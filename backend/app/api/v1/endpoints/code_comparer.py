"""
Code Comparer API Endpoints

Provides endpoints for comparing code snippets with AI-powered analysis.
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from typing import Optional
from loguru import logger

from app.modules.code_comparer.schemas import (
    CodeComparisonRequest,
    CodeComparisonResult,
)
from app.modules.code_comparer.service import CodeComparerService

router = APIRouter(prefix="/code-comparer", tags=["code-comparer"])


# Initialize service
code_comparer_service = CodeComparerService()


def log_comparison_analytics(metadata: dict, context: Optional[dict]):
    """Log comparison analytics in background (non-blocking)"""
    try:
        logger.info("code_comparison_completed", extra={
            "comparison_mode": metadata.get("comparison_mode"),
            "similarity_score": metadata.get("similarity_score"),
            "execution_time_ms": metadata.get("execution_time_ms"),
            "llm_used": metadata.get("llm_used"),
            "language_1": metadata.get("language_1"),
            "language_2": metadata.get("language_2"),
            "study_id": context.get("study_id") if context else None,
            "dataset": context.get("dataset") if context else None,
        })
    except Exception as e:
        logger.warning(f"Failed to log analytics: {e}")


@router.post("/analyze", response_model=CodeComparisonResult)
async def analyze_code_comparison(
    request: CodeComparisonRequest,
    background_tasks: BackgroundTasks,
):
    """
    Compare two code snippets and return detailed analysis.
    
    - **Quick mode**: <1s, static diff only
    - **Standard mode**: 3-5s, diff + AI categorization
    - **Deep mode**: 10-15s, full AI + domain mapping
    
    Example request:
    ```json
    {
        "code_1": "x <- 1\\ny <- 2",
        "code_2": "x <- 1\\ny <- 3",
        "language_1": "r",
        "language_2": "r",
        "comparison_mode": "standard",
        "options": {
            "ignore_whitespace": true,
            "ignore_comments": false,
            "case_sensitive": false
        }
    }
    ```
    """
    try:
        # Validate input
        if not request.code_1.strip() or not request.code_2.strip():
            raise HTTPException(
                status_code=400,
                detail="Both code snippets must be non-empty"
            )
        
        if len(request.code_1) > 50000 or len(request.code_2) > 50000:
            raise HTTPException(
                status_code=413,
                detail="Code too large. Maximum 50,000 characters per snippet."
            )
        
        # Perform comparison
        logger.info(f"Starting code comparison: mode={request.comparison_mode}, lang1={request.language_1}, lang2={request.language_2}")
        
        result = await code_comparer_service.compare(request)
        
        # Log analytics in background
        background_tasks.add_task(
            log_comparison_analytics,
            result.metadata,
            request.context.dict() if request.context else None,
        )
        
        logger.info(f"Code comparison completed: similarity={result.overall_similarity_score:.1f}%, "
                   f"differences={result.summary['total_differences']}, "
                   f"time={result.metadata['execution_time_ms']}ms")
        
        return result
    
    except ValueError as e:
        logger.error(f"Validation error in code comparison: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except TimeoutError:
        logger.error("Code comparison timeout")
        raise HTTPException(
            status_code=503,
            detail="Analysis timeout. Try Quick mode for faster results."
        )
    except Exception as e:
        logger.error(f"Code comparison failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )


@router.get("/health")
async def health_check():
    """Health check endpoint for code comparer service"""
    return {
        "status": "healthy",
        "service": "code-comparer",
        "modes_available": ["quick", "standard", "deep"],
    }








