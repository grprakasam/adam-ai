"""
Code Execution API Endpoints

Provides REST API for executing R/SAS code snippets in sandboxed Docker environments.
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks, UploadFile, File, Form
from typing import List, Optional
import logging
import subprocess
import asyncio
import json
import shutil
from pathlib import Path
from datetime import datetime
import uuid

from app.modules.testing.models import (
    CodeSnippetExecutionRequest,
    CodeExecutionResult,
    DockerEnvironmentStatus,
    TestStatus,
    PerformanceMetrics,
    TestDatasetUploadRequest,
    TestDatasetInfo,
    TestDatasetListResponse,
    TestDatasetFile,
)
from app.modules.testing.test_execution.r_executor import RExecutor
from app.modules.testing.test_execution.service import TestExecutionService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/code-execution", tags=["code-execution"])

# Initialize services
r_executor = RExecutor()
test_execution_service = TestExecutionService()


# ============================================
# DOCKER ENVIRONMENT CHECK
# ============================================

@router.get("/environment-status", response_model=DockerEnvironmentStatus)
async def check_environment_status():
    """
    Check Docker environment status
    
    Verifies:
    - Docker daemon is running
    - R image (rocker/tidyverse) is available
    - SAS image is available (if configured)
    
    Returns:
        DockerEnvironmentStatus with availability flags
    """
    try:
        # Check if Docker is running
        result = subprocess.run(
            ["docker", "info"],
            capture_output=True,
            text=True,
            timeout=5
        )
        
        docker_available = result.returncode == 0
        
        if not docker_available:
            return DockerEnvironmentStatus(
                docker_available=False,
                error_message="Docker is not running. Please start Docker Desktop."
            )
        
        # Check R image
        r_image = "rocker/tidyverse:latest"
        r_result = subprocess.run(
            ["docker", "images", "-q", r_image],
            capture_output=True,
            text=True,
            timeout=5
        )
        r_image_available = bool(r_result.stdout.strip())
        
        # Check SAS image (optional)
        sas_image = "sass/base:latest"
        sas_result = subprocess.run(
            ["docker", "images", "-q", sas_image],
            capture_output=True,
            text=True,
            timeout=5
        )
        sas_image_available = bool(sas_result.stdout.strip())
        
        return DockerEnvironmentStatus(
            docker_available=True,
            r_image_available=r_image_available,
            sas_image_available=sas_image_available,
            r_image_name=r_image,
            sas_image_name=sas_image,
        )
        
    except subprocess.TimeoutExpired:
        logger.error("Docker command timeout")
        return DockerEnvironmentStatus(
            docker_available=False,
            error_message="Docker command timed out. Please check Docker installation."
        )
    except FileNotFoundError:
        logger.error("Docker command not found")
        return DockerEnvironmentStatus(
            docker_available=False,
            error_message="Docker is not installed. Please install Docker Desktop."
        )
    except Exception as e:
        logger.error(f"Error checking Docker status: {str(e)}")
        return DockerEnvironmentStatus(
            docker_available=False,
            error_message=f"Error: {str(e)}"
        )


@router.post("/pull-images")
async def pull_docker_images(background_tasks: BackgroundTasks):
    """
    Pull required Docker images in the background
    
    Pulls:
    - rocker/tidyverse:latest (R)
    - sass/base:latest (SAS) - if configured
    
    Returns:
        Task status
    """
    def pull_images():
        try:
            # Pull R image
            logger.info("Pulling R Docker image: rocker/tidyverse:latest")
            subprocess.run(
                ["docker", "pull", "rocker/tidyverse:latest"],
                check=True,
                timeout=600  # 10 minutes
            )
            logger.info("R image pulled successfully")
            
            # Pull SAS image (optional)
            # Uncomment if SAS image is available
            # logger.info("Pulling SAS Docker image: sass/base:latest")
            # subprocess.run(
            #     ["docker", "pull", "sass/base:latest"],
            #     check=True,
            #     timeout=600
            # )
            # logger.info("SAS image pulled successfully")
            
        except Exception as e:
            logger.error(f"Error pulling Docker images: {str(e)}")
    
    background_tasks.add_task(pull_images)
    
    return {
        "message": "Docker image pull started in background",
        "status": "in_progress"
    }


# ============================================
# CODE SNIPPET EXECUTION
# ============================================

@router.post("/execute-snippet", response_model=CodeExecutionResult)
async def execute_code_snippet(request: CodeSnippetExecutionRequest):
    """
    Execute a single R or SAS code snippet
    
    Workflow:
    1. Validate request and check Docker availability
    2. Prepare execution environment
    3. Execute code in Docker container
    4. Capture output, errors, warnings
    5. Parse and preview generated datasets
    6. Return structured results
    
    Args:
        request: Code execution request with snippet and parameters
    
    Returns:
        CodeExecutionResult with execution status and outputs
    """
    logger.info(f"Executing {request.language} code snippet: {request.snippet_id or 'unnamed'}")
    
    try:
        # Check Docker availability first
        env_status = await check_environment_status()
        
        if not env_status.docker_available:
            raise HTTPException(
                status_code=503,
                detail=f"Docker not available: {env_status.error_message}"
            )
        
        if request.language == "R" and not env_status.r_image_available:
            raise HTTPException(
                status_code=503,
                detail="R Docker image not available. Please pull the image first."
            )
        
        if request.language == "SAS" and not env_status.sas_image_available:
            raise HTTPException(
                status_code=503,
                detail="SAS Docker image not available."
            )
        
        # Execute based on language
        if request.language == "R":
            result = await execute_r_snippet(request)
        elif request.language == "SAS":
            # SAS execution to be implemented
            raise HTTPException(
                status_code=501,
                detail="SAS execution not yet implemented"
            )
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported language: {request.language}"
            )
        
        logger.info(f"Execution completed: {request.snippet_id} - Status: {result.status}")
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Execution error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Execution failed: {str(e)}"
        )


async def execute_r_snippet(request: CodeSnippetExecutionRequest) -> CodeExecutionResult:
    """
    Execute R code snippet using RExecutor with dataset mounting
    """
    import time
    from datetime import datetime
    import tempfile
    import os
    
    start_time = time.time()
    
    try:
        # Load dataset if specified
        dataset_path = None
        if request.test_dataset_ids:
            dataset_id = request.test_dataset_ids[0]  # Use first dataset
            metadata = load_datasets_metadata()
            dataset_info = next((d for d in metadata['datasets'] if d['id'] == dataset_id), None)
            
            if dataset_info:
                dataset_path = Path(DATASETS_DIR) / dataset_id
                if not dataset_path.exists():
                    raise ValueError(f"Dataset directory not found: {dataset_id}")
                logger.info(f"Mounting dataset: {dataset_info['name']} ({dataset_id})")
            else:
                logger.warning(f"Dataset not found in metadata: {dataset_id}")
        
        # Create temporary directory for execution context
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            
            # Paths
            script_path = temp_path / "test_script.R"
            output_path = temp_path / "output"
            output_path.mkdir(exist_ok=True)
            
            # Prepare R script
            # If dataset is provided, add code to list and load available datasets
            dataset_setup = ""
            if dataset_path:
                dataset_setup = """
