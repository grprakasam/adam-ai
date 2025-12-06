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

    logger.info(f"=== CATEGORIZE-PATH REQUEST ===")
    logger.info(f"Input spec_file_path: {spec_file_path}")
    logger.info(f"Dataset type: {dataset_type}")

    # Get the backend directory - this is where storage/study_documents lives
    # Navigate from specification.py up to backend directory
    current_file = Path(__file__).resolve()
    logger.info(f"Current file location: {current_file}")
    
    # specification.py -> endpoints -> v1 -> api -> app -> backend
    # Count: 5 parent directories to reach backend
    backend_dir = current_file.parent.parent.parent.parent.parent
    logger.info(f"Backend directory (5 levels up): {backend_dir}")
    
    # Project root is one level above backend
    project_root = backend_dir.parent
    logger.info(f"Project root (6 levels up): {project_root}")
    
    # Convert to absolute path if relative
    spec_path = Path(spec_file_path)
    
    if spec_path.is_absolute():
        logger.info(f"Path is already absolute: {spec_path}")
        
        # Robustness fix: Logic to handle cases where path includes 'app/storage' (incorrect) instead of 'storage'
        if not spec_path.exists():
            path_str = str(spec_path)
            if "app" in path_str and "storage" in path_str:
                # Try fixing backend/app/storage -> backend/storage
                fixed_path_str = path_str.replace("app\\storage", "storage").replace("app/storage", "storage")
                fixed_path = Path(fixed_path_str)
                
                if fixed_path.exists():
                    logger.warning(f"Auto-corrected incorrect path: {spec_path} -> {fixed_path}")
                    spec_path = fixed_path
    else:
        # Determine which type of path this is
        normalized_path = spec_file_path.replace('\\', '/')
        
        if normalized_path.startswith('storage/'):
            # This is a study document path - relative to backend
            spec_path = backend_dir / spec_file_path
            logger.info(f"Storage path: backend_dir + '{spec_file_path}' = {spec_path}")
        elif normalized_path.startswith('Content/'):
            # This is a default spec path - relative to project root
            spec_path = project_root / spec_file_path
            logger.info(f"Content path: project_root + '{spec_file_path}' = {spec_path}")
        else:
            # Unknown path type - try both locations
            logger.warning(f"Unknown path type: {spec_file_path}. Trying multiple locations...")
            
            # Try as storage path first
            storage_attempt = backend_dir / "storage" / "study_documents" / spec_file_path
            content_attempt = project_root / "Content" / "UserInputs" / "ADAMSpecifications" / spec_file_path
            
            if storage_attempt.exists():
                spec_path = storage_attempt
                logger.info(f"Found as storage path: {spec_path}")
            elif content_attempt.exists():
                spec_path = content_attempt
                logger.info(f"Found as content path: {spec_path}")
            else:
                # Last resort - assume relative to backend
                spec_path = backend_dir / spec_file_path
                logger.warning(f"File not found in standard locations. Using backend-relative: {spec_path}")

    logger.info(f"=== FINAL PATH RESOLUTION ===")
    logger.info(f"Resolved spec_path: {spec_path}")
    logger.info(f"Path exists: {spec_path.exists()}")
    
    # Robustness fix: Logic to handle cases where path includes 'app/storage' (incorrect) instead of 'storage'
    if not spec_path.exists():
        path_str = str(spec_path)
        # Check for common incorrect patterns
        if "app" in path_str and "storage" in path_str:
             # Try fixing backend/app/storage -> backend/storage across different OS separators
            fixed_path_str = path_str.replace("app\\storage", "storage").replace("app/storage", "storage")
            fixed_path = Path(fixed_path_str)
            
            if fixed_path.exists():
                logger.warning(f"Auto-corrected incorrect path: {spec_path} -> {fixed_path}")
                spec_path = fixed_path

        # Strategy 2: Remove intermediate segments (like 'app') between 'backend' and 'storage'
        if not spec_path.exists():
            try:
                parts = list(spec_path.parts)
                if 'backend' in parts and 'storage' in parts:
                    backend_idx = parts.index('backend')
                    storage_idx = parts.index('storage')
                    
                    # If there is something between backend and storage (like 'app')
                    if storage_idx > backend_idx + 1:
                        new_parts = parts[:backend_idx+1] + parts[storage_idx:]
                        fixed_path = Path(*new_parts)
                        if fixed_path.exists():
                            logger.warning(f"Auto-corrected path by removing intermediate segments: {spec_path} -> {fixed_path}")
                            spec_path = fixed_path
            except Exception as e:
                logger.error(f"Path correction strategy 2 failed: {e}")

        # Strategy 3: Rebase 'study_documents' path onto known backend_dir
        if not spec_path.exists() and "study_documents" in str(spec_path):
             try:
                path_str = str(spec_path).replace("\\", "/")
                # search for study_documents with boundary to avoid partial matches
                if "/study_documents/" in path_str:
                    _, relative_part = path_str.split("/study_documents/", 1)
                    # Construct path: backend_dir / storage / study_documents / relative_part
                    # We use backend_dir defined earlier in the function
                    candidate_path = backend_dir / "storage" / "study_documents" / relative_part
                    
                    logger.info(f"Strategy 3 candidate: {candidate_path}")
                    if candidate_path.exists():
                        logger.warning(f"Rebased path via study_documents: {spec_path} -> {candidate_path}")
                        spec_path = candidate_path
                elif "study_documents/" in path_str: # fallback if leading slash missing in split
                     _, relative_part = path_str.split("study_documents/", 1)
                     candidate_path = backend_dir / "storage" / "study_documents" / relative_part
                     if candidate_path.exists():
                        logger.warning(f"Rebased path via study_documents (simple split): {spec_path} -> {candidate_path}")
                        spec_path = candidate_path

             except Exception as e:
                 logger.error(f"Path correction strategy 3 failed: {e}")

        # Strategy 4: Brute force search by filename in study_documents (Last Resort)
        if not spec_path.exists():
            try:
                filename = spec_path.name
                # Only search if we have a valid-looking filename
                if filename and filename.lower().endswith(('.xlsx', '.xls')):
                    search_dir = backend_dir / "storage" / "study_documents"
                    if search_dir.exists():
                        # Use rglob to find the file anywhere in study_documents
                        found_files = list(search_dir.rglob(filename))
                        if found_files:
                            # Take the first match (most likely correct if IDs are unique)
                            logger.warning(f"Strategy 4 found file by name: {spec_path} -> {found_files[0]}")
                            spec_path = found_files[0]
            except Exception as e:
                logger.error(f"Strategy 4 failed: {e}")

    if spec_path.exists():
        logger.info(f"File found! Size: {spec_path.stat().st_size} bytes")

        # Validate file exists
    if not spec_path.exists():
        logger.error(f"FILE NOT FOUND at resolved path: {spec_path}")
        logger.error(f"Backend dir: {backend_dir}")
        logger.error(f"Project root: {project_root}")
        
        # Check what directories exist to help debug
        storage_dir = backend_dir / "storage" / "study_documents"
        if storage_dir.exists():
            logger.error(f"Storage dir exists: {storage_dir}")
            try:
                studies = list(storage_dir.iterdir())[:5]
                logger.error(f"Available studies: {[s.name for s in studies]}")
            except Exception as e:
                logger.error(f"Error listing studies: {e}")
        
        # Provide helpful error message
        error_detail = f"Specification file not found: {spec_path}"
        error_detail += f"\nDEBUG: Backend={backend_dir} | Root={project_root}"
        error_detail += "\n\nThe specification file may have been moved or the study data is outdated."
        error_detail += "\nTry selecting a different specification file or re-upload your specification document."
        
        raise HTTPException(
            status_code=404,
            detail=error_detail,
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

