"""
Comprehensive tests for pseudo-code generation functionality.

Tests cover:
- JSON response parsing with pseudo-code extraction
- Pseudo-code quality and format validation
- Graceful fallback when pseudo-code generation fails
- Integration with CodeGeneratorService
"""

import pytest
import json
from unittest.mock import AsyncMock, patch, MagicMock
from app.modules.code_generator.service import CodeGeneratorService
from app.modules.code_generator.prompt_builder import PromptBuilder


class TestPseudoCodePromptGeneration:
    """Test pseudo-code prompt design and guidance"""

    def setup_method(self):
        """Initialize test fixtures"""
        self.builder = PromptBuilder()
        self.sample_context = {
            "study_id": "STUDY001",
            "adam_dataset": "ADSL",
            "programming_language": "R",
            "sdtm_version": "3.4",
            "adam_ig_version": "1.3",
            "sdtm_domains": ["DM", "VS", "LB"]
        }

    @pytest.mark.asyncio
    async def test_pseudo_code_prompt_includes_guidance(self):
        """Verify pseudo-code prompt includes explicit domain expert guidance"""
        prompt = await self.builder.build_code_generation_prompt(
            variable_name="AGEGR1",
            variable_label="Age Group 1",
            variable_type="Char",
            derivation_logic="Categorize AGE into groups: <65, 65-80, >80",
            language="R",
            context=self.sample_context
        )

        # Check for key pseudo-code guidance
        assert "pseudo" in prompt.lower() or "plain english" in prompt.lower()
        assert "if/then/else" in prompt.lower() or "IF/THEN/ELSE" in prompt
        assert "JSON" in prompt
        assert "pseudo_code" in prompt
        assert "code_snippet" in prompt
        assert "pseudo_summary" in prompt

    @pytest.mark.asyncio
    async def test_pseudo_code_prompt_language_specific(self):
        """Test pseudo-code prompt is language-specific"""
        r_prompt = await self.builder.build_code_generation_prompt(
            variable_name="TEST",
            variable_label="Test Variable",
            variable_type="Num",
            derivation_logic="Test derivation",
            language="R",
            context=self.sample_context
        )

        sas_prompt = await self.builder.build_code_generation_prompt(
            variable_name="TEST",
            variable_label="Test Variable",
            variable_type="Num",
            derivation_logic="Test derivation",
            language="SAS",
            context=self.sample_context.copy()
        )

        # Verify language-specific prompts
        assert "R" in r_prompt
        assert "SAS" in sas_prompt
        assert r_prompt != sas_prompt

    @pytest.mark.asyncio
    async def test_pseudo_code_prompt_with_user_note(self):
        """Test pseudo-code prompt includes user intent/notes"""
        user_note = "Please focus on handling missing values correctly"

        prompt = await self.builder.build_code_generation_prompt(
            variable_name="AGECAT",
            variable_label="Age Category",
            variable_type="Char",
            derivation_logic="Categorize AGE",
            language="R",
            context=self.sample_context,
            user_note=user_note
        )

        # Should include user intent section
        assert "User Intent" in prompt or "user" in prompt.lower()
        assert "missing" in prompt.lower()


