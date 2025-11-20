"""
Executable CDISC ADAM Rule Engine
Transforms descriptive markdown rules into executable Python validation

This replaces the current approach of markdown files with executable rules that can:
- Validate code during generation
- Provide actionable error messages
- Enforce CDISC standards programmatically
- Support custom organizational rules
"""

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional
from enum import Enum
from datetime import datetime
import re
from loguru import logger


class RuleSeverity(str, Enum):
    """Severity levels for rule violations"""
    ERROR = "error"  # Must fix - prevents approval
    WARNING = "warning"  # Should fix - allows approval with warning
    INFO = "info"  # Informational - best practice suggestion


class RuleCategory(str, Enum):
    """Categories of ADAM rules"""
    NAMING_CONVENTION = "naming_convention"
    DATA_TYPE = "data_type"
    DERIVATION_LOGIC = "derivation_logic"
    SOURCE_VARIABLE = "source_variable"
    CONTROLLED_TERMINOLOGY = "controlled_terminology"
    VARIABLE_ORDERING = "variable_ordering"
    FORMATTING = "formatting"
    DOCUMENTATION = "documentation"


class RuleResult:
    """Result of rule validation"""

    def __init__(
        self,
        rule_id: str,
        rule_name: str,
        passed: bool,
        severity: RuleSeverity,
        message: str,
        details: Optional[Dict[str, Any]] = None,
        suggestion: Optional[str] = None,
        reference: Optional[str] = None
    ):
        self.rule_id = rule_id
        self.rule_name = rule_name
        self.passed = passed
        self.severity = severity
        self.message = message
        self.details = details or {}
        self.suggestion = suggestion
        self.reference = reference
        self.timestamp = datetime.utcnow()

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            "rule_id": self.rule_id,
            "rule_name": self.rule_name,
            "passed": self.passed,
            "severity": self.severity.value,
            "message": self.message,
            "details": self.details,
            "suggestion": self.suggestion,
            "reference": self.reference,
            "timestamp": self.timestamp.isoformat()
        }


class ADAMRule(ABC):
    """Base class for all ADAM validation rules"""

    def __init__(
        self,
        rule_id: str,
        name: str,
        description: str,
        category: RuleCategory,
        severity: RuleSeverity = RuleSeverity.ERROR,
        reference: Optional[str] = None
    ):
        self.rule_id = rule_id
        self.name = name
        self.description = description
        self.category = category
        self.severity = severity
        self.reference = reference or "ADAM IG v2.1"

    @abstractmethod
    def validate(
        self,
        variable: Dict[str, Any],
        code: str,
        context: Dict[str, Any]
    ) -> RuleResult:
        """
        Validate a variable and its generated code

        Args:
            variable: Variable metadata (name, type, label, etc.)
            code: Generated code snippet
            context: Additional context (language, dataset, other variables, etc.)

        Returns:
            RuleResult indicating pass/fail and details
        """
        pass

    def applies_to(self, variable: Dict[str, Any], context: Dict[str, Any]) -> bool:
        """
        Check if this rule applies to the given variable

        Override this to implement conditional rule application
        """
        return True


# ============================================================================
# NAMING CONVENTION RULES
# ============================================================================

