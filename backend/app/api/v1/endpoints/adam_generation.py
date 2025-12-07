"""
ADAM Generator API Endpoints

Handle file uploads and execution for ADAM generation.
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks, UploadFile, File
from typing import List
import logging
import shutil
from pathlib import Path

from app.modules.r_execution import (
    RExecutionService,
    RExecutionRequest,
    RExecutionResponse,
    ExecutionMode,
    RunStatus,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/adam-generation", tags=["adam-generation"])

# Initialize service
service = RExecutionService()

@router.post("/run", response_model=RExecutionResponse)
async def run_adam_generation(
    background_tasks: BackgroundTasks,
    code_file: UploadFile = File(...),
    data_files: List[UploadFile] = File(default=[]),
):
    """
    Start ADAM generation run with file uploads.
    
    1. Uploads R script and SDTM datasets.
    2. Sets up execution environment.
    3. Starts R execution in background.
    """
    try:
        # Generate Run ID
        run_id = service.generate_run_id()
        
        # Create Run Record early to reserve ID
        await service.repository.create_run(
            run_id=run_id,
            request_params={
                "code": "loaded_from_file", 
                "filename": code_file.filename,
                "mode": ExecutionMode.INTERACTIVE 
            }
        )

        # Create workspace manually to populate files
        work_dir = service._create_work_directory(run_id)
        input_dir = work_dir / "input"
        
        # Read code content
        code_content = await code_file.read()
        code_str = code_content.decode("utf-8", errors="replace")
        
        # Save SDTM files
        for data_file in data_files:
            file_path = input_dir / data_file.filename
            with open(file_path, "wb") as f:
                shutil.copyfileobj(data_file.file, f)
            logger.info(f"[{run_id}] Saved data file: {data_file.filename}")

        # Create Execution Request
        request = RExecutionRequest(
            code=code_str,
            mode=ExecutionMode.INTERACTIVE, # Use interactive mode to get plots/consoles
            timeout_seconds=600, # 10 minutes default
            memory_limit_mb=2048,
            capture_plots=True
        )
        
        # Start background execution
        # Note: We pass run_id to reuse the one we generated and populated
        background_tasks.add_task(
            service.execute,
            request,
            run_id
        )
        
        return RExecutionResponse(
            run_id=run_id,
            status=RunStatus.QUEUED,
            message="ADAM generation started",
            stream_url=f"/api/v1/r-execution/run/{run_id}/stream"
        )

    except Exception as e:
        logger.error(f"Error starting ADAM generation: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to start execution: {str(e)}"
        )
@router.post("/preprocess")
async def preprocess_sdtm_files(
    data_files: List[UploadFile] = File(...),
):
    """
    Generate R code to load uploaded SDTM files.
    """
    try:
        code_lines = [
            "# === Generated Preprocessing Code ===",
            "# Load required libraries",
            "library(haven)",
            "library(readr)",
            "library(readxl)",
            "library(dplyr)",
            "",
            "# Load SDTM Datasets"
        ]
        
        domains_found = []

        for file in data_files:
            filename = file.filename
            clean_name = filename.lower().replace(" ", "_")
            domain_name = Path(filename).stem.lower() # default variable name
            
            # Simple heuristic for domain naming (e.g. adsl.xpt -> adsl)
            # If filename is complex (e.g. sdtm_dm.sas7bdat), maybe keep it or simplify.
            # Let's stick to stem.
            
            load_cmd = ""
            if filename.lower().endswith(".sas7bdat"):
                load_cmd = f'{domain_name} <- read_sas("input/{filename}")'
            elif filename.lower().endswith(".xpt"):
                load_cmd = f'{domain_name} <- read_xpt("input/{filename}")'
            elif filename.lower().endswith(".csv"):
                load_cmd = f'{domain_name} <- read_csv("input/{filename}")'
            elif filename.lower().endswith(".xlsx"):
                load_cmd = f'{domain_name} <- read_excel("input/{filename}")'
            else:
                load_cmd = f'# Warning: Unsupported format for {filename}'
            
            code_lines.append(load_cmd)
            domains_found.append(domain_name.upper())

        code_lines.append("")
        code_lines.append(f"# Processed {len(data_files)} files: {', '.join(domains_found)}")
        
        return {"code": "\n".join(code_lines)}

    except Exception as e:
        logger.error(f"Error generating preprocessing code: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
