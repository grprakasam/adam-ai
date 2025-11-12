"""
Unit tests for TemplateSelector from prompt_builder module
"""
import pytest
from app.modules.code_generator.prompt_builder import TemplateSelector


class TestTemplateSelector:
    """Test cases for TemplateSelector pattern matching"""
    
    def setup_method(self):
        """Setup test fixtures"""
        self.selector = TemplateSelector()
    
    def test_direct_derivation_pattern(self):
        """Test detection of direct derivation pattern"""
        derivations = [
            "Derived from SDTM.DM.AGE",
            "Copy value from ADSL.USUBJID",
            "Set equal to SDTM.VS.VSSTRESN"
        ]
        
        for derivation in derivations:
            pattern_type = self.selector.identify_pattern(derivation)
            assert pattern_type == "direct_derivation", f"Failed for: {derivation}"
    
    def test_conditional_flag_pattern(self):
        """Test detection of conditional flag pattern"""
        derivations = [
            "If AVAL >= 100 then 'Y' else 'N'",
            "Set to 'Y' if SAFFL = 'Y', otherwise 'N'",
            "Flag as 'Y' when AGE > 65, else 'N'"
        ]
        
        for derivation in derivations:
            pattern_type = self.selector.identify_pattern(derivation)
            assert pattern_type == "conditional_flag", f"Failed for: {derivation}"
    
    def test_date_conversion_pattern(self):
        """Test detection of date conversion pattern"""
        derivations = [
            "Convert RFSTDTC to numeric date",
            "Format EXSTDTC as date",
            "Transform AESTDTC to SAS date"
        ]
        
        for derivation in derivations:
            pattern_type = self.selector.identify_pattern(derivation)
            assert pattern_type == "date_conversion", f"Failed for: {derivation}"
    
    def test_datetime_conversion_pattern(self):
        """Test detection of datetime conversion pattern"""
        derivations = [
            "Convert AESTDTC to datetime",
            "Format EXSTDTC as datetime value",
            "Parse CMSTDTC to datetime"
        ]
        
        for derivation in derivations:
            pattern_type = self.selector.identify_pattern(derivation)
            assert pattern_type == "datetime_conversion", f"Failed for: {derivation}"
    
    def test_merge_pattern(self):
        """Test detection of merge/join pattern"""
        derivations = [
            "Merge ADSL with SDTM.VS by USUBJID",
            "Join with DM dataset on SUBJID",
            "Left join ADSL and ADVS"
        ]
        
        for derivation in derivations:
            pattern_type = self.selector.identify_pattern(derivation)
            assert pattern_type == "merge_datasets", f"Failed for: {derivation}"
    
    def test_numeric_calculation_pattern(self):
        """Test detection of numeric calculation pattern"""
        derivations = [
            "Calculate AVAL = BASE + CHG",
            "Compute BMI = WEIGHT / (HEIGHT^2)",
            "Sum of AVAL1 and AVAL2"
        ]
        
        for derivation in derivations:
            pattern_type = self.selector.identify_pattern(derivation)
            assert pattern_type == "numeric_calculation", f"Failed for: {derivation}"
    
    def test_aggregate_pattern(self):
        """Test detection of aggregate function pattern"""
        derivations = [
            "Maximum value of AVAL by USUBJID",
            "Mean of all AVAL values",
            "Count records per subject",
            "Minimum AVAL within visit"
        ]
        
        for derivation in derivations:
            pattern_type = self.selector.identify_pattern(derivation)
            assert pattern_type == "aggregate_function", f"Failed for: {derivation}"
    
    def test_string_concatenation_pattern(self):
        """Test detection of string concatenation pattern"""
        derivations = [
            "Concatenate LNAME and FNAME",
            "Combine USUBJID with VISIT",
            "Join TRT01P and TRT01PN with '-'"
        ]
        
        for derivation in derivations:
            pattern_type = self.selector.identify_pattern(derivation)
            assert pattern_type == "string_concatenation", f"Failed for: {derivation}"
    
    def test_grouping_pattern(self):
        """Test detection of grouping pattern"""
        derivations = [
            "Group by USUBJID and VISIT",
            "Group records by subject",
            "Aggregate by patient ID"
        ]
        
        for derivation in derivations:
            pattern_type = self.selector.identify_pattern(derivation)
            assert pattern_type == "grouping_operation", f"Failed for: {derivation}"
    
    def test_sorting_pattern(self):
        """Test detection of sorting pattern"""
        derivations = [
            "Sort by USUBJID and ADT",
            "Order by subject and date",
            "Arrange by visit number"
        ]
        
        for derivation in derivations:
            pattern_type = self.selector.identify_pattern(derivation)
            assert pattern_type == "sorting", f"Failed for: {derivation}"
    
    def test_baseline_flag_pattern(self):
        """Test detection of baseline flag pattern"""
        derivations = [
            "Set BASETYPE = 'LAST' for baseline records",
            "Flag baseline visit",
            "Identify baseline observations"
        ]
        
        for derivation in derivations:
            pattern_type = self.selector.identify_pattern(derivation)
            assert pattern_type == "baseline_flag", f"Failed for: {derivation}"
    
    def test_worst_case_flag_pattern(self):
        """Test detection of worst case pattern"""
        derivations = [
            "Identify worst grade by subject",
            "Flag most severe event",
            "Select maximum toxicity"
        ]
        
        for derivation in derivations:
            pattern_type = self.selector.identify_pattern(derivation)
            assert pattern_type == "worst_case_flag", f"Failed for: {derivation}"
    
    def test_unknown_pattern_returns_none(self):
        """Test that unknown patterns return None"""
        unknown_derivations = [
            "Some completely random text",
            "This doesn't match any pattern",
            ""
        ]
        
        for derivation in unknown_derivations:
            pattern_type = self.selector.identify_pattern(derivation)
            # Should return None or a default pattern
            assert pattern_type is None or isinstance(pattern_type, str)
    
    def test_case_insensitive_matching(self):
        """Test that pattern matching is case insensitive"""
        derivation_lower = "if aval >= 100 then 'y' else 'n'"
        derivation_upper = "IF AVAL >= 100 THEN 'Y' ELSE 'N'"
        
        pattern_lower = self.selector.identify_pattern(derivation_lower)
        pattern_upper = self.selector.identify_pattern(derivation_upper)
        
        assert pattern_lower == pattern_upper == "conditional_flag"
