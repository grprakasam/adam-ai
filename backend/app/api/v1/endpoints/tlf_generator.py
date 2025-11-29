"""
TLF (Tables, Listings, Figures) Generator API Endpoints

AI-driven endpoints for creating ADAM statistical outputs based on mockshell documents.
"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends
from typing import Optional, Dict, Any, List
from loguru import logger
from pydantic import BaseModel, Field
import uuid

from app.modules.tlf_generator.service import TLFGeneratorService


router = APIRouter(prefix="/tlf-generator", tags=["tlf-generator"])


# ============================================================================
# Request/Response Models
# ============================================================================

class TLFType(str):
    """TLF type enumeration"""
    TABLE = "table"
    LISTING = "listing"
    FIGURE = "figure"


class TLFAnalysisRequest(BaseModel):
    """Request for analyzing uploaded mockshell"""
    tlf_type: str = Field(..., description="Type: table, listing, or figure")
    study_id: Optional[str] = Field(None, description="Study identifier")
    dataset_name: Optional[str] = Field(None, description="Dataset name (e.g., ADSL, ADAE)")
    output_name: Optional[str] = Field(None, description="Output name (e.g., T_14_1_01)")
    description: Optional[str] = Field(None, description="Description of the output")
    additional_context: Optional[str] = Field(None, description="Any additional context or requirements")


class TLFAnalysisResponse(BaseModel):
    """Response containing AI's understanding of mockshell"""
    session_id: str = Field(..., description="Unique session identifier")
    tlf_type: str
    understanding: Dict[str, Any] = Field(..., description="AI's interpretation of the mockshell")
    confidence_score: float = Field(..., description="Confidence score (0-1)")
    suggested_modifications: Optional[List[str]] = Field(None, description="Suggested improvements")
    requires_clarification: Optional[List[str]] = Field(None, description="Items needing clarification")


class TLFApprovalRequest(BaseModel):
    """Request to approve or modify understanding"""
    session_id: str
    approved: bool = Field(..., description="Whether user approves the understanding")
    modifications: Optional[Dict[str, Any]] = Field(None, description="User modifications to understanding")
    feedback: Optional[str] = Field(None, description="User feedback")


class TLFGenerationRequest(BaseModel):
    """Request to generate final TLF output"""
    session_id: str
    format: str = Field(default="html", description="Output format: html, pdf, rtf")
    include_citations: bool = Field(default=True, description="Include citations from source documents")


class TLFGenerationResponse(BaseModel):
    """Response with generated TLF output"""
    session_id: str
    tlf_type: str
    output: str = Field(..., description="Generated TLF content")
    format: str
    citations: Optional[List[Dict[str, str]]] = Field(None, description="Citations used")
    metadata: Dict[str, Any] = Field(..., description="Generation metadata")


# ============================================================================
# Service Instance
# ============================================================================

def get_tlf_service() -> TLFGeneratorService:
    """Get TLF generator service instance"""
    return TLFGeneratorService()


# ============================================================================
# API Endpoints
# ============================================================================

