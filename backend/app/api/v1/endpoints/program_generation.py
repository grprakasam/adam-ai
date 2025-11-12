"""
Program Generation API Endpoints
Endpoints for generating complete ADAM programs
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, List, Optional, Any
from loguru import logger

from app.modules.program_generation.service import ProgramGeneratorService


router = APIRouter(prefix="/program-generation")

# Singleton service instance
_program_service: ProgramGeneratorService = None


def get_program_service() -> ProgramGeneratorService:
    """Get or create program generator service singleton"""
    global _program_service
    if _program_service is None:
        _program_service = ProgramGeneratorService()
    return _program_service


class ProgramGenerationRequest(BaseModel):
    """Request model for program generation"""
    study_id: str
    dataset: str
    language: str  # 'R' or 'SAS'
    categorized_variables: Dict[str, Any]
    code_snippets: Dict[str, str]
    standards: Optional[Dict[str, str]] = None
    sdtm_domains: Optional[List[str]] = None


class ProgramGenerationWithNotesRequest(BaseModel):
    """Enhanced request model for program generation with user notes"""
    study_id: str
    dataset: str
    language: str  # 'R' or 'SAS'
    categorized_variables: Dict[str, Any]
    approved_variables: List[str]  # Only approved variables
    code_snippets: Dict[str, str]
    user_notes: Optional[Dict[str, str]] = {}  # Variable name -> user note
    user_preferences: Optional[Dict[str, Any]] = {}  # User programming preferences
    standards: Optional[Dict[str, str]] = None
    sdtm_domains: Optional[List[str]] = None


@router.post("/generate")
async def generate_complete_program(request: ProgramGenerationRequest) -> Dict[str, Any]:
    """
    Generate complete ADAM program from code snippets
    
    Takes categorized variables and their generated code snippets,
    orders them logically, and assembles a complete executable program.
    
    Returns:
        Complete program code with metadata
    """
    try:
        logger.info(f"Generating program: {request.dataset} in {request.language}")
        
        service = get_program_service()
        
        result = service.generate_complete_program(
            study_id=request.study_id,
            dataset=request.dataset,
            language=request.language,
            categorized_variables=request.categorized_variables,
            code_snippets=request.code_snippets,
            standards=request.standards,
            sdtm_domains=request.sdtm_domains
        )
        
        return {
            "status": "success",
            "data": result
        }
        
    except Exception as e:
        logger.error(f"Error generating program: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generate-header")
async def generate_header(
    language: str,
    dataset: str,
    study_id: str,
    standards: Optional[Dict[str, str]] = None
) -> Dict[str, Any]:
    """
    Generate program header only
    
    Useful for previewing header format before full generation.
    """
    try:
        service = get_program_service()
        
        header = service.generate_program_header(
            language=language,
            dataset=dataset,
            study_id=study_id,
            standards=standards
        )
        
        return {
            "status": "success",
            "data": {
                "header": header
            }
        }
        
    except Exception as e:
        logger.error(f"Error generating header: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/order-variables")
async def order_variables(variables: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Order variables by dependency
    
    Takes a list of variables and returns them in optimal execution order.
    """
    try:
        service = get_program_service()
        
        ordered = service.order_variables_by_dependency(variables)
        
        return {
            "status": "success",
            "data": {
                "ordered_variables": ordered,
                "count": len(ordered)
            }
        }
        
    except Exception as e:
        logger.error(f"Error ordering variables: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status")
async def program_generation_status() -> Dict[str, Any]:
    """
    Get program generation service status
    """
    try:
        service = get_program_service()
        return {
            "status": "active",
            "service": "ProgramGeneratorService",
            "supported_languages": ["R", "SAS"]
        }
    except Exception as e:
        logger.error(f"Error getting status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generate-with-notes")
async def generate_program_with_notes(request: ProgramGenerationWithNotesRequest) -> Dict[str, Any]:
    """
    Generate complete ADAM program with user notes and preferences
    
    Enhanced version that:
    - Filters to only approved variables
    - Integrates user notes into code as comments
    - Applies user programming preferences
    - Provides detailed metadata
    
    Args:
        request: Enhanced program generation request with notes and preferences
        
    Returns:
        Complete program code with metadata
    """
    try:
        logger.info(f"Generating program with notes: {request.dataset} in {request.language}")
        logger.info(f"Approved variables: {len(request.approved_variables)}")
        logger.info(f"Variables with notes: {len(request.user_notes)}")
        
        service = get_program_service()
        
        result = service.generate_program_with_notes(
            study_id=request.study_id,
            dataset=request.dataset,
            language=request.language,
            categorized_variables=request.categorized_variables,
            approved_variables=request.approved_variables,
            code_snippets=request.code_snippets,
            user_notes=request.user_notes,
            user_preferences=request.user_preferences,
            standards=request.standards,
            sdtm_domains=request.sdtm_domains
        )
        
        if result.get('status') == 'error':
            raise HTTPException(status_code=500, detail=result.get('error', 'Unknown error'))
        
        return {
            "status": "success",
            "data": result
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating program with notes: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

