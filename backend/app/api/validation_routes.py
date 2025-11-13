"""
Code Validation API Routes
Endpoints for validating R and SAS code
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from typing import Optional, Dict, List
from app.core.validation import get_validator, ValidationResult
from app.core.auth import get_current_user

router = APIRouter(prefix="/validation", tags=["validation"])


class ValidateCodeRequest(BaseModel):
    """Request model for code validation"""
    code: str = Field(..., description="Code to validate")
    language: str = Field(..., description="Programming language (R or SAS)")
    check_style: bool = Field(default=True, description="Include style checking")


class ValidationIssueResponse(BaseModel):
    """Single validation issue"""
    line: int
    column: Optional[int]
    severity: str  # error, warning, info, style
    message: str
    rule: Optional[str]
    suggestion: Optional[str]


class ValidationResponse(BaseModel):
    """Response model for code validation"""
    isValid: bool
    language: str
    issues: List[Dict]
    errorCount: int
    warningCount: int
    executionTime: float


class ValidatorStatusResponse(BaseModel):
    """Status of validation tools"""
    R: Dict
    SAS: Dict


@router.post("/validate", response_model=ValidationResponse)
async def validate_code(
    request: ValidateCodeRequest,
    current_user = Depends(get_current_user)
):
    """
    Validate R or SAS code for syntax errors and style issues.
    
    **Requirements:**
    - Authentication required
    - Supports R and SAS languages
    - Returns detailed validation issues with line numbers
    
    **Example Request:**
    ```json
    {
      "code": "library(dplyr)\\ndata <- read.csv('file.csv')",
      "language": "R",
      "check_style": true
    }
    ```
    
    **Example Response:**
    ```json
    {
      "isValid": true,
      "language": "R",
      "issues": [],
      "errorCount": 0,
      "warningCount": 0,
      "executionTime": 0.5
    }
    ```
    """
    try:
        validator = get_validator()
        result = validator.validate(request.code, request.language)
        
        return result.to_dict()
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Validation failed: {str(e)}"
        )


@router.get("/status", response_model=ValidatorStatusResponse)
async def get_validator_status(current_user = Depends(get_current_user)):
    """
    Get status of validation tools and their availability.
    
    **Requirements:**
    - Authentication required
    
    **Returns:**
    - R validator status (R installed, lintr available)
    - SAS validator status
    
    **Example Response:**
    ```json
    {
      "R": {
        "available": true,
        "lintr_available": true
      },
      "SAS": {
        "available": true,
        "note": "Using basic syntax checking"
      }
    }
    ```
    """
    validator = get_validator()
    return validator.get_validator_status()


@router.post("/quick-check")
async def quick_syntax_check(
    request: ValidateCodeRequest,
    current_user = Depends(get_current_user)
):
    """
    Quick syntax-only check without style validation.
    Faster than full validation, useful for real-time checking.
    
    **Requirements:**
    - Authentication required
    - Only checks critical syntax errors
    - Skips style checking for speed
    """
    try:
        validator = get_validator()
        
        if request.language.upper() == "R":
            issues = validator.r_validator.validate_syntax(request.code)
        elif request.language.upper() == "SAS":
            issues = validator.sas_validator.validate_syntax(request.code)
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported language: {request.language}"
            )
        
        has_errors = any(issue.severity.value == "error" for issue in issues)
        
        return {
            "isValid": not has_errors,
            "language": request.language.upper(),
            "issues": [issue.to_dict() for issue in issues],
            "errorCount": sum(1 for i in issues if i.severity.value == "error")
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Quick check failed: {str(e)}"
        )
