"""Pre-flight validator - quick structural checks before P21"""

from pathlib import Path
from typing import Set, List
import time
import re
from loguru import logger

from ..models import PreflightResult, PreflightIssue


class PreflightValidator:
    """
    Quick structural validation before P21.
    Runs in < 5 seconds, catches obvious issues.
    """

    def __init__(self, base_path: Path = None):
        if base_path is None:
            base_path = Path("Content/UserInputs")
        self.base_path = base_path

    async def validate(
        self,
        study_id: str,
        dataset: str
    ) -> PreflightResult:
        """
        Perform quick structural checks.
        
        Checks:
        1. Dataset file exists
        2. Required variables present
        3. Variable naming conventions
        4. Label lengths
        5. Data type consistency
        """
        start_time = time.time()
        issues: List[PreflightIssue] = []

        logger.info(f"Starting preflight validation: {study_id}/{dataset}")

        # Check 1: File exists
        dataset_path = self._get_dataset_path(study_id, dataset)
        if not dataset_path.exists():
            issues.append(PreflightIssue(
                severity="ERROR",
                check="file_exists",
                message=f"Dataset file not found: {dataset_path}",
                suggested_fix="Verify the file path and upload the dataset"
            ))
            return PreflightResult(
                passed=False,
                has_blocking_errors=True,
                runtime_seconds=time.time() - start_time,
                issues=issues
            )

        # File exists - add success info
        issues.append(PreflightIssue(
            severity="INFO",
            check="file_exists",
            message=f"Dataset file found: {dataset_path.name}"
        ))

        # Check 2: Required variables (from ADAM rules)
        required_vars = self._load_required_variables(dataset)
        if required_vars:
            actual_vars = self._get_dataset_variables(dataset_path)
            if actual_vars:
                missing_vars = required_vars - actual_vars
                if missing_vars:
                    issues.append(PreflightIssue(
                        severity="ERROR",
                        check="required_variables",
                        message=f"Missing required variables: {', '.join(sorted(missing_vars))}",
                        suggested_fix="Add the missing variables to your dataset"
                    ))
                else:
                    issues.append(PreflightIssue(
                        severity="INFO",
                        check="required_variables",
                        message=f"All {len(required_vars)} required variables present"
                    ))
            
                # Check 3: Variable naming conventions
                naming_issues = self._check_naming_conventions(actual_vars)
                issues.extend(naming_issues)
                
                if not naming_issues:
                    issues.append(PreflightIssue(
                        severity="INFO",
                        check="naming_conventions",
                        message="Variable naming conventions valid"
                    ))
        else:
            # No required variables defined for this dataset type
            issues.append(PreflightIssue(
                severity="INFO",
                check="required_variables",
                message=f"No required variables defined for dataset type: {dataset}"
            ))

        # Check 4 & 5: Label lengths and data types require data loading (TODO)
        # For now, just report as not checked
        issues.append(PreflightIssue(
            severity="INFO",
            check="data_validation",
            message="Label length and data type checks require data loading (not yet implemented)"
        ))

        has_errors = any(i.severity == "ERROR" for i in issues)
        runtime = time.time() - start_time

        logger.info(f"Preflight complete: {len(issues)} issues found in {runtime:.2f}s")

        return PreflightResult(
            passed=not has_errors,
            has_blocking_errors=has_errors,
            runtime_seconds=runtime,
            issues=issues
        )

    def _get_dataset_path(self, study_id: str, dataset: str) -> Path:
        """Get path to dataset file"""
        # Try common extensions
        for ext in [".xpt", ".csv", ".xlsx", ".sas7bdat"]:
            path = self.base_path / study_id / f"{dataset}{ext}"
            if path.exists():
                return path
        # Default to .xpt (SAS Transport format - standard for FDA submissions)
        return self.base_path / study_id / f"{dataset}.xpt"

    def _load_required_variables(self, dataset: str) -> Set[str]:
        """Load required variables from ADAM rules"""
        # Common required variables by dataset type
        required_vars = {
            "ADSL": {"STUDYID", "USUBJID", "SUBJID", "SITEID", "AGE", "SEX", "RACE", "ARM", "ARMCD", "TRT01P", "TRT01A"},
            "ADAE": {"STUDYID", "USUBJID", "AESEQ", "AEDECOD", "AEBODSYS", "AESTDTC", "AEENDTC"},
            "ADLB": {"STUDYID", "USUBJID", "PARAMCD", "PARAM", "AVAL", "AVALU", "ADT"},
            "ADVS": {"STUDYID", "USUBJID", "PARAMCD", "PARAM", "AVAL", "AVALU", "ADT"},
            "ADTTE": {"STUDYID", "USUBJID", "PARAMCD", "PARAM", "AVAL", "CNSR", "STARTDT"},
        }
        
        # Get dataset type (strip any numeric suffix like ADSL01)
        dataset_type = re.sub(r'\d+$', '', dataset.upper())
        
        return required_vars.get(dataset_type, set())

    def _get_dataset_variables(self, dataset_path: Path) -> Set[str]:
        """Extract variable names from dataset"""
        # For now, return empty set - requires data loading implementation
        # TODO: Implement based on file type (.csv, .xpt, .xlsx)
        # For CSV: read first line
        # For XPT: use pyreadstat or xport
        # For Excel: use openpyxl or pandas
        
        if dataset_path.suffix == '.csv':
            try:
                with open(dataset_path, 'r') as f:
                    first_line = f.readline().strip()
                    return set(first_line.split(','))
            except Exception as e:
                logger.warning(f"Could not read CSV headers: {e}")
        
        return set()

    def _check_naming_conventions(self, variables: Set[str]) -> List[PreflightIssue]:
        """
        Validate variable naming per ADAM_VariablenamingRules.md
        
        Rules:
        - DT suffix: numeric date
        - DTM suffix: numeric datetime
        - FL suffix: Y/N flag
        - GRy pattern: grouping variables
        """
        issues = []
        
        # Pattern checks
        suspicious_vars = []

        for var in variables:
            # Check for common typos or non-standard naming
            
            # Date variables should end with DT (but not DTM)
            if 'DATE' in var.upper() and not var.endswith('DT') and not var.endswith('DTM'):
                suspicious_vars.append(f"{var} (contains 'DATE' but missing DT suffix)")
            
            # DateTime variables should end with DTM
            if 'TIME' in var.upper() and not var.endswith('DTM'):
                suspicious_vars.append(f"{var} (contains 'TIME' but missing DTM suffix)")
            
            # Check for invalid characters
            if not re.match(r'^[A-Z][A-Z0-9]*$', var):
                issues.append(PreflightIssue(
                    severity="WARNING",
                    check="naming_conventions",
                    message=f"Variable '{var}' contains invalid characters (should be uppercase alphanumeric only)",
                    variable=var,
                    suggested_fix="Use only uppercase letters and numbers"
                ))
        
        # Report suspicious variables as info (not warnings, as they may be valid)
        if suspicious_vars and len(suspicious_vars) <= 5:
            for susp in suspicious_vars:
                issues.append(PreflightIssue(
                    severity="INFO",
                    check="naming_conventions",
                    message=f"Review variable naming: {susp}"
                ))

        return issues

    def _check_label_lengths(self, dataset_path: Path) -> List[PreflightIssue]:
        """Check variable label lengths (≤256, warn if >200)"""
        issues = []
        # TODO: Implement once data loading available
        return issues

    def _check_data_types(self, dataset_path: Path) -> List[PreflightIssue]:
        """Check data type consistency"""
        issues = []
        # TODO: Implement once data loading available
        return issues
