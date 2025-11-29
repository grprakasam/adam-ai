"""
Dataset Comparer API Endpoints

Provides endpoints for comparing ADAM datasets in various formats.
"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from typing import Optional
from loguru import logger
import tempfile
import os
from pathlib import Path

from app.modules.dataset_comparer.schemas import (
    DatasetComparisonRequest,
    DatasetComparisonResult,
)
from app.modules.dataset_comparer.service import DatasetComparerService

router = APIRouter(prefix="/dataset-comparer", tags=["dataset-comparer"])

# Initialize service
dataset_comparer_service = DatasetComparerService()


@router.post("/compare", response_model=DatasetComparisonResult)
async def compare_datasets(
    request: DatasetComparisonRequest,
):
    """
    Compare two datasets and return detailed analysis.

    Supports multiple comparison modes:
    - **Quick**: Metadata & structure only (<1s)
    - **Standard**: Recommended for routine QC (2-5s)
    - **Comprehensive**: Full validation with statistics (10s+)

    Supported formats: CSV, Excel, SAS, R (RDS), XPT

    Example request:
    ```json
    {
        "dataset1_path": "/path/to/adsl_dev.sas7bdat",
        "dataset2_path": "/path/to/adsl_qc.sas7bdat",
        "comparison_mode": "standard",
        "settings": {
            "variable_selection": "all",
            "numeric_comparison": "exact",
            "missing_value_handling": "different",
            "key_variable": "USUBJID"
        }
    }
    ```
    """
    try:
        logger.info(f"Starting dataset comparison: mode={request.comparison_mode}")

        # Validate file paths exist
        if not os.path.exists(request.dataset1_path):
            raise HTTPException(
                status_code=404,
                detail=f"Dataset 1 not found: {request.dataset1_path}"
            )

        if not os.path.exists(request.dataset2_path):
            raise HTTPException(
                status_code=404,
                detail=f"Dataset 2 not found: {request.dataset2_path}"
            )

        # Perform comparison
        result = await dataset_comparer_service.compare(request)

        logger.info(f"Dataset comparison completed: {result.overall_match:.1f}% match, "
                   f"{result.values.differences.__len__()} differences")

        return result

    except ValueError as e:
        logger.error(f"Validation error in dataset comparison: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except FileNotFoundError as e:
        logger.error(f"File not found: {str(e)}")
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Dataset comparison failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )


@router.post("/upload", response_model=dict)
async def upload_dataset(
    file: UploadFile = File(...),
):
    """
    Upload a dataset file for comparison.

    Supported formats: CSV, Excel (.xlsx, .xls), SAS (.sas7bdat), XPT (.xpt), R (.rds)

    Returns:
        dict with file_path and metadata
    """
    try:
        # Validate file type
        allowed_extensions = ['.csv', '.xlsx', '.xls', '.sas7bdat', '.xpt', '.rds', '.rdata']
        file_ext = Path(file.filename or '').suffix.lower()

        if file_ext not in allowed_extensions:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file format: {file_ext}. Allowed: {', '.join(allowed_extensions)}"
            )

        # Save to temp directory
        temp_dir = tempfile.gettempdir()
        file_path = os.path.join(temp_dir, file.filename or 'dataset')

        with open(file_path, 'wb') as f:
            content = await file.read()
            f.write(content)

        logger.info(f"Dataset uploaded: {file.filename} ({len(content)} bytes)")

        return {
            "file_path": file_path,
            "filename": file.filename,
            "size": len(content),
            "format": file_ext.upper(),
        }

    except Exception as e:
        logger.error(f"Dataset upload failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Upload failed: {str(e)}"
        )


@router.get("/health")
async def health_check():
    """Health check endpoint for dataset comparer service"""
    return {
        "status": "healthy",
        "service": "dataset-comparer",
        "modes_available": ["quick", "standard", "comprehensive"],
        "formats_supported": ["CSV", "Excel", "SAS", "XPT", "R"],
    }