class DateVariableNamingRule(ADAMRule):
    """
    Rule: Variables ending in 'DT' must be date type
    ADAM IG Reference: Section 3.1.1
    """

    def __init__(self):
        super().__init__(
            rule_id="ADAM-NAME-001",
            name="Date Variable Naming Convention",
            description="Variables with suffix 'DT' must be date type and use proper date parsing",
            category=RuleCategory.NAMING_CONVENTION,
            severity=RuleSeverity.ERROR,
            reference="ADAM IG v2.1 Section 3.1.1 - Variable Naming"
        )

    def applies_to(self, variable: Dict[str, Any], context: Dict[str, Any]) -> bool:
        """Only applies to variables ending in DT"""
        var_name = variable.get("name", "")
        return var_name.endswith("DT")

    def validate(self, variable: Dict[str, Any], code: str, context: Dict[str, Any]) -> RuleResult:
        var_name = variable.get("name", "")
        var_type = variable.get("type", "").lower()
        language = context.get("language", "").upper()

        # Check 1: Type should be date or numeric (for SAS date values)
        valid_types = ["date", "num", "numeric", "number"]
        if var_type not in valid_types:
            return RuleResult(
                rule_id=self.rule_id,
                rule_name=self.name,
                passed=False,
                severity=RuleSeverity.ERROR,
                message=f"Variable '{var_name}' ends with 'DT' but type is '{var_type}', should be 'Date' or 'Num'",
                details={
                    "variable": var_name,
                    "actual_type": var_type,
                    "expected_types": valid_types
                },
                reference=self.reference
            )

        # Check 2: Code should use proper date parsing functions
        if language == "R":
            date_functions = ["as.Date", "ymd", "mdy", "dmy", "as_date", "lubridate"]
            has_date_parsing = any(func in code for func in date_functions)

            if not has_date_parsing:
                return RuleResult(
                    rule_id=self.rule_id,
                    rule_name=self.name,
                    passed=False,
                    severity=RuleSeverity.WARNING,
                    message=f"Variable '{var_name}' should use proper date parsing function",
                    details={"variable": var_name, "language": "R"},
                    suggestion="Use as.Date(), ymd(), or lubridate functions for date conversion",
                    reference=self.reference
                )

        elif language == "SAS":
            date_functions = ["INPUT(", "DATEPART(", "MDY(", "DMY("]
            has_date_parsing = any(func in code for func in date_functions)

            if not has_date_parsing:
                return RuleResult(
                    rule_id=self.rule_id,
                    rule_name=self.name,
                    passed=False,
                    severity=RuleSeverity.WARNING,
                    message=f"Variable '{var_name}' should use proper SAS date parsing",
                    details={"variable": var_name, "language": "SAS"},
                    suggestion="Use INPUT(), DATEPART(), or MDY() for date conversion",
                    reference=self.reference
                )

        return RuleResult(
            rule_id=self.rule_id,
            rule_name=self.name,
            passed=True,
            severity=RuleSeverity.INFO,
            message=f"Date variable '{var_name}' follows naming conventions",
            reference=self.reference
        )


class FlagVariableNamingRule(ADAMRule):
    """
    Rule: Flag variables must end with 'FL' and be character type
    ADAM IG Reference: Section 3.1.1
    """

    def __init__(self):
        super().__init__(
            rule_id="ADAM-NAME-002",
            name="Flag Variable Naming Convention",
            description="Variables with suffix 'FL' must be character type with values Y/N",
            category=RuleCategory.NAMING_CONVENTION,
            severity=RuleSeverity.ERROR,
            reference="ADAM IG v2.1 Section 3.1.1"
        )

    def applies_to(self, variable: Dict[str, Any], context: Dict[str, Any]) -> bool:
        var_name = variable.get("name", "")
        return var_name.endswith("FL")

    def validate(self, variable: Dict[str, Any], code: str, context: Dict[str, Any]) -> RuleResult:
        var_name = variable.get("name", "")
        var_type = variable.get("type", "").lower()

        # Check type
        if var_type not in ["char", "character", "text", "string"]:
            return RuleResult(
                rule_id=self.rule_id,
                rule_name=self.name,
                passed=False,
                severity=RuleSeverity.ERROR,
                message=f"Flag variable '{var_name}' must be character type, not '{var_type}'",
                details={"variable": var_name, "actual_type": var_type},
                suggestion="Change variable type to 'Char'",
                reference=self.reference
            )

        # Check for Y/N values in code
        has_y_n_values = bool(re.search(r'["\'](Y|N)["\']', code))

        if not has_y_n_values:
            return RuleResult(
                rule_id=self.rule_id,
                rule_name=self.name,
                passed=False,
                severity=RuleSeverity.WARNING,
                message=f"Flag variable '{var_name}' should use 'Y'/'N' values",
                details={"variable": var_name},
                suggestion="Use 'Y' for Yes and 'N' for No",
                reference=self.reference
            )

        return RuleResult(
            rule_id=self.rule_id,
            rule_name=self.name,
            passed=True,
            severity=RuleSeverity.INFO,
            message=f"Flag variable '{var_name}' follows conventions",
            reference=self.reference
        )


