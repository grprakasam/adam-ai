"""
Pydantic Models for Consolidated Code Generation
"""

from typing import List, Dict, Optional, Literal
from pydantic import BaseModel, Field, validator
from datetime import datetime


class VariableMetadata(BaseModel):
    """Metadata for a single variable"""
    name: str
    type: str
    length: Optional[int] = None
    format: Optional[str] = None
    label: Optional[str] = None
    required: bool = False


class ApprovedVariable(BaseModel):
    """Single approved variable with code snippet and metadata"""
    name: str = Field(..., description="Variable name (e.g., USUBJID)")
    category: str = Field(..., description="CDISC category (e.g., Subject & Study Identifiers)")
    code_snippet: str = Field(..., description="Generated code for this variable")
    user_notes: Optional[str] = Field(None, description="User annotations/modifications")
    derivation_logic: Optional[str] = Field(None, description="Derivation description")
    metadata: Optional[VariableMetadata] = None


class UserPreferences(BaseModel):
    """User preferences for code generation"""
    r_packages: List[str] = Field(default_factory=lambda: ["dplyr", "tidyr", "haven"])
    sas_procs: List[str] = Field(default_factory=lambda: ["PROC SORT", "PROC SQL"])
    include_validation: bool = True
    include_error_handling: bool = True
    optimization_level: Literal["standard", "aggressive"] = "standard"


class ConsolidatedCodeRequest(BaseModel):
    """Request payload for consolidated code generation"""
    study_id: str = Field(..., description="Study identifier")
    dataset: Literal["ADSL", "ADAE", "ADLB", "ADCM", "ADVS"] = Field(..., description="ADAM dataset type")
    language: Literal["R", "SAS"] = Field(..., description="Programming language")
    comment_verbosity: Literal["low", "medium", "high"] = Field(default="medium", description="Comment detail level")
    execution_mode: Literal["api", "local"] = Field(default="api", description="LLM execution mode")
    approved_variables: List[ApprovedVariable] = Field(..., description="List of approved variables")
    user_preferences: Optional[UserPreferences] = Field(default_factory=UserPreferences)
    standards_version: Optional[Dict[str, str]] = Field(default_factory=dict)

    @validator('approved_variables')
    def validate_minimum_variables(cls, v):
        if len(v) < 1:
            raise ValueError("At least one approved variable is required")
        return v


class OptimizationResult(BaseModel):
    """Details of code optimizations applied"""
    description: str
    original_lines: Optional[int] = None
    optimized_lines: Optional[int] = None
    performance_impact: Optional[str] = None


class ValidationResult(BaseModel):
    """Code validation results"""
    syntax_valid: bool
    cdisc_compliant: bool
    warnings: List[str] = Field(default_factory=list)
    errors: List[str] = Field(default_factory=list)


class ConsolidatedCodeSummary(BaseModel):
    """Summary statistics for generated code"""
    total_variables: int
    categories_included: int
    lines_of_code: int
    file_size_kb: float
    optimizations_applied: List[str]
    generation_time_seconds: float
    confidence_score: Optional[float] = Field(None, ge=0, le=100, description="AI confidence (0-100)")


class GenerationMetadata(BaseModel):
    """Metadata about the generation process"""
    generated_at: datetime = Field(default_factory=datetime.utcnow)
    llm_provider: Literal["gemini", "openai", "anthropic", "ollama"]
    model_used: str
    execution_mode: Literal["api", "local"]


class ConsolidatedCodeData(BaseModel):
    """Main data payload for consolidated code response"""
    consolidated_code: str
    summary: ConsolidatedCodeSummary
    validation_results: ValidationResult
    metadata: GenerationMetadata


class ConsolidatedCodeResponse(BaseModel):
    """Complete response for consolidated code generation"""
    status: Literal["success", "error"]
    data: Optional[ConsolidatedCodeData] = None
    message: Optional[str] = None
    error_code: Optional[str] = None


class ProgressUpdate(BaseModel):
    """Real-time progress update"""
    step: str
    progress: float = Field(..., ge=0, le=100)
    current_step: int
    total_steps: int
    elapsed_seconds: float
    estimated_remaining: Optional[float] = None