# List available datasets
cat("Available datasets:\\n")
dataset_files <- list.files("/data", pattern = "\\\\.(xpt|sas7bdat|csv|txt)$", full.names = TRUE)
print(dataset_files)
cat("\\n")

# Function to load datasets
load_dataset <- function(filename) {
  file_path <- file.path("/data", filename)
  ext <- tools::file_ext(file_path)
  
  if (ext == "xpt") {
    library(haven)
    return(read_xpt(file_path))
  } else if (ext == "sas7bdat") {
    library(haven)
    return(read_sas(file_path))
  } else if (ext == "csv") {
    return(read.csv(file_path))
  } else if (ext == "txt") {
    return(read.table(file_path, header = TRUE, sep = "\\t"))
  } else {
    stop("Unsupported file format: ", ext)
  }
}

cat("Dataset loading function ready. Use: load_dataset('filename.xpt')\\n\\n")
"""
            
            full_script = f"""
# R Code Execution Script
library(tidyverse)

{dataset_setup}

# User Code
{request.code}

# Save session info
cat("\\n===== R Session Info =====\\n")
sessionInfo()
"""
            
            # Write script
            script_path.write_text(full_script)
            
            # Build Docker command
            docker_cmd = [
                "docker", "run",
                "--rm",  # Remove container after execution
                "-v", f"{script_path.absolute()}:/script.R:ro",  # Mount script (read-only)
                "-v", f"{output_path.absolute()}:/output",  # Mount output directory (read-write)
            ]
            
            # Mount dataset if provided
            if dataset_path:
                docker_cmd.extend([
                    "-v", f"{dataset_path.absolute()}:/data:ro",  # Mount dataset (read-only)
                ])
            
            # Add resource limits and security constraints
            docker_cmd.extend([
                "--memory", "2g",  # Limit memory to 2GB
                "--cpus", "2",     # Limit to 2 CPUs
                "--network", "none",  # No network access (security)
                "rocker/tidyverse:latest",
                "Rscript", "/script.R"
            ])
            
            logger.info(f"Executing Docker command: {' '.join(docker_cmd)}")
            
            # Execute Docker container with timeout
            try:
                process = await asyncio.create_subprocess_exec(
                    *docker_cmd,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
                
                stdout, stderr = await asyncio.wait_for(
                    process.communicate(),
                    timeout=request.timeout
                )
                
                # Parse output
                console_output = stdout.decode('utf-8', errors='ignore').split('\n') if stdout else []
                error_output = stderr.decode('utf-8', errors='ignore').split('\n') if stderr else []
                
                # Determine status
                if process.returncode == 0:
                    status = TestStatus.PASSED
                    errors = []
                else:
                    status = TestStatus.FAILED
                    errors = error_output
                
                # Extract warnings from output
                warnings_list = [line for line in console_output if 'Warning' in line or 'warning' in line]
                
                execution_time = time.time() - start_time
                
                return CodeExecutionResult(
                    snippet_id=request.snippet_id,
                    status=status,
                    language=request.language,
                    console_output=console_output,
                    errors=errors,
                    warnings=warnings_list,
                    dataset_previews=[],
                    performance=PerformanceMetrics(
                        execution_time_seconds=execution_time,
                        memory_used_mb=None,
                        cpu_usage_percent=None,
                    ),
                    executed_at=datetime.now(),
                )
                
            except asyncio.TimeoutError:
                execution_time = time.time() - start_time
                logger.error(f"Execution timeout after {request.timeout} seconds")
                return CodeExecutionResult(
                    snippet_id=request.snippet_id,
                    status=TestStatus.ERROR,
                    language=request.language,
                    console_output=[],
                    errors=[f"Execution timeout after {request.timeout} seconds"],
                    warnings=[],
                    dataset_previews=[],
                    performance=PerformanceMetrics(
                        execution_time_seconds=execution_time,
                    ),
                    executed_at=datetime.now(),
                )
        
    except Exception as e:
        execution_time = time.time() - start_time
        logger.error(f"Execution error: {str(e)}")
        return CodeExecutionResult(
            snippet_id=request.snippet_id,
            status=TestStatus.ERROR,
            language=request.language,
            console_output=[],
            errors=[f"Execution error: {str(e)}"],
            warnings=[],
            dataset_previews=[],
            performance=PerformanceMetrics(
                execution_time_seconds=execution_time,
            ),
            executed_at=datetime.now(),
        )


# ============================================
# TEST DATASET MANAGEMENT
# ============================================

# Base directory for test datasets
TEST_DATASETS_DIR = Path("Content/UserInputs/TestDatasets")
TEST_DATASETS_DIR.mkdir(parents=True, exist_ok=True)

# Metadata file for tracking datasets
DATASETS_METADATA_FILE = TEST_DATASETS_DIR / "datasets_metadata.json"


def load_datasets_metadata() -> dict:
    """Load datasets metadata from JSON file"""
    if DATASETS_METADATA_FILE.exists():
        try:
            with open(DATASETS_METADATA_FILE, 'r') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Error loading metadata: {e}")
            return {}
    return {}


def save_datasets_metadata(metadata: dict):
    """Save datasets metadata to JSON file"""
    try:
        with open(DATASETS_METADATA_FILE, 'w') as f:
            json.dump(metadata, f, indent=2, default=str)
    except Exception as e:
        logger.error(f"Error saving metadata: {e}")


@router.get("/test-datasets", response_model=TestDatasetListResponse)
async def list_test_datasets(project_id: Optional[str] = None):
    """
    List all saved test datasets
    
    Optionally filter by project_id.
    
    Returns:
        List of test dataset collections with metadata
    """
    try:
        metadata = load_datasets_metadata()
        
        datasets = []
        for dataset_id, info in metadata.items():
            # Filter by project if specified
            if project_id and info.get('project_id') != project_id:
                continue
            
            # Build dataset info
            dataset_info = TestDatasetInfo(
                dataset_id=dataset_id,
                name=info.get('name', 'Unnamed Dataset'),
                description=info.get('description'),
                project_id=info.get('project_id'),
                files=[
                    TestDatasetFile(**file_info) 
                    for file_info in info.get('files', [])
                ],
                created_at=datetime.fromisoformat(info.get('created_at', datetime.now().isoformat())),
                file_count=len(info.get('files', [])),
                total_size_bytes=sum(f.get('size_bytes', 0) for f in info.get('files', [])),
            )
            datasets.append(dataset_info)
        
        # Sort by created_at descending
        datasets.sort(key=lambda x: x.created_at, reverse=True)
        
        return TestDatasetListResponse(
            datasets=datasets,
            total_count=len(datasets)
        )
        
    except Exception as e:
        logger.error(f"Error listing datasets: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to list datasets: {str(e)}")


@router.post("/test-datasets/upload", response_model=TestDatasetInfo)
async def upload_test_dataset(
    files: List[UploadFile] = File(...),
    name: str = Form(...),
    description: Optional[str] = Form(None),
    project_id: Optional[str] = Form(None),
):
    """
    Upload test dataset files
    
    Creates a new dataset collection and uploads SDTM files (.xpt, .sas7bdat, .csv).
    
    Args:
        files: List of dataset files to upload
        name: Display name for the dataset collection
        description: Optional description
        project_id: Optional project association
    
    Returns:
        TestDatasetInfo with upload details
    """
    try:
        # Generate unique dataset ID
        dataset_id = str(uuid.uuid4())
        dataset_dir = TEST_DATASETS_DIR / dataset_id
        dataset_dir.mkdir(parents=True, exist_ok=True)
        
        # Save uploaded files
        uploaded_files = []
        for file in files:
            # Validate file extension
            allowed_extensions = ['.xpt', '.sas7bdat', '.csv', '.txt']
            file_ext = Path(file.filename).suffix.lower()
            if file_ext not in allowed_extensions:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid file type: {file.filename}. Allowed: {', '.join(allowed_extensions)}"
                )
            
            # Save file
            file_path = dataset_dir / file.filename
            with open(file_path, 'wb') as f:
                content = await file.read()
                f.write(content)
            
            file_info = TestDatasetFile(
                filename=file.filename,
                size_bytes=len(content),
                uploaded_at=datetime.now(),
                file_path=str(file_path)
            )
            uploaded_files.append(file_info)
        
        # Create metadata entry
        metadata = load_datasets_metadata()
        metadata[dataset_id] = {
            'name': name,
            'description': description,
            'project_id': project_id,
            'created_at': datetime.now().isoformat(),
            'files': [
                {
                    'filename': f.filename,
                    'size_bytes': f.size_bytes,
                    'uploaded_at': f.uploaded_at.isoformat(),
                    'file_path': f.file_path
                }
                for f in uploaded_files
            ]
        }
        save_datasets_metadata(metadata)
        
        logger.info(f"Uploaded test dataset: {dataset_id} - {name} ({len(uploaded_files)} files)")
        
        return TestDatasetInfo(
            dataset_id=dataset_id,
            name=name,
            description=description,
            project_id=project_id,
            files=uploaded_files,
            created_at=datetime.now(),
            file_count=len(uploaded_files),
            total_size_bytes=sum(f.size_bytes for f in uploaded_files),
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading dataset: {e}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


@router.delete("/test-datasets/{dataset_id}")
async def delete_test_dataset(dataset_id: str):
    """
    Delete a test dataset collection
    
    Removes all files and metadata for the specified dataset.
    
    Args:
        dataset_id: Dataset identifier
    
    Returns:
        Success message
    """
    try:
        metadata = load_datasets_metadata()
        
        if dataset_id not in metadata:
            raise HTTPException(status_code=404, detail="Dataset not found")
        
        # Delete files
        dataset_dir = TEST_DATASETS_DIR / dataset_id
        if dataset_dir.exists():
            shutil.rmtree(dataset_dir)
        
        # Remove from metadata
        dataset_name = metadata[dataset_id].get('name', dataset_id)
        del metadata[dataset_id]
        save_datasets_metadata(metadata)
        
        logger.info(f"Deleted test dataset: {dataset_id} - {dataset_name}")
        
        return {
            "message": f"Dataset '{dataset_name}' deleted successfully",
            "dataset_id": dataset_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting dataset: {e}")
        raise HTTPException(status_code=500, detail=f"Delete failed: {str(e)}")


@router.get("/test-datasets/{dataset_id}", response_model=TestDatasetInfo)
async def get_test_dataset(dataset_id: str):
    """
    Get details of a specific test dataset
    
    Args:
        dataset_id: Dataset identifier
    
    Returns:
        TestDatasetInfo with full details
    """
    try:
        metadata = load_datasets_metadata()
        
        if dataset_id not in metadata:
            raise HTTPException(status_code=404, detail="Dataset not found")
        
        info = metadata[dataset_id]
        
        return TestDatasetInfo(
            dataset_id=dataset_id,
            name=info.get('name', 'Unnamed Dataset'),
            description=info.get('description'),
            project_id=info.get('project_id'),
            files=[
                TestDatasetFile(**file_info) 
                for file_info in info.get('files', [])
            ],
            created_at=datetime.fromisoformat(info.get('created_at', datetime.now().isoformat())),
            file_count=len(info.get('files', [])),
            total_size_bytes=sum(f.get('size_bytes', 0) for f in info.get('files', [])),
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting dataset: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get dataset: {str(e)}")