class TestJSONResponseParsing:
    """Test JSON response parsing for pseudo-code extraction"""

    def setup_method(self):
        """Initialize code generator service"""
        self.service = CodeGeneratorService()

    def test_parse_valid_json_response(self):
        """Test parsing valid JSON response with pseudo-code"""
        json_response = {
            "code_snippet": "ADSL$AGEGR1 <- cut(ADSL$AGE, breaks=c(0, 65, 80, Inf), labels=c('<65', '65-80', '>80'))",
            "pseudo_code": "IF AGE < 65 THEN AGEGR1 = '<65'\nELSE IF AGE <= 80 THEN AGEGR1 = '65-80'\nELSE AGEGR1 = '>80'",
            "pseudo_summary": "Categorize age into three groups based on clinical cutoffs"
        }

        raw_response = json.dumps(json_response)
        code, pseudo, summary = self.service._parse_json_response(
            raw_response=raw_response,
            language="R",
            variable_name="AGEGR1"
        )

        assert "AGEGR1" in code
        assert pseudo is not None
        assert "IF" in pseudo.upper()
        assert "65" in pseudo
        assert summary is not None
        assert "categorize" in summary.lower() or "age" in summary.lower()

    def test_parse_json_with_markdown_code_blocks(self):
        """Test parsing JSON response wrapped in markdown code blocks"""
        json_data = {
            "code_snippet": "adam$VAR <- value",
            "pseudo_code": "SET VAR TO value",
            "pseudo_summary": "Simple assignment"
        }

        raw_response = f"""```json
{json.dumps(json_data)}
```"""

        code, pseudo, summary = self.service._parse_json_response(
            raw_response=raw_response,
            language="R",
            variable_name="TEST"
        )

        assert code is not None
        assert pseudo is not None
        assert summary is not None

    def test_parse_response_with_missing_pseudo_code(self):
        """Test graceful handling when pseudo-code field is missing"""
        json_response = {
            "code_snippet": "ADSL$VAR <- value",
            "pseudo_code": None,  # Missing pseudo-code
            "pseudo_summary": None
        }

        raw_response = json.dumps(json_response)
        code, pseudo, summary = self.service._parse_json_response(
            raw_response=raw_response,
            language="R",
            variable_name="VAR"
        )

        assert code is not None
        assert pseudo is None
        assert summary is None

    def test_parse_invalid_json_fallback(self):
        """Test fallback when response is not valid JSON"""
        raw_response = """
        This is not JSON format.
        Here's some code:
        ADSL$VAR <- cut(ADSL$AGE, breaks=c(0, 65, Inf))
        """

        code, pseudo, summary = self.service._parse_json_response(
            raw_response=raw_response,
            language="R",
            variable_name="TEST"
        )

        # Should fallback to treating response as plain code
        assert code is not None
        assert len(code) > 0
        assert pseudo is None  # Fallback means no pseudo-code
        assert summary is None

    def test_parse_pseudo_code_truncation(self):
        """Test that pseudo-code longer than 15 lines is truncated"""
        # Create pseudo-code with 20 lines
        long_pseudo = "\n".join([f"Line {i}" for i in range(1, 21)])

        json_response = {
            "code_snippet": "code here",
            "pseudo_code": long_pseudo,
            "pseudo_summary": "Test"
        }

        raw_response = json.dumps(json_response)
        code, pseudo, summary = self.service._parse_json_response(
            raw_response=raw_response,
            language="R",
            variable_name="TEST"
        )

        # Should be truncated to 15 lines
        assert pseudo is not None
        lines = pseudo.split("\n")
        assert len(lines) <= 16  # 15 lines + truncated message


class TestPseudoCodeFormatValidation:
    """Test pseudo-code format validation and quality"""

    def setup_method(self):
        """Initialize test fixtures"""
        self.service = CodeGeneratorService()

    def test_pseudo_code_uses_plain_english(self):
        """Verify pseudo-code uses plain English keywords"""
        json_response = {
            "code_snippet": "result <- ifelse(x > 10, 'high', 'low')",
            "pseudo_code": "IF age greater than 65 THEN category = 'senior' ELSE category = 'adult'",
            "pseudo_summary": "Categorize by age threshold"
        }

        raw_response = json.dumps(json_response)
        code, pseudo, summary = self.service._parse_json_response(
            raw_response=raw_response,
            language="R",
            variable_name="AGECAT"
        )

        # Check for domain-expert-friendly keywords
        pseudo_upper = pseudo.upper()
        assert any(kw in pseudo_upper for kw in ["IF", "THEN", "ELSE", "AND", "OR"])

    def test_pseudo_code_includes_sdtm_domain_references(self):
        """Verify pseudo-code references SDTM domains"""
        json_response = {
            "code_snippet": "adam$saffl <- ifelse(!is.na(vs$vsstresn), 'Y', 'N')",
            "pseudo_code": "IF VS domain has measurement value THEN SAFFL = 'Y' ELSE SAFFL = 'N'",
            "pseudo_summary": "Safety population flag based on vital signs"
        }

        raw_response = json.dumps(json_response)
        code, pseudo, summary = self.service._parse_json_response(
            raw_response=raw_response,
            language="R",
            variable_name="SAFFL"
        )

        # Should reference SDTM domain
        assert "VS" in pseudo or "domain" in pseudo.lower()


