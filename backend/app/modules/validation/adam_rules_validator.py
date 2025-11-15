"""
ADAM Rules Validation Engine

Validates ADAM variable naming conventions, formats, and derivation logic
against CDISC ADAM Implementation Guide standards.

Based on: Context/ADAMRules/ADAM_VariablenamingRules.md
"""

import re
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from enum import Enum


class ValidationSeverity(str, Enum):
    """Validation severity levels"""
    ERROR = "error"
    WARNING = "warning"
    INFO = "info"


class ValidationResult(BaseModel):
    """Single validation result"""
    rule_id: str
    variable_name: str
    severity: ValidationSeverity
    message: str
    suggestion: Optional[str] = None


class ValidationSummary(BaseModel):
    """Summary of all validation results"""
    is_valid: bool
    total_checks: int
    errors: List[ValidationResult]
    warnings: List[ValidationResult]
    info: List[ValidationResult]


class ADAMRulesValidator:
    """
    Validator for ADAM variable naming conventions and format rules.
    
    Rules enforced:
    1. Variable suffix conventions (DT, DTM, FL, GRy, N)
    2. Treatment variable formats (TRTxxP, TRTxxA)
    3. Phase variable formats (APxxSDT, APxxEDT)
    4. Category ordering (CDISC standard)
    """
    
    # CDISC ADAM Category Order
    CDISC_CATEGORY_ORDER = [
        "Demographics",
        "Treatment",
        "Disposition",
        "Dates and Times",
        "Groupings and Populations",
        "Laboratory Values",
        "Vital Signs",
        "Other Variables"
    ]
    
    def __init__(self):
        self.results: List[ValidationResult] = []
    
    def validate_variable_naming(self, variable_name: str, variable_type: Optional[str] = None,
                                   variable_format: Optional[str] = None) -> List[ValidationResult]:
        """
        Validate variable naming conventions.
        
        Rules:
        - DT suffix → Date variables (numeric with DATE9. format)
        - DTM suffix → Datetime variables (numeric with DATETIME19. format)
        - FL suffix → Flag variables (character with Y/N values)
        - GRy suffix → Grouping variables (y = scheme number)
        - N suffix → Numeric equivalents of character variables
        """
        results = []
        
        # Rule 1: DT suffix (Date variables)
        if variable_name.endswith('DT') and not variable_name.endswith('EDT'):
            if variable_type and variable_type.lower() != 'numeric':
                results.append(ValidationResult(
                    rule_id="ADAM-001",
                    variable_name=variable_name,
                    severity=ValidationSeverity.ERROR,
                    message=f"{variable_name}: DT variables must be numeric type",
                    suggestion="Change variable type to numeric with DATE9. format"
                ))
            
            if variable_format and not variable_format.startswith('DATE9'):
                results.append(ValidationResult(
                    rule_id="ADAM-002",
                    variable_name=variable_name,
                    severity=ValidationSeverity.ERROR,
                    message=f"{variable_name}: DT variables must use DATE9. format",
                    suggestion="Apply DATE9. format to this date variable"
                ))
        
        # Rule 2: DTM suffix (Datetime variables)
        if variable_name.endswith('DTM'):
            if variable_type and variable_type.lower() != 'numeric':
                results.append(ValidationResult(
                    rule_id="ADAM-003",
                    variable_name=variable_name,
                    severity=ValidationSeverity.ERROR,
                    message=f"{variable_name}: DTM variables must be numeric type",
                    suggestion="Change variable type to numeric with DATETIME19. format"
                ))
            
            if variable_format and not variable_format.startswith('DATETIME19'):
                results.append(ValidationResult(
                    rule_id="ADAM-004",
                    variable_name=variable_name,
                    severity=ValidationSeverity.ERROR,
                    message=f"{variable_name}: DTM variables must use DATETIME19. format",
                    suggestion="Apply DATETIME19. format to this datetime variable"
                ))
        
        # Rule 3: FL suffix (Flag variables)
        if variable_name.endswith('FL'):
            if variable_type and variable_type.lower() != 'character':
                results.append(ValidationResult(
                    rule_id="ADAM-005",
                    variable_name=variable_name,
                    severity=ValidationSeverity.ERROR,
                    message=f"{variable_name}: FL variables must be character type",
                    suggestion="Change variable type to character with Y/N values"
                ))
            
            # Note: Actual Y/N value check would require inspecting data
            results.append(ValidationResult(
                rule_id="ADAM-006",
                variable_name=variable_name,
                severity=ValidationSeverity.INFO,
                message=f"{variable_name}: Ensure FL variable contains only Y/N values",
                suggestion="Validate that flag values are Y or N (or missing)"
            ))
        
        # Rule 4: GRy suffix (Grouping variables)
        if re.match(r'^.+GR\d+$', variable_name):
            results.append(ValidationResult(
                rule_id="ADAM-007",
                variable_name=variable_name,
                severity=ValidationSeverity.WARNING,
                message=f"{variable_name}: Grouping variable detected - verify scheme number is consistent",
                suggestion="Ensure GR scheme number (y) is sequential and documented"
            ))
        
        # Rule 5: N suffix (Numeric equivalents)
        if variable_name.endswith('N') and not variable_name.endswith('MIN'):
            base_var = variable_name[:-1]
            results.append(ValidationResult(
                rule_id="ADAM-008",
                variable_name=variable_name,
                severity=ValidationSeverity.INFO,
                message=f"{variable_name}: Numeric equivalent variable - ensure {base_var} exists as character",
                suggestion=f"Verify that character variable {base_var} is present in dataset"
            ))
        
        return results
    
    def validate_treatment_variables(self, variable_name: str) -> List[ValidationResult]:
        """
        Validate treatment variable naming conventions.
        
        Rules:
        - TRTxxP: Treatment period (xx = 01, 02, 03, etc. with leading zero)
        - TRTxxA: Actual treatment (xx = 01, 02, 03, etc. with leading zero)
        """
        results = []
        
        # Check TRTxxP format
        if 'TRT' in variable_name and variable_name.endswith('P'):
            if not re.match(r'^TRT\d{2}P$', variable_name):
                results.append(ValidationResult(
                    rule_id="ADAM-009",
                    variable_name=variable_name,
                    severity=ValidationSeverity.ERROR,
                    message=f"{variable_name}: Treatment period must follow TRTxxP format (e.g., TRT01P, TRT02P)",
                    suggestion="Use TRT01P, TRT02P, TRT03P with two-digit numbers and leading zeros"
                ))
        
        # Check TRTxxA format
        if 'TRT' in variable_name and variable_name.endswith('A'):
            if not re.match(r'^TRT\d{2}A$', variable_name):
                results.append(ValidationResult(
                    rule_id="ADAM-010",
                    variable_name=variable_name,
                    severity=ValidationSeverity.ERROR,
                    message=f"{variable_name}: Actual treatment must follow TRTxxA format (e.g., TRT01A, TRT02A)",
                    suggestion="Use TRT01A, TRT02A, TRT03A with two-digit numbers and leading zeros"
                ))
        
        return results
    
    def validate_phase_variables(self, variable_name: str) -> List[ValidationResult]:
        """
        Validate phase variable naming conventions.
        
        Rules:
        - APxxSDT: Analysis phase xx start date (xx = 01, 02, etc.)
        - APxxEDT: Analysis phase xx end date (xx = 01, 02, etc.)
        """
        results = []
        
        if variable_name.startswith('AP') and ('SDT' in variable_name or 'EDT' in variable_name):
            if not re.match(r'^AP\d{2}[SE]DT$', variable_name):
                results.append(ValidationResult(
                    rule_id="ADAM-011",
                    variable_name=variable_name,
                    severity=ValidationSeverity.ERROR,
                    message=f"{variable_name}: Phase variables must follow APxxSDT/APxxEDT format (e.g., AP01SDT, AP01EDT)",
                    suggestion="Use AP01SDT/AP01EDT, AP02SDT/AP02EDT with two-digit phase numbers"
                ))
        
        return results
    
    def validate_category_order(self, categories: List[str]) -> List[ValidationResult]:
        """
        Validate that variable categories follow CDISC standard ordering.
        
        Categories should appear in this order:
        1. Demographics
        2. Treatment
        3. Disposition
        4. Dates and Times
        5. Groupings and Populations
        6. Laboratory Values
        7. Vital Signs
        8. Other Variables
        """
        results = []
        
        for i, category in enumerate(categories):
            if category in self.CDISC_CATEGORY_ORDER:
                expected_position = self.CDISC_CATEGORY_ORDER.index(category)
                
                if i != expected_position:
                    results.append(ValidationResult(
                        rule_id="ADAM-012",
                        variable_name=category,
                        severity=ValidationSeverity.WARNING,
                        message=f"Category '{category}' at position {i}, expected at {expected_position} per CDISC standard",
                        suggestion=f"Reorder categories to follow CDISC standard: {', '.join(self.CDISC_CATEGORY_ORDER)}"
                    ))
        
        return results
    
    def validate_variable(self, variable_name: str, variable_type: Optional[str] = None,
                          variable_format: Optional[str] = None, 
                          category: Optional[str] = None) -> List[ValidationResult]:
        """
        Comprehensive validation of a single variable.
        
        Runs all applicable validation rules and returns results.
        """
        results = []
        
        # Run naming convention validation
        results.extend(self.validate_variable_naming(variable_name, variable_type, variable_format))
        
        # Run treatment variable validation
        results.extend(self.validate_treatment_variables(variable_name))
        
        # Run phase variable validation
        results.extend(self.validate_phase_variables(variable_name))
        
        return results
    
    def validate_dataset(self, variables: List[Dict[str, Any]], 
                         categories: Optional[List[str]] = None) -> ValidationSummary:
        """
        Validate an entire ADAM dataset specification.
        
        Args:
            variables: List of variable dictionaries with keys:
                - name: str (required)
                - type: str (optional)
                - format: str (optional)
                - category: str (optional)
            categories: List of category names in order (optional)
        
        Returns:
            ValidationSummary with all results
        """
        all_results = []
        
        # Validate each variable
        for var in variables:
            var_name = var.get('name', '')
            var_type = var.get('type')
            var_format = var.get('format')
            var_category = var.get('category')
            
            results = self.validate_variable(var_name, var_type, var_format, var_category)
            all_results.extend(results)
        
        # Validate category ordering if provided
        if categories:
            all_results.extend(self.validate_category_order(categories))
        
        # Categorize results
        errors = [r for r in all_results if r.severity == ValidationSeverity.ERROR]
        warnings = [r for r in all_results if r.severity == ValidationSeverity.WARNING]
        info = [r for r in all_results if r.severity == ValidationSeverity.INFO]
        
        return ValidationSummary(
            is_valid=len(errors) == 0,
            total_checks=len(all_results),
            errors=errors,
            warnings=warnings,
            info=info
        )


# Quick validation functions for convenience
def quick_validate_variable(variable_name: str, variable_type: Optional[str] = None,
                             variable_format: Optional[str] = None) -> Dict[str, Any]:
    """Quick validation of a single variable, returns dict"""
    validator = ADAMRulesValidator()
    results = validator.validate_variable(variable_name, variable_type, variable_format)
    
    return {
        'is_valid': len([r for r in results if r.severity == ValidationSeverity.ERROR]) == 0,
        'errors': [r.dict() for r in results if r.severity == ValidationSeverity.ERROR],
        'warnings': [r.dict() for r in results if r.severity == ValidationSeverity.WARNING],
        'info': [r.dict() for r in results if r.severity == ValidationSeverity.INFO],
    }
