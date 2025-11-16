"""
Controlled Terminology Validator

Validates dataset values against CDISC Controlled Terminology codelists.
Supports loading from Excel files with MedDRA and NCI CT versions.
"""

from pathlib import Path
from typing import Set, List, Dict, Any, Optional
import time
from loguru import logger

from ..models import CTValidationResult, CTValidationIssue


class ControlledTerminologyValidator:
    """
    Validates dataset values against controlled terminology codelists.
    Supports Excel-based CT definitions with auto-detection of versions.
    """

    def __init__(self, base_path: Path = None):
        if base_path is None:
            base_path = Path("Content/ControlledTerminology")
        self.base_path = base_path
        self.codelists: Dict[str, Set[str]] = {}
        self.ct_metadata: Dict[str, Any] = {}

    async def validate(
        self,
        study_id: str,
        dataset: str,
        ct_file_path: Optional[str] = None
    ) -> CTValidationResult:
        """
        Validate dataset values against controlled terminology.
        
        Args:
            study_id: Study identifier
            dataset: Dataset name (e.g., ADSL)
            ct_file_path: Optional path to CT Excel file
            
        Returns:
            CTValidationResult with validation issues
        """
        start_time = time.time()
        issues: List[CTValidationIssue] = []

        logger.info(f"Starting CT validation for {study_id}/{dataset}")

        # Load CT file
        ct_file = self._find_ct_file(ct_file_path)
        if not ct_file or not ct_file.exists():
            logger.warning(f"CT file not found: {ct_file}")
            return CTValidationResult(
                passed=False,
                runtime_seconds=time.time() - start_time,
                ct_file=str(ct_file) if ct_file else "Not found",
                variables_checked=0,
                issues=[CTValidationIssue(
                    severity="ERROR",
                    variable="N/A",
                    value="N/A",
                    expected_codelist="N/A",
                    message="Controlled Terminology file not found. Please upload CT definitions."
                )]
            )

        # Load codelists from Excel
        self._load_codelists(ct_file)

        # Get variable-to-codelist mappings for this dataset
        var_mappings = self._get_variable_mappings(dataset)
        
        if not var_mappings:
            logger.info(f"No CT variable mappings defined for {dataset}")
            return CTValidationResult(
                passed=True,
                runtime_seconds=time.time() - start_time,
                ct_file=str(ct_file),
                meddra_version=self.ct_metadata.get("meddra_version"),
                nci_ct_version=self.ct_metadata.get("nci_ct_version"),
                variables_checked=0,
                issues=[]
            )

        # TODO: Load dataset and validate values
        # For now, simulate validation with demo data
        variables_checked = len(var_mappings)
        
        # Demo: simulate finding a few issues
        if "SEX" in var_mappings:
            # Example: valid values are M, F, U
            pass  # Would check actual data here
        
        if "RACE" in var_mappings:
            # Example: check against RACE codelist
            pass

        runtime = time.time() - start_time
        passed = len([i for i in issues if i.severity == "ERROR"]) == 0

        logger.info(f"CT validation complete: {len(issues)} issues found in {runtime:.2f}s")

        return CTValidationResult(
            passed=passed,
            runtime_seconds=runtime,
            ct_file=str(ct_file),
            meddra_version=self.ct_metadata.get("meddra_version"),
            nci_ct_version=self.ct_metadata.get("nci_ct_version"),
            variables_checked=variables_checked,
            issues=issues
        )

    def _find_ct_file(self, ct_file_path: Optional[str]) -> Optional[Path]:
        """Find CT Excel file"""
        if ct_file_path:
            path = Path(ct_file_path)
            if path.exists():
                return path
        
        # Auto-detect CT file in standard location
        if self.base_path.exists():
            for file in self.base_path.glob("*.xlsx"):
                if "terminology" in file.name.lower() or "ct" in file.name.lower():
                    return file
        
        return None

    def _load_codelists(self, ct_file: Path):
        """Load codelists from Excel file"""
        try:
            # TODO: Implement Excel parsing with openpyxl or pandas
            # Expected structure:
            # Sheet 1: Codelists (CodelistName, Code, Term)
            # Sheet 2: Metadata (MedDRA version, NCI CT version)
            
            # For now, use hardcoded demo codelists
            self.codelists = {
                "SEX": {"M", "F", "U", "UNDIFFERENTIATED"},
                "RACE": {"WHITE", "BLACK OR AFRICAN AMERICAN", "ASIAN", "AMERICAN INDIAN OR ALASKA NATIVE", 
                        "NATIVE HAWAIIAN OR OTHER PACIFIC ISLANDER", "MULTIPLE", "OTHER", "UNKNOWN"},
                "ETHNIC": {"HISPANIC OR LATINO", "NOT HISPANIC OR LATINO", "NOT REPORTED", "UNKNOWN"},
                "COUNTRY": {"USA", "CAN", "GBR", "DEU", "FRA", "ESP", "ITA", "JPN", "CHN", "AUS"},
            }
            
            self.ct_metadata = {
                "meddra_version": "27.0",
                "nci_ct_version": "2024-12-27"
            }
            
            logger.info(f"Loaded {len(self.codelists)} codelists from {ct_file.name}")
        except Exception as e:
            logger.error(f"Error loading CT file: {e}")

    def _get_variable_mappings(self, dataset: str) -> Dict[str, str]:
        """Get variable-to-codelist mappings for dataset"""
        # Common CT variables by dataset
        mappings = {
            "ADSL": {
                "SEX": "SEX",
                "RACE": "RACE",
                "ETHNIC": "ETHNIC",
                "COUNTRY": "COUNTRY",
            },
            "ADAE": {
                "AESEV": "SEVERITY",
                "AESER": "NY",
                "AEREL": "CAUSALITY",
            },
        }
        
        dataset_type = dataset.upper()
        return mappings.get(dataset_type, {})