class NumericSuffixRule(ADAMRule):
    """
    Rule: Numeric variables should end with 'N'
    Example: AGEGR1N for numeric age group
    """

    def __init__(self):
        super().__init__(
            rule_id="ADAM-NAME-003",
            name="Numeric Suffix Convention",
            description="Numeric variables corresponding to character variables should end with 'N'",
            category=RuleCategory.NAMING_CONVENTION,
            severity=RuleSeverity.WARNING,
            reference="ADAM IG v2.1 Section 3.1.1"
        )

    def applies_to(self, variable: Dict[str, Any], context: Dict[str, Any]) -> bool:
        var_name = variable.get("name", "")
        var_type = variable.get("type", "").lower()
        # Only check numeric variables
        return var_type in ["num", "numeric", "number", "integer"]

    def validate(self, variable: Dict[str, Any], code: str, context: Dict[str, Any]) -> RuleResult:
        var_name = variable.get("name", "")

        # Check if there's a corresponding character variable (e.g., AGEGR1 for AGEGR1N)
        base_name = var_name[:-1] if var_name.endswith("N") else var_name

        # If numeric variable name doesn't end with N, suggest it
        if not var_name.endswith("N"):
            # Check if this is a coded variable
            if any(keyword in var_name for keyword in ["GR", "CAT", "CD"]):
                return RuleResult(
                    rule_id=self.rule_id,
                    rule_name=self.name,
                    passed=False,
                    severity=RuleSeverity.WARNING,
                    message=f"Numeric coded variable '{var_name}' should end with 'N'",
                    details={"variable": var_name},
                    suggestion=f"Consider renaming to '{var_name}N' if it's a numeric code",
                    reference=self.reference
                )

        return RuleResult(
            rule_id=self.rule_id,
            rule_name=self.name,
            passed=True,
            severity=RuleSeverity.INFO,
            message=f"Variable '{var_name}' naming is acceptable",
            reference=self.reference
        )


# ============================================================================
# TREATMENT VARIABLE RULES
# ============================================================================

class TreatmentVariableRule(ADAMRule):
    """
    Rule: Treatment variables (TRTxxP, TRTxxA) must derive from EX domain
    ADAM IG Reference: Section 3.2
    """

    def __init__(self):
        super().__init__(
            rule_id="ADAM-TRT-001",
            name="Treatment Variable Source",
            description="Treatment variables must derive from EX (Exposure) domain",
            category=RuleCategory.SOURCE_VARIABLE,
            severity=RuleSeverity.ERROR,
            reference="ADAM IG v2.1 Section 3.2 - Treatment Variables"
        )

    def applies_to(self, variable: Dict[str, Any], context: Dict[str, Any]) -> bool:
        var_name = variable.get("name", "")
        # Matches TRT01P, TRT02A, etc.
        return bool(re.match(r"^TRT\d{2}[PA]$", var_name))

    def validate(self, variable: Dict[str, Any], code: str, context: Dict[str, Any]) -> RuleResult:
        var_name = variable.get("name", "")

        # Check if code references EX domain
        ex_references = ["EX$", "EX.", "EXSTDTC", "EXENDTC", "EXTRT", "from EX", "FROM EX"]
        has_ex_reference = any(ref in code for ref in ex_references)

        if not has_ex_reference:
            return RuleResult(
                rule_id=self.rule_id,
                rule_name=self.name,
                passed=False,
                severity=RuleSeverity.ERROR,
                message=f"Treatment variable '{var_name}' must derive from EX (Exposure) domain",
                details={"variable": var_name, "expected_source": "EX"},
                suggestion="Use variables from EX domain like EXTRT, EXSTDTC, EXENDTC",
                reference=self.reference
            )

        # Check if it's Planned (P) or Actual (A)
        if var_name.endswith("P"):
            # Planned treatment - should use EXTRT
            if "EXTRT" not in code:
                return RuleResult(
                    rule_id=self.rule_id,
                    rule_name=self.name,
                    passed=False,
                    severity=RuleSeverity.WARNING,
                    message=f"Planned treatment '{var_name}' should typically use EXTRT",
                    details={"variable": var_name},
                    suggestion="Verify EXTRT is the correct source variable for planned treatment",
                    reference=self.reference
                )

        return RuleResult(
            rule_id=self.rule_id,
            rule_name=self.name,
            passed=True,
            severity=RuleSeverity.INFO,
            message=f"Treatment variable '{var_name}' correctly derives from EX domain",
            reference=self.reference
        )


