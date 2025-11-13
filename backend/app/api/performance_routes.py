"""
Performance and System API Routes
Cache management, batch processing, and system metrics
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from app.core.cache import get_cache, get_cache_stats, clear_cache
from app.core.batch import get_batch_processor, BatchItem, BatchStatus
from app.core.auth import get_current_user, require_role
import uuid

router = APIRouter(prefix="/performance", tags=["performance"])


class CacheStatsResponse(BaseModel):
    """Cache statistics"""
    size: int
    max_size: int
    hits: int
    misses: int
    total_requests: int
    hit_rate: float


class BatchJobRequest(BaseModel):
    """Request to create batch job"""
    variables: List[str] = Field(..., description="List of variables to process")
    operation: str = Field(..., description="Operation type: generate, validate, categorize")
    language: str = Field(default="R", description="Programming language")
    spec: Optional[str] = Field(None, description="Specification text")


class BatchProgressResponse(BaseModel):
    """Batch job progress"""
    job_id: str
    status: str
    progress: float
    total: int
    completed: int
    failed: int
    processing: int
    pending: int


@router.get("/cache/stats", response_model=CacheStatsResponse)
async def get_cache_statistics(current_user = Depends(get_current_user)):
    """
    Get cache statistics including hit rate and size.
    
    **Requirements:**
    - Authentication required
    
    **Returns:**
    - Cache size and max size
    - Hit/miss counts and hit rate percentage
    - Sample of cached entries
    
    **Example Response:**
    ```json
    {
      "size": 150,
      "max_size": 1000,
      "hits": 450,
      "misses": 200,
      "total_requests": 650,
      "hit_rate": 69.23
    }
    ```
    """
    stats = get_cache_stats()
    return stats


@router.post("/cache/clear")
async def clear_cache_endpoint(current_user = Depends(require_role("admin"))):
    """
    Clear all cached data.
    
    **Requirements:**
    - Admin authentication required
    
    **Use Cases:**
    - Clear cache after model updates
    - Free up memory
    - Reset system state
    
    **Returns:**
    - Success message
    """
    clear_cache()
    return {
        "message": "Cache cleared successfully",
        "status": "success"
    }


@router.post("/cache/cleanup")
async def cleanup_expired_cache(current_user = Depends(get_current_user)):
    """
    Remove expired cache entries.
    
    **Requirements:**
    - Authentication required
    
    **Returns:**
    - Number of entries removed
    """
    cache = get_cache()
    removed = cache.cleanup_expired()
    return {
        "message": f"Removed {removed} expired entries",
        "removed_count": removed
    }


@router.post("/batch/create", response_model=Dict[str, str])
async def create_batch_job(
    request: BatchJobRequest,
    current_user = Depends(get_current_user)
):
    """
    Create a batch processing job for multiple variables.
    
    **Requirements:**
    - Authentication required
    - Maximum 50 variables per batch
    
    **Use Cases:**
    - Generate code for multiple variables at once
    - Validate multiple code snippets
    - Categorize multiple variables
    
    **Example Request:**
    ```json
    {
      "variables": ["AGE", "SEX", "RACE", "ETHNIC"],
      "operation": "generate",
      "language": "R",
      "spec": "ADSL specification..."
    }
    ```
    
    **Returns:**
    - job_id for tracking progress
    """
    if len(request.variables) > 50:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum 50 variables per batch"
        )
    
    # Create batch items
    job_id = str(uuid.uuid4())
    items = [
        BatchItem(
            id=str(uuid.uuid4()),
            variable=var,
            status=BatchStatus.PENDING
        )
        for var in request.variables
    ]
    
    # Store job info (actual processing would be handled by background task)
    processor = get_batch_processor()
    
    return {
        "job_id": job_id,
        "status": "created",
        "item_count": len(items),
        "message": f"Batch job created with {len(items)} items"
    }


@router.get("/batch/{job_id}/progress", response_model=BatchProgressResponse)
async def get_batch_progress(
    job_id: str,
    current_user = Depends(get_current_user)
):
    """
    Get progress for a batch job.
    
    **Requirements:**
    - Authentication required
    - Valid job_id
    
    **Returns:**
    - Current job status
    - Progress percentage
    - Item counts by status
    
    **Example Response:**
    ```json
    {
      "job_id": "uuid-here",
      "status": "processing",
      "progress": 65.5,
      "total": 20,
      "completed": 13,
      "failed": 0,
      "processing": 2,
      "pending": 5
    }
    ```
    """
    processor = get_batch_processor()
    progress = processor.get_job_progress(job_id)
    
    if not progress:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Batch job {job_id} not found"
        )
    
    return progress


@router.get("/batch/{job_id}/results")
async def get_batch_results(
    job_id: str,
    current_user = Depends(get_current_user)
):
    """
    Get results for a completed batch job.
    
    **Requirements:**
    - Authentication required
    - Job must be completed
    
    **Returns:**
    - Full job details with all item results
    - Success/failure status for each item
    - Generated code or error messages
    """
    processor = get_batch_processor()
    job = processor.get_job(job_id)
    
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Batch job {job_id} not found"
        )
    
    return job.to_dict()


@router.delete("/batch/{job_id}")
async def cancel_batch_job(
    job_id: str,
    current_user = Depends(get_current_user)
):
    """
    Cancel a running batch job.
    
    **Requirements:**
    - Authentication required
    - Job must be in processing status
    
    **Returns:**
    - Success status
    """
    processor = get_batch_processor()
    cancelled = processor.cancel_job(job_id)
    
    if not cancelled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Job cannot be cancelled (not found or already completed)"
        )
    
    return {
        "message": f"Batch job {job_id} cancelled",
        "status": "cancelled"
    }


@router.get("/stats")
async def get_performance_stats(current_user = Depends(get_current_user)):
    """
    Get overall performance statistics.
    
    **Requirements:**
    - Authentication required
    
    **Returns:**
    - Cache statistics
    - Batch processor statistics
    - System metrics
    
    **Use Cases:**
    - Monitor system performance
    - Identify bottlenecks
    - Track resource usage
    """
    cache = get_cache()
    processor = get_batch_processor()
    
    return {
        "cache": cache.get_stats(),
        "batch_processor": processor.get_stats(),
        "system": {
            "max_concurrent_jobs": processor.max_concurrent,
            "cache_max_size": cache.max_size
        }
    }