class TestCodeGeneratorServicePseudoCode:
    """Integration tests for pseudo-code in CodeGeneratorService"""

    @pytest.mark.asyncio
    async def test_generate_single_variable_with_pseudo_code(self):
        """Test single variable generation includes pseudo-code"""
        service = CodeGeneratorService()

        variable = {
            "name": "AGEGR1",
            "label": "Age Group 1",
            "type": "Char",
            "derivation": "Categorize AGE into groups: <65, 65-80, >80"
        }

        context = {
            "study_id": "STUDY001",
            "adam_dataset": "ADSL",
            "sdtm_version": "3.4",
            "adam_ig_version": "1.3"
        }

        # Mock the LLM call to return proper JSON
        mock_response = json.dumps({
            "code_snippet": "ADSL$AGEGR1 <- cut(ADSL$AGE, breaks=c(0, 65, 80, Inf))",
            "pseudo_code": "IF AGE < 65 THEN '<65' ELSE IF AGE <= 80 THEN '65-80' ELSE '>80'",
            "pseudo_summary": "Categorize age into three groups"
        })

        with patch.object(service, '_call_llm', new_callable=AsyncMock) as mock_llm:
            mock_llm.return_value = mock_response

            result = await service.generate_single_variable(
                variable=variable,
                language="R",
                context=context
            )

            # Verify result includes pseudo-code
            assert result["variable"] == "AGEGR1"
            assert result["code_snippet"] is not None
            assert result["pseudo_code"] is not None
            assert result["pseudo_summary"] is not None
            assert result["metadata"]["has_pseudo_code"] is True

    @pytest.mark.asyncio
    async def test_generate_single_variable_fallback_without_pseudo_code(self):
        """Test fallback generation when LLM fails (no pseudo-code)"""
        service = CodeGeneratorService()

        variable = {
            "name": "TESTVAR",
            "label": "Test Variable",
            "type": "Num",
            "derivation": "Test"
        }

        context = {
            "study_id": "STUDY001",
            "adam_dataset": "ADSL"
        }

        # Mock LLM to fail
        with patch.object(service, '_call_llm', new_callable=AsyncMock) as mock_llm:
            mock_llm.side_effect = Exception("LLM service unavailable")

            result = await service.generate_single_variable(
                variable=variable,
                language="R",
                context=context
            )

            # Verify fallback (no pseudo-code)
            assert result["variable"] == "TESTVAR"
            assert result["code_snippet"] is not None  # Fallback template
            assert result["pseudo_code"] is None  # No pseudo-code in fallback
            assert result["pseudo_summary"] is None
            assert result["metadata"]["has_pseudo_code"] is False
            assert result["metadata"]["is_fallback"] is True

    @pytest.mark.asyncio
    async def test_batch_generation_preserves_pseudo_code(self):
        """Test that batch generation preserves pseudo-code from LLM response"""
        service = CodeGeneratorService()

        # Use JSON-based parsing to test pseudo-code extraction from batch responses
        batch_json = json.dumps([
            {
                "code_snippet": "ADSL$VAR1 <- calculation1",
                "pseudo_code": "Pseudo step 1\nPseudo step 2",
                "pseudo_summary": "Summary 1"
            },
            {
                "code_snippet": "ADSL$VAR2 <- calculation2",
                "pseudo_code": "Pseudo step A\nPseudo step B",
                "pseudo_summary": "Summary 2"
            }
        ])

        # Test parsing of batch response - should extract pseudo-code from each
        import json as json_module
        try:
            data = json_module.loads(batch_json)
            for item in data:
                code, pseudo, summary = service._parse_json_response(
                    json.dumps(item),
                    "R",
                    item.get("variable", "TEST")
                )
                assert code is not None
                assert pseudo is not None, f"Pseudo-code should be extracted from batch response"
                assert summary is not None
        except Exception as e:
            pytest.fail(f"Failed to parse batch JSON: {e}")


