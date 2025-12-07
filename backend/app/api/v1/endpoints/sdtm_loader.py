"""
SDTM Data Loader API Endpoints

Generates R code for loading SDTM datasets into R dataframes with proper naming.
This provides a data preprocessing layer before ADAM code execution.
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import logging
from pathlib import Path
import json
import pandas as pd

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/sdtm-loader", tags=["sdtm-loader"])


class SDTMDatasetInfo(BaseModel):
    """Information about a single SDTM dataset"""
    domain: str = Field(..., description="SDTM domain code (e.g., DM, AE, LB)")
    filename: str = Field(..., description="Dataset filename")
    file_path: str = Field(..., description="Full file path")
    file_size: int = Field(0, description="File size in bytes")
    num_rows: Optional[int] = Field(None, description="Number of rows")
    num_columns: Optional[int] = Field(None, description="Number of columns")
    columns: Optional[List[str]] = Field(default_factory=list, description="Column names")
    sample_data: Optional[List[Dict[str, Any]]] = Field(default_factory=list, description="Sample data rows")


class SDTMInputStatus(BaseModel):
    """Status of SDTM inputs for ADAM generation"""
    study_id: str
    adam_dataset: str
    required_domains: List[str] = Field(default_factory=list)
    available_domains: List[str] = Field(default_factory=list)
    missing_domains: List[str] = Field(default_factory=list)
    dataset_metadata: Dict[str, SDTMDatasetInfo] = Field(default_factory=dict)


class DataPreprocessingCode(BaseModel):
    """Generated R code for data preprocessing"""
    r_code: str = Field(..., description="R code that loads SDTM datasets")
    datasets_loaded: List[str] = Field(default_factory=list)
    total_datasets: int = 0
    description: str = ""


class SDTMInputCheckRequest(BaseModel):
    """Request for checking SDTM inputs"""
    study_id: str
    adam_dataset: str


# ADAM dataset requirements mapping
ADAM_REQUIREMENTS = {
    "ADSL": ["DM", "EX", "DS"],
    "ADAE": ["DM", "AE", "EX"],
    "ADLB": ["DM", "LB", "EX"],
    "ADVS": ["DM", "VS", "EX"],
    "ADCM": ["DM", "CM", "EX"],
    "ADEX": ["DM", "EX"],
    "ADMH": ["DM", "MH"],
    "ADTTE": ["DM", "AE", "EX", "DS"],
    "ADPC": ["DM", "PC", "EX"],
    "ADPP": ["DM", "PP", "EX"],
    # Default for unknown ADAM datasets
    "DEFAULT": ["DM"],
}


def get_sdtm_directory(study_id: str) -> Path:
    """Get the SDTM data directory for a study"""
    backend_dir = Path(__file__).resolve().parents[4]
    return (backend_dir / "Content" / "Generated" / "SDTM" / study_id).resolve()


def get_required_domains(adam_dataset: str) -> List[str]:
    """Get required SDTM domains for an ADAM dataset"""
    return ADAM_REQUIREMENTS.get(adam_dataset.upper(), ADAM_REQUIREMENTS["DEFAULT"])


def scan_sdtm_datasets(study_id: str) -> Dict[str, SDTMDatasetInfo]:
    """Scan and return information about available SDTM datasets"""
    sdtm_dir = get_sdtm_directory(study_id)
    datasets = {}
    
    if not sdtm_dir.exists():
        logger.warning(f"SDTM directory does not exist: {sdtm_dir}")
        return datasets
    
    # Scan for CSV files
    for csv_file in sdtm_dir.glob("*.csv"):
        domain = csv_file.stem.upper()
        
        try:
            # Read dataset to get metadata
            df = pd.read_csv(csv_file, nrows=10)  # Read only first 10 rows for preview
            df_full = pd.read_csv(csv_file)
            
            dataset_info = SDTMDatasetInfo(
                domain=domain,
                filename=csv_file.name,
                file_path=str(csv_file),
                file_size=csv_file.stat().st_size,
                num_rows=len(df_full),
                num_columns=len(df_full.columns),
                columns=list(df_full.columns),
                sample_data=df.to_dict('records')[:5]  # First 5 rows as sample
            )
            datasets[domain] = dataset_info
            logger.info(f"Found SDTM dataset: {domain} with {len(df_full)} rows")
            
        except Exception as e:
            logger.error(f"Error reading SDTM dataset {csv_file}: {e}")
            # Still add basic info even if we can't read the file
            datasets[domain] = SDTMDatasetInfo(
                domain=domain,
                filename=csv_file.name,
                file_path=str(csv_file),
                file_size=csv_file.stat().st_size if csv_file.exists() else 0
            )
    
    return datasets


def generate_preprocessing_r_code(datasets: Dict[str, SDTMDatasetInfo], study_id: str) -> str:
    """
    Generate R code that reads SDTM datasets and assigns them to variables
    matching the dataset names (e.g., dm, ae, lb, vs, ex)
    """
    if not datasets:
        return """# No SDTM datasets available
