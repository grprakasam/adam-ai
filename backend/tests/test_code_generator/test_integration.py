"""
Integration tests for code_generator module
Tests the full flow from request to response
"""
import pytest
from unittest.mock import Mock, AsyncMock, patch
from app.modules.code_generator.service import CodeGeneratorService, get_code_generator_service
from app.modules.code_generator.gemini_client import GeminiClient


class TestCodeGeneratorIntegration:
    """Integration tests for full code generation flow"""
    
    @pytest.mark.asyncio
    async def test_full_generation_flow_with_mocked_api(self):
        """Test complete flow from categorization to code generation"""
        # Mock Gemini client
        with patch('app.modules.code_generator.service.GeminiClient') as MockClient:
            mock_instance = Mock(spec=GeminiClient)
            mock_instance.generate_code = AsyncMock(return_value={
                "code_snippet": "adsl$AGEGR1 <- ifelse(adsl$AGE < 65, '<65', '>=65')",
                "coding_rationale": "Categorize age into two groups based on threshold",
                "success": True
            })
            MockClient.return_value = mock_instance
            
            # Create service
            service = CodeGeneratorService()
            
            # Sample categorization result
            categorization_result = {
                "demographic_variables": [
                    {
                        "variable": "AGEGR1",
                        "label": "Age Group 1",
                        "derivation": "Categorize AGE: <65 vs >=65",
                        "type": "text"
                    }
                ],
                "efficacy_variables": [
                    {
                        "variable": "CHG",
                        "label": "Change from Baseline",
                        "derivation": "AVAL - BASE",
                        "type": "numeric"
                    }
                ]
            }
            
            context = {
                "dataset": "ADSL",
                "language": "R",
                "standards": {
                    "sdtm_version": "3.4",
                    "adam_ig_version": "1.3"
                },
                "available_sdtm_domains": ["DM", "VS"],
                "study_id": "TEST001"
            }
            
            # Generate code for all variables
            results = await service.generate_code_for_all_variables(
                categorization_result=categorization_result,
                dataset="ADSL",
                language="R",
                context=context
            )
            
            # Should have 2 results (one from each category)
            assert len(results) == 2
            
            # Check first result
            agegr1_result = next(r for r in results if r["variable"] == "AGEGR1")
            assert agegr1_result["success"] is True
            assert "AGEGR1" in agegr1_result["code_snippet"] or "adsl" in agegr1_result["code_snippet"].lower()
            assert len(agegr1_result["coding_rationale"]) > 0
            
            # Check second result
            chg_result = next(r for r in results if r["variable"] == "CHG")
            assert chg_result["success"] is True
    
    @pytest.mark.asyncio
    async def test_single_variable_generation_with_mock(self):
        """Test generating code for a single variable"""
        with patch('app.modules.code_generator.service.GeminiClient') as MockClient:
            mock_instance = Mock(spec=GeminiClient)
            mock_instance.generate_code = AsyncMock(return_value={
                "code_snippet": "test_code",
                "coding_rationale": "test_rationale",
                "success": True
            })
            MockClient.return_value = mock_instance
            
            service = CodeGeneratorService()
            
            result = await service.generate_single_variable(
                variable="TEST",
                derivation="Test derivation",
                language="R",
                dataset="ADSL",
                context={
                    "spec_row": {"Label": "Test", "Type": "text"},
                    "standards": {"sdtm_version": "3.4"}
                }
            )
            
            assert result["variable"] == "TEST"
            assert result["success"] is True
            assert result["code_snippet"] == "test_code"
    
    @pytest.mark.asyncio
    async def test_caching_across_multiple_requests(self):
        """Test that caching works across multiple generation requests"""
        with patch('app.modules.code_generator.service.GeminiClient') as MockClient:
            mock_instance = Mock(spec=GeminiClient)
            
            call_count = [0]
            async def track_calls(*args, **kwargs):
                call_count[0] += 1
                return {
                    "code_snippet": f"code_{call_count[0]}",
                    "coding_rationale": "rationale",
                    "success": True
                }
            
            mock_instance.generate_code = AsyncMock(side_effect=track_calls)
            MockClient.return_value = mock_instance
            
            service = CodeGeneratorService()
            
            # First request
            result1 = await service.generate_single_variable(
                variable="TEST",
                derivation="Same derivation",
                language="R",
                dataset="ADSL",
                context={}
            )
            
            # Second request with same parameters
            result2 = await service.generate_single_variable(
                variable="TEST",
                derivation="Same derivation",
                language="R",
                dataset="ADSL",
                context={}
            )
            
            # Should have same code (from cache)
            assert result1["code_snippet"] == result2["code_snippet"]
            
            # Should only call API once
            assert call_count[0] == 1
    
    @pytest.mark.asyncio
    async def test_collect_all_variables(self):
        """Test variable collection from categorization result"""
        service = get_code_generator_service()
        
        categorization_result = {
            "demographic_variables": [
                {"variable": "AGE", "derivation": "deriv1"},
                {"variable": "SEX", "derivation": "deriv2"}
            ],
            "efficacy_variables": [
                {"variable": "AVAL", "derivation": "deriv3"}
            ],
            "safety_variables": [
                {"variable": "SAFFL", "derivation": "deriv4"}
            ]
        }
        
        all_vars = service.collect_all_variables(categorization_result)
        
        assert len(all_vars) == 4
        variables = [v["variable"] for v in all_vars]
        assert "AGE" in variables
        assert "SEX" in variables
        assert "AVAL" in variables
        assert "SAFFL" in variables
    
    def test_build_generation_context(self):
        """Test context building for code generation"""
        service = get_code_generator_service()
        
        base_context = {
            "dataset": "ADSL",
            "standards": {"sdtm_version": "3.4"},
            "available_sdtm_domains": ["DM", "VS"]
        }
        
        variable = {
            "variable": "AGEGR1",
            "derivation": "Test",
            "label": "Age Group",
            "type": "text"
        }
        
        context = service.build_generation_context(base_context, variable)
        
        assert context["dataset"] == "ADSL"
        assert context["variable"] == "AGEGR1"
        assert context["derivation"] == "Test"
        assert "spec_row" in context
        assert context["spec_row"]["Variable"] == "AGEGR1"
    
    @pytest.mark.asyncio
    async def test_error_handling_api_failure(self):
        """Test graceful handling of API failures"""
        with patch('app.modules.code_generator.service.GeminiClient') as MockClient:
            mock_instance = Mock(spec=GeminiClient)
            mock_instance.generate_code = AsyncMock(
                side_effect=Exception("API connection failed")
            )
            MockClient.return_value = mock_instance
            
            service = CodeGeneratorService()
            
            result = await service.generate_single_variable(
                variable="TEST",
                derivation="Test",
                language="R",
                dataset="ADSL",
                context={}
            )
            
            # Should return error result, not raise exception
            assert result["success"] is False
            assert "error" in result
            assert "API connection failed" in result["error"]
    
    @pytest.mark.asyncio
    async def test_multiple_languages(self):
        """Test code generation for different languages"""
        with patch('app.modules.code_generator.service.GeminiClient') as MockClient:
            mock_instance = Mock(spec=GeminiClient)
            
            async def language_specific_response(prompt, **kwargs):
                if "SAS" in prompt:
                    return {
                        "code_snippet": "data test; x = 5; run;",
                        "coding_rationale": "SAS code",
                        "success": True
                    }
                else:
                    return {
                        "code_snippet": "x <- 5",
                        "coding_rationale": "R code",
                        "success": True
                    }
            
            mock_instance.generate_code = AsyncMock(side_effect=language_specific_response)
            MockClient.return_value = mock_instance
            
            service = CodeGeneratorService()
            
            # Generate R code
            r_result = await service.generate_single_variable(
                variable="TEST",
                derivation="Set x to 5",
                language="R",
                dataset="ADSL",
                context={}
            )
            
            # Generate SAS code
            sas_result = await service.generate_single_variable(
                variable="TEST",
                derivation="Set x to 5",
                language="SAS",
                dataset="ADSL",
                context={}
            )
            
            # Should have different code for different languages
            assert r_result["code_snippet"] != sas_result["code_snippet"]
            assert "<-" in r_result["code_snippet"] or "R" in r_result["coding_rationale"]
            assert "data" in sas_result["code_snippet"].lower() or "SAS" in sas_result["coding_rationale"]
    
    def test_singleton_pattern(self):
        """Test that get_code_generator_service returns singleton"""
        service1 = get_code_generator_service()
        service2 = get_code_generator_service()
        
        # Should be same instance
        assert service1 is service2
    
    @pytest.mark.asyncio
    async def test_batch_processing_large_dataset(self):
        """Test batch processing with many variables"""
        with patch('app.modules.code_generator.service.GeminiClient') as MockClient:
            mock_instance = Mock(spec=GeminiClient)
            mock_instance.generate_code = AsyncMock(return_value={
                "code_snippet": "code",
                "coding_rationale": "rationale",
                "success": True
            })
            MockClient.return_value = mock_instance
            
            service = CodeGeneratorService()
            
            # Create large categorization result
            categorization_result = {
                "demographic_variables": [
                    {"variable": f"VAR{i}", "derivation": f"deriv{i}"}
                    for i in range(25)
                ]
            }
            
            results = await service.generate_code_for_all_variables(
                categorization_result=categorization_result,
                dataset="ADSL",
                language="R",
                context={}
            )
            
            # Should process all 25 variables
            assert len(results) == 25
            assert all(r["success"] for r in results)
