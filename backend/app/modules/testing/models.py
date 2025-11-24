"""
Testing Framework Models

Pydantic models for test data generation, execution, and validation.
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Literal
from datetime import datetime
from enum import Enum


class TestStatus(str, Enum):
    """Test execution status"""
    PASSED = "passed"
    FAILED = "failed"
    ERROR = "error"
    SKIPPED = "skipped"
    RUNNING = "running"


class ExecutionEnvironment(str, Enum):
    """Execution environment type"""
    DOCKER = "docker"
    LOCAL = "local"
    VIYA = "viya"


class LanguageType(str, Enum):
    """Programming language"""
    R = "R"
    SAS = "SAS"


# ============================================
# CODE EXECUTION MODELS (NEW)
# ============================================

class CodeSnippetExecutionRequest(BaseModel):
    """Request to execute a single code snippet"""
    code: str = Field(..., description="Code snippet to execute")
    language: LanguageType = Field(..., description="Programming language (R or SAS)")
    snippet_id: Optional[str] = Field(None, description="Optional snippet identifier")
    test_dataset_ids: List[str] = Field(default_factory=list, description="List of test dataset IDs to mount")
    timeout: int = Field(300, description="Execution timeout in seconds (default: 300s / 5 minutes)")
    execution_env: ExecutionEnvironment = Field(ExecutionEnvironment.DOCKER, description="Execution environment")


class DatasetPreview(BaseModel):
    """Preview of output dataset"""
    name: str = Field(..., description="Dataset name")
    rows: int = Field(..., description="Number of rows")
    columns: int = Field(..., description="Number of columns")
    column_names: List[str] = Field(default_factory=list, description="Column names")
    first_rows: List[Dict[str, Any]] = Field(default_factory=list, description="First 10 rows as dict")
    file_path: Optional[str] = Field(None, description="Path to full dataset file")


class PerformanceMetrics(BaseModel):
    """Execution performance metrics"""
    execution_time_seconds: float = Field(..., description="Execution time in seconds")
    memory_used_mb: Optional[float] = Field(None, description="Memory used in MB")
    cpu_usage_percent: Optional[float] = Field(None, description="CPU usage percentage")


class CodeExecutionResult(BaseModel):
    """Result of code snippet execution with regulatory compliance"""
    snippet_id: Optional[str] = None
    execution_id: str = Field(..., description="Unique execution identifier for traceability")
    status: TestStatus
    language: LanguageType
    
    # Output
    console_output: List[str] = Field(default_factory=list, description="Console stdout lines")
    errors: List[str] = Field(default_factory=list, description="Error messages")
    warnings: List[str] = Field(default_factory=list, description="Warning messages")
    
    # Dataset results
    dataset_previews: List[DatasetPreview] = Field(default_factory=list, description="Generated datasets")
    
    # Performance
    performance: PerformanceMetrics
    
    # Metadata
    executed_at: datetime = Field(default_factory=datetime.now)
    executed_by: Optional[str] = Field(None, description="User who executed code")
    
    # Reproducibility & Compliance
    environment_info: Dict[str, str] = Field(default_factory=dict, description="Execution environment details")
    code_checksum: Optional[str] = Field(None, description="SHA-256 hash of executed code")
    dataset_checksums: Dict[str, str] = Field(default_factory=dict, description="Checksums of input datasets")
    
    # Audit trail reference
    audit_entry_id: Optional[str] = Field(None, description="Link to audit trail entry")


class DockerEnvironmentStatus(BaseModel):
    """Docker environment status"""
    docker_available: bool = Field(..., description="Docker daemon is running")
    r_image_available: bool = Field(False, description="R Docker image is pulled")
    sas_image_available: bool = Field(False, description="SAS Docker image is pulled")
    r_image_name: str = Field("rocker/tidyverse:latest")
    sas_image_name: str = Field("sass/base:latest")
    error_message: Optional[str] = Field(None, description="Error if Docker unavailable")


# ============================================
# TEST DATA GENERATION MODELS
# ============================================

class TestDataGenerationRequest(BaseModel):
    """Request for generating test data"""
    dataset_type: str = Field(..., description="SDTM dataset type (DM, AE, LB, etc.)")
    num_subjects: int = Field(10, ge=1, le=1000, description="Number of subjects")
    include_edge_cases: bool = Field(True, description="Include edge cases")
    include_negative_cases: bool = Field(False, description="Include invalid data")
    seed: Optional[int] = Field(None, description="Random seed for reproducibility")


class TestDataGenerationResponse(BaseModel):
    """Response from test data generation"""
    test_data_id: str
    dataset_type: str
    num_subjects: int
    file_path: str
    generated_at: datetime
    metadata: Dict[str, Any] = Field(default_factory=dict)


# ============================================
# TEST EXECUTION MODELS
# ============================================

class TestExecutionRequest(BaseModel):
    """Request to execute ADAM code against test data"""
    code: str = Field(..., description="ADAM code to execute")
    language: LanguageType
    test_data_id: str = Field(..., description="Test data identifier")
    execution_env: ExecutionEnvironment = Field(ExecutionEnvironment.DOCKER)
    timeout: int = Field(300, description="Timeout in seconds")


class TestExecutionResult(BaseModel):
    """Result of test execution"""
    test_id: str
    status: TestStatus
    execution_duration_seconds: float
    output_dataset_path: Optional[str] = None
    logs: List[str] = Field(default_factory=list)
    errors: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)


# ============================================
# TEST VALIDATION MODELS
# ============================================

class ValidationIssue(BaseModel):
    """Single validation issue"""
    severity: Literal["ERROR", "WARNING", "INFO"]
    message: str
    variable: Optional[str] = None
    row_number: Optional[int] = None
    rule: Optional[str] = None


class TestValidationResult(BaseModel):
    """Result of test validation"""
    test_id: str
    dataset_name: str
    total_issues: int
    errors: int
    warnings: int
    info: int
    issues: List[ValidationIssue] = Field(default_factory=list)
    validated_at: datetime = Field(default_factory=datetime.now)


# ============================================
# COMPREHENSIVE TEST REPORT
# ============================================

class ComprehensiveTestReport(BaseModel):
    """Comprehensive test report"""
    test_suite_id: str
    execution_result: TestExecutionResult
    validation_result: TestValidationResult
    generated_at: datetime = Field(default_factory=datetime.now)
    summary: Dict[str, Any] = Field(default_factory=dict)


# ============================================
# TEST DATASET MANAGEMENT MODELS
# ============================================

class TestDatasetUploadRequest(BaseModel):
    """Request to upload a test dataset"""
    name: str = Field(..., description="Dataset collection name")
    description: Optional[str] = Field(None, description="Optional description")
    project_id: Optional[str] = Field(None, description="Associated project ID")


class TestDatasetFile(BaseModel):
    """Information about a single dataset file"""
    filename: str
    size_bytes: int
    uploaded_at: datetime
    file_path: str


class TestDatasetInfo(BaseModel):
    """Information about a test dataset collection with integrity tracking"""
    dataset_id: str
    name: str
    description: Optional[str] = None
    project_id: Optional[str] = None
    files: List[TestDatasetFile] = Field(default_factory=list)
    created_at: datetime
    created_by: Optional[str] = Field(None, description="User who uploaded dataset")
    file_count: int = 0
    total_size_bytes: int = 0
    
    # Data integrity
    integrity_checks: Dict[str, 'DataIntegrityCheck'] = Field(default_factory=dict, description="File integrity checks")
    last_verified_at: Optional[datetime] = Field(None, description="Last integrity verification")
    
    # Audit trail
    upload_audit_id: Optional[str] = Field(None, description="Audit entry for upload")
    
    # Metadata
    tags: List[str] = Field(default_factory=list, description="Dataset tags for organization")
    version: str = Field("1.0", description="Dataset version")


class TestDatasetListResponse(BaseModel):
    """Response with list of test datasets"""
    datasets: List[TestDatasetInfo]
    total_count: int


# ============================================
# AUDIT TRAIL & REGULATORY COMPLIANCE (21 CFR Part 11)
# ============================================

class AuditAction(str, Enum):
    """Audit trail action types"""
    DATASET_UPLOAD = "dataset_upload"
    DATASET_DELETE = "dataset_delete"
    CODE_EXECUTE = "code_execute"
    CODE_VALIDATE = "code_validate"
    RESULT_VIEW = "result_view"
    RESULT_EXPORT = "result_export"
    CONFIGURATION_CHANGE = "configuration_change"
    USER_LOGIN = "user_login"
    USER_LOGOUT = "user_logout"


class AuditEntry(BaseModel):
    """Single audit trail entry per 21 CFR Part 11.10(e)"""
    audit_id: str = Field(..., description="Unique audit entry ID")
    timestamp: datetime = Field(default_factory=datetime.now, description="Action timestamp (UTC)")
    user_id: str = Field(..., description="User who performed the action")
    user_name: str = Field(..., description="Full name of user")
    action: AuditAction = Field(..., description="Type of action performed")
    resource_type: str = Field(..., description="Type of resource (dataset, code, result)")
    resource_id: str = Field(..., description="ID of affected resource")
    description: str = Field(..., description="Human-readable action description")
    before_state: Optional[Dict[str, Any]] = Field(None, description="State before action")
    after_state: Optional[Dict[str, Any]] = Field(None, description="State after action")
    ip_address: Optional[str] = Field(None, description="IP address of user")
    session_id: Optional[str] = Field(None, description="User session identifier")
    success: bool = Field(True, description="Whether action succeeded")
    error_message: Optional[str] = Field(None, description="Error if action failed")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional context")


class DataIntegrityCheck(BaseModel):
    """Data integrity verification per 21 CFR Part 11.10(a)"""
    checksum_algorithm: str = Field("SHA-256", description="Hash algorithm used")
    checksum_value: str = Field(..., description="Computed checksum")
    file_size_bytes: int = Field(..., description="Original file size")
    verified_at: datetime = Field(default_factory=datetime.now, description="Verification timestamp")
    verified_by: Optional[str] = Field(None, description="User who verified")
    integrity_status: Literal["valid", "invalid", "not_verified"] = Field("valid")


class ElectronicSignature(BaseModel):
    """Electronic signature per 21 CFR Part 11.50"""
    signature_id: str = Field(..., description="Unique signature ID")
    signed_by: str = Field(..., description="User ID of signer")
    signer_name: str = Field(..., description="Full name of signer")
    signed_at: datetime = Field(default_factory=datetime.now, description="Signature timestamp")
    signature_meaning: str = Field(..., description="Meaning of signature (e.g., 'Approved', 'Reviewed')")
    signature_value: str = Field(..., description="Encrypted signature value")
    resource_id: str = Field(..., description="ID of signed resource")
    resource_checksum: str = Field(..., description="Checksum at time of signing")


class ValidationMetadata(BaseModel):
    """Enhanced validation metadata for regulatory compliance"""
    validation_id: str = Field(..., description="Unique validation ID")
    validation_type: Literal["syntax", "execution", "output"] = Field(...)
    validator_version: str = Field(..., description="Version of validation tool")
    validation_timestamp: datetime = Field(default_factory=datetime.now)
    validation_status: Literal["passed", "failed", "warning"] = Field(...)
    validation_criteria: List[str] = Field(default_factory=list, description="Validation rules applied")
    validation_results: Dict[str, Any] = Field(default_factory=dict)
    validated_by_user: Optional[str] = Field(None)
    comments: Optional[str] = Field(None, description="Validation comments or notes")

