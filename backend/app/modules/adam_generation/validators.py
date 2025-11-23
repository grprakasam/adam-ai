"""
Input validators for ADAM generation
"""

import logging
from pathlib import Path
from typing import List, Dict, Any, Optional
from dataclasses import dataclass

from .schemas import SDTMInputCheck
from .exceptions import ValidationError
from .code_analyzer import CodeAnalyzer, CodeAnalysisResult

logger = logging.getLogger(__name__)


@dataclass
class ValidationResult:
    """Result of input validation"""
    is_valid: bool
    errors: List[str]
    required_domains: List[str]
    available_domains: List[str]
    missing_domains: List[str]
    metadata: Dict[str, Dict[str, Any]] = None
    code_analysis: Optional[CodeAnalysisResult] = None
    detection_method: str = "default"  # 'default', 'code_analysis', or 'hybrid'


class InputValidator:
    """Validate inputs before ADAM generation"""

    # Required SDTM domains per ADAM dataset
    REQUIRED_DOMAINS = {
        "ADSL": ["DM", "EX", "DS"],
        "ADAE": ["DM", "AE", "EX"],
        "ADLB": ["DM", "LB", "EX"],
        "ADVS": ["DM", "VS", "EX"],
        "ADTTE": ["DM", "DS", "AE"],
    }

    # Optional but recommended domains
    OPTIONAL_DOMAINS = {
        "ADSL": ["AE", "LB", "VS"],
        "ADAE": ["LB", "VS"],
        "ADLB": ["AE", "VS"],
        "ADVS": ["AE", "LB"],
        "ADTTE": ["LB", "VS"],
    }

    def __init__(self, base_path: Optional[Path] = None):
        """Initialize validator with base path for SDTM datasets"""
        if base_path is None:
            # Default to Content/Generated/SDTM - resolve relative to backend directory
            # This ensures consistent path resolution regardless of where the code runs
            backend_dir = Path(__file__).resolve().parents[3]  # Go up to backend/app/modules/adam_generation -> backend
            self.base_path = (backend_dir / "Content" / "Generated" / "SDTM").resolve()
        else:
            self.base_path = Path(base_path).resolve() if base_path else Path("Content/Generated/SDTM").resolve()

        # Initialize code analyzer for intelligent dataset detection
        self.code_analyzer = CodeAnalyzer()

        logger.info(f"InputValidator initialized with base_path: {self.base_path}")

    async def validate_inputs(self, study_id: str, adam_dataset: str) -> ValidationResult:
        """Validate that required SDTM datasets are available"""
        required = self.REQUIRED_DOMAINS.get(adam_dataset, [])
        optional = self.OPTIONAL_DOMAINS.get(adam_dataset, [])

        study_path = self.base_path / study_id
        
        logger.info(f"Checking SDTM datasets in: {study_path} (exists: {study_path.exists()})")
        
        available = []
        missing = []
        metadata = {}

        # First, scan the directory for ALL available SDTM files
        # This ensures we find all datasets generated, not just required ones
        all_available_domains = set()
        if study_path.exists():
            for csv_file in study_path.glob("*.csv"):
                domain = csv_file.stem.upper()
                # Skip metadata files and ensure it's a valid domain name
                if domain not in ['METADATA'] and len(domain) >= 2:
                    all_available_domains.add(domain)
                    if domain not in available:
                        available.append(domain)
                        metadata[domain] = self._get_file_metadata(csv_file)
                        logger.debug(f"Found SDTM dataset: {domain} at {csv_file}")
        else:
            logger.warning(f"SDTM directory does not exist: {study_path}")
            logger.info(f"Base path: {self.base_path}, Study ID: {study_id}")
        
        logger.info(f"Found {len(all_available_domains)} SDTM datasets in {study_path}: {sorted(all_available_domains)}")

        # Check each required domain
        for domain in required:
            if domain not in all_available_domains:
                missing.append(domain)
                metadata[domain] = {"exists": False}
            elif domain not in available:
                # Domain is required and exists, ensure it's in available list
                domain_file = study_path / f"{domain}.csv"
                available.append(domain)
                metadata[domain] = self._get_file_metadata(domain_file)

        # Check optional domains (add to available if found)
        for domain in optional:
            if domain in all_available_domains and domain not in available:
                domain_file = study_path / f"{domain}.csv"
                available.append(domain)
                metadata[domain] = self._get_file_metadata(domain_file)

        # Remove duplicates and sort
        available = sorted(list(set(available)))
        missing = sorted(list(set(missing)))

        errors = []
        if missing:
            errors.append(f"Missing required SDTM domains: {', '.join(missing)}")

        logger.info(f"Validation result for {study_id}/{adam_dataset}: {len(available)} available, {len(missing)} missing")

        return ValidationResult(
            is_valid=len(missing) == 0,
            errors=errors,
            required_domains=required,
            available_domains=available,
            missing_domains=missing,
            metadata=metadata
        )

    async def check_sdtm_availability(
        self,
        study_id: str,
        adam_dataset: str,
        consolidated_code: Optional[str] = None,
        language: str = 'R'
    ) -> SDTMInputCheck:
        """
        Check SDTM dataset availability for a study.

        If consolidated_code is provided, uses intelligent code analysis.
        Otherwise, uses default ADAM dataset mapping.

        Args:
            study_id: Study identifier
            adam_dataset: ADAM dataset name
            consolidated_code: Optional R/SAS code to analyze
            language: Programming language ('R' or 'SAS')

        Returns:
            SDTMInputCheck with dataset availability and analysis metadata
        """
        # Use code-aware validation if code is provided
        if consolidated_code:
            result = await self.validate_inputs_with_code(
                study_id, adam_dataset, consolidated_code, language
            )
        else:
            result = await self.validate_inputs(study_id, adam_dataset)

        # Build response with code analysis metadata
        return SDTMInputCheck(
            study_id=study_id,
            adam_dataset=adam_dataset,
            required_domains=result.required_domains,
            available_domains=result.available_domains,
            missing_domains=result.missing_domains,
            dataset_metadata=result.metadata or {},
            detection_method=result.detection_method,
            confidence_level=result.code_analysis.confidence_level if result.code_analysis else None,
            code_analysis_warnings=result.code_analysis.warnings if result.code_analysis else None,
            dataset_operations=result.code_analysis.dataset_operations if result.code_analysis else None
        )

    def _get_file_metadata(self, file_path: Path) -> Dict[str, Any]:
        """Get metadata about a CSV file"""
        try:
            import pandas as pd
            df = pd.read_csv(file_path, nrows=0)  # Read only headers
            return {
                "exists": True,
                "columns": list(df.columns),
                "column_count": len(df.columns),
                "file_size": file_path.stat().st_size,
            }
        except Exception as e:
            logger.error(f"Error reading metadata for {file_path}: {e}")
            return {
                "exists": True,
                "error": str(e)
            }

    async def validate_inputs_with_code(
        self,
        study_id: str,
        adam_dataset: str,
        consolidated_code: Optional[str] = None,
        language: str = 'R'
    ) -> ValidationResult:
        """
        Validate inputs using intelligent code analysis.

        If consolidated_code is provided, analyzes it to detect required datasets.
        Otherwise, falls back to default ADAM dataset mapping.

        Args:
            study_id: Study identifier
            adam_dataset: ADAM dataset name
            consolidated_code: Optional R/SAS code to analyze
            language: Programming language ('R' or 'SAS')

        Returns:
            ValidationResult with detected datasets and availability status
        """
        code_analysis = None
        detection_method = "default"

        # If code is provided, analyze it for dataset requirements
        if consolidated_code and consolidated_code.strip():
            logger.info(f"Analyzing consolidated code to detect required datasets for {adam_dataset}")
            code_analysis = self.code_analyzer.analyze_code(consolidated_code, language)

            if code_analysis.required_datasets and code_analysis.confidence_level != 'low':
                # Use code-detected datasets as required datasets
                required = code_analysis.required_datasets
                detection_method = "code_analysis"
                logger.info(f"Code analysis detected {len(required)} datasets with {code_analysis.confidence_level} confidence: {required}")
            else:
                # Low confidence - fall back to default mapping
                required = self.REQUIRED_DOMAINS.get(adam_dataset, [])
                detection_method = "hybrid"
                logger.warning(f"Code analysis had low confidence, falling back to default mapping for {adam_dataset}")
        else:
            # No code provided - use default mapping
            required = self.REQUIRED_DOMAINS.get(adam_dataset, [])
            detection_method = "default"
            logger.info(f"No code provided, using default mapping for {adam_dataset}: {required}")

        optional = self.OPTIONAL_DOMAINS.get(adam_dataset, [])
        study_path = self.base_path / study_id

        logger.info(f"Checking SDTM datasets in: {study_path} (exists: {study_path.exists()})")

        available = []
        missing = []
        metadata = {}

        # Scan directory for all available SDTM files
        all_available_domains = set()
        if study_path.exists():
            for csv_file in study_path.glob("*.csv"):
                domain = csv_file.stem.upper()
                if domain not in ['METADATA'] and len(domain) >= 2:
                    all_available_domains.add(domain)
                    if domain not in available:
                        available.append(domain)
                        metadata[domain] = self._get_file_metadata(csv_file)
                        logger.debug(f"Found SDTM dataset: {domain} at {csv_file}")
        else:
            logger.warning(f"SDTM directory does not exist: {study_path}")

        logger.info(f"Found {len(all_available_domains)} SDTM datasets: {sorted(all_available_domains)}")

        # Check each required domain
        for domain in required:
            if domain not in all_available_domains:
                missing.append(domain)
                metadata[domain] = {"exists": False}
            elif domain not in available:
                domain_file = study_path / f"{domain}.csv"
                available.append(domain)
                metadata[domain] = self._get_file_metadata(domain_file)

        # Check optional domains
        for domain in optional:
            if domain in all_available_domains and domain not in available:
                domain_file = study_path / f"{domain}.csv"
                available.append(domain)
                metadata[domain] = self._get_file_metadata(domain_file)

        # Remove duplicates and sort
        available = sorted(list(set(available)))
        missing = sorted(list(set(missing)))

        errors = []
        if missing:
            errors.append(f"Missing required SDTM domains: {', '.join(missing)}")

        # Add code analysis warnings if any
        if code_analysis and code_analysis.warnings:
            for warning in code_analysis.warnings:
                logger.warning(f"Code analysis warning: {warning}")

        logger.info(f"Validation result ({detection_method}): {len(available)} available, {len(missing)} missing")

        return ValidationResult(
            is_valid=len(missing) == 0,
            errors=errors,
            required_domains=required,
            available_domains=available,
            missing_domains=missing,
            metadata=metadata,
            code_analysis=code_analysis,
            detection_method=detection_method
        )