# ============================================================================
# DATA TYPE RULES
# ============================================================================

class TypeConsistencyRule(ADAMRule):
    """
    Rule: Variable types must be consistent with their derivation
    """

    def __init__(self):
        super().__init__(
            rule_id="ADAM-TYPE-001",
            name="Data Type Consistency",
            description="Variable type must match the operations performed in derivation",
            category=RuleCategory.DATA_TYPE,
            severity=RuleSeverity.ERROR,
            reference="ADAM IG v2.1"
        )

    def validate(self, variable: Dict[str, Any], code: str, context: Dict[str, Any]) -> RuleResult:
        var_name = variable.get("name", "")
        var_type = variable.get("type", "").lower()
        language = context.get("language", "").upper()

        issues = []

        # Check numeric variables
        if var_type in ["num", "numeric", "number"]:
            # Should have numeric operations
            string_operations = ["paste", "str_c", "CATX(", "CATS(", "substr"]
            has_string_ops = any(op in code for op in string_operations)

            if has_string_ops:
                issues.append("Numeric variable uses string operations")

        # Check character variables
        elif var_type in ["char", "character", "text", "string"]:
            # Should not have mathematical operations on the result
            if language == "R":
                math_ops = [" + ", " - ", " * ", " / ", "sum(", "mean("]
                # But assignment with math is OK: AGE = AGE + 1
                # We're looking for math on this variable
                has_math = any(f"{var_name}{op}" in code or f"{var_name} {op}" in code for op in ["+", "-", "*", "/"])

                if has_math:
                    issues.append("Character variable involved in mathematical operations")

        if issues:
            return RuleResult(
                rule_id=self.rule_id,
                rule_name=self.name,
                passed=False,
                severity=RuleSeverity.ERROR,
                message=f"Type inconsistency for '{var_name}': {', '.join(issues)}",
                details={"variable": var_name, "type": var_type, "issues": issues},
                suggestion=f"Verify that '{var_name}' type '{var_type}' is correct for the derivation",
                reference=self.reference
            )

        return RuleResult(
            rule_id=self.rule_id,
            rule_name=self.name,
            passed=True,
            severity=RuleSeverity.INFO,
            message=f"Variable '{var_name}' type is consistent with derivation",
            reference=self.reference
        )


# ============================================================================
# RULE ENGINE
# ============================================================================