cat("WARNING: No SDTM datasets found. Please generate SDTM data first.\\n")
"""
    
    lines = [
        "# ====================================================================",
        "# SDTM DATA PREPROCESSING",
        "# Auto-generated R code to load SDTM datasets into dataframes",
        f"# Study ID: {study_id}",
        f"# Generated: {__import__('datetime').datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        "# ====================================================================",
        "",
        "# Load required libraries",
        "library(dplyr)",
        "library(tidyr)",
        "",
        "cat('=== Loading SDTM Datasets ===\\n\\n')",
        "",
    ]
    
    # Generate read statements for each dataset
    for domain, info in sorted(datasets.items()):
        var_name = domain.lower()  # Use lowercase for variable names (e.g., dm, ae, lb)
        file_path = info.file_path.replace('\\', '/')  # Normalize path for R
        
        lines.extend([
            f"# Load {domain} dataset ({info.num_rows or '?'} rows, {info.num_columns or '?'} columns)",
            f'{var_name} <- read.csv("/work/input/{info.filename}")',
            f'cat("✓ Loaded {domain}: ", nrow({var_name}), " rows x ", ncol({var_name}), " columns\\n")',
            "",
        ])
    
    # Add summary section
    lines.extend([
        "# ====================================================================",
        "# SDTM Data Summary",
        "# ====================================================================",
        "",
        "cat('\\n=== SDTM Data Summary ===\\n\\n')",
        "",
    ])
    
    for domain in sorted(datasets.keys()):
        var_name = domain.lower()
        lines.extend([
            f"cat('--- {domain} Dataset ---\\n')",
            f"cat('Dimensions: ', nrow({var_name}), ' rows x ', ncol({var_name}), ' columns\\n')",
            f"cat('Variables: ', paste(names({var_name})[1:min(10, ncol({var_name}))], collapse=', ')",
            f"       if(ncol({var_name}) > 10) cat('...'), '\\n')",
            f"cat('\\n')",
            "",
        ])
    
    lines.extend([
        "cat('\\n=== SDTM Data Loading Complete ===\\n\\n')",
        "",
        "# Available dataframes:",
        f"# {', '.join([d.lower() for d in sorted(datasets.keys())])}",
        "",
    ])
    
    return "\n".join(lines)


@router.post("/check-inputs", response_model=SDTMInputStatus)
async def check_sdtm_inputs(request: SDTMInputCheckRequest):
    """
    Check available SDTM inputs for ADAM generation.
    
    Returns:
        - Required domains based on ADAM dataset type
        - Available domains in the study
        - Missing domains that need to be generated
        - Metadata for each available dataset
    """
    try:
        study_id = request.study_id
        adam_dataset = request.adam_dataset
        
        logger.info(f"Checking SDTM inputs for study={study_id}, adam_dataset={adam_dataset}")
        
        # Get required domains for this ADAM dataset
        required_domains = get_required_domains(adam_dataset)
        
        # Scan for available datasets
        available_datasets = scan_sdtm_datasets(study_id)
        available_domains = list(available_datasets.keys())
        
        # Determine missing domains
        missing_domains = [d for d in required_domains if d not in available_domains]
        
        # Build dataset metadata dict
        dataset_metadata = {}
        for domain, info in available_datasets.items():
            dataset_metadata[domain] = info
        
        logger.info(f"SDTM check result: required={required_domains}, available={available_domains}, missing={missing_domains}")
        
        return SDTMInputStatus(
            study_id=study_id,
            adam_dataset=adam_dataset,
            required_domains=required_domains,
            available_domains=available_domains,
            missing_domains=missing_domains,
            dataset_metadata=dataset_metadata
        )
        
    except Exception as e:
        logger.error(f"Error checking SDTM inputs: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to check SDTM inputs: {str(e)}")


@router.get("/preprocessing-code", response_model=DataPreprocessingCode)
async def generate_preprocessing_code(
    study_id: str = Query(..., description="Study ID"),
    adam_dataset: str = Query(..., description="Target ADAM dataset")
):
    """
    Generate R code for SDTM data preprocessing.
    
    This code reads all available SDTM datasets and assigns them to
    R dataframes with names matching the domain codes (lowercase).
    
    Example: DM.csv -> dm dataframe, AE.csv -> ae dataframe
    
    Returns:
        DataPreprocessingCode with R code and metadata
    """
    try:
        logger.info(f"Generating preprocessing code for study={study_id}, adam_dataset={adam_dataset}")
        
        # Scan available datasets
        available_datasets = scan_sdtm_datasets(study_id)
        
        if not available_datasets:
            return DataPreprocessingCode(
                r_code="# No SDTM datasets found. Please generate SDTM data first.",
                datasets_loaded=[],
                total_datasets=0,
                description="No SDTM datasets available for loading."
            )
        
        # Generate the R code
        r_code = generate_preprocessing_r_code(available_datasets, study_id)
        
        loaded_domains = sorted(available_datasets.keys())
        
        return DataPreprocessingCode(
            r_code=r_code,
            datasets_loaded=loaded_domains,
            total_datasets=len(loaded_domains),
            description=f"R code to load {len(loaded_domains)} SDTM dataset(s): {', '.join(loaded_domains)}"
        )
        
    except Exception as e:
        logger.error(f"Error generating preprocessing code: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to generate preprocessing code: {str(e)}")


@router.get("/dataset-preview")
async def get_dataset_preview(
    study_id: str = Query(..., description="Study ID"),
    domain: str = Query(..., description="SDTM domain code")
):
    """
    Get a preview of a specific SDTM dataset.
    
    Returns first 20 rows and column information for the specified dataset.
    """
    try:
        sdtm_dir = get_sdtm_directory(study_id)
        csv_file = sdtm_dir / f"{domain.upper()}.csv"
        
        if not csv_file.exists():
            raise HTTPException(
                status_code=404,
                detail=f"Dataset {domain} not found for study {study_id}"
            )
        
        # Read dataset
        df = pd.read_csv(csv_file)
        
        # Get preview
        preview = df.head(20).to_dict('records')
        
        return {
            "study_id": study_id,
            "domain": domain.upper(),
            "filename": csv_file.name,
            "total_rows": len(df),
            "total_columns": len(df.columns),
            "columns": list(df.columns),
            "preview": preview
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting dataset preview: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get dataset preview: {str(e)}")
