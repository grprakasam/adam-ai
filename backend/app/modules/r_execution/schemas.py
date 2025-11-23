"""
Pydantic schemas for R execution module
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum


class ExecutionMode(str, Enum):
    """Execution mode for R code"""
    INTERACTIVE = "interactive"  # Pure R execution, minimal wrapping
    ADAM = "adam"  # ADAM-specific with SDTM loading


class RunStatus(str, Enum):
    """Status of R execution"""
    QUEUED = "queued"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    CANCELED = "canceled"
    TIMEOUT = "timeout"


class RExecutionRequest(BaseModel):
    """Request to execute R code"""
    code: str = Field(..., description="R code to execute")
    r_version: str = Field(default="4.3.2", description="R version to use")
    mode: ExecutionMode = Field(default=ExecutionMode.INTERACTIVE, description="Execution mode")
    timeout_seconds: int = Field(default=300, ge=10, le=3600, description="Execution timeout (10s-1h)")
    memory_limit_mb: int = Field(default=2048, ge=512, le=8192, description="Memory limit (512MB-8GB)")
    capture_plots: bool = Field(default=True, description="Capture plots as images")
    working_directory: Optional[str] = Field(None, description="Optional working directory")

    # ADAM mode specific
    study_id: Optional[str] = Field(None, description="Study ID (for ADAM mode)")
    adam_dataset: Optional[str] = Field(None, description="ADAM dataset name (for ADAM mode)")


class PlotInfo(BaseModel):
    """Information about a generated plot"""
    index: int
    filename: str
    path: str
    size_bytes: int
    format: str = "png"


class DataFrameInfo(BaseModel):
    """Information about a data frame in the output"""
    name: str
    rows: int
    columns: int
    column_names: List[str]
    preview_rows: List[Dict[str, Any]] = Field(default_factory=list, description="First 10 rows")


class RExecutionOutput(BaseModel):
    """Complete output from R execution"""
    stdout: List[str] = Field(default_factory=list, description="Console output lines")
    stderr: List[str] = Field(default_factory=list, description="Error/warning lines")
    plots: List[PlotInfo] = Field(default_factory=list, description="Generated plots")
    data_frames: List[DataFrameInfo] = Field(default_factory=list, description="Data frames created")
    files: List[str] = Field(default_factory=list, description="Other files created")
    exit_code: int = 0
    error_message: Optional[str] = None


class RExecutionStatus(BaseModel):
    """Status of an R execution run"""
    run_id: str
    status: RunStatus
    mode: ExecutionMode
    r_version: str
    progress_percent: int = Field(default=0, ge=0, le=100)
    current_step: str = "Initializing"
    started_at: datetime
    finished_at: Optional[datetime] = None
    duration_seconds: Optional[float] = None
    error_message: Optional[str] = None


class RExecutionResponse(BaseModel):
    """Response after starting R execution"""
    run_id: str
    status: RunStatus
    message: str = "Execution started"
    stream_url: str  # URL for SSE stream


class RExecutionResult(BaseModel):
    """Complete result after R execution completes"""
    run_id: str
    status: RunStatus
    mode: ExecutionMode
    r_version: str
    code_hash: str
    execution_duration: float
    output: RExecutionOutput
    started_at: datetime
    finished_at: datetime
    resource_usage: Optional[Dict[str, Any]] = None