class TestPseudoCodeEdgeCases:
    """Test edge cases and error handling in pseudo-code generation"""

    def setup_method(self):
        """Initialize test fixtures"""
        self.service = CodeGeneratorService()

    def test_parse_response_with_empty_pseudo_code(self):
        """Test handling of empty pseudo-code field"""
        json_response = {
            "code_snippet": "code here",
            "pseudo_code": "",  # Empty
            "pseudo_summary": ""
        }

        raw_response = json.dumps(json_response)
        code, pseudo, summary = self.service._parse_json_response(
            raw_response=raw_response,
            language="R",
            variable_name="TEST"
        )

        # Empty strings should be treated as None
        assert code is not None
        # Empty string may be returned as-is or treated as None
        # Current behavior: treats empty as falsy
        assert pseudo == "" or pseudo is None

    def test_parse_response_with_special_characters(self):
        """Test handling pseudo-code with special characters and syntax"""
        json_response = {
            "code_snippet": 'code with "quotes" and \'apostrophes\'',
            "pseudo_code": "IF x >= 65 & y <= 100 THEN result = 'Y/N' ELSE result = 'N/A'",
            "pseudo_summary": "Check condition with special chars: @, #, $"
        }

        raw_response = json.dumps(json_response)
        code, pseudo, summary = self.service._parse_json_response(
            raw_response=raw_response,
            language="R",
            variable_name="TEST"
        )

        assert pseudo is not None
        assert "&" in pseudo or "and" in pseudo.lower()

    def test_parse_response_with_multiline_pseudo_code(self):
        """Test handling multi-line pseudo-code with proper indentation"""
        multiline_pseudo = """IF age < 65 THEN
  category = '<65'
ELSE IF age <= 80 THEN
  category = '65-80'
ELSE
  category = '>80'"""

        json_response = {
            "code_snippet": "code",
            "pseudo_code": multiline_pseudo,
            "pseudo_summary": "Summary"
        }

        raw_response = json.dumps(json_response)
        code, pseudo, summary = self.service._parse_json_response(
            raw_response=raw_response,
            language="R",
            variable_name="TEST"
        )

        assert pseudo is not None
        assert "\n" in pseudo  # Multiline preserved
        assert "category" in pseudo


class TestPromptBuilderMetadata:
    """Test prompt builder metadata for pseudo-code generation"""

    def setup_method(self):
        """Initialize test fixtures"""
        self.builder = PromptBuilder()

    def test_prompt_specifies_json_format(self):
        """Verify prompt explicitly requests JSON format"""
        context = {
            "study_id": "STUDY001",
            "adam_dataset": "ADSL",
            "programming_language": "R"
        }

        import asyncio
        prompt = asyncio.run(self.builder.build_code_generation_prompt(
            variable_name="TEST",
            variable_label="Test",
            variable_type="Char",
            derivation_logic="Test",
            language="R",
            context=context
        ))

        assert "JSON" in prompt
        assert "code_snippet" in prompt
        assert "pseudo_code" in prompt

    def test_prompt_requests_domain_expert_clarity(self):
        """Verify prompt includes domain expert clarity guidance"""
        context = {
            "study_id": "STUDY001",
            "adam_dataset": "ADSL",
            "programming_language": "R"
        }

        import asyncio
        prompt = asyncio.run(self.builder.build_code_generation_prompt(
            variable_name="TEST",
            variable_label="Test",
            variable_type="Char",
            derivation_logic="Test",
            language="R",
            context=context
        ))

        # Should emphasize domain expert clarity
        lower_prompt = prompt.lower()
        assert "domain" in lower_prompt or "expert" in lower_prompt or "plain english" in lower_prompt
