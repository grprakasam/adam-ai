"""
API endpoints for specification variable categorization
"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from typing import Optional
from pathlib import Path
import tempfile
import os
from loguru import logger
from pydantic import BaseModel

from app.modules.variable_categorizer import (
    VariableCategorizerService,
    CategorizationResult,
)
from app.utils.validators import validate_file_upload, validate_dataset_type
from app.utils.error_handlers import FileProcessingError


class CategorizeByPathRequest(BaseModel):
    """Request model for categorize-path endpoint"""
    spec_file_path: str
    dataset_type: str = "ADSL"

router = APIRouter()

# Initialize categorizer service (lazy loading)
_categorizer_service: Optional[VariableCategorizerService] = None


def get_categorizer_service() -> VariableCategorizerService:
    """Get or create the categorizer service instance"""
    global _categorizer_service
    if _categorizer_service is None:
        _categorizer_service = VariableCategorizerService()
        _categorizer_service.initialize()
    return _categorizer_service


@router.post("/categorize", response_model=CategorizationResult)
async def categorize_specification(
    file: UploadFile = File(..., description="ADAM specification Excel file"),
    dataset_type: str = Form(default="ADSL", description="Dataset type (ADSL, ADAE, ADLB)"),
):
    """
    Categorize variables from an ADAM specification file

    This endpoint:
    1. Accepts an uploaded specification Excel file
    2. Reads the VariablesMapping.xlsx reference
    3. Categorizes all variables from the spec
    4. Returns categorized variables grouped by category

    Variables not found in the mapping are grouped under "Other Category"
    """
    logger.info(f"Received specification file: {file.filename} for dataset: {dataset_type}")

    # Validate file upload
    validate_file_upload(file, allowed_extensions=[".xlsx", ".xls"], max_size_mb=50)

    # Validate dataset type
    dataset_type = validate_dataset_type(dataset_type)

    # Save uploaded file to temporary location
    temp_file_path = None
    try:
        with tempfile.NamedTemporaryFile(
            delete=False, suffix=Path(file.filename).suffix
        ) as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_file_path = temp_file.name

        logger.info(f"Saved uploaded file to: {temp_file_path}")

        # Get categorizer service
        categorizer = get_categorizer_service()

        # Categorize the specification
        result = categorizer.categorize_specification(
            spec_file_path=temp_file_path, dataset_type=dataset_type.upper()
        )

        logger.info(
            f"Categorization successful: {result.total_variables} variables, "
            f"{len(result.categories)} categories"
        )

        return result

    except FileNotFoundError as e:
        logger.error(f"File not found error: {str(e)}")
        raise HTTPException(
            status_code=404,
            detail=f"Required file not found: {str(e)}",
        )

    except ValueError as e:
        logger.error(f"Validation error: {str(e)}")
        raise HTTPException(
            status_code=400,
            detail=f"Invalid data: {str(e)}",
        )

    except Exception as e:
        logger.error(f"Error categorizing specification: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Error processing specification: {str(e)}",
        )

    finally:
        # Clean up temporary file
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.unlink(temp_file_path)
                logger.debug(f"Cleaned up temporary file: {temp_file_path}")
            except Exception as e:
                logger.warning(f"Failed to clean up temporary file: {str(e)}")


@router.post("/categorize-path", response_model=CategorizationResult)
async def categorize_specification_by_path(request: CategorizeByPathRequest):
    """
    Categorize variables from a specification file using file path

    Alternative endpoint for when the file is already on the server
    (e.g., default specification files in Content/UserInputs/)

    Args:
        request: Request containing spec_file_path and dataset_type

    Returns:
        CategorizationResult with categorized variables
    """
    spec_file_path = request.spec_file_path
    dataset_type = request.dataset_type

    logger.info(f"Categorizing spec from path: {spec_file_path} for dataset: {dataset_type}")

    # Convert to absolute path if relative
    spec_path = Path(spec_file_path)
    if not spec_path.is_absolute():
        # Check if path starts with 'storage/' (study documents)
        if spec_file_path.startswith('storage/') or spec_file_path.startswith('storage\\'):
            # Resolve relative to backend directory
            backend_root = Path(__file__).parent.parent.parent.parent
            spec_path = backend_root / spec_file_path
        else:
            # Assume relative to project root for Content/ paths
            project_root = Path(__file__).parent.parent.parent.parent.parent
            spec_path = project_root / spec_file_path

    logger.info(f"Resolved spec path: {spec_path}")

    # Validate file exists
    if not spec_path.exists():
        logger.error(f"File not found at resolved path: {spec_path}")
        raise HTTPException(
            status_code=404,
            detail=f"Specification file not found: {spec_path}",
        )

    # Validate dataset type
    valid_datasets = ["ADSL", "ADAE", "ADLB"]
    if dataset_type.upper() not in valid_datasets:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid dataset_type. Must be one of: {', '.join(valid_datasets)}",
        )

    try:
        # Get categorizer service
        categorizer = get_categorizer_service()

        # Categorize the specification
        result = categorizer.categorize_specification(
            spec_file_path=str(spec_path), dataset_type=dataset_type.upper()
        )

        logger.info(
            f"Categorization successful: {result.total_variables} variables, "
            f"{len(result.categories)} categories"
        )

        return result

    except FileNotFoundError as e:
        logger.error(f"File not found error: {str(e)}")
        raise HTTPException(
            status_code=404,
            detail=f"Required file not found: {str(e)}",
        )

    except ValueError as e:
        logger.error(f"Validation error: {str(e)}")
        raise HTTPException(
            status_code=400,
            detail=f"Invalid data: {str(e)}",
        )

    except Exception as e:
        logger.error(f"Error categorizing specification: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Error processing specification: {str(e)}",
        )


@router.get("/variable/{variable_name}/category")
async def get_variable_category(variable_name: str):
    """
    Get category for a specific variable name

    Args:
        variable_name: Variable name to look up

    Returns:
        Category information for the variable
    """
    try:
        categorizer = get_categorizer_service()
        category = categorizer.get_variable_category(variable_name)

        return {
            "variable_name": variable_name,
            "category": category,
        }

    except Exception as e:
        logger.error(f"Error getting category for {variable_name}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error retrieving category: {str(e)}",
        )

