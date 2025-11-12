"""
Simplified integration tests for code_generator module
Tests the main functionality without accessing private methods
"""
import pytest
import asyncio
from unittest.mock import Mock, AsyncMock, patch
from app.modules.code_generator.prompt_builder import PromptBuilder, TemplateSelector
from app.modules.code_generator.cache_manager import CacheManager
from app.modules.code_generator.service import CodeGeneratorService, get_code_generator_service


class TestTemplateSelector:
    """Test template selection logic"""
    
    def test_select_template_conditional_flag(self):
        """Test conditional flag pattern detection"""
        selector = TemplateSelector()
        template = selector.select_template("If AGE >= 65 then 'Y' else 'N'", "R")
        assert template == "conditional_flag"
    
    def test_select_template_baseline_flag(self):
        """Test baseline flag detection"""
        selector = TemplateSelector()
        template = selector.select_template("Flag baseline visit", "R")
        assert template == "baseline_flag"
    
    def test_select_template_date_conversion(self):
        """Test date conversion detection"""
        selector = TemplateSelector()
        template = selector.select_template("Convert RFSTDTC to date", "R")
        assert template == "date_conversion"
    
    def test_select_template_merge(self):
        """Test merge pattern detection"""
        selector = TemplateSelector()
        template = selector.select_template("Merge ADSL with VS by USUBJID", "R")
        assert template == "merge_datasets"


class TestPromptBuilder:
    """Test prompt construction"""
    
    def test_create_prompt_builder(self):
        """Test prompt builder creation"""
        builder = PromptBuilder()
        assert builder is not None
        assert hasattr(builder, 'template_selector')
    
    def test_build_code_prompt(self):
        """Test code generation prompt building"""
        builder = PromptBuilder()
        
        prompt = builder.build_code_generation_prompt(
            variable_name="AGEGR1",
            derivation="Categorize AGE into <65 and >=65",
            language="R",
            adam_dataset="ADSL",
            variable_type="text",
            variable_label="Age Group 1",
            sdtm_domains=["DM", "VS"],
            cdisc_standards={"sdtm_version": "3.4"}
        )
        
        assert prompt is not None
        assert "AGEGR1" in prompt
        assert "AGE" in prompt or "age" in prompt.lower()
        assert "R" in prompt or "code" in prompt.lower()


class TestCacheManager:
    """Test caching functionality"""
    
    def test_cache_key_generation(self):
        """Test cache key creation"""
        cache = CacheManager()
        key = cache.generate_cache_key(
            variable_name="TEST",
            derivation="Test deriv",
            language="R",
            adam_dataset="ADSL",
            variable_type="text"
        )
        assert isinstance(key, str)
        assert len(key) == 32  # MD5 hash length
    
    def test_cache_set_and_get(self):
        """Test basic caching"""
        cache = CacheManager()
        key = "test_key"
        data = {"code": "test", "rationale": "test"}
        
        cache.set(key, data)
        result = cache.get(key)
        
        assert result == data
    
    def test_cache_miss(self):
        """Test cache miss"""
        cache = CacheManager()
        result = cache.get("nonexistent")
        assert result is None
    
    def test_cache_clear(self):
        """Test cache clearing"""
        cache = CacheManager()
        cache.set("key1", {"data": "1"})
        cache.clear()
        assert cache.get("key1") is None


class TestCodeGeneratorService:
    """Test code generator service"""
    
    def test_singleton_pattern(self):
        """Test that service is a singleton"""
        service1 = get_code_generator_service()
        service2 = get_code_generator_service()
        assert service1 is service2
    
    def test_collect_all_variables(self):
        """Test variable collection"""
        service = get_code_generator_service()
        
        categorization = {
            "demographic_variables": [
                {"variable": "AGE", "derivation": "test1"},
                {"variable": "SEX", "derivation": "test2"}
            ],
            "efficacy_variables": [
                {"variable": "AVAL", "derivation": "test3"}
            ]
        }
        
        variables = service.collect_all_variables(categorization)
        assert len(variables) == 3
        var_names = [v["variable"] for v in variables]
        assert "AGE" in var_names
        assert "SEX" in var_names
        assert "AVAL" in var_names


@pytest.mark.asyncio
class TestIntegrationWithMocks:
    """Integration tests with mocked API"""
    
    async def test_single_variable_generation(self):
        """Test generating code for single variable"""
        with patch('app.modules.code_generator.gemini_client.GeminiClient') as MockClient:
            mock_instance = Mock()
            mock_instance.generate_code = AsyncMock(return_value={
                "code_snippet": "test <- 'code'",
                "coding_rationale": "Test rationale"
            })
            MockClient.return_value = mock_instance
            
            service = CodeGeneratorService()
            
            result = await service.generate_single_variable(
                variable_name="TEST",
                derivation="Test derivation",
                language="R",
                adam_dataset="ADSL",
                variable_type="text",
                variable_label="Test Variable",
                sdtm_domains=["DM"],
                cdisc_standards={"sdtm_version": "3.4"}
            )
            
            assert result is not None
            assert result["variable"] == "TEST"
    
    async def test_bulk_generation(self):
        """Test bulk code generation"""
        with patch('app.modules.code_generator.gemini_client.GeminiClient') as MockClient:
            mock_instance = Mock()
            mock_instance.generate_code = AsyncMock(return_value={
                "code_snippet": "code",
                "coding_rationale": "rationale"
            })
            MockClient.return_value = mock_instance
            
            service = CodeGeneratorService()
            
            categorization = {
                "demographic_variables": [
                    {
                        "variable": "AGE",
                        "label": "Age",
                        "derivation": "From DM.AGE",
                        "type": "numeric"
                    }
                ]
            }
            
            results = await service.generate_code_for_all_variables(
                categorization_result=categorization,
                adam_dataset="ADSL",
                language="R",
                sdtm_domains=["DM"],
                cdisc_standards={"sdtm_version": "3.4"}
            )
            
            assert len(results) == 1
            assert results[0]["variable"] == "AGE"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
