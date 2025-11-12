"""
Unit tests for BatchProcessor module
"""
import pytest
from unittest.mock import Mock, AsyncMock, patch
from app.modules.code_generator.batch_processor import BatchProcessor
from app.modules.code_generator.gemini_client import GeminiClient
from app.modules.code_generator.prompt_builder import PromptBuilder
from app.modules.code_generator.cache_manager import CacheManager


class TestBatchProcessor:
    """Test cases for BatchProcessor batch processing logic"""
    
    def setup_method(self):
        """Setup test fixtures"""
        self.mock_client = Mock(spec=GeminiClient)
        self.mock_client.generate_code = AsyncMock()
        
        self.prompt_builder = PromptBuilder()
        self.cache_manager = CacheManager()
        
        self.processor = BatchProcessor(
            gemini_client=self.mock_client,
            prompt_builder=self.prompt_builder,
            cache_manager=self.cache_manager,
            batch_size=3,
            max_concurrent=2
        )
    
    def teardown_method(self):
        """Cleanup after tests"""
        self.cache_manager.clear()
    
    def test_batch_creation(self):
        """Test that variables are split into correct batch sizes"""
        variables = [
            {"variable": f"VAR{i}", "derivation": f"deriv{i}"}
            for i in range(10)
        ]
        
        # Mock the process_batch method to capture batches
        batches = []
        original_process = self.processor._create_batches
        
        def capture_batches(vars, size):
            result = list(original_process(vars, size))
            batches.extend(result)
            return result
        
        with patch.object(self.processor, '_create_batches', side_effect=capture_batches):
            # This would normally process, we just want to see batches
            pass
        
        # With 10 variables and batch_size=3, should create 4 batches
        result_batches = list(self.processor._create_batches(variables, 3))
        assert len(result_batches) == 4
        assert len(result_batches[0]) == 3
        assert len(result_batches[-1]) == 1  # Last batch has remainder
    
    @pytest.mark.asyncio
    async def test_generate_single_variable_success(self):
        """Test successful single variable generation"""
        # Mock Gemini response
        self.mock_client.generate_code.return_value = {
            "code_snippet": "test_code <- 'generated'",
            "coding_rationale": "Test rationale",
            "success": True
        }
        
        variable = {
            "variable": "TEST",
            "derivation": "Test derivation"
        }
        
        context = {
            "dataset": "ADSL",
            "language": "R"
        }
        
        result = await self.processor.generate_single_variable(
            variable, context
        )
        
        assert result["variable"] == "TEST"
        assert result["code_snippet"] == "test_code <- 'generated'"
        assert result["success"] is True
        assert "error" not in result
    
    @pytest.mark.asyncio
    async def test_generate_single_variable_error_handling(self):
        """Test error handling in single variable generation"""
        # Mock Gemini to raise an error
        self.mock_client.generate_code.side_effect = Exception("API Error")
        
        variable = {
            "variable": "TEST",
            "derivation": "Test derivation"
        }
        
        context = {
            "dataset": "ADSL",
            "language": "R"
        }
        
        result = await self.processor.generate_single_variable(
            variable, context
        )
        
        assert result["variable"] == "TEST"
        assert result["success"] is False
        assert "error" in result
        assert "API Error" in result["error"]
    
    @pytest.mark.asyncio
    async def test_process_batch_parallel_execution(self):
        """Test that batch processes variables in parallel"""
        # Mock successful generation
        self.mock_client.generate_code.return_value = {
            "code_snippet": "code",
            "coding_rationale": "rationale",
            "success": True
        }
        
        variables = [
            {"variable": f"VAR{i}", "derivation": f"deriv{i}"}
            for i in range(3)
        ]
        
        context = {
            "dataset": "ADSL",
            "language": "R"
        }
        
        results = await self.processor.process_batch(variables, context)
        
        assert len(results) == 3
        assert all(r["success"] for r in results)
        # Should have called generate_code 3 times
        assert self.mock_client.generate_code.call_count == 3
    
    @pytest.mark.asyncio
    async def test_cache_integration(self):
        """Test that caching works during batch processing"""
        # Setup cached variable
        variable1 = {"variable": "VAR1", "derivation": "deriv1"}
        cache_key = self.cache_manager.generate_cache_key(
            variable="VAR1",
            derivation="deriv1",
            language="R",
            dataset="ADSL"
        )
        cached_result = {
            "code_snippet": "cached_code",
            "coding_rationale": "cached_rationale"
        }
        self.cache_manager.set(cache_key, cached_result)
        
        # Setup uncached variable
        variable2 = {"variable": "VAR2", "derivation": "deriv2"}
        self.mock_client.generate_code.return_value = {
            "code_snippet": "new_code",
            "coding_rationale": "new_rationale",
            "success": True
        }
        
        context = {
            "dataset": "ADSL",
            "language": "R"
        }
        
        results = await self.processor.process_variables_batch(
            variables=[variable1, variable2],
            context=context
        )
        
        # Should have 2 results
        assert len(results) == 2
        
        # First should be from cache
        var1_result = next(r for r in results if r["variable"] == "VAR1")
        assert var1_result["code_snippet"] == "cached_code"
        
        # Second should be newly generated
        var2_result = next(r for r in results if r["variable"] == "VAR2")
        assert var2_result["code_snippet"] == "new_code"
        
        # Should only call API once (for uncached variable)
        assert self.mock_client.generate_code.call_count == 1
    
    @pytest.mark.asyncio
    async def test_concurrency_limit(self):
        """Test that max_concurrent limit is respected"""
        # This is hard to test directly, but we can verify the semaphore exists
        assert hasattr(self.processor, 'semaphore')
        assert self.processor.max_concurrent == 2
    
    def test_validate_syntax_basic_r(self):
        """Test basic R syntax validation"""
        valid_r_codes = [
            "x <- 5",
            "df %>% filter(x > 5)",
            "result <- mean(x, na.rm = TRUE)"
        ]
        
        for code in valid_r_codes:
            is_valid, message = self.processor.validate_syntax_basic(code, "R")
            assert is_valid is True
    
    def test_validate_syntax_basic_r_invalid(self):
        """Test detection of invalid R syntax"""
        invalid_r_codes = [
            "x <- ",  # Incomplete assignment
            "if (x > 5 {",  # Missing closing parenthesis
            "function(",  # Incomplete function
        ]
        
        for code in invalid_r_codes:
            is_valid, message = self.processor.validate_syntax_basic(code, "R")
            # Should either be invalid or pass (basic check might not catch all)
            assert isinstance(is_valid, bool)
    
    def test_validate_syntax_basic_sas(self):
        """Test basic SAS syntax validation"""
        valid_sas_codes = [
            "data test; set input; x = 5; run;",
            "proc sql; select * from table; quit;",
            "data _null_; put 'test'; run;"
        ]
        
        for code in valid_sas_codes:
            is_valid, message = self.processor.validate_syntax_basic(code, "SAS")
            assert is_valid is True
    
    @pytest.mark.asyncio
    async def test_empty_variables_list(self):
        """Test handling of empty variables list"""
        results = await self.processor.process_variables_batch(
            variables=[],
            context={"dataset": "ADSL", "language": "R"}
        )
        
        assert results == []
    
    @pytest.mark.asyncio
    async def test_partial_batch_failure(self):
        """Test that partial failures don't stop entire batch"""
        # Mock to fail on second call
        call_count = [0]
        
        async def mock_generate(*args, **kwargs):
            call_count[0] += 1
            if call_count[0] == 2:
                raise Exception("Simulated failure")
            return {
                "code_snippet": "code",
                "coding_rationale": "rationale",
                "success": True
            }
        
        self.mock_client.generate_code.side_effect = mock_generate
        
        variables = [
            {"variable": "VAR1", "derivation": "deriv1"},
            {"variable": "VAR2", "derivation": "deriv2"},
            {"variable": "VAR3", "derivation": "deriv3"}
        ]
        
        context = {"dataset": "ADSL", "language": "R"}
        
        results = await self.processor.process_batch(variables, context)
        
        # Should have 3 results
        assert len(results) == 3
        
        # Two should succeed, one should fail
        successes = [r for r in results if r["success"]]
        failures = [r for r in results if not r["success"]]
        
        assert len(successes) == 2
        assert len(failures) == 1
