"""
Cache Management API Endpoints

Provides endpoints for managing application caches, particularly for
study-specific data isolation. When a user switches studies, all cached
data for the previous study should be cleared to prevent data leakage.
"""

from fastapi import APIRouter, HTTPException
from typing import Dict, Any, Optional
from loguru import logger
from pydantic import BaseModel

from app.modules.traceability.service import TraceabilityService
from app.modules.code_generator.service import CodeGeneratorService


router = APIRouter()


class CacheClearRequest(BaseModel):
    """Request model for cache clearing operations"""
    study_id: str
    datasets: Optional[list[str]] = None  # If None, clear all datasets


class CacheClearResponse(BaseModel):
    """Response model for cache clearing operations"""
    success: bool
    study_id: str
    cleared_entries: int
    message: str


@router.delete("/study/{study_id}", response_model=CacheClearResponse)
async def clear_study_caches(study_id: str):
    """
    Clear all caches for a specific study.
    
    This endpoint should be called when:
    - A user switches to a different study
    - A study's specification file is changed
    - A user explicitly requests a refresh
    
    This ensures data isolation between studies and prevents stale
    data from being served.
    """
    try:
        logger.info(f"Clearing all caches for study: {study_id}")
        
        cleared_count = 0
        
        # Clear traceability caches
        try:
            traceability_service = TraceabilityService()
            datasets = ['ADSL', 'ADAE', 'ADLB', 'ADVS', 'ADCM', 'ADTTE']
            
            for dataset in datasets:
                cache_key = f"traceability:{study_id}:{dataset}"
                try:
                    await traceability_service.cache.delete(cache_key)
                    cleared_count += 1
                    logger.debug(f"Cleared cache: {cache_key}")
                except Exception as e:
                    # Cache entry may not exist
                    logger.debug(f"Cache key not found or error: {cache_key}: {e}")
        except Exception as e:
            logger.warning(f"Error clearing traceability caches: {e}")
        
        # Clear code generator caches (if they're stored by study)
        try:
            code_service = CodeGeneratorService()
            if hasattr(code_service, 'cache_manager') and hasattr(code_service.cache_manager, 'clear_study'):
                count = code_service.cache_manager.clear_study(study_id)
                cleared_count += count
        except Exception as e:
            logger.warning(f"Error clearing code generator caches: {e}")
        
        logger.info(f"Cleared {cleared_count} cache entries for study {study_id}")
        
        return CacheClearResponse(
            success=True,
            study_id=study_id,
            cleared_entries=cleared_count,
            message=f"Successfully cleared {cleared_count} cache entries for study {study_id}"
        )
        
    except Exception as e:
        logger.error(f"Failed to clear caches for study {study_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to clear caches: {str(e)}")


@router.post("/clear", response_model=CacheClearResponse)
async def clear_caches(request: CacheClearRequest):
    """
    Clear caches for a specific study with optional dataset filtering.
    
    This allows more granular control over cache clearing.
    """
    try:
        logger.info(f"Clearing caches for study: {request.study_id}, datasets: {request.datasets}")
        
        cleared_count = 0
        
        # Determine which datasets to clear
        datasets = request.datasets or ['ADSL', 'ADAE', 'ADLB', 'ADVS', 'ADCM', 'ADTTE']
        
        # Clear traceability caches
        try:
            traceability_service = TraceabilityService()
            
            for dataset in datasets:
                cache_key = f"traceability:{request.study_id}:{dataset}"
                try:
                    await traceability_service.cache.delete(cache_key)
                    cleared_count += 1
                except Exception:
                    pass
        except Exception as e:
            logger.warning(f"Error clearing traceability caches: {e}")
        
        return CacheClearResponse(
            success=True,
            study_id=request.study_id,
            cleared_entries=cleared_count,
            message=f"Cleared {cleared_count} cache entries"
        )
        
    except Exception as e:
        logger.error(f"Failed to clear caches: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to clear caches: {str(e)}")


@router.get("/stats")
async def get_cache_stats() -> Dict[str, Any]:
    """
    Get cache statistics for monitoring and debugging.
    
    Returns statistics about cache usage, hit rates, and entry counts.
    """
    try:
        stats = {
            "traceability": {},
            "code_generator": {},
            "total_entries": 0,
        }
        
        # Get traceability cache stats
        try:
            traceability_service = TraceabilityService()
            if hasattr(traceability_service.cache, 'get_stats'):
                stats["traceability"] = traceability_service.cache.get_stats()
        except Exception as e:
            stats["traceability"]["error"] = str(e)
        
        # Get code generator cache stats
        try:
            code_service = CodeGeneratorService()
            if hasattr(code_service, 'cache_manager') and hasattr(code_service.cache_manager, 'get_stats'):
                stats["code_generator"] = code_service.cache_manager.get_stats()
        except Exception as e:
            stats["code_generator"]["error"] = str(e)
        
        return stats
        
    except Exception as e:
        logger.error(f"Failed to get cache stats: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get cache stats: {str(e)}")
