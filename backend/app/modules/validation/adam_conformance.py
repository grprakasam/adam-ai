"""
Pre-P21 structural checks for ADAM datasets based on CDISC rules
"""

import re
from typing import List, Dict, Any
from pathlib import Path
import pandas as pd

from .models import ValidationIssue, ValidationSummary, PreP21Response


class AdamConformanceValidator:
    """
    Validates ADAM dataset structure before P21 validation
    Checks:
    - Required variables present
    - Key variables defined
    - Label lengths <= 256 characters
    - Date/datetime variable naming (DT/DTM suffix)
    - Flag variable naming (FL suffix)
    - Grouping variable naming (GR suffix)
    """
    
    def __init__(self, adam_rules_path: str = None):
        """
        Initialize validator with ADAM rules
        
        Args:
            adam_rules_path: Path to ADAM rules directory
        """
        if adam_rules_path is None:
            # Default to Context/ADAMRules
            adam_rules_path = Path(__file__).parents[4] / "Context" / "ADAMRules"
        
        self.adam_rules_path = Path(adam_rules_path)
        self.required_vars = self._load_required_variables()
        self.key_vars = self._load_key_variables()
    
    def _load_required_variables(self) -> Dict[str, List[str]]:
        """Load required variables per dataset from rules"""
        # Simplified - should parse from ADAM rules markdown files
        return {
            "ADSL": ["STUDYID", "USUBJID", "SUBJID", "SITEID", "AGE", "SEX", "RACE"],
            "ADAE": ["STUDYID", "USUBJID", "ASTDT", "AEDECOD", "AESER", "AESEV"],
            "ADLB": ["STUDYID", "USUBJID", "PARAMCD", "PARAM", "AVAL", "AVALU"]
        }
    
    def _load_key_variables(self) -> Dict[str, List[str]]:
        """Load key variables per dataset"""
        return {
            "ADSL": ["STUDYID", "USUBJID"],
            "ADAE": ["STUDYID", "USUBJID", "AESEQ"],
            "ADLB": ["STUDYID", "USUBJID", "PARAMCD", "AVISIT", "ATPT"]
        }
    
    def validate_dataset(
        self,
        dataset_name: str,
        variable_metadata: List[Dict[str, Any]]
    ) -> List[ValidationIssue]:
        """
        Validate a single ADAM dataset structure
        
        Args:
            dataset_name: Name of dataset (e.g., "ADSL")
            variable_metadata: List of variable metadata dicts with keys:
                - name: variable name
                - label: variable label
                - type: variable type
                - length: variable length
        
        Returns:
            List of validation issues
        """
        issues = []
        var_names = [v["name"] for v in variable_metadata]
        
        # Check required variables
        if dataset_name in self.required_vars:
            for req_var in self.required_vars[dataset_name]:
                if req_var not in var_names:
                    issues.append(ValidationIssue(
                        severity="ERROR",
                        dataset=dataset_name,
                        variable=req_var,
                        rule_id="ADAM-REQ-001",
                        message=f"Required variable {req_var} is missing",
                        category="Required Variables"
                    ))
        
        # Check key variables present
        if dataset_name in self.key_vars:
            for key_var in self.key_vars[dataset_name]:
                if key_var not in var_names:
                    issues.append(ValidationIssue(
                        severity="ERROR",
                        dataset=dataset_name,
                        variable=key_var,
                        rule_id="ADAM-KEY-001",
                        message=f"Key variable {key_var} is missing",
                        category="Key Variables"
                    ))
        
        # Check variable naming conventions
        for var_meta in variable_metadata:
            var_name = var_meta["name"]
            label = var_meta.get("label", "")
            
            # Check label length
            if len(label) > 256:
                issues.append(ValidationIssue(
                    severity="ERROR",
                    dataset=dataset_name,
                    variable=var_name,
                    rule_id="ADAM-LABEL-001",
                    message=f"Label length {len(label)} exceeds 256 characters",
                    category="Labels"
                ))
            
            # Check date variable naming (should end with DT or DTM)
            if "date" in label.lower() or "time" in label.lower():
                if not (var_name.endswith("DT") or var_name.endswith("DTM")):
                    issues.append(ValidationIssue(
                        severity="WARNING",
                        dataset=dataset_name,
                        variable=var_name,
                        rule_id="ADAM-NAME-001",
                        message=f"Date/time variable should end with DT or DTM suffix",
                        category="Naming Conventions"
                    ))
            
            # Check flag variable naming (should end with FL)
            if "flag" in label.lower():
                if not var_name.endswith("FL"):
                    issues.append(ValidationIssue(
                        severity="WARNING",
                        dataset=dataset_name,
                        variable=var_name,
                        rule_id="ADAM-NAME-002",
                        message=f"Flag variable should end with FL suffix",
                        category="Naming Conventions"
                    ))
            
            # Check grouping variable naming (should end with GR)
            if "group" in label.lower() and not var_name.startswith("PARAM"):
                if not var_name.endswith("GR"):
                    issues.append(ValidationIssue(
                        severity="INFO",
                        dataset=dataset_name,
                        variable=var_name,
                        rule_id="ADAM-NAME-003",
                        message=f"Grouping variable should consider GR suffix",
                        category="Naming Conventions"
                    ))
        
        return issues
    
    def validate(
        self,
        study_id: str,
        datasets: Dict[str, List[Dict[str, Any]]],
        rules_preset: str = "default"
    ) -> PreP21Response:
        """
        Validate multiple ADAM datasets
        
        Args:
            study_id: Study identifier
            datasets: Dict mapping dataset_name to list of variable metadata
            rules_preset: Rules preset to apply
        
        Returns:
            PreP21Response with all issues and summary
        """
        all_issues = []
        
        for dataset_name, var_metadata in datasets.items():
            issues = self.validate_dataset(dataset_name, var_metadata)
            all_issues.extend(issues)
        
        # Create summary
        by_severity = {"ERROR": 0, "WARNING": 0, "INFO": 0}
        for issue in all_issues:
            by_severity[issue.severity] += 1
        
        summary = ValidationSummary(
            total_issues=len(all_issues),
            by_severity=by_severity,
            datasets_checked=list(datasets.keys())
        )
        
        return PreP21Response(issues=all_issues, summary=summary)
