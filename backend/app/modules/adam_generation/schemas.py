"""
Pydantic schemas for ADAM generation
"""

from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Literal, Any
from datetime import datetime
from enum import Enum


class RunStatus(str, Enum):
    """Execution status enum"""
    QUEUED = "queued"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    CANCELED = "canceled"
    TIMEOUT = "timeout"


class AdamGenerationRequest(BaseModel):
    """Request to generate ADAM dataset"""
    study_id: str = Field(..., min_length=1, max_length=100, description="Study identifier")
    adam_dataset: str = Field(..., pattern="^AD[A-Z]{2,8}$", description="ADAM dataset name (e.g., ADSL, ADAE)")
    language: Literal["R", "SAS"] = Field("R", description="Programming language")
    r_version: Optional[str] = Field(None, pattern=r"^\d+\.\d+\.\d+$", description="R version (e.g., 4.3.2)")

    # Input specification
    consolidated_code_id: Optional[str] = Field(None, description="Reference to stored consolidated code")
    consolidated_code_text: Optional[str] = Field(None, description="Inline R/SAS code")
    sdtm_domains: Optional[List[str]] = Field(None, description="Required SDTM domains (auto-detect if None)")
    use_latest_sdtm: bool = Field(True, description="Use latest SDTM datasets for study")

    # Output preferences
    output_formats: List[Literal["csv", "xlsx", "rds", "zip"]] = Field(
        ["csv", "xlsx"], 
        description="Output formats to generate"
    )

    # Execution settings
    timeout_seconds: Optional[int] = Field(None, ge=60, le=3600, description="Execution timeout in seconds")
    memory_limit_mb: Optional[int] = Field(None, ge=512, le=8192, description="Memory limit in MB")
    enable_verbose_logging: bool = Field(False, description="Enable verbose logging")

    @validator('consolidated_code_text', 'consolidated_code_id', always=True)
    def check_code_source(cls, v, values):
        """Ensure either code_id or code_text is provided"""
        if not values.get('consolidated_code_id') and not v:
            raise ValueError("Either consolidated_code_id or consolidated_code_text required")
        return v


class AdamGenerationStatus(BaseModel):
    """Status response for polling"""
    run_id: str
    study_id: str
    adam_dataset: str
    status: RunStatus
    progress_percent: int = Field(ge=0, le=100)
    current_step: str
    started_at: datetime
    finished_at: Optional[datetime] = None
    duration_seconds: Optional[float] = None

    # Success metadata
    output_summary: Optional[Dict[str, Any]] = None

    # Failure metadata
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    error_details: Optional[Dict[str, Any]] = None


class AdamDatasetPreview(BaseModel):
    """Preview of generated dataset for UI table"""
    columns: List[str]
    rows: List[Dict[str, Any]]
    total_rows: int
    total_columns: int
    key_variables: List[str] = Field(default_factory=list, description="Key variables like USUBJID")


class AdamGenerationResult(BaseModel):
    """Complete result after successful generation"""
    run_id: str
    status: RunStatus
    adam_dataset: str

    # Output artifacts
    preview: AdamDatasetPreview
    download_urls: Dict[str, str] = Field(default_factory=dict, description="Format to download URL mapping")
    file_paths: Dict[str, str] = Field(default_factory=dict, description="Format to file path mapping")

    # Metadata
    r_version: str
    execution_duration: float
    input_datasets: List[str]
    code_hash: str
    timestamp: datetime


class AdamFeedbackRequest(BaseModel):
    """User feedback submission"""
    study_id: str
    adam_dataset: str
    run_id: Optional[str] = None
    rating: Optional[int] = Field(None, ge=1, le=5, description="Rating 1-5")
    is_production_ready: Optional[bool] = None
    comments: Optional[str] = Field(None, max_length=2000)
    user_id: Optional[str] = None


class RVersionInfo(BaseModel):
    """Available R version metadata"""
    version: str
    docker_image: str
    is_default: bool = False
    is_recommended: bool = False
    description: Optional[str] = None
    preinstalled_packages: List[str] = Field(default_factory=list)


class SDTMInputCheck(BaseModel):
    """SDTM input availability check result"""
    study_id: str
    adam_dataset: str
    required_domains: List[str]
    available_domains: List[str]
    missing_domains: List[str]
    dataset_metadata: Dict[str, Dict[str, Any]] = Field(default_factory=dict)

    # Code analysis metadata
    detection_method: Optional[str] = Field(None, description="How datasets were detected: 'default', 'code_analysis', or 'hybrid'")
    confidence_level: Optional[str] = Field(None, description="Confidence in detected datasets: 'high', 'medium', or 'low'")
    code_analysis_warnings: Optional[List[str]] = Field(None, description="Warnings from code analysis")
    dataset_operations: Optional[Dict[str, List[str]]] = Field(None, description="Operations detected for each dataset")


class ExecutionResult(BaseModel):
    """Result from Docker R execution"""
    success: bool
    exit_code: int
    duration: float = Field(description="Execution duration in seconds")
    logs: List[str] = Field(default_factory=list)
    stderr: Optional[str] = None
    stdout: Optional[str] = None
    log_file: Optional[str] = None


class ProgressEvent(BaseModel):
    """Real-time progress event for SSE streaming"""
    run_id: str
    step: str
    progress_percent: int = Field(ge=0, le=100)
    message: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class RunMetadata(BaseModel):
    """Complete metadata for an ADAM generation run (for audit trail)"""
    run_id: str
    study_id: str
    adam_dataset: str
    language: str
    r_version: Optional[str] = None
    docker_image: Optional[str] = None

    # Input references
    consolidated_code_hash: str
    sdtm_datasets: List[str]
    sdtm_file_hashes: Dict[str, str] = Field(default_factory=dict)

    # Execution tracking
    started_at: datetime
    finished_at: Optional[datetime] = None
    duration_seconds: Optional[float] = None
    status: RunStatus

    # Configuration
    timeout_seconds: int
    memory_limit_mb: int

    # Results
    output_file_hashes: Dict[str, str] = Field(default_factory=dict)
    output_summary: Optional[Dict[str, Any]] = None

    # Error tracking
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    error_details: Optional[Dict[str, Any]] = None

    # User tracking
    user_id: Optional[str] = None

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

