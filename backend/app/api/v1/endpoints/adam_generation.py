"""
ADAM Generation API Endpoints

Provides REST API for executing consolidated R/SAS programs against SDTM datasets
to generate ADAM datasets using Dockerized R runtime.
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks, Query
from fastapi.responses import FileResponse, StreamingResponse
from sse_starlette.sse import EventSourceResponse
from typing import List, Optional
import logging
from pathlib import Path
from datetime import datetime
import json

from app.modules.adam_generation import (
    AdamGenerationService,
    AdamGenerationRequest,
    AdamGenerationStatus,
    AdamGenerationResult,
    AdamFeedbackRequest,
    RVersionInfo,
    SDTMInputCheck,
    RunStatus,
    ValidationError,
    DockerUnavailableError,
)
from app.modules.adam_generation.validators import InputValidator
from app.modules.adam_generation.progress_emitter import get_progress_emitter

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/adam-generation", tags=["adam-generation"])

# Initialize service
service = AdamGenerationService()
validator = InputValidator()


@router.post("/run", response_model=AdamGenerationStatus)
async def start_adam_generation(
    request: AdamGenerationRequest,
    background_tasks: BackgroundTasks
):
    """Start ADAM dataset generation (async)"""
    try:
        # Validate immediately
        validation_result = await validator.validate_inputs(
            request.study_id,
            request.adam_dataset
        )
        if not validation_result.is_valid:
            raise HTTPException(
                status_code=400,
                detail=f"Validation failed: {', '.join(validation_result.errors)}"
            )
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Start background task
    run_id = AdamGenerationService._generate_run_id()
    await service.repository.create_run(
        run_id=run_id,
        study_id=request.study_id,
        adam_dataset=request.adam_dataset,
        request_params=request.dict()
    )

    # Execute in background
    background_tasks.add_task(
        service.generate_adam_dataset,
        request
    )

    return AdamGenerationStatus(
        run_id=run_id,
        study_id=request.study_id,
        adam_dataset=request.adam_dataset,
        status=RunStatus.QUEUED,
        progress_percent=0,
        current_step="Queued for execution",
        started_at=datetime.utcnow()
    )


@router.get("/run/{run_id}", response_model=AdamGenerationStatus)
async def get_run_status(run_id: str):
    """Poll run status"""
    try:
        status = await service.get_run_status(run_id)
        return status
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/run/{run_id}/stream")
async def stream_run_progress(run_id: str):
    """Server-Sent Events stream for real-time progress"""
    emitter = get_progress_emitter()

    async def event_generator():
        try:
            async for event in emitter.subscribe(run_id):
                yield {
                    "event": "progress",
                    "data": json.dumps(event)
                }
        except Exception as e:
            logger.error(f"Error in SSE stream for {run_id}: {e}")
            yield {
                "event": "error",
                "data": json.dumps({"error": str(e)})
            }

    return EventSourceResponse(event_generator())


@router.get("/run/{run_id}/result", response_model=AdamGenerationResult)
async def get_run_result(run_id: str):
    """Get complete result after successful generation"""
    status = await service.get_run_status(run_id)
    
    if status.status != RunStatus.SUCCEEDED:
        raise HTTPException(
            status_code=400,
            detail=f"Run {run_id} has not completed successfully (status: {status.status})"
        )

    # Get run metadata
    run = await service.repository.get_run(run_id, status.study_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    # Build result (simplified - in production, reconstruct from metadata)
    # For now, return status with additional info
    raise HTTPException(
        status_code=501,
        detail="Result reconstruction not yet fully implemented"
    )


@router.get("/run/{run_id}/download")
async def download_adam_dataset(
    run_id: str,
    format: str = Query("csv", regex="^(csv|xlsx|rds|zip)$")
):
    """Download generated ADAM dataset"""
    status = await service.get_run_status(run_id)

    if status.status != RunStatus.SUCCEEDED:
        raise HTTPException(
            status_code=400,
            detail="Run not completed successfully"
        )

    # Get run metadata
    run = await service.repository.get_run(run_id, status.study_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    output_artifacts = run.get("output_artifacts", {})
    file_path = output_artifacts.get(format)

    if not file_path or not Path(file_path).exists():
        raise HTTPException(
            status_code=404,
            detail=f"Format {format} not available for this run"
        )

    filename = f"{status.study_id}_{status.adam_dataset}_{run_id[:8]}.{format}"
    return FileResponse(
        path=file_path,
        filename=filename,
        media_type=_get_media_type(format)
    )


@router.get("/r-versions", response_model=List[RVersionInfo])
async def list_r_versions():
    """List available R versions"""
    return await service.get_r_versions()


@router.post("/run/{run_id}/feedback")
async def submit_feedback(run_id: str, feedback: AdamFeedbackRequest):
    """Submit user feedback for a run"""
    status = await service.get_run_status(run_id)
    
    await service.repository.save_feedback(
        run_id=run_id,
        study_id=status.study_id,
        feedback=feedback.dict()
    )
    
    return {"status": "success", "message": "Feedback submitted"}


@router.post("/check-inputs", response_model=SDTMInputCheck)
async def check_sdtm_inputs(
    study_id: str = Query(..., description="Study ID"),
    adam_dataset: str = Query(..., description="ADAM dataset name"),
    consolidated_code: Optional[str] = Query(None, description="Optional consolidated code to analyze for dataset requirements"),
    language: str = Query('R', description="Programming language (R or SAS)")
):
    """
    Pre-flight check for SDTM dataset availability.

    If consolidated_code is provided, intelligently analyzes it to detect
    required datasets. Otherwise, uses default ADAM dataset mapping.
    """
    result = await validator.check_sdtm_availability(
        study_id,
        adam_dataset,
        consolidated_code=consolidated_code,
        language=language
    )
    return result


def _get_media_type(format: str) -> str:
    """Get MIME type for format"""
    types = {
        "csv": "text/csv",
        "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "rds": "application/octet-stream",
        "zip": "application/zip"
    }
    return types.get(format, "application/octet-stream")

