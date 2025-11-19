"""
Input Validation Utilities
Comprehensive validation functions for API inputs
"""

from typing import Optional, List, Dict, Any
from pathlib import Path
from fastapi import HTTPException, UploadFile
from loguru import logger
import re


def validate_file_upload(
    file: UploadFile,
    allowed_extensions: List[str],
    max_size_mb: int = 10
) -> None:
    """
    Validate uploaded file

    Args:
        file: Uploaded file
        allowed_extensions: List of allowed file extensions (e.g., ['.xlsx', '.xls'])
        max_size_mb: Maximum file size in megabytes

    Raises:
        HTTPException: If validation fails
    """
    if not file:
        raise HTTPException(status_code=400, detail="No file provided")

    if not file.filename:
        raise HTTPException(status_code=400, detail="File has no name")

    # Check file extension
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed types: {', '.join(allowed_extensions)}"
        )

    # Check file size if available
    if hasattr(file, 'size') and file.size:
        max_size_bytes = max_size_mb * 1024 * 1024
        if file.size > max_size_bytes:
            raise HTTPException(
                status_code=400,
                detail=f"File too large. Maximum size: {max_size_mb}MB"
            )

    logger.info(f"File validation passed: {file.filename}")


def validate_study_id(study_id: str) -> str:
    """
    Validate study ID format

    Args:
        study_id: Study identifier

    Returns:
        Validated study ID

    Raises:
        HTTPException: If validation fails
    """
    if not study_id or not study_id.strip():
        raise HTTPException(status_code=400, detail="Study ID is required")

    # Remove leading/trailing whitespace
    study_id = study_id.strip()

    # Check length
    if len(study_id) < 3 or len(study_id) > 100:
        raise HTTPException(
            status_code=400,
            detail="Study ID must be between 3 and 100 characters"
        )

    # Check for valid characters (alphanumeric, hyphens, underscores)
    if not re.match(r'^[a-zA-Z0-9_-]+$', study_id):
        raise HTTPException(
            status_code=400,
            detail="Study ID can only contain letters, numbers, hyphens, and underscores"
        )

    return study_id


def validate_dataset_type(dataset: str) -> str:
    """
    Validate ADAM dataset type

    Args:
        dataset: Dataset type (e.g., ADSL, ADAE)

    Returns:
        Validated dataset type

    Raises:
        HTTPException: If validation fails
    """
    valid_datasets = ["ADSL", "ADAE", "ADLB", "ADCM", "ADVS", "ADTTE", "ADEX"]

    if not dataset or not dataset.strip():
        raise HTTPException(status_code=400, detail="Dataset type is required")

    dataset = dataset.strip().upper()

    if dataset not in valid_datasets:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid dataset type. Valid types: {', '.join(valid_datasets)}"
        )

    return dataset


def validate_programming_language(language: str) -> str:
    """
    Validate programming language

    Args:
        language: Programming language (R or SAS)

    Returns:
        Validated language

    Raises:
        HTTPException: If validation fails
    """
    valid_languages = ["R", "SAS"]

    if not language or not language.strip():
        raise HTTPException(status_code=400, detail="Programming language is required")

    language = language.strip().upper()

    if language not in valid_languages:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid programming language. Valid options: {', '.join(valid_languages)}"
        )

    return language


