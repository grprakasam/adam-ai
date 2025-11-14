"""
Program Generation API Endpoints
Endpoints for generating complete ADAM programs
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, List, Optional, Any
from loguru import logger

from app.modules.program_generation.service import ProgramGeneratorService
try:
    from app.modules.program_generation.models import ConsolidatedCodeRequest, ConsolidatedCodeResponse
    from app.modules.program_generation.consolidated_service import ConsolidatedCodeService
    CONSOLIDATED_AVAILABLE = True
except ImportError as e:
    CONSOLIDATED_AVAILABLE = False
    logger.warning(f"Consolidated code generation modules not available: {e}")


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


# Singleton for consolidated service
_consolidated_service: 'ConsolidatedCodeService' = None


def get_consolidated_service() -> 'ConsolidatedCodeService':
    """Get or create consolidated code service singleton"""
    global _consolidated_service
    if _consolidated_service is None and CONSOLIDATED_AVAILABLE:
        _consolidated_service = ConsolidatedCodeService()
    return _consolidated_service


@router.post("/consolidated", response_model=Dict[str, Any])
async def generate_consolidated_code(request: ConsolidatedCodeRequest) -> Dict[str, Any]:
    """
    Generate consolidated ADAM code from approved variables

    This endpoint provides advanced code generation with:
    - Category-based assembly following CDISC standards
    - Code optimization (redundancy removal, performance improvements)
    - Verbosity-driven documentation (low/medium/high)
    - CDISC compliance validation
    - Execution mode selection (API vs Local Ollama)

    Args:
        request: ConsolidatedCodeRequest with all parameters

    Returns:
        ConsolidatedCodeResponse with generated code, validation, and metadata

    Raises:
        HTTPException: If service unavailable or generation fails
    """
    try:
        if not CONSOLIDATED_AVAILABLE:
            raise HTTPException(
                status_code=503,
                detail="Consolidated code generation service not available. Missing required modules."
            )

        service = get_consolidated_service()
        if service is None:
            raise HTTPException(
                status_code=503,
                detail="Failed to initialize consolidated code service"
            )

        logger.info(f"Generating consolidated code: {request.dataset} in {request.language}")
        logger.info(f"Variables: {len(request.approved_variables)}, Mode: {request.execution_mode}")

        # Generate consolidated code
        result = await service.generate_consolidated_code(request)

        # Convert Pydantic model to dict
        if hasattr(result, 'dict'):
            result_dict = result.dict()
        else:
            result_dict = result

        if result_dict.get('status') == 'error':
            error_msg = result_dict.get('message', 'Unknown error')
            error_code = result_dict.get('error_code', 'GENERATION_ERROR')

            status_code = 400 if error_code in ['VALIDATION_ERROR', 'INSUFFICIENT_APPROVALS'] else 500
            raise HTTPException(status_code=status_code, detail=error_msg)

        logger.info(f"Consolidated code generated successfully: {result_dict.get('data', {}).get('summary', {}).get('lines_of_code', 0)} lines")

        return result_dict

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating consolidated code: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

