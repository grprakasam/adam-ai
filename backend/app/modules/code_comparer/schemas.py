"""
Code Comparer Schemas

Pydantic models for code comparison requests and responses.
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from datetime import datetime


class ComparisonOptions(BaseModel):
    """Options for code comparison"""
    ignore_whitespace: bool = Field(default=True, description="Ignore whitespace differences")
    ignore_comments: bool = Field(default=False, description="Ignore comment differences")
    case_sensitive: bool = Field(default=False, description="Case-sensitive comparison (default: False for SAS, True for R)")


class ComparisonContext(BaseModel):
    """Context information for deep analysis"""
    study_id: Optional[str] = Field(None, description="Study ID for ADaM domain mapping")
    dataset: Optional[str] = Field(None, description="Dataset name (e.g., ADSL, ADAE)")


class CodeComparisonRequest(BaseModel):
    """Request model for code comparison"""
    code_1: str = Field(..., min_length=1, max_length=50000, description="First code snippet (1-50,000 characters)")
    code_2: str = Field(..., min_length=1, max_length=50000, description="Second code snippet (1-50,000 characters)")
    language_1: Literal["sas", "r", "auto"] = Field("auto", description="Language of first code")
    language_2: Literal["sas", "r", "auto"] = Field("auto", description="Language of second code")
    comparison_mode: Literal["quick", "standard", "deep"] = Field("standard", description="Comparison mode")
    options: ComparisonOptions = Field(default_factory=ComparisonOptions, description="Comparison options")
    context: Optional[ComparisonContext] = Field(None, description="Context for deep analysis")


class Difference(BaseModel):
    """Represents a single difference between two code snippets"""
    id: str = Field(..., description="Unique identifier for the difference")
    type: Literal["functional", "logical", "syntax", "style", "comment"] = Field(..., description="Type of difference")
    severity: Literal["critical", "important", "minor", "informational"] = Field(..., description="Severity level")
    
    # Location
    code1_span: Optional[dict] = Field(None, description="Location in code 1: {start_line: int, end_line: int}")
    code2_span: Optional[dict] = Field(None, description="Location in code 2: {start_line: int, end_line: int}")
    
    # Description
    title: str = Field(..., max_length=100, description="Brief title (max 100 chars)")
    summary: str = Field(..., description="One-sentence summary")
    details: Optional[str] = Field(None, description="Detailed explanation")
    
    # ADaM context (Deep mode only)
    adam_context: Optional[dict] = Field(None, description="ADaM domain context: {affected_variables: List[str], impact_description: str}")
    
    # Recommendation
    recommendation: Optional[Literal["Review required", "Acceptable difference", "Fix QC code"]] = Field(
        None, description="Suggested action"
    )


class SyntaxIssue(BaseModel):
    """Represents a syntax issue in one of the code snippets"""
    side: Literal["code1", "code2"] = Field(..., description="Which code has the issue")
    line: int = Field(..., ge=1, description="Line number (1-indexed)")
    severity: Literal["error", "warning"] = Field(..., description="Severity of the issue")
    message: str = Field(..., description="Error message")
    code_snippet: Optional[str] = Field(None, description="Code snippet around the issue")


class ComplianceIssue(BaseModel):
    """Represents a potential CDISC compliance issue"""
    rule_id: str = Field(..., description="CDISC rule identifier (e.g., 'CDISC-ADAM-3.2.1')")
    description: str = Field(..., description="Description of the compliance issue")
    affected_code_side: Literal["code1", "code2", "both"] = Field(..., description="Which code side is affected")


class AdamInsights(BaseModel):
    """ADaM domain insights (Deep Analysis mode only)"""
    affected_variables: List[str] = Field(default_factory=list, description="List of affected ADaM variables")
    cdisc_rules_referenced: List[str] = Field(default_factory=list, description="Referenced CDISC rules")
    common_patterns_detected: List[str] = Field(default_factory=list, description="Detected common ADaM patterns")
    potential_compliance_issues: List[ComplianceIssue] = Field(default_factory=list, description="Potential compliance issues")


class CodeComparisonResult(BaseModel):
    """Response model for code comparison"""
    # High-level scores
    overall_similarity_score: float = Field(..., ge=0, le=100, description="Overall similarity score (0-100)")
    classification_label: Literal[
        "Very similar",
        "Similar with differences",
        "Moderately different",
        "Significantly different"
    ] = Field(..., description="Classification label")
    
    # Subscores
    subscores: dict = Field(..., description="Subscores: code_similarity, functional_equivalence, logical_alignment, syntax_quality")
    
    # Executive summary
    summary: dict = Field(..., description="Summary: total_differences, critical_count, important_count, minor_count, executive_narrative")
    
    # Categorized differences
    differences: List[Difference] = Field(default_factory=list, description="List of all differences")
    
    # Domain insights (Deep Analysis mode only)
    adam_insights: Optional[AdamInsights] = Field(None, description="ADaM domain insights")
    
    # Syntax issues
    syntax_issues: List[SyntaxIssue] = Field(default_factory=list, description="Syntax issues found")
    
    # Metadata
    metadata: dict = Field(..., description="Metadata: comparison_mode, language_1, language_2, execution_time_ms, llm_used")










