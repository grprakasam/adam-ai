"""
Input Collection Service
Handles collection and validation of user inputs for ADAM code generation
"""

from typing import Optional, List, Dict, Any
from pathlib import Path
# import pandas as pd  # Temporarily commented - install with: pip install pandas
from loguru import logger

from app.models.input_models import (
    ProjectInput,
    SDTMDataset,
    SpecificationFile,
    GenerationParameters
)
from app.config import settings


class InputCollectionService:
    """Service for collecting and managing user inputs"""
    
    def __init__(self):
        self.content_dir = Path(settings.CONTENT_DIR)
        self.user_inputs_dir = self.content_dir / "UserInputs"
        self.sdtm_dir = self.user_inputs_dir / "SDTMDatasets"
        self.spec_dir = self.user_inputs_dir / "ADAMSpecifications"
        
    async def validate_project_structure(self) -> Dict[str, bool]:
        """
        Validate that required directories exist
        
        Returns:
            Dictionary with validation results for each directory
        """
        validation_results = {
            "content_dir": self.content_dir.exists(),
            "user_inputs_dir": self.user_inputs_dir.exists(),
            "sdtm_dir": self.sdtm_dir.exists(),
            "spec_dir": self.spec_dir.exists()
        }
        
        logger.info(f"Project structure validation: {validation_results}")
        return validation_results
    
    async def collect_sdtm_datasets(self) -> List[SDTMDataset]:
        """
        Collect available SDTM datasets from the UserInputs/SDTMDatasets directory
        
        Returns:
            List of SDTMDataset objects
        """
        datasets = []
        
        if not self.sdtm_dir.exists():
            logger.warning(f"SDTM directory not found: {self.sdtm_dir}")
            return datasets
        
        # Look for CSV, SAS7BDAT, and XPT files
        for file_path in self.sdtm_dir.glob("**/*"):
            if file_path.suffix.lower() in ['.csv', '.sas7bdat', '.xpt']:
                try:
                    # Extract domain from filename (e.g., DM.csv -> DM)
                    domain = file_path.stem.upper()
                    
                    # Get file size
                    file_size = file_path.stat().st_size
                    
                    dataset = SDTMDataset(
                        name=file_path.name,
                        domain=domain,
                        file_path=str(file_path),
                        file_type=file_path.suffix[1:],  # Remove the dot
                        file_size=file_size
                    )
                    datasets.append(dataset)
                    logger.info(f"Found SDTM dataset: {dataset.name} ({dataset.domain})")
                    
                except Exception as e:
                    logger.error(f"Error processing SDTM file {file_path}: {str(e)}")
        
        logger.info(f"Collected {len(datasets)} SDTM datasets")
        return datasets
    
    async def collect_specification_files(self) -> List[SpecificationFile]:
        """
        Collect available ADAM specification files
        
        Returns:
            List of SpecificationFile objects
        """
        spec_files = []
        
        if not self.spec_dir.exists():
            logger.warning(f"Specification directory not found: {self.spec_dir}")
            return spec_files
        
        # Look for Excel, Word, and PDF files
        for file_path in self.spec_dir.glob("**/*"):
            if file_path.suffix.lower() in ['.xlsx', '.xls', '.docx', '.pdf']:
                try:
                    # Determine specification type from filename
                    filename_lower = file_path.name.lower()
                    if 'adsl' in filename_lower:
                        spec_type = 'ADSL'
                    elif 'adae' in filename_lower:
                        spec_type = 'ADAE'
                    elif 'adlb' in filename_lower:
                        spec_type = 'ADLB'
                    else:
                        spec_type = 'GENERAL'
                    
                    file_size = file_path.stat().st_size
                    
                    spec_file = SpecificationFile(
                        name=file_path.name,
                        file_path=str(file_path),
                        file_type=file_path.suffix[1:],
                        file_size=file_size,
                        spec_type=spec_type
                    )
                    spec_files.append(spec_file)
                    logger.info(f"Found specification file: {spec_file.name} ({spec_file.spec_type})")
                    
                except Exception as e:
                    logger.error(f"Error processing specification file {file_path}: {str(e)}")
        
        logger.info(f"Collected {len(spec_files)} specification files")
        return spec_files
    
    async def load_sdtm_data(self, file_path: str) -> Optional[Any]:
        """
        Load SDTM dataset into a pandas DataFrame
        
        Args:
            file_path: Path to the SDTM dataset file
            
        Returns:
            DataFrame with the dataset, or None if loading fails
        
        Note: Pandas is required for this functionality
        """
        logger.warning("load_sdtm_data requires pandas - install with: pip install pandas")
        return None
        
        # Uncomment when pandas is installed:
        # try:
        #     file_path_obj = Path(file_path)
        #     
        #     if not file_path_obj.exists():
        #         logger.error(f"SDTM file not found: {file_path}")
        #         return None
        #     
        #     # Load based on file type
        #     if file_path_obj.suffix.lower() == '.csv':
        #         df = pd.read_csv(file_path_obj)
        #     elif file_path_obj.suffix.lower() == '.sas7bdat':
        #         df = pd.read_sas(file_path_obj)
        #     elif file_path_obj.suffix.lower() == '.xpt':
        #         df = pd.read_sas(file_path_obj, format='xport')
        #     else:
        #         logger.error(f"Unsupported file type: {file_path_obj.suffix}")
        #         return None
        #     
        #     logger.info(f"Loaded SDTM dataset: {file_path_obj.name} ({len(df)} rows, {len(df.columns)} columns)")
        #     return df
        #     
        # except Exception as e:
        #     logger.error(f"Error loading SDTM data from {file_path}: {str(e)}")
        #     return None
    
    async def validate_input_completeness(
        self,
        project_input: ProjectInput
    ) -> Dict[str, Any]:
        """
        Validate that all required inputs are present and valid
        
        Args:
            project_input: The project input object to validate
            
        Returns:
            Dictionary with validation results
        """
        validation_results = {
            "is_valid": True,
            "errors": [],
            "warnings": []
        }
        
        # Check SDTM datasets
        if not project_input.sdtm_datasets:
            validation_results["errors"].append("No SDTM datasets provided")
            validation_results["is_valid"] = False
        
        # Check specifications
        if not project_input.specifications:
            validation_results["warnings"].append("No specification files provided")
        
        # Check ADAM dataset type
        if not project_input.parameters.adam_dataset:
            validation_results["errors"].append("ADAM dataset type not specified")
            validation_results["is_valid"] = False
        
        # Check programming language
        if project_input.parameters.programming_language not in ["R", "SAS"]:
            validation_results["errors"].append(
                f"Invalid programming language: {project_input.parameters.programming_language}"
            )
            validation_results["is_valid"] = False
        
        logger.info(f"Input validation: {validation_results}")
        return validation_results
    
    async def prepare_input_summary(
        self,
        project_input: ProjectInput
    ) -> Dict[str, Any]:
        """
        Prepare a summary of the collected inputs
        
        Args:
            project_input: The project input object
            
        Returns:
            Dictionary with input summary
        """
        summary = {
            "sdtm_datasets": [
                {
                    "name": ds.name,
                    "domain": ds.domain,
                    "file_type": ds.file_type
                }
                for ds in project_input.sdtm_datasets
            ],
            "specifications": [
                {
                    "name": spec.name,
                    "type": spec.spec_type,
                    "file_type": spec.file_type
                }
                for spec in project_input.specifications
            ],
            "parameters": {
                "adam_dataset": project_input.parameters.adam_dataset,
                "programming_language": project_input.parameters.programming_language,
                "llm_provider": project_input.parameters.llm_provider,
                "model": project_input.parameters.model
            }
        }
        
        return summary


# Global service instance
input_service = InputCollectionService()
