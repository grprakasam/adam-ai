"""
Integration Tests for Code Generation Workflow
Tests the complete flow from request to code generation
"""

import pytest
import asyncio
from unittest.mock import Mock, patch, AsyncMock
from fastapi.testclient import TestClient
from app.main import app
from app.models.input_models import CodeSnippetRequest, Standards
from app.modules.code_generator.service import CodeGeneratorService


client = TestClient(app)


@pytest.fixture
def mock_llm_service():
    """Mock LLM service to avoid actual API calls"""
    with patch('app.modules.code_generator.service.get_llm_service') as mock:
        llm_service = AsyncMock()
        llm_service.generate_completion.return_value = """
# ADAM ADSL AGE Derivation
adsl <- adsl %>%
  mutate(
    AGE = floor(as.numeric(difftime(RFSTDTC, BRTHDTC, units = "days")) / 365.25)
  )
"""
        mock.return_value = llm_service
        yield llm_service


@pytest.fixture
def sample_code_snippet_request():
    """Sample request payload for code generation"""
    return {
        "study_id": "TEST001",
        "dataset": "ADSL",
        "variable": "AGE",
        "derivation": "Age in years at reference start date",
        "spec_row": {
            "Variable": "AGE",
            "Label": "Age",
            "Type": "Num",
            "Length": "8",
            "Format": "",
            "Source/Derivation": "Derived from RFSTDTC and BRTHDTC"
        },
        "standards": {
            "sdtm_version": "3.4",
            "adam_ig_version": "1.3",
            "meddra_version": "26.0"
        },
        "language": "R",
        "context": {
            "available_sdtm_domains": ["DM", "EX", "AE"],
            "required_variables": ["AGE"],
            "category": "Demographics"
        }
    }


@pytest.fixture
def auth_headers():
    """Authentication headers for API requests"""
    # Create a test token
    from app.core.auth import create_access_token
    token = create_access_token(data={"sub": "test_user", "role": "user"})
    return {"Authorization": f"Bearer {token}"}