@router.post("/analyze", response_model=TLFAnalysisResponse)
async def analyze_mockshell(
    file: UploadFile = File(..., description="Mockshell document (PDF, Word, Excel, Image)"),
    tlf_type: str = Form(..., description="Type: table, listing, or figure"),
    study_id: Optional[str] = Form(None),
    dataset_name: Optional[str] = Form(None),
    output_name: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    additional_context: Optional[str] = Form(None),
    service: TLFGeneratorService = Depends(get_tlf_service)
):
    """
    Analyze uploaded mockshell document and extract TLF specifications.
    
    This endpoint:
    1. Accepts mockshell documents in various formats (PDF, Word, Excel, Images)
    2. Uses AI to understand the structure and requirements
    3. Returns a structured understanding for user confirmation
    
    Returns a session_id for subsequent operations.
    """
    try:
        logger.info(f"Analyzing mockshell: {file.filename}, type: {tlf_type}")
        
        # Read file content
        file_content = await file.read()
        
        # Create analysis request
        request = TLFAnalysisRequest(
            tlf_type=tlf_type,
            study_id=study_id,
            dataset_name=dataset_name,
            output_name=output_name,
            description=description,
            additional_context=additional_context
        )
        
        # Analyze mockshell
        result = await service.analyze_mockshell(
            file_content=file_content,
            filename=file.filename,
            request=request
        )
        
        logger.info(f"✅ Analysis complete. Session ID: {result['session_id']}")
        return TLFAnalysisResponse(**result)
        
    except Exception as e:
        logger.error(f"❌ Failed to analyze mockshell: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@router.post("/approve", response_model=Dict[str, Any])
async def approve_understanding(
    request: TLFApprovalRequest,
    service: TLFGeneratorService = Depends(get_tlf_service)
):
    """
    Approve or modify the AI's understanding of the mockshell.
    
    This endpoint:
    1. Accepts user's approval or modifications
    2. Updates the session with confirmed specifications
    3. Prepares for final generation
    
    If not approved, user can provide modifications or re-upload.
    """
    try:
        logger.info(f"Processing approval for session: {request.session_id}, approved: {request.approved}")
        
        result = await service.process_approval(request)
        
        return {
            "status": "approved" if request.approved else "modified",
            "session_id": request.session_id,
            "ready_for_generation": result.get("ready_for_generation", False),
            "message": result.get("message", "Understanding updated successfully")
        }
        
    except Exception as e:
        logger.error(f"❌ Failed to process approval: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Approval processing failed: {str(e)}")


@router.post("/generate", response_model=TLFGenerationResponse)
async def generate_tlf(
    request: TLFGenerationRequest,
    service: TLFGeneratorService = Depends(get_tlf_service)
):
    """
    Generate the final TLF output based on approved specifications.
    
    This endpoint:
    1. Retrieves approved specifications from session
    2. Generates the TLF output using AI
    3. Includes citations from source documents
    4. Returns the formatted output
    
    Requires prior approval via /approve endpoint.
    """
    try:
        logger.info(f"Generating TLF for session: {request.session_id}, format: {request.format}")
        
        result = await service.generate_tlf(request)
        
        logger.info(f"✅ TLF generation complete for session: {request.session_id}")
        return TLFGenerationResponse(**result)
        
    except Exception as e:
        logger.error(f"❌ Failed to generate TLF: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")


@router.get("/session/{session_id}")
async def get_session_status(
    session_id: str,
    service: TLFGeneratorService = Depends(get_tlf_service)
):
    """
    Get current status and details of a TLF generation session.
    
    Useful for:
    - Checking session state
    - Retrieving previous analysis
    - Reviewing approved specifications
    """
    try:
        session = await service.get_session(session_id)
        
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        return session
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to retrieve session: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Session retrieval failed: {str(e)}")


@router.delete("/session/{session_id}")
async def delete_session(
    session_id: str,
    service: TLFGeneratorService = Depends(get_tlf_service)
):
    """
    Delete a TLF generation session and associated data.
    """
    try:
        await service.delete_session(session_id)
        return {"status": "deleted", "session_id": session_id}
        
    except Exception as e:
        logger.error(f"❌ Failed to delete session: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Session deletion failed: {str(e)}")


@router.get("/examples")
async def get_examples():
    """
    Get example mockshells and templates for different TLF types.
    
    Useful for users to understand expected formats.
    """
    return {
        "table": {
            "description": "Statistical tables with summary statistics",
            "examples": [
                "Demographics table (age, sex, race)",
                "Adverse events summary table",
                "Lab values summary by visit"
            ]
        },
        "listing": {
            "description": "Detailed line-by-line data listings",
            "examples": [
                "Subject disposition listing",
                "Adverse events listing by subject",
                "Concomitant medications listing"
            ]
        },
        "figure": {
            "description": "Graphical representations and plots",
            "examples": [
                "Kaplan-Meier survival curves",
                "Laboratory values over time",
                "Mean change from baseline plots"
            ]
        }
    }


