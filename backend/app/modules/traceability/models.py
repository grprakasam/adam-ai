"""
Pydantic models for traceability module
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Literal
from datetime import datetime


class SourceVariable(BaseModel):
    """Source SDTM variable reference"""
    domain: str = Field(..., description="SDTM domain (DM, AE, LB, etc.)")
    variable: Optional[str] = Field(None, description="SDTM variable name (None if entire domain)")
    label: Optional[str] = None


class DerivationStep(BaseModel):
    """Step-by-step derivation logic"""
    step_number: int
    operation: str = Field(..., description="Operation type (merge, filter, calculate)")
    detail: str = Field(..., description="Human-readable description")
    code_reference: Optional[str] = None


class CodeReference(BaseModel):
    """Reference to generated code snippet"""
    language: Literal['R', 'SAS']
    snippet_id: str
    code: str
    line_number: Optional[int] = None


class AIInsight(BaseModel):
    """AI-generated insights for variable"""
    anomalies: List[Dict[str, str]] = Field(default_factory=list)
    suggestions: List[Dict[str, str]] = Field(default_factory=list)
    similar_patterns: List[str] = Field(default_factory=list)
    confidence_factors: Dict[str, float] = Field(default_factory=dict)


class TraceabilityVariable(BaseModel):
    """Complete traceability record for one ADAM variable"""
    variable_name: str
    label: str
    category: str
    data_type: str
    length: Optional[int] = None
    format: Optional[str] = None
    is_key: bool = False
    is_required: bool = False

    # Lineage
    sources: List[SourceVariable]
    algorithm: str
    derivation_steps: List[DerivationStep]

    # References
    rule_refs: List[str] = Field(default_factory=list, description="ADAM IG rule references")
    code_refs: List[CodeReference] = Field(default_factory=list)

    # Quality Metrics
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence score (0-1)")
    validation_status: Literal['valid', 'warning', 'error'] = 'valid'
    validation_notes: Optional[str] = None

    # AI Insights
    ai_insights: Optional[AIInsight] = None

    # Collaboration
    comments: List[Dict] = Field(default_factory=list)
    last_updated: datetime = Field(default_factory=datetime.utcnow)
    updated_by: Optional[str] = None


class TraceabilityMatrix(BaseModel):
    """Complete traceability matrix for a dataset"""
    study_id: str
    dataset: str
    sdtm_version: str
    adam_ig_version: str
    generated_at: datetime = Field(default_factory=datetime.utcnow)
    generated_by: Optional[str] = None

    variables: List[TraceabilityVariable]

    # Summary Statistics
    total_variables: int
    traced_variables: int
    average_confidence: float
    high_confidence_count: int  # >80%
    medium_confidence_count: int  # 50-80%
    low_confidence_count: int  # <50%

    # Graph Data
    graph_data: Optional[Dict] = None  # React Flow format


class TraceabilityGenerationRequest(BaseModel):
    """Request to generate traceability matrix"""
    study_id: str
    dataset: Literal['ADSL', 'ADAE', 'ADLB']
    specification_path: str
    code_snippets: Dict[str, Dict] = Field(default_factory=dict)
    include_ai_insights: bool = True
    force_refresh: bool = False