class TestCodeGenerationEndpoint:
    """Test code generation API endpoint"""
    
    def test_generate_code_snippet_success(
        self, 
        sample_code_snippet_request, 
        auth_headers,
        mock_llm_service
    ):
        """Test successful code generation"""
        response = client.post(
            "/api/v1/code-generation/generate-code-snippet",
            json=sample_code_snippet_request,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["variable"] == "AGE"
        assert data["code_snippet"]
        assert data["coding_rationale"]
        assert data["language"] == "R"
        assert "metadata" in data
    
    def test_generate_code_with_user_note(
        self, 
        sample_code_snippet_request, 
        auth_headers,
        mock_llm_service
    ):
        """Test code generation with user notes"""
        sample_code_snippet_request["user_note"] = "Use floor() function instead of round()"
        
        response = client.post(
            "/api/v1/code-generation/generate-code-snippet",
            json=sample_code_snippet_request,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify user note was processed
        assert data["metadata"].get("user_note_applied") is True
        assert data["metadata"].get("user_note_summary")
    
    def test_generate_code_invalid_language(
        self, 
        sample_code_snippet_request, 
        auth_headers
    ):
        """Test validation for invalid language"""
        sample_code_snippet_request["language"] = "Python"  # Invalid
        
        response = client.post(
            "/api/v1/code-generation/generate-code-snippet",
            json=sample_code_snippet_request,
            headers=auth_headers
        )
        
        assert response.status_code == 400
        assert "invalid" in response.json()["detail"].lower()
    
    def test_generate_code_missing_study_id(
        self, 
        sample_code_snippet_request, 
        auth_headers
    ):
        """Test validation for missing required fields"""
        del sample_code_snippet_request["study_id"]
        
        response = client.post(
            "/api/v1/code-generation/generate-code-snippet",
            json=sample_code_snippet_request,
            headers=auth_headers
        )
        
        assert response.status_code == 422  # Validation error
    
    def test_generate_code_unauthorized(self, sample_code_snippet_request):
        """Test authentication requirement"""
        response = client.post(
            "/api/v1/code-generation/generate-code-snippet",
            json=sample_code_snippet_request
        )
        
        assert response.status_code == 401


class TestBulkCodeGeneration:
    """Test bulk code generation endpoint"""
    
    @pytest.fixture
    def bulk_request_payload(self):
        """Sample bulk generation request"""
        return {
            "study_id": "TEST001",
            "dataset": "ADSL",
            "categorized_variables": {
                "categories": [
                    {
                        "name": "Demographics",
                        "variables": [
                            {
                                "name": "AGE",
                                "label": "Age",
                                "type": "Num",
                                "derivation": "Age in years",
                                "is_required": True,
                                "category": "Demographics"
                            },
                            {
                                "name": "SEX",
                                "label": "Sex",
                                "type": "Char",
                                "derivation": "Sex from DM",
                                "is_required": True,
                                "category": "Demographics"
                            }
                        ]
                    }
                ],
                "total_variables": 2
            },
            "language": "R",
            "standards": {
                "sdtm_version": "3.4",
                "adam_ig_version": "1.3",
                "meddra_version": "26.0"
            }
        }
    
    def test_bulk_generation_success(
        self, 
        bulk_request_payload, 
        auth_headers,
        mock_llm_service
    ):
        """Test successful bulk code generation"""
        response = client.post(
            "/api/v1/code-generation/generate-code-bulk",
            json=bulk_request_payload,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        assert len(data) == 2  # AGE and SEX
        
        for snippet in data:
            assert snippet["variable"] in ["AGE", "SEX"]
            assert snippet["code_snippet"]
            assert snippet["coding_rationale"]


class TestCodeGeneratorService:
    """Test CodeGeneratorService class"""
    
    @pytest.mark.asyncio
    async def test_generate_code_snippet_with_cache(self, mock_llm_service):
        """Test caching mechanism"""
        service = CodeGeneratorService()
        
        # First call - should hit LLM
        result1 = await service.generate_code_snippet(
            study_id="TEST001",
            dataset="ADSL",
            variable="AGE",
            derivation="Age in years",
            spec_row={"Variable": "AGE", "Label": "Age"},
            standards=Standards(
                sdtm_version="3.4",
                adam_ig_version="1.3",
                meddra_version="26.0"
            ),
            language="R",
            context={}
        )
        
        assert mock_llm_service.generate_completion.call_count == 1
        
        # Second call - should use cache
        result2 = await service.generate_code_snippet(
            study_id="TEST001",
            dataset="ADSL",
            variable="AGE",
            derivation="Age in years",
            spec_row={"Variable": "AGE", "Label": "Age"},
            standards=Standards(
                sdtm_version="3.4",
                adam_ig_version="1.3",
                meddra_version="26.0"
            ),
            language="R",
            context={}
        )
        
        # Should still be 1 call (cache hit)
        assert mock_llm_service.generate_completion.call_count == 1
        
        # Results should be identical
        assert result1.code_snippet == result2.code_snippet
    
    @pytest.mark.asyncio
    async def test_clean_generated_code(self):
        """Test code cleaning function"""
        from app.modules.code_generator.service import clean_generated_code
        
        messy_code = """
library(dplyr)
library(tidyr)

# Example usage:
# This is test code

# Derivation of AGE
adsl <- adsl %>%
  mutate(AGE = floor(age_years))

# Example:
print(head(adsl))
"""
        
        cleaned = clean_generated_code(messy_code, "R")
        
        # Should remove library statements
        assert "library(dplyr)" not in cleaned
        
        # Should remove example sections
        assert "Example usage:" not in cleaned
        assert "print(head(adsl))" not in cleaned
        
        # Should keep derivation logic
        assert "mutate(AGE = floor(age_years))" in cleaned
    
    @pytest.mark.asyncio
    async def test_error_handling(self, mock_llm_service):
        """Test error handling in service"""
        service = CodeGeneratorService()
        
        # Make LLM service fail
        mock_llm_service.generate_completion.side_effect = Exception("LLM API Error")
        
        result = await service.generate_code_snippet(
            study_id="TEST001",
            dataset="ADSL",
            variable="AGE",
            derivation="Age in years",
            spec_row={"Variable": "AGE"},
            standards=Standards(
                sdtm_version="3.4",
                adam_ig_version="1.3",
                meddra_version="26.0"
            ),
            language="R",
            context={}
        )
        
        # Should return error snippet instead of crashing
        assert result.error is not None
        assert "LLM API Error" in result.error


class TestCacheManager:
    """Test cache functionality"""
    
    def test_cache_set_and_get(self):
        """Test basic cache operations"""
        from app.core.cache import get_cache
        
        cache = get_cache()
        cache.clear()  # Start fresh
        
        # Set value
        cache.set("test_key", {"data": "test_value"}, ttl=60)
        
        # Get value
        result = cache.get("test_key")
        assert result == {"data": "test_value"}
    
    def test_cache_expiration(self):
        """Test cache TTL expiration"""
        import time
        from app.core.cache import get_cache
        
        cache = get_cache()
        cache.clear()
        
        # Set with 1-second TTL
        cache.set("short_lived", "data", ttl=1)
        
        # Should exist immediately
        assert cache.get("short_lived") == "data"
        
        # Wait for expiration
        time.sleep(2)
        
        # Should be expired
        assert cache.get("short_lived") is None
    
    def test_cache_stats(self):
        """Test cache statistics tracking"""
        from app.core.cache import get_cache
        
        cache = get_cache()
        cache.clear()
        
        # Generate some cache activity
        cache.set("key1", "value1")
        cache.get("key1")  # Hit
        cache.get("key2")  # Miss
        
        stats = cache.get_stats()
        
        assert stats["size"] >= 1
        assert stats["hits"] >= 1
        assert stats["misses"] >= 1
        assert stats["hit_rate"] > 0


class TestValidationEndpoint:
    """Test code validation endpoints"""
    
    def test_validate_r_code(self, auth_headers):
        """Test R code validation"""
        valid_code = """
adsl <- dm %>%
  mutate(AGE = floor(age_years))
"""
        
        response = client.post(
            "/api/v1/validation/validate",
            json={
                "code": valid_code,
                "language": "R",
                "check_style": True
            },
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "isValid" in data
        assert "issues" in data
        assert data["language"] == "R"
    
    def test_validate_sas_code(self, auth_headers):
        """Test SAS code validation"""
        sas_code = """
data adsl;
    set dm;
    age = floor(age_years);
run;
"""
        
        response = client.post(
            "/api/v1/validation/validate",
            json={
                "code": sas_code,
                "language": "SAS",
                "check_style": True
            },
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "isValid" in data
        assert data["language"] == "SAS"


class TestAuthenticationFlow:
    """Test authentication and authorization"""
    
    def test_login_success(self):
        """Test successful login"""
        response = client.post(
            "/api/v1/auth/login",
            data={
                "username": "admin",
                "password": "admin"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "access_token" in data
        assert "token_type" in data
        assert data["token_type"] == "bearer"
        assert "user" in data
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = client.post(
            "/api/v1/auth/login",
            data={
                "username": "invalid",
                "password": "wrong"
            }
        )
        
        assert response.status_code == 401
    
    def test_protected_endpoint_no_token(self):
        """Test accessing protected endpoint without token"""
        response = client.get("/api/v1/auth/me")
        
        assert response.status_code == 401
    
    def test_protected_endpoint_with_token(self, auth_headers):
        """Test accessing protected endpoint with valid token"""
        response = client.get(
            "/api/v1/auth/me",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "username" in data
        assert "role" in data


@pytest.mark.asyncio
class TestConcurrentGeneration:
    """Test concurrent code generation"""
    
    async def test_batch_processing(self, mock_llm_service):
        """Test batch processor handles concurrent requests"""
        from app.core.batch import get_batch_processor, BatchItem, BatchStatus
        import uuid
        
        processor = get_batch_processor(max_concurrent=3)
        
        # Create test items
        items = [
            BatchItem(
                id=str(uuid.uuid4()),
                variable=f"VAR{i}",
                status=BatchStatus.PENDING
            )
            for i in range(10)
        ]
        
        async def mock_processor(item):
            await asyncio.sleep(0.1)  # Simulate work
            return {"result": f"Code for {item.variable}"}
        
        job_id = str(uuid.uuid4())
        job = await processor.process_batch(
            job_id=job_id,
            items=items,
            processor_func=mock_processor
        )
        
        assert job.status == BatchStatus.COMPLETED
        assert len(job.items) == 10
        
        # All items should be completed
        completed = [i for i in job.items if i.status == BatchStatus.COMPLETED]
        assert len(completed) == 10


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--cov=app", "--cov-report=html"])