def validate_categorized_variables(categorized_vars: Dict[str, Any]) -> None:
    """
    Validate categorized variables structure

    Args:
        categorized_vars: Categorized variables dictionary

    Raises:
        HTTPException: If validation fails
    """
    if not categorized_vars:
        raise HTTPException(status_code=400, detail="Categorized variables are required")

    # Check required keys (dataset_type optional for backward compatibility)
    required_keys = ["categories", "total_variables"]
    missing_keys = [key for key in required_keys if key not in categorized_vars]

    if missing_keys:
        raise HTTPException(
            status_code=400,
            detail=f"Missing required fields: {', '.join(missing_keys)}"
        )

    # Validate categories structure
    if not isinstance(categorized_vars.get("categories"), list):
        raise HTTPException(status_code=400, detail="Categories must be a list")

    # Allow empty categories (no variables to process)
    categories = categorized_vars.get("categories", [])
    if categories:
        logger.info(f"Categorized variables validation: {len(categories)} categories found")

    # Validate total_variables (can be 0 for empty specifications)
    total_vars = categorized_vars.get("total_variables", 0)
    if not isinstance(total_vars, int) or total_vars < 0:
        raise HTTPException(status_code=400, detail="Invalid total_variables count (must be non-negative integer)")

    logger.info(f"Categorized variables validation passed: {total_vars} total variables")


def validate_standards(standards: Dict[str, str]) -> None:
    """
    Validate standards dictionary

    Args:
        standards: Standards versions dictionary

    Raises:
        HTTPException: If validation fails
    """
    if not standards:
        raise HTTPException(status_code=400, detail="Standards information is required")

    required_keys = ["sdtm_version", "adam_ig_version", "meddra_version"]
    missing_keys = [key for key in required_keys if key not in standards]

    if missing_keys:
        raise HTTPException(
            status_code=400,
            detail=f"Missing required standards: {', '.join(missing_keys)}"
        )

    # Validate version formats (should not be empty)
    for key, value in standards.items():
        if not value or not str(value).strip():
            raise HTTPException(
                status_code=400,
                detail=f"Standards version '{key}' cannot be empty"
            )

    logger.info("Standards validation passed")


def validate_variable_name(variable_name: str) -> str:
    """
    Validate ADAM variable name

    Args:
        variable_name: Variable name

    Returns:
        Validated variable name

    Raises:
        HTTPException: If validation fails
    """
    if not variable_name or not variable_name.strip():
        raise HTTPException(status_code=400, detail="Variable name is required")

    variable_name = variable_name.strip().upper()

    # ADAM variable names should be 8 characters or less, alphanumeric
    if len(variable_name) > 8:
        raise HTTPException(
            status_code=400,
            detail="Variable name must be 8 characters or less"
        )

    if not re.match(r'^[A-Z][A-Z0-9]*$', variable_name):
        raise HTTPException(
            status_code=400,
            detail="Variable name must start with a letter and contain only letters and numbers"
        )

    return variable_name


def sanitize_user_input(text: str, max_length: int = 10000) -> str:
    """
    Sanitize user input text

    Args:
        text: Input text
        max_length: Maximum allowed length

    Returns:
        Sanitized text

    Raises:
        HTTPException: If validation fails
    """
    if not text:
        return ""

    # Remove leading/trailing whitespace
    text = text.strip()

    # Check length
    if len(text) > max_length:
        raise HTTPException(
            status_code=400,
            detail=f"Text too long. Maximum length: {max_length} characters"
        )

    # Remove potentially dangerous characters (basic sanitization)
    # Allow letters, numbers, spaces, and common punctuation
    sanitized = re.sub(r'[^\w\s\.\,\:\;\-\(\)\[\]\{\}\/\\\'\"\+\=\*\&\%\$\#\@\!\?\n\r\t]', '', text)

    return sanitized


def validate_pagination(offset: int = 0, limit: int = 100, max_limit: int = 1000) -> tuple:
    """
    Validate pagination parameters

    Args:
        offset: Number of items to skip
        limit: Number of items to return
        max_limit: Maximum allowed limit

    Returns:
        Tuple of (validated_offset, validated_limit)

    Raises:
        HTTPException: If validation fails
    """
    if offset < 0:
        raise HTTPException(status_code=400, detail="Offset must be non-negative")

    if limit <= 0:
        raise HTTPException(status_code=400, detail="Limit must be positive")

    if limit > max_limit:
        raise HTTPException(
            status_code=400,
            detail=f"Limit too high. Maximum: {max_limit}"
        )

    return offset, limit
