"""
Pydantic models for validation module
"""

from typing import Dict, List, Optional, Literal, Any
from pydantic import BaseModel, Field
from datetime import datetime


class ValidationIssue(BaseModel):
    """Single validation issue"""
    severity: Literal["ERROR", "WARNING", "INFO"]
    dataset: Optional[str] = None
    variable: Optional[str] = None
    rule_id: Optional[str] = None
    message: str
    location: Optional[str] = None
    category: Optional[str] = None


class ValidationSummary(BaseModel):
    """Summary of validation results"""
    total_issues: int
    by_severity: Dict[str, int] = Field(default_factory=dict)
    datasets_checked: List[str] = Field(default_factory=list)
    validation_timestamp: datetime = Field(default_factory=datetime.utcnow)


class PreP21Request(BaseModel):
    """Request for Pre-P21 structural checks"""
    study_id: str
    dataset_names: List[str]
    rules_preset: Optional[str] = "default"


class PreP21Response(BaseModel):
    """Response from Pre-P21 checks"""
    issues: List[ValidationIssue]
    summary: ValidationSummary


class CTValidationRequest(BaseModel):
    """Request for Controlled Terminology validation"""
    study_id: str
    dataset_name: str
    ct_file_path: str
    versions: Optional[Dict[str, str]] = None
    bindings: Optional[Dict[str, str]] = None


class CTValidationResponse(BaseModel):
    """Response from CT validation"""
    issues: List[ValidationIssue]
    summary: ValidationSummary
    codelists_checked: List[str] = Field(default_factory=list)


class P21ValidationRequest(BaseModel):
    """Request for Pinnacle 21 validation"""
    study_id: str
    adam_paths: List[str]
    ruleset: Literal["ADaM"] = "ADaM"
    timeout_sec: Optional[int] = 600


class ArtifactRef(BaseModel):
    """Reference to a generated artifact"""
    name: str
    path: str
    created_at: str
    checksum: Optional[str] = None
    size_bytes: Optional[int] = None


class P21ValidationResponse(BaseModel):
    """Response from P21 validation"""
    issues: List[ValidationIssue]
    artifacts: List[ArtifactRef]
    summary: ValidationSummary
    raw_output: Optional[Dict[str, Any]] = None
