"""
Test Validation Service

Validates test output against expected results, performs:
- Dataset structure validation
- Variable-level comparison
- CDISC compliance checks
- Statistical validation
"""

import logging
import pandas as pd
from pathlib import Path
from typing import Optional, List, Dict, Any
from datetime import datetime

from ..models import (
    TestValidationResult,
    ValidationIssue,
)

logger = logging.getLogger(__name__)


class TestValidationService:
    """
    Service for validating test execution output
    """

    def __init__(self):
        self.validation_history: Dict[str, TestValidationResult] = {}

    async def validate_output(
        self,
        actual_dataset_path: str,
        expected_dataset_path: Optional[str],
        validation_level: str,
        test_id: str,
    ) -> TestValidationResult:
        """
        Validate test output against expected results

        Args:
            actual_dataset_path: Path to actual output dataset
            expected_dataset_path: Path to expected output dataset (optional)
            validation_level: basic | standard | strict
            test_id: Test execution ID

        Returns:
            TestValidationResult with comparison details
        """
        logger.info(f"Validating test output: {test_id}, level: {validation_level}")

        issues: List[ValidationIssue] = []

        # Load actual dataset
        try:
            actual_df = self._load_dataset(actual_dataset_path)
        except Exception as e:
            logger.error(f"Failed to load actual dataset: {str(e)}")
            issues.append(ValidationIssue(
                severity="ERROR",
                message=f"Failed to load actual dataset: {str(e)}",
            ))
            return self._create_validation_result(test_id, "actual_dataset", issues)

        # Validate structure
        structure_issues = self._validate_structure(actual_df, validation_level)
        issues.extend(structure_issues)

        # Validate against expected dataset if provided
        if expected_dataset_path:
            try:
                expected_df = self._load_dataset(expected_dataset_path)
                comparison_issues = self._compare_datasets(actual_df, expected_df, validation_level)
                issues.extend(comparison_issues)
            except Exception as e:
                logger.warning(f"Could not load expected dataset: {str(e)}")
                issues.append(ValidationIssue(
                    severity="WARNING",
                    message=f"Expected dataset not available: {str(e)}",
                ))

        # CDISC compliance checks
        cdisc_issues = self._validate_cdisc_compliance(actual_df, validation_level)
        issues.extend(cdisc_issues)

        # Create result
        result = self._create_validation_result(test_id, Path(actual_dataset_path).stem, issues)

        # Store in history
        self.validation_history[test_id] = result

        logger.info(f"Validation completed: {test_id} - {result.total_issues} issues found")
        return result

    def _load_dataset(self, file_path: str) -> pd.DataFrame:
        """Load dataset from file"""
        path = Path(file_path)

        if path.suffix == '.csv':
            return pd.read_csv(path)
        elif path.suffix in ['.sas7bdat', '.xpt']:
            # For SAS datasets, would use pyreadstat or pandas
            # For now, assume CSV
            raise ValueError(f"SAS dataset loading not yet implemented: {path.suffix}")
        else:
            raise ValueError(f"Unsupported file format: {path.suffix}")

    def _validate_structure(self, df: pd.DataFrame, level: str) -> List[ValidationIssue]:
        """Validate dataset structure"""
        issues = []

        # Check for empty dataset
        if len(df) == 0:
            issues.append(ValidationIssue(
                severity="ERROR",
                message="Dataset is empty (0 rows)",
            ))
            return issues

        # Check for missing columns
        if len(df.columns) == 0:
            issues.append(ValidationIssue(
                severity="ERROR",
                message="Dataset has no columns",
            ))

        # Check for duplicate rows (strict mode)
        if level == "strict":
            duplicates = df.duplicated().sum()
            if duplicates > 0:
                issues.append(ValidationIssue(
                    severity="WARNING",
                    message=f"Found {duplicates} duplicate rows",
                ))

        # Check for null values in key columns
        key_columns = ['STUDYID', 'USUBJID', 'DOMAIN']
        for col in key_columns:
            if col in df.columns:
                null_count = df[col].isnull().sum()
                if null_count > 0:
                    issues.append(ValidationIssue(
                        severity="ERROR",
                        message=f"Found {null_count} null values in key column: {col}",
                        variable=col,
                    ))

        return issues

    def _compare_datasets(
        self,
        actual_df: pd.DataFrame,
        expected_df: pd.DataFrame,
        level: str
    ) -> List[ValidationIssue]:
        """Compare actual vs expected datasets"""
        issues = []

        # Check row counts
        if len(actual_df) != len(expected_df):
            issues.append(ValidationIssue(
                severity="ERROR",
                message=f"Row count mismatch: actual={len(actual_df)}, expected={len(expected_df)}",
            ))

        # Check column sets
        actual_cols = set(actual_df.columns)
        expected_cols = set(expected_df.columns)

        missing_cols = expected_cols - actual_cols
        if missing_cols:
            issues.append(ValidationIssue(
                severity="ERROR",
                message=f"Missing columns: {', '.join(sorted(missing_cols))}",
            ))

        extra_cols = actual_cols - expected_cols
        if extra_cols and level in ["standard", "strict"]:
            issues.append(ValidationIssue(
                severity="WARNING",
                message=f"Extra columns: {', '.join(sorted(extra_cols))}",
            ))

        # Compare common columns
        common_cols = actual_cols & expected_cols
        for col in common_cols:
            col_issues = self._compare_column(actual_df[col], expected_df[col], col, level)
            issues.extend(col_issues)

        return issues

    def _compare_column(
        self,
        actual_col: pd.Series,
        expected_col: pd.Series,
        col_name: str,
        level: str
    ) -> List[ValidationIssue]:
        """Compare a single column"""
        issues = []

        # Check data types
        if actual_col.dtype != expected_col.dtype:
            issues.append(ValidationIssue(
                severity="WARNING",
                message=f"Data type mismatch in column {col_name}: actual={actual_col.dtype}, expected={expected_col.dtype}",
                variable=col_name,
            ))

        # For strict validation, compare values
        if level == "strict":
            # Compare values (accounting for floating point precision)
            if pd.api.types.is_numeric_dtype(actual_col) and pd.api.types.is_numeric_dtype(expected_col):
                # Numeric comparison with tolerance
                if not actual_col.equals(expected_col):
                    diff_count = (~np.isclose(actual_col.fillna(0), expected_col.fillna(0), rtol=1e-5, equal_nan=True)).sum()
                    if diff_count > 0:
                        issues.append(ValidationIssue(
                            severity="ERROR",
                            message=f"Value differences in column {col_name}: {diff_count} rows differ",
                            variable=col_name,
                        ))
            else:
                # String comparison
                if not actual_col.equals(expected_col):
                    diff_count = (actual_col != expected_col).sum()
                    if diff_count > 0:
                        issues.append(ValidationIssue(
                            severity="ERROR",
                            message=f"Value differences in column {col_name}: {diff_count} rows differ",
                            variable=col_name,
                        ))

        return issues

    def _validate_cdisc_compliance(self, df: pd.DataFrame, level: str) -> List[ValidationIssue]:
        """Validate CDISC compliance"""
        issues = []

        # Basic CDISC checks
        required_adam_vars = ['STUDYID', 'USUBJID']
        for var in required_adam_vars:
            if var not in df.columns:
                issues.append(ValidationIssue(
                    severity="ERROR",
                    message=f"Missing required CDISC variable: {var}",
                    variable=var,
                    rule="CDISC-ADAM-REQUIRED",
                ))

        # Check variable naming conventions (strict mode)
        if level == "strict":
            for col in df.columns:
                if not col.isupper():
                    issues.append(ValidationIssue(
                        severity="WARNING",
                        message=f"Variable name not uppercase: {col}",
                        variable=col,
                        rule="CDISC-NAMING",
                    ))

                if len(col) > 8 and not col.endswith(('DT', 'TM', 'DTM', 'DTC', 'FL', 'GR')):
                    # ADAM variables can be > 8 chars with specific suffixes
                    issues.append(ValidationIssue(
                        severity="INFO",
                        message=f"Variable name longer than 8 characters: {col}",
                        variable=col,
                        rule="CDISC-LENGTH",
                    ))

        return issues

    def _create_validation_result(
        self,
        test_id: str,
        dataset_name: str,
        issues: List[ValidationIssue]
    ) -> TestValidationResult:
        """Create validation result from issues"""

        errors = sum(1 for i in issues if i.severity == "ERROR")
        warnings = sum(1 for i in issues if i.severity == "WARNING")
        info = sum(1 for i in issues if i.severity == "INFO")

        return TestValidationResult(
            test_id=test_id,
            dataset_name=dataset_name,
            total_issues=len(issues),
            errors=errors,
            warnings=warnings,
            info=info,
            issues=issues,
            validated_at=datetime.now(),
        )

    async def get_validation_result(self, test_id: str) -> Optional[TestValidationResult]:
        """Retrieve validation result by test ID"""
        return self.validation_history.get(test_id)


# Import numpy for numerical comparison
import numpy as np
