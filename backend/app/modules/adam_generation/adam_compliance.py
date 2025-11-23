"""
ADAM Dataset Compliance Module

Handles CDISC ADAM IG compliance requirements:
- Variable ordering
- Type validation
- Label and metadata preservation
"""

from typing import List, Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)


class ADAMCompliance:
    """Ensures ADAM datasets comply with CDISC ADAM IG requirements"""
    
    # CDISC ADAM Variable Ordering for ADSL
    ADSL_VARIABLE_ORDER = [
        # 1. Identifiers (required order)
        "STUDYID", "USUBJID", "SUBJID", "SITEID",
        # 2. Demographics
        "AGE", "AGEU", "SEX", "RACE", "ETHNIC", "ARM", "ARMCD", "ACTARM", "ACTARMCD",
        # 3. Treatment Variables
        "TRT01P", "TRT01A", "TRT02P", "TRT02A", "TRTSDT", "TRTEDT", "TRTDURD", 
        "TRTSDTM", "TRTEDTM", "TRT01PN", "TRT01AN", "TRT02PN", "TRT02AN",
        # 4. Disposition
        "DCSREAS", "DCREASCD", "DTHFL", "DTHDTC", "DTHDT",
        # 5. Reference Dates
        "RFSTDTC", "RFENDTC", "RFSTDT", "RFENDT", "RFICDTC", "RFICDT",
        # 6. Groupings and Populations
        "AGEGR1", "AGEGR1N", "SITEGR1", "RACEGR1", "ITTFL", "SAFFL", "EFFFL", "FASFL",
        # 7. Other dates
        "LSTALVDT", "LSTALVDTC",
        # 8. Other variables (alphabetical)
    ]
    
    # CDISC ADAM Variable Ordering for ADAE
    ADAE_VARIABLE_ORDER = [
        # 1. Identifiers
        "STUDYID", "USUBJID", "SUBJID", "SITEID",
        # 2. Sequence and Event
        "AESEQ", "AEDECOD", "AETERM", "AEBODSYS", "AESOC",
        # 3. Dates
        "ASTDT", "ASTDTM", "AENDT", "AENDTM", "ASTDY", "AENDY",
        # 4. Severity and Seriousness
        "AESEV", "AESER", "AESDTH", "AESHOSP", "AESLIFE", "AESDISAB", "AESCONG",
        # 5. Treatment
        "TRTSDT", "TRTEDT", "TRTA", "TRTAN",
        # 6. Flags
        "AOCCFL", "AOCCSFL", "AOCCPFL",
        # 7. Other variables (alphabetical)
    ]
    
    # CDISC ADAM Variable Ordering for ADLB
    ADLB_VARIABLE_ORDER = [
        # 1. Identifiers
        "STUDYID", "USUBJID", "SUBJID", "SITEID",
        # 2. Parameter
        "PARAMCD", "PARAM", "PARAMN", "PARCAT1", "PARCAT2",
        # 3. Visit and Timepoint
        "AVISIT", "AVISITN", "ATPT", "ATPTN", "ADY", "ADT", "ADTM",
        # 4. Analysis Values
        "AVAL", "AVALC", "AVALU", "BASE", "CHG", "PCHG",
        # 5. Treatment
        "TRTSDT", "TRTEDT", "TRTA", "TRTAN",
        # 6. Flags
        "ABLFL", "ANL01FL", "ANL02FL",
        # 7. Other variables (alphabetical)
    ]
    
    # Variable type rules
    DATE_VARIABLES = ["DT", "DTM"]  # Suffixes that indicate date/datetime
    FLAG_VARIABLES = ["FL"]  # Suffixes that indicate flags
    GROUPING_VARIABLES = ["GR"]  # Suffixes that indicate groupings
    
    @classmethod
    def get_variable_order(cls, dataset_name: str) -> List[str]:
        """Get CDISC variable ordering for a dataset"""
        dataset_upper = dataset_name.upper()
        if dataset_upper == "ADSL":
            return cls.ADSL_VARIABLE_ORDER.copy()
        elif dataset_upper == "ADAE":
            return cls.ADAE_VARIABLE_ORDER.copy()
        elif dataset_upper == "ADLB":
            return cls.ADLB_VARIABLE_ORDER.copy()
        else:
            # Default: identifiers first, then alphabetical
            return ["STUDYID", "USUBJID", "SUBJID", "SITEID"]
    
    @classmethod
    def order_variables(cls, dataset_name: str, variable_names: List[str]) -> List[str]:
        """
        Order variables according to CDISC ADAM IG requirements
        
        Args:
            dataset_name: Name of ADAM dataset (ADSL, ADAE, ADLB, etc.)
            variable_names: List of variable names in current order
            
        Returns:
            List of variable names in CDISC order
        """
        order_template = cls.get_variable_order(dataset_name)
        ordered = []
        remaining = set(variable_names)
        
        # Add variables in CDISC order
        for var in order_template:
            if var in remaining:
                ordered.append(var)
                remaining.remove(var)
        
        # Add remaining variables in alphabetical order
        ordered.extend(sorted(remaining))
        
        return ordered
    
    @classmethod
    def get_variable_type_rules(cls) -> Dict[str, Dict[str, Any]]:
        """Get variable type validation rules"""
        return {
            "date": {
                "suffixes": ["DT"],
                "required_type": "numeric",
                "format": "DATE9.",
                "description": "Date variables must be numeric (SAS date value)"
            },
            "datetime": {
                "suffixes": ["DTM"],
                "required_type": "numeric",
                "format": "DATETIME19.",
                "description": "Datetime variables must be numeric (SAS datetime value)"
            },
            "flag": {
                "suffixes": ["FL"],
                "required_type": "character",
                "length": 1,
                "values": ["Y", "N", ""],
                "description": "Flag variables must be character(1) with Y/N values"
            },
            "grouping": {
                "suffixes": ["GR"],
                "required_type": "character",
                "max_length": 200,
                "description": "Grouping variables are character"
            }
        }
    
    @classmethod
    def validate_variable_name(cls, var_name: str) -> Dict[str, Any]:
        """
        Validate variable name against ADAM naming conventions
        
        Returns:
            Dict with validation results
        """
        issues = []
        warnings = []
        
        # Check uppercase
        if not var_name.isupper():
            warnings.append(f"Variable name should be uppercase: {var_name}")
        
        # Check length
        if len(var_name) > 8 and not any(var_name.endswith(suffix) for suffix in ["DT", "DTM", "DTC", "FL", "GR", "GR1", "GR2"]):
            warnings.append(f"Variable name > 8 characters without standard suffix: {var_name}")
        
        # Check suffix conventions
        type_rules = cls.get_variable_type_rules()
        for var_type, rules in type_rules.items():
            for suffix in rules["suffixes"]:
                if var_name.endswith(suffix):
                    return {
                        "type": var_type,
                        "rules": rules,
                        "issues": issues,
                        "warnings": warnings
                    }
        
        return {
            "type": "other",
            "rules": {},
            "issues": issues,
            "warnings": warnings
        }
    
    @classmethod
    def get_variable_label(cls, var_name: str, dataset_name: str) -> Optional[str]:
        """Get standard variable label for common ADAM variables"""
        labels = {
            "STUDYID": "Study Identifier",
            "USUBJID": "Unique Subject Identifier",
            "SUBJID": "Subject Identifier for the Study",
            "SITEID": "Study Site Identifier",
            "AGE": "Age",
            "AGEU": "Age Units",
            "SEX": "Sex",
            "RACE": "Race",
            "ETHNIC": "Ethnicity",
            "TRTSDT": "Date of First Exposure to Treatment",
            "TRTEDT": "Date of Last Exposure to Treatment",
            "TRTDURD": "Total Treatment Duration (Days)",
            "TRT01P": "Planned Treatment for Period 01",
            "TRT01A": "Actual Treatment for Period 01",
            "ITTFL": "Intent-to-Treat Population Flag",
            "SAFFL": "Safety Population Flag",
            "EFFFL": "Efficacy Population Flag",
            "DTHFL": "Subject Death Flag",
            "DTHDTC": "Date/Time of Death",
            "RFSTDTC": "Subject Reference Start Date/Time",
            "RFENDTC": "Subject Reference End Date/Time",
        }
        return labels.get(var_name.upper())
    
    @classmethod
    def get_variable_format(cls, var_name: str) -> Optional[str]:
        """Get standard format for variable"""
        if var_name.endswith("DT"):
            return "DATE9."
        elif var_name.endswith("DTM"):
            return "DATETIME19."
        elif var_name.endswith("DTC"):
            return "$ISO8601DT"
        elif var_name.endswith("FL"):
            return "$1"
        return None

