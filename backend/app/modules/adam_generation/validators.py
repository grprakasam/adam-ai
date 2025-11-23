"""
Input validators for ADAM generation
"""

import logging
from pathlib import Path
from typing import List, Dict, Any, Optional
from dataclasses import dataclass

from .schemas import SDTMInputCheck
from .exceptions import ValidationError

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
        adam_dataset: str
    ) -> SDTMInputCheck:
        """Check SDTM dataset availability for a study"""
        result = await self.validate_inputs(study_id, adam_dataset)
        
        return SDTMInputCheck(
            study_id=study_id,
            adam_dataset=adam_dataset,
            required_domains=result.required_domains,
            available_domains=result.available_domains,
            missing_domains=result.missing_domains,
            dataset_metadata=result.metadata or {}
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

