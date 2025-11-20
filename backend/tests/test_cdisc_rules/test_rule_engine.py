"""
Tests for CDISC ADAM Rule Engine
Domain-specific validation testing
"""

import pytest
from app.modules.cdisc_rules.rule_engine import (
    ADAMRuleEngine,
    DateVariableNamingRule,
    FlagVariableNamingRule,
    TreatmentVariableRule,
    TypeConsistencyRule,
    RuleSeverity,
    get_rule_engine
)


class TestDateVariableNamingRule:
    """Test date variable naming conventions"""

    def test_date_variable_with_proper_type_and_parsing_r(self):
        """Test valid date variable in R"""
        rule = DateVariableNamingRule()

        variable = {
            "name": "TRTSDT",
            "type": "Date",
            "label": "Treatment Start Date"
        }

        code = "TRTSDT <- as.Date(EX$EXSTDTC)"
        context = {"language": "R"}

        result = rule.validate(variable, code, context)

        assert result.passed is True
        assert result.severity == RuleSeverity.INFO

    def test_date_variable_wrong_type(self):
        """Test date variable with wrong type"""
        rule = DateVariableNamingRule()

        variable = {
            "name": "TRTSDT",
            "type": "Char",  # Wrong type
            "label": "Treatment Start Date"
        }

        code = "TRTSDT <- EX$EXSTDTC"
        context = {"language": "R"}

        result = rule.validate(variable, code, context)

        assert result.passed is False
        assert result.severity == RuleSeverity.ERROR
        assert "type" in result.message.lower()

    def test_date_variable_missing_date_parsing_r(self):
        """Test date variable without proper date parsing in R"""
        rule = DateVariableNamingRule()

        variable = {
            "name": "TRTSDT",
            "type": "Date",
            "label": "Treatment Start Date"
        }

        code = "TRTSDT <- EX$EXSTDTC"  # Missing as.Date()
        context = {"language": "R"}

        result = rule.validate(variable, code, context)

        assert result.passed is False
        assert result.severity == RuleSeverity.WARNING
        assert "date parsing" in result.message.lower()

    def test_date_variable_sas(self):
        """Test date variable in SAS"""
        rule = DateVariableNamingRule()

        variable = {
            "name": "TRTSDT",
            "type": "Num",
            "label": "Treatment Start Date"
        }

        code = "TRTSDT = INPUT(EXSTDTC, YYMMDD10.);"
        context = {"language": "SAS"}

        result = rule.validate(variable, code, context)

        assert result.passed is True


class TestFlagVariableNamingRule:
    """Test flag variable naming conventions"""

    def test_flag_variable_proper_type_and_values(self):
        """Test valid flag variable"""
        rule = FlagVariableNamingRule()

        variable = {
            "name": "SAFFL",
            "type": "Char",
            "label": "Safety Population Flag"
        }

        code = "SAFFL <- ifelse(RANDFL == 'Y' & DOSEFL == 'Y', 'Y', 'N')"
        context = {"language": "R"}

        result = rule.validate(variable, code, context)

        assert result.passed is True

    def test_flag_variable_wrong_type(self):
        """Test flag variable with wrong type"""
        rule = FlagVariableNamingRule()

        variable = {
            "name": "SAFFL",
            "type": "Num",  # Wrong type
            "label": "Safety Population Flag"
        }

        code = "SAFFL <- 1"
        context = {"language": "R"}

        result = rule.validate(variable, code, context)

        assert result.passed is False
        assert result.severity == RuleSeverity.ERROR
        assert "character type" in result.message.lower()

    def test_flag_variable_missing_y_n_values(self):
        """Test flag variable without Y/N values"""
        rule = FlagVariableNamingRule()

        variable = {
            "name": "SAFFL",
            "type": "Char",
            "label": "Safety Population Flag"
        }

        code = "SAFFL <- ifelse(condition, '1', '0')"  # Using 1/0 instead of Y/N
        context = {"language": "R"}

        result = rule.validate(variable, code, context)

        assert result.passed is False
        assert result.severity == RuleSeverity.WARNING


class TestTreatmentVariableRule:
    """Test treatment variable derivation rules"""

    def test_treatment_variable_from_ex_domain(self):
        """Test treatment variable correctly using EX domain"""
        rule = TreatmentVariableRule()

        variable = {
            "name": "TRT01P",
            "type": "Char",
            "label": "Planned Treatment for Period 01"
        }

        code = "TRT01P <- EX$EXTRT"
        context = {"language": "R"}

        result = rule.validate(variable, code, context)

        assert result.passed is True

    def test_treatment_variable_wrong_source(self):
        """Test treatment variable not using EX domain"""
        rule = TreatmentVariableRule()

        variable = {
            "name": "TRT01P",
            "type": "Char",
            "label": "Planned Treatment for Period 01"
        }

        code = "TRT01P <- DM$ARM"  # Wrong - should use EX domain
        context = {"language": "R"}

        result = rule.validate(variable, code, context)

        assert result.passed is False
        assert result.severity == RuleSeverity.ERROR
        assert "EX" in result.message

    def test_treatment_variable_actual_vs_planned(self):
        """Test treatment variable planned vs actual"""
        rule = TreatmentVariableRule()

        # Planned treatment (P)
        variable_planned = {
            "name": "TRT01P",
            "type": "Char",
            "label": "Planned Treatment"
        }

        code_planned = "TRT01P <- EX$EXTRT"
        result = rule.validate(variable_planned, code_planned, {"language": "R"})

        assert result.passed is True


