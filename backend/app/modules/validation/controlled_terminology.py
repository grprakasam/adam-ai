"""
Controlled Terminology (CT) validator for ADAM datasets
Validates variable values against CDISC Controlled Terminology codelists
"""

from typing import List, Dict, Any, Optional
from pathlib import Path
import pandas as pd

from .models import ValidationIssue, ValidationSummary, CTValidationResponse


class ControlledTerminologyValidator:
    """
    Validates ADAM variables against Controlled Terminology codelists
    Reads from Excel file with codelist definitions
    """
    
    def __init__(self, ct_file_path: str = None):
        """
        Initialize CT validator
        
        Args:
            ct_file_path: Path to ControlledTerminology.xlsx file
        """
        if ct_file_path is None:
            # Default path
            ct_file_path = Path(__file__).parents[4] / "Content" / "ControlledTerminology" / "ControlledTerminology.xlsx"
        
        self.ct_file_path = Path(ct_file_path)
        self.codelists = self._load_codelists()
    
    def _load_codelists(self) -> Dict[str, Dict[str, Any]]:
        """
        Load controlled terminology codelists from Excel
        
        Expected Excel structure:
        Sheet: Codelists
        Columns: Codelist, Code, Decode, Version, Standard
        
        Returns:
            Dict mapping codelist_name to dict of valid codes
        """
        codelists = {}
        
        try:
            if not self.ct_file_path.exists():
                return {}
            
            # Read Excel file
            df = pd.read_excel(self.ct_file_path, sheet_name="Codelists")
            
            # Group by codelist
            for codelist_name in df["Codelist"].unique():
                codelist_df = df[df["Codelist"] == codelist_name]
                codelists[codelist_name] = {
                    "codes": set(codelist_df["Code"].astype(str).tolist()),
                    "version": codelist_df["Version"].iloc[0] if "Version" in codelist_df.columns else "Unknown",
                    "standard": codelist_df["Standard"].iloc[0] if "Standard" in codelist_df.columns else "CDISC"
                }
        
        except Exception as e:
            # Log error but don't fail
            print(f"Warning: Could not load CT file: {e}")
        
        return codelists
    
    def validate_variable(
        self,
        dataset_name: str,
        variable_name: str,
        codelist_name: str,
        values: List[str]
    ) -> List[ValidationIssue]:
        """
        Validate variable values against codelist
        
        Args:
            dataset_name: Dataset name
            variable_name: Variable name
            codelist_name: Codelist to validate against
            values: List of values to validate
        
        Returns:
            List of validation issues
        """
        issues = []
        
        if codelist_name not in self.codelists:
            issues.append(ValidationIssue(
                severity="WARNING",
                dataset=dataset_name,
                variable=variable_name,
                rule_id="CT-001",
                message=f"Codelist {codelist_name} not found in CT file",
                category="Controlled Terminology"
            ))
            return issues
        
        codelist = self.codelists[codelist_name]
        valid_codes = codelist["codes"]
        
        # Check each value
        invalid_values = []
        for value in values:
            if str(value) not in valid_codes and value is not None and value != "":
                invalid_values.append(value)
        
        if invalid_values:
            issues.append(ValidationIssue(
                severity="ERROR",
                dataset=dataset_name,
                variable=variable_name,
                rule_id="CT-002",
                message=f"Invalid values found: {', '.join(map(str, invalid_values[:5]))}{'...' if len(invalid_values) > 5 else ''}",
                location=f"{len(invalid_values)} invalid value(s) out of {len(values)} total",
                category="Controlled Terminology"
            ))
        
        return issues
    
    def validate(
        self,
        study_id: str,
        dataset_name: str,
        bindings: Dict[str, str],
        dataset_values: Dict[str, List[str]],
        versions: Optional[Dict[str, str]] = None
    ) -> CTValidationResponse:
        """
        Validate multiple variables against CT
        
        Args:
            study_id: Study identifier
            dataset_name: Dataset name
            bindings: Dict mapping variable_name to codelist_name
            dataset_values: Dict mapping variable_name to list of values
            versions: Optional version specifications
        
        Returns:
            CTValidationResponse with issues and summary
        """
        all_issues = []
        codelists_checked = []
        
        for var_name, codelist_name in bindings.items():
            if var_name in dataset_values:
                values = dataset_values[var_name]
                issues = self.validate_variable(
                    dataset_name,
                    var_name,
                    codelist_name,
                    values
                )
                all_issues.extend(issues)
                
                if codelist_name not in codelists_checked:
                    codelists_checked.append(codelist_name)
        
        # Create summary
        by_severity = {"ERROR": 0, "WARNING": 0, "INFO": 0}
        for issue in all_issues:
            by_severity[issue.severity] += 1
        
        summary = ValidationSummary(
            total_issues=len(all_issues),
            by_severity=by_severity,
            datasets_checked=[dataset_name]
        )
        
        return CTValidationResponse(
            issues=all_issues,
            summary=summary,
            codelists_checked=codelists_checked
        )