class ADAMRuleEngine:
    """
    Executable ADAM Rule Engine

    Manages and executes all ADAM validation rules
    """

    def __init__(self):
        self.rules: List[ADAMRule] = []
        self._register_default_rules()

    def _register_default_rules(self):
        """Register all built-in ADAM rules"""
        self.rules.extend([
            # Naming Convention Rules
            DateVariableNamingRule(),
            FlagVariableNamingRule(),
            NumericSuffixRule(),

            # Treatment Variable Rules
            TreatmentVariableRule(),

            # Data Type Rules
            TypeConsistencyRule(),

            # More rules would be added here...
        ])

        logger.info(f"Registered {len(self.rules)} ADAM validation rules")

    def register_rule(self, rule: ADAMRule):
        """Register a custom rule"""
        self.rules.append(rule)
        logger.info(f"Registered custom rule: {rule.rule_id} - {rule.name}")

    def unregister_rule(self, rule_id: str) -> bool:
        """Remove a rule by ID"""
        original_count = len(self.rules)
        self.rules = [r for r in self.rules if r.rule_id != rule_id]
        removed = original_count > len(self.rules)

        if removed:
            logger.info(f"Unregistered rule: {rule_id}")

        return removed

    async def validate_code(
        self,
        variable: Dict[str, Any],
        code: str,
        context: Optional[Dict[str, Any]] = None
    ) -> List[RuleResult]:
        """
        Execute all applicable rules for a variable

        Args:
            variable: Variable metadata
            code: Generated code
            context: Additional context (language, dataset, etc.)

        Returns:
            List of RuleResult objects
        """
        context = context or {}
        results = []

        logger.debug(f"Validating variable '{variable.get('name')}' with {len(self.rules)} rules")

        for rule in self.rules:
            try:
                # Check if rule applies
                if not rule.applies_to(variable, context):
                    continue

                # Execute rule
                result = rule.validate(variable, code, context)
                results.append(result)

                # Log failures
                if not result.passed and result.severity == RuleSeverity.ERROR:
                    logger.warning(
                        f"Rule failed: {rule.rule_id} - {result.message}"
                    )

            except Exception as e:
                logger.error(f"Error executing rule {rule.rule_id}: {str(e)}")
                # Add error result
                results.append(RuleResult(
                    rule_id=rule.rule_id,
                    rule_name=rule.name,
                    passed=False,
                    severity=RuleSeverity.ERROR,
                    message=f"Rule execution failed: {str(e)}",
                    reference=rule.reference
                ))

        logger.debug(f"Validation complete: {len(results)} rules executed")
        return results

    def get_validation_summary(self, results: List[RuleResult]) -> Dict[str, Any]:
        """
        Generate summary of validation results

        Args:
            results: List of RuleResult objects

        Returns:
            Summary dictionary
        """
        total = len(results)
        passed = sum(1 for r in results if r.passed)
        failed = total - passed

        errors = sum(1 for r in results if not r.passed and r.severity == RuleSeverity.ERROR)
        warnings = sum(1 for r in results if not r.passed and r.severity == RuleSeverity.WARNING)

        # Group by category
        by_category = {}
        for result in results:
            # Find the rule to get its category
            rule = next((r for r in self.rules if r.rule_id == result.rule_id), None)
            if rule:
                category = rule.category.value
                if category not in by_category:
                    by_category[category] = {"passed": 0, "failed": 0}

                if result.passed:
                    by_category[category]["passed"] += 1
                else:
                    by_category[category]["failed"] += 1

        return {
            "total_rules": total,
            "passed": passed,
            "failed": failed,
            "errors": errors,
            "warnings": warnings,
            "pass_rate": (passed / total * 100) if total > 0 else 0,
            "by_category": by_category,
            "approval_blocked": errors > 0,  # Cannot approve with errors
            "results": [r.to_dict() for r in results]
        }

    def get_rule_catalog(self) -> List[Dict[str, Any]]:
        """Get catalog of all available rules"""
        return [
            {
                "rule_id": rule.rule_id,
                "name": rule.name,
                "description": rule.description,
                "category": rule.category.value,
                "severity": rule.severity.value,
                "reference": rule.reference
            }
            for rule in self.rules
        ]


# Global rule engine instance
_rule_engine = None


def get_rule_engine() -> ADAMRuleEngine:
    """Get or create rule engine singleton"""
    global _rule_engine
    if _rule_engine is None:
        _rule_engine = ADAMRuleEngine()
    return _rule_engine