class TestTypeConsistencyRule:
    """Test data type consistency"""

    def test_numeric_variable_with_numeric_operations(self):
        """Test numeric variable with appropriate operations"""
        rule = TypeConsistencyRule()

        variable = {
            "name": "AVAL",
            "type": "Num",
            "label": "Analysis Value"
        }

        code = "AVAL <- as.numeric(LBSTRESN)"
        context = {"language": "R"}

        result = rule.validate(variable, code, context)

        assert result.passed is True

    def test_numeric_variable_with_string_operations(self):
        """Test numeric variable with string operations (should fail)"""
        rule = TypeConsistencyRule()

        variable = {
            "name": "AVAL",
            "type": "Num",
            "label": "Analysis Value"
        }

        code = "AVAL <- paste(LBSTRESN, 'mg')"  # String operation on numeric var
        context = {"language": "R"}

        result = rule.validate(variable, code, context)

        assert result.passed is False
        assert result.severity == RuleSeverity.ERROR


class TestADAMRuleEngine:
    """Test the complete rule engine"""

    @pytest.fixture
    def rule_engine(self):
        """Get rule engine instance"""
        return ADAMRuleEngine()

    @pytest.mark.asyncio
    async def test_validate_code_all_rules(self, rule_engine):
        """Test validating code against all rules"""
        variable = {
            "name": "TRTSDT",
            "type": "Date",
            "label": "Treatment Start Date"
        }

        code = "TRTSDT <- as.Date(EX$EXSTDTC)"
        context = {"language": "R", "dataset": "ADSL"}

        results = await rule_engine.validate_code(variable, code, context)

        # Should have run applicable rules
        assert len(results) > 0

        # All should pass for this valid code
        all_passed = all(r.passed or r.severity != RuleSeverity.ERROR for r in results)
        assert all_passed

    @pytest.mark.asyncio
    async def test_validation_summary(self, rule_engine):
        """Test validation summary generation"""
        variable = {
            "name": "TRTSDT",
            "type": "Char",  # Wrong type - should trigger error
            "label": "Treatment Start Date"
        }

        code = "TRTSDT <- EX$EXSTDTC"  # No date parsing
        context = {"language": "R"}

        results = await rule_engine.validate_code(variable, code, context)
        summary = rule_engine.get_validation_summary(results)

        assert "total_rules" in summary
        assert "passed" in summary
        assert "failed" in summary
        assert "errors" in summary
        assert "warnings" in summary
        assert "pass_rate" in summary
        assert "approval_blocked" in summary

        # Should have at least one error (wrong type)
        assert summary["errors"] > 0
        assert summary["approval_blocked"] is True

    @pytest.mark.asyncio
    async def test_rule_registration(self, rule_engine):
        """Test custom rule registration"""
        from app.modules.cdisc_rules.rule_engine import ADAMRule, RuleCategory, RuleResult

        class CustomRule(ADAMRule):
            def __init__(self):
                super().__init__(
                    rule_id="CUSTOM-001",
                    name="Custom Test Rule",
                    description="Test custom rule",
                    category=RuleCategory.NAMING_CONVENTION
                )

            def validate(self, variable, code, context):
                return RuleResult(
                    rule_id=self.rule_id,
                    rule_name=self.name,
                    passed=True,
                    severity=RuleSeverity.INFO,
                    message="Custom rule passed"
                )

        initial_count = len(rule_engine.rules)
        rule_engine.register_rule(CustomRule())

        assert len(rule_engine.rules) == initial_count + 1

    def test_get_rule_catalog(self, rule_engine):
        """Test getting rule catalog"""
        catalog = rule_engine.get_rule_catalog()

        assert len(catalog) > 0
        assert all("rule_id" in rule for rule in catalog)
        assert all("name" in rule for rule in catalog)
        assert all("description" in rule for rule in catalog)
        assert all("category" in rule for rule in catalog)


class TestCDISCCompliance:
    """Test CDISC standards compliance"""

    @pytest.mark.asyncio
    async def test_adam_ig_variable_naming_compliance(self):
        """Test compliance with ADAM IG variable naming"""
        rule_engine = ADAMRuleEngine()

        # Test cases: (variable, code, should_pass)
        test_cases = [
            # Valid cases
            (
                {"name": "TRTSDT", "type": "Date"},
                "TRTSDT <- as.Date(EX$EXSTDTC)",
                True
            ),
            (
                {"name": "SAFFL", "type": "Char"},
                "SAFFL <- ifelse(condition, 'Y', 'N')",
                True
            ),
            (
                {"name": "TRT01P", "type": "Char"},
                "TRT01P <- EX$EXTRT",
                True
            ),

            # Invalid cases
            (
                {"name": "TRTSDT", "type": "Char"},  # Wrong type
                "TRTSDT <- EX$EXSTDTC",
                False
            ),
            (
                {"name": "TRT01P", "type": "Char"},
                "TRT01P <- DM$ARM",  # Wrong source
                False
            ),
        ]

        for variable, code, should_pass in test_cases:
            results = await rule_engine.validate_code(variable, code, {"language": "R"})
            summary = rule_engine.get_validation_summary(results)

            if should_pass:
                assert summary["errors"] == 0, f"Expected pass for {variable['name']}"
            else:
                assert summary["errors"] > 0, f"Expected failure for {variable['name']}"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
