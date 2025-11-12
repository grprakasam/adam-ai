"""
Standards API Endpoints
Endpoints for managing and accessing CDISC standards documents
"""

from fastapi import APIRouter, HTTPException
from loguru import logger
from typing import Dict, Any

from app.modules.standards_loading.service import StandardsLoadingService


router = APIRouter(prefix="/standards")

# Singleton service instance
_standards_service: StandardsLoadingService = None


def get_standards_service() -> StandardsLoadingService:
    """Get or create standards service singleton"""
    global _standards_service
    if _standards_service is None:
        _standards_service = StandardsLoadingService()
    return _standards_service


@router.get("/summary")
async def get_standards_summary() -> Dict[str, Any]:
    """
    Get summary of available standards documents
    
    Returns summary with counts and lists of available documents
    """
    try:
        service = get_standards_service()
        summary = await service.get_standards_summary()
        return {
            "status": "success",
            "data": summary
        }
    except Exception as e:
        logger.error(f"Error getting standards summary: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/load-all")
async def load_all_standards() -> Dict[str, Any]:
    """
    Load all standards documents
    
    Returns information about all loaded standards
    """
    try:
        service = get_standards_service()
        standards = await service.load_all_standards()
        return {
            "status": "success",
            "data": standards
        }
    except Exception as e:
        logger.error(f"Error loading all standards: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/ig-documents")
async def load_ig_documents() -> Dict[str, Any]:
    """
    Load CDISC Implementation Guide documents
    
    Returns IG document information
    """
    try:
        service = get_standards_service()
        ig_docs = await service.load_ig_documents()
        return {
            "status": "success",
            "data": ig_docs
        }
    except Exception as e:
        logger.error(f"Error loading IG documents: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/toxicity-grading")
async def load_toxicity_grading() -> Dict[str, Any]:
    """
    Load toxicity grading standards
    
    Returns toxicity grading information
    """
    try:
        service = get_standards_service()
        toxicity = await service.load_toxicity_grading()
        return {
            "status": "success",
            "data": toxicity
        }
    except Exception as e:
        logger.error(f"Error loading toxicity grading: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/meddra-dictionaries")
async def load_meddra_dictionaries() -> Dict[str, Any]:
    """
    Load MedDRA terminology dictionaries
    
    Returns MedDRA dictionary information
    """
    try:
        service = get_standards_service()
        meddra = await service.load_meddra_dictionaries()
        return {
            "status": "success",
            "data": meddra
        }
    except Exception as e:
        logger.error(f"Error loading MedDRA dictionaries: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/validate")
async def validate_standards_availability() -> Dict[str, Any]:
    """
    Validate that required standards are available
    
    Returns validation status for each standards category
    """
    try:
        service = get_standards_service()
        validation = service.validate_standards_availability()
        return {
            "status": "success",
            "data": validation
        }
    except Exception as e:
        logger.error(f"Error validating standards: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{category}/{name}")
async def get_standard_by_name(category: str, name: str) -> Dict[str, Any]:
    """
    Get specific standard document by name
    
    Args:
        category: Category (ig_documents, toxicity_grading, meddra_dictionaries)
        name: Document name
        
    Returns:
        Document information
    """
    try:
        service = get_standards_service()
        
        # Load all standards if not already loaded
        if not service.standards_cache:
            await service.load_all_standards()
        
        document = service.get_standard_by_name(category, name)
        
        if not document:
            raise HTTPException(
                status_code=404,
                detail=f"Standard '{name}' not found in category '{category}'"
            )
        
        return {
            "status": "success",
            "data": document
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting standard {category}/{name}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status")
async def standards_status() -> Dict[str, Any]:
    """
    Get standards service status
    
    Returns service status and configuration
    """
    try:
        service = get_standards_service()
        return {
            "status": "active",
            "directories": {
                "standards": str(service.standards_dir),
                "ig": str(service.ig_dir),
                "toxicity": str(service.toxicity_dir),
                "meddra": str(service.meddra_dir)
            },
            "cache_loaded": len(service.standards_cache) > 0
        }
    except Exception as e:
        logger.error(f"Error getting standards status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
