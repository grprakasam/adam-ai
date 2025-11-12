"""
Unit tests for PromptBuilder module
"""
import pytest
from app.modules.code_generator.prompt_builder import PromptBuilder


class TestPromptBuilder:
    """Test cases for PromptBuilder prompt generation"""
    
    def setup_method(self):
        """Setup test fixtures"""
        self.builder = PromptBuilder()
        self.sample_context = {
            "dataset": "ADSL",
            "variable": "AGEGR1",
            "derivation": "Categorize AGE into groups: <65, 65-80, >80",
            "language": "R",
            "spec_row": {
                "Variable": "AGEGR1",
                "Label": "Age Group 1",
                "Type": "text",
                "Length": 10
            },
            "standards": {
                "sdtm_version": "3.4",
                "adam_ig_version": "1.3"
            },
            "available_sdtm_domains": ["DM", "VS", "LB"],
            "required_variables": ["AGE", "USUBJID"]
        }
    
    def test_code_generation_prompt_structure(self):
        """Test that code generation prompt has required sections"""
        prompt = self.builder.build_code_generation_prompt(
            variable=self.sample_context["variable"],
            derivation=self.sample_context["derivation"],
            language=self.sample_context["language"],
            dataset=self.sample_context["dataset"],
            context=self.sample_context
        )
        
        # Check key sections are present
        assert "AGEGR1" in prompt
        assert "Categorize AGE" in prompt
        assert "R" in prompt or "code" in prompt.lower()
        assert "CDISC" in prompt or "ADAM" in prompt
        assert "ADSL" in prompt
    
    def test_code_generation_prompt_includes_standards(self):
        """Test that standards information is included"""
        prompt = self.builder.build_code_generation_prompt(
            variable=self.sample_context["variable"],
            derivation=self.sample_context["derivation"],
            language="R",
            dataset="ADSL",
            context=self.sample_context
        )
        
        assert "3.4" in prompt or "SDTM" in prompt
        assert "1.3" in prompt or "ADAM" in prompt
    
    def test_code_generation_prompt_language_specific(self):
        """Test that prompts are language-specific"""
        r_prompt = self.builder.build_code_generation_prompt(
            variable="TEST",
            derivation="Test derivation",
            language="R",
            dataset="ADSL",
            context=self.sample_context
        )
        
        sas_prompt = self.builder.build_code_generation_prompt(
            variable="TEST",
            derivation="Test derivation",
            language="SAS",
            dataset="ADSL",
            context=self.sample_context
        )
        
        # Check language-specific content
        assert "R" in r_prompt.upper()
        assert "SAS" in sas_prompt.upper()
        assert r_prompt != sas_prompt
    
    def test_code_generation_prompt_with_template(self):
        """Test prompt generation with template suggestion"""
        prompt = self.builder.build_code_generation_prompt(
            variable="SAFFL",
            derivation="If AGE >= 18 then 'Y' else 'N'",
            language="R",
            dataset="ADSL",
            context=self.sample_context
        )
        
        # Template suggestion should be included for conditional pattern
        assert prompt is not None
        assert len(prompt) > 100
    
    def test_rationale_prompt_structure(self):
        """Test that rationale prompt requests high-level explanation"""
        prompt = self.builder.build_rationale_prompt(
            variable="AGEGR1",
            derivation="Categorize AGE into groups",
            dataset="ADSL"
        )
        
        assert "AGEGR1" in prompt
        assert "explain" in prompt.lower() or "rationale" in prompt.lower()
        assert "high-level" in prompt.lower() or "brief" in prompt.lower()
    
    def test_syntax_validation_prompt_structure(self):
        """Test that validation prompt checks syntax"""
        code = "adsl <- adsl %>% mutate(AGEGR1 = case_when(AGE < 65 ~ '<65'))"
        
        prompt = self.builder.build_syntax_validation_prompt(
            code=code,
            language="R"
        )
        
        assert code in prompt
        assert "R" in prompt
        assert "syntax" in prompt.lower() or "validate" in prompt.lower()
    
    def test_prompt_with_minimal_context(self):
        """Test prompt generation with minimal context"""
        minimal_context = {
            "dataset": "ADSL",
            "variable": "TEST"
        }
        
        prompt = self.builder.build_code_generation_prompt(
            variable="TEST",
            derivation="Simple derivation",
            language="R",
            dataset="ADSL",
            context=minimal_context
        )
        
        # Should still generate valid prompt
        assert prompt is not None
        assert "TEST" in prompt
        assert len(prompt) > 50
    
    def test_prompt_with_complex_derivation(self):
        """Test prompt with complex multi-step derivation"""
        complex_derivation = """
        1. Merge ADSL with VS by USUBJID
        2. Filter for baseline visits (ABLFL = 'Y')
        3. Calculate mean of AVAL by PARAMCD
        4. Create flag if mean > 100
        """
        
        prompt = self.builder.build_code_generation_prompt(
            variable="MEANFL",
            derivation=complex_derivation,
            language="R",
            dataset="ADVS",
            context=self.sample_context
        )
        
        # Should handle multi-line derivation
        assert prompt is not None
        assert "MEANFL" in prompt
        assert len(prompt) > 100
    
    def test_prompt_includes_available_domains(self):
        """Test that available SDTM domains are mentioned"""
        context = {
            **self.sample_context,
            "available_sdtm_domains": ["DM", "VS", "LB", "AE"]
        }
        
        prompt = self.builder.build_code_generation_prompt(
            variable="TEST",
            derivation="Test",
            language="R",
            dataset="ADSL",
            context=context
        )
        
        # Should mention available domains
        assert "DM" in prompt or "domains" in prompt.lower()
    
    def test_prompt_length_reasonable(self):
        """Test that prompts are not excessively long"""
        prompt = self.builder.build_code_generation_prompt(
            variable=self.sample_context["variable"],
            derivation=self.sample_context["derivation"],
            language="R",
            dataset="ADSL",
            context=self.sample_context
        )
        
        # Prompt should be substantial but not excessive (< 5000 chars)
        assert 100 < len(prompt) < 5000
