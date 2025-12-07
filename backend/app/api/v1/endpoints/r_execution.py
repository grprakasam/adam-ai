"""
R Execution API Endpoints

REST API for interactive R code execution.
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks, Query
from fastapi.responses import FileResponse, StreamingResponse
from sse_starlette.sse import EventSourceResponse
from typing import Optional
import logging
import json
from pathlib import Path
import asyncio

from app.modules.r_execution import (
    RExecutionService,
    RExecutionRequest,
    RExecutionResponse,
    RExecutionStatus,
    RExecutionResult,
    RunStatus,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/r-execution", tags=["r-execution"])

# Initialize service
service = RExecutionService()


@router.post("/run", response_model=RExecutionResponse)
async def start_r_execution(
    request: RExecutionRequest,
    background_tasks: BackgroundTasks
):
    """
    Start R code execution in background

    Returns immediately with run_id and stream URL.
    Use the stream endpoint to monitor progress.
    """
    try:
        # Validate code is not empty
        if not request.code.strip():
            raise HTTPException(
                status_code=400,
                detail="R code cannot be empty"
            )

        # Start execution
        response = await service.start_execution(request)

        # Execute in background
        background_tasks.add_task(
            service.execute,
            request,
            response.run_id
        )

        return response

    except Exception as e:
        logger.error(f"Error starting R execution: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to start execution: {str(e)}"
        )


@router.get("/run/{run_id}", response_model=RExecutionStatus)
async def get_execution_status(run_id: str):
    """Get execution status"""
    status = await service.get_status(run_id)

    if not status:
        raise HTTPException(
            status_code=404,
            detail=f"Run {run_id} not found"
        )

    return status


@router.get("/run/{run_id}/result", response_model=RExecutionResult)
async def get_execution_result(run_id: str):
    """Get complete execution result (only available for completed runs)"""
    result = await service.get_result(run_id)

    if not result:
        # Check if run exists
        status = await service.get_status(run_id)
        if not status:
            raise HTTPException(
                status_code=404,
                detail=f"Run {run_id} not found"
            )

        # Run exists but not complete
        raise HTTPException(
            status_code=400,
            detail=f"Run {run_id} is not complete (status: {status.status})"
        )

    return result


@router.get("/run/{run_id}/stream")
async def stream_execution_progress(run_id: str):
    """
    Server-Sent Events stream for real-time execution progress

    Streams progress updates until execution completes.
    """
    # Check run exists
    status = await service.get_status(run_id)
    if not status:
        raise HTTPException(
            status_code=404,
            detail=f"Run {run_id} not found"
        )

    async def event_generator():
        """Generate SSE events"""
        try:
            # Poll for status updates
            last_progress = -1
            max_polls = 600  # 10 minutes @ 1s intervals

            for _ in range(max_polls):
                # Get current status
                current_status = await service.get_status(run_id)

                if not current_status:
                    break

                # Send update if progress changed
                if current_status.progress_percent != last_progress:
                    event_data = {
                        "run_id": run_id,
                        "status": current_status.status.value,
                        "progress_percent": current_status.progress_percent,
                        "current_step": current_status.current_step,
                        "error_message": current_status.error_message
                    }

                    yield {
                        "event": "progress",
                        "data": json.dumps(event_data)
                    }

                    last_progress = current_status.progress_percent

                # Check if complete
                if current_status.status in [RunStatus.SUCCEEDED, RunStatus.FAILED, RunStatus.TIMEOUT, RunStatus.CANCELED]:
                    # Send final event
                    yield {
                        "event": "complete",
                        "data": json.dumps({
                            "run_id": run_id,
                            "status": current_status.status.value,
                            "duration_seconds": current_status.duration_seconds,
                            "error_message": current_status.error_message
                        })
                    }
                    break

                # Wait before next poll
                await asyncio.sleep(1)

        except Exception as e:
            logger.error(f"Error in SSE stream for {run_id}: {e}", exc_info=True)
            yield {
                "event": "error",
                "data": json.dumps({"error": str(e)})
            }

    return EventSourceResponse(event_generator())


@router.get("/run/{run_id}/output/console")
async def get_console_output(run_id: str):
    """Get console output (stdout + stderr)"""
    result = await service.get_result(run_id)

    if not result:
        raise HTTPException(
            status_code=404,
            detail=f"Result not available for run {run_id}"
        )

    return {
        "run_id": run_id,
        "stdout": result.output.stdout,
        "stderr": result.output.stderr
    }


@router.get("/run/{run_id}/plots/{plot_index}")
async def download_plot(run_id: str, plot_index: int):
    """Download a plot image"""
    result = await service.get_result(run_id)

    if not result:
        raise HTTPException(
            status_code=404,
            detail=f"Result not available for run {run_id}"
        )

    # Find plot
    plot = next((p for p in result.output.plots if p.index == plot_index), None)

    if not plot:
        raise HTTPException(
            status_code=404,
            detail=f"Plot {plot_index} not found in run {run_id}"
        )

    plot_path = Path(plot.path)

    if not plot_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Plot file not found: {plot.filename}"
        )

    return FileResponse(
        path=plot_path,
        filename=plot.filename,
        media_type=f"image/{plot.format}"
    )


@router.get("/run/{run_id}/download/{filename}")
async def download_output_file(run_id: str, filename: str):
    """Download an output file"""
    work_dir = Path("Content/Generated/R_Execution/runs") / run_id
    output_dir = work_dir / "output"

    file_path = output_dir / filename

    # Security check - ensure file is within output directory
    try:
        file_path = file_path.resolve()
        output_dir = output_dir.resolve()

        if not str(file_path).startswith(str(output_dir)):
            raise HTTPException(
                status_code=403,
                detail="Access denied"
            )

    except Exception:
        raise HTTPException(
            status_code=403,
            detail="Invalid file path"
        )

    if not file_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"File not found: {filename}"
        )

    # Determine media type
    media_type = "application/octet-stream"
    if filename.endswith('.csv'):
        media_type = "text/csv"
    elif filename.endswith('.json'):
        media_type = "application/json"
    elif filename.endswith('.txt'):
        media_type = "text/plain"

    return FileResponse(
        path=file_path,
        filename=filename,
        media_type=media_type
    )


@router.delete("/run/{run_id}")
async def cancel_execution(run_id: str):
    """Cancel a running execution"""
    success = await service.cancel_execution(run_id)

    if not success:
        status = await service.get_status(run_id)
        if not status:
            raise HTTPException(
                status_code=404,
                detail=f"Run {run_id} not found"
            )

        raise HTTPException(
            status_code=400,
            detail=f"Cannot cancel run with status {status.status}"
        )

    return {"status": "success", "message": f"Run {run_id} canceled"}


@router.get("/versions")
async def list_r_versions():
    """List available R versions (Docker-based)"""
    from app.modules.r_execution.docker_runner import InteractiveRRunner

    versions = []
    for version, image in InteractiveRRunner.R_IMAGES.items():
        versions.append({
            "version": version,
            "docker_image": image,
            "is_default": version == InteractiveRRunner.DEFAULT_VERSION,
            "is_recommended": version == "4.3.2"
        })

    return versions


@router.get("/capabilities")
async def get_execution_capabilities():
    """
    Get current R execution capabilities

    Returns information about available execution methods:
    - Docker (recommended - best isolation)
    - Local R (fallback - uses installed R)
    """
    capabilities = service.get_capabilities()
    return capabilities.to_dict()


@router.get("/validate")
async def validate_system_health():
    """
    Validate system health before execution
    
    Performs comprehensive pre-execution checks including:
    - Docker availability and status
    - R image availability
    - Disk space
    - System resources (CPU, memory)
    
    Returns detailed validation results with suggestions for fixing issues.
    """
    from app.modules.r_execution.validation import validate_system
    
    try:
        validation_result = validate_system()
        return validation_result
    except Exception as e:
        logger.error(f"Error during system validation: {e}", exc_info=True)
        return {
            "is_valid": False,
            "checks": [{
                "is_valid": False,
                "message": f"Validation error: {str(e)}",
                "severity": "error",
                "suggestion": "Check backend logs for more details"
            }],
            "summary": "System validation failed with unexpected error"
        }


@router.get("/runs")
async def list_recent_runs(limit: int = Query(default=20, ge=1, le=100)):
    """List recent execution runs"""
    runs = await service.repository.list_runs(limit=limit)
    return {"runs": runs, "total": len(runs)}

