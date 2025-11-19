"""
Pydantic Models for Submission Readiness

All models use Pydantic v2 syntax for data validation and serialization.
"""

from typing import Optional, List, Dict, Any, Literal
from datetime import datetime
from pydantic import BaseModel, Field


# ========================
# Validation Models
# ========================

class PreflightIssue(BaseModel):
    """Individual pre-flight validation issue"""
    severity: Literal["ERROR", "WARNING", "INFO"]
    check: str = Field(..., description="Name of the check that failed")
    message: str = Field(..., description="Human-readable error message")
    variable: Optional[str] = None
    location: Optional[str] = None
    suggested_fix: Optional[str] = None


class PreflightResult(BaseModel):
    """Result of pre-flight structural validation"""
    passed: bool
    has_blocking_errors: bool
    runtime_seconds: float
    issues: List[PreflightIssue] = []


class CTValidationIssue(BaseModel):
    """Controlled Terminology validation issue"""
    severity: Literal["ERROR", "WARNING", "INFO"]
    variable: str
    value: str = Field(..., description="Invalid value found")
    expected_codelist: str
    message: str
    suggested_value: Optional[str] = None


class CTValidationResult(BaseModel):
    """Result of Controlled Terminology validation"""
    passed: bool
    runtime_seconds: float
    ct_file: str
    meddra_version: Optional[str] = None
    nci_ct_version: Optional[str] = None
    variables_checked: int
    issues: List[CTValidationIssue] = []


class P21ValidationIssue(BaseModel):
    """Pinnacle 21 validation issue"""
    severity: Literal["ERROR", "WARNING", "INFO"]
    dataset: str
    variable: Optional[str] = None
    rule_id: str
    message: str
    location: Optional[str] = None


class P21ValidationResult(BaseModel):
    """Result of P21 Community Edition validation"""
    passed: bool
    runtime_seconds: float
    summary: Dict[str, int] = Field(
        default_factory=dict,
        description="{'errors': 0, 'warnings': 3, 'info': 12}"
    )
    issues: List[P21ValidationIssue] = []
    report_path: Optional[str] = None


class ValidationSummary(BaseModel):
    """Summary of all validation checks"""
    overall_passed: bool = False
    summary: Dict[str, int] = Field(
        default_factory=lambda: {"errors": 0, "warnings": 0, "info": 0}
    )
    preflight: Optional[PreflightResult] = None
    controlled_terminology: Optional[CTValidationResult] = None
    p21: Optional[P21ValidationResult] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


# ========================
# Readiness Score Models
# ========================

class SubmissionReadinessScore(BaseModel):
    """Composite submission readiness score (0-100)"""
    overall: int = Field(..., ge=0, le=100)
    components: Dict[str, int] = Field(
        default_factory=lambda: {
            "preflight": 0,
            "controlled_terminology": 0,
            "p21_validation": 0,
            "define_xml": 0,
            "documentation": 0
        }
    )
    recommendations: List[str] = []
    last_updated: datetime = Field(default_factory=datetime.utcnow)


# ========================
# Artifact Models
# ========================

class Artifact(BaseModel):
    """Generated submission artifact"""
    name: str
    path: str
    size_bytes: int
    checksum_md5: str
    checksum_sha256: str
    created_at: datetime = Field(default_factory=datetime.utcnow)


class PackageManifest(BaseModel):
    """Manifest for eCTD package"""
    study_id: str
    package_path: str
    zip_file: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    artifacts: List[Artifact] = []
    total_size_bytes: int = 0
    audit_id: str


# ========================
# Request Models
# ========================

class ValidationRequest(BaseModel):
    """Request to run validation checks"""
    study_id: str
    dataset: str
    checks: List[Literal["preflight", "ct", "p21"]] = ["preflight", "ct", "p21"]
    options: Optional[Dict[str, Any]] = None


class PackageRequest(BaseModel):
    """Request to generate submission package"""
    study_id: str
    datasets: List[str]
    include: Dict[str, bool] = Field(
        default_factory=lambda: {
            "define_xml": True,
            "adrg": True,
            "sdrg": True,
            "programs": False
        }
    )
    options: Optional[Dict[str, Any]] = None


class DefineXmlOptions(BaseModel):
    """Options for Define.xml generation"""
    include_variable_docs: bool = True
    include_codelist_refs: bool = True
    add_stylesheet: bool = True
    include_value_metadata: bool = False
    template: str = "fda_standard"


# ========================
# Activity Log Models
# ========================

class ActivityLogItem(BaseModel):
    """Individual activity log entry"""
    timestamp: str
    action: str
    message: str
    status: Literal["success", "warning", "error", "info"]
    details: Optional[Dict[str, Any]] = None


# ========================
# Additional Models for API Endpoints
# ========================

class StudyInfo(BaseModel):
    """Study metadata for submission documents"""
    study_id: str
    protocol_number: str
    study_name: str
    sponsor: str
    description: Optional[str] = None
    adam_ig_version: str = "1.3"
    meddra_version: Optional[str] = None
    therapeutic_area: Optional[str] = None


class DatasetInfo(BaseModel):
    """Dataset information for submission"""
    name: str
    label: str
    structure: str = "One record per subject per parameter per analysis visit"
    class_type: str = "ADAM"
    key_variables: List[str] = Field(default_factory=list)
    variables: List[Dict[str, Any]] = Field(default_factory=list)


class ArtifactRef(BaseModel):
    """Reference to generated artifact"""
    name: str
    path: str
    created_at: str
    checksum: Optional[str] = None
    size_bytes: Optional[int] = None


class DefineXMLRequest(BaseModel):
    """Request for Define.xml generation"""
    study_info: 'StudyInfo'
    datasets: List['DatasetInfo']
    stylesheet_link: Optional[str] = None
    include_variable_docs: bool = True
    include_value_level: bool = False


class DefineXMLResponse(BaseModel):
    """Response from Define.xml generation"""
    artifact: ArtifactRef
    warnings: List[str] = Field(default_factory=list)


class DocumentRequest(BaseModel):
    """Request for ADRG/SDRG generation"""
    study_info: 'StudyInfo'
    datasets: List['DatasetInfo']
    notes: Optional[str] = None
    include_derivations: bool = True
    include_validation_summary: bool = False


class DocumentResponse(BaseModel):
    """Response from ADRG/SDRG generation"""
    artifact: ArtifactRef


class ECTDPackageRequest(BaseModel):
    """Request for eCTD packaging"""
    study_id: str
    include_define_xml: bool = True
    include_adrg: bool = True
    include_sdrg: bool = True
    include_programs: bool = False
    create_zip: bool = False
    target_dir: Optional[str] = None


class ECTDPackageResponse(BaseModel):
    """Response from eCTD packaging"""
    artifact: ArtifactRef
    tree: List[str] = Field(default_factory=list)
    manifest: Dict[str, Any] = Field(default_factory=dict)
