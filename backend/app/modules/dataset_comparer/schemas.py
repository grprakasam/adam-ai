"""
Dataset Comparer Schemas

Pydantic models for dataset comparison requests and responses.
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Literal, Dict, Any
from datetime import datetime


class ComparisonSettings(BaseModel):
    """Settings for dataset comparison"""
    variable_selection: Literal["all", "selected", "exclude-meta"] = Field(
        "all", description="Variable selection mode"
    )
    selected_variables: List[str] = Field(
        default_factory=list, description="Variables to compare (if variable_selection='selected')"
    )
    numeric_comparison: Literal["exact", "tolerance", "relative"] = Field(
        "exact", description="Numeric comparison mode"
    )
    numeric_tolerance: float = Field(
        1e-8, description="Tolerance for numeric comparison"
    )
    relative_diff_threshold: float = Field(
        0.01, description="Relative difference threshold (percentage)"
    )
    missing_value_handling: Literal["different", "equal", "ignore"] = Field(
        "different", description="How to handle missing values"
    )
    case_sensitive: bool = Field(True, description="Case-sensitive character comparison")
    trim_whitespace: bool = Field(True, description="Trim whitespace in character comparison")
    key_variable: str = Field("USUBJID", description="Key variable for observation matching")


class DatasetMetadata(BaseModel):
    """Dataset metadata"""
    filename: str
    observations: int
    variables: int
    creation_date: Optional[datetime] = None
    modification_date: Optional[datetime] = None
    label: Optional[str] = None
    format: str


class DatasetComparisonRequest(BaseModel):
    """Request for dataset comparison"""
    dataset1_path: str = Field(..., description="Path or identifier for dataset 1")
    dataset2_path: str = Field(..., description="Path or identifier for dataset 2")
    comparison_mode: Literal["quick", "standard", "comprehensive"] = Field(
        "standard", description="Comparison mode"
    )
    settings: ComparisonSettings = Field(
        default_factory=ComparisonSettings, description="Comparison settings"
    )


class StructureComparison(BaseModel):
    """Structure comparison results"""
    match: bool
    common_variables: int
    unique_to_dataset1: List[str] = Field(default_factory=list)
    unique_to_dataset2: List[str] = Field(default_factory=list)
    type_mismatches: List[Dict[str, str]] = Field(default_factory=list)


class ObservationComparison(BaseModel):
    """Observation comparison results"""
    total_dataset1: int
    total_dataset2: int
    common_count: int
    equal_count: int
    difference_count: int
    unique_to_dataset1: int
    unique_to_dataset2: int


class ValueDifference(BaseModel):
    """Difference in values for a specific variable"""
    variable: str
    type: str
    diff_count: int
    details: List[Dict[str, Any]] = Field(default_factory=list)


class ValueComparison(BaseModel):
    """Value comparison results"""
    matching_variables: int
    total_variables: int
    differences: List[ValueDifference] = Field(default_factory=list)


class NumericSummary(BaseModel):
    """Statistical summary for numeric variables"""
    variable: str
    mean1: float
    mean2: float
    max_diff: float
    std_diff: float


class StatisticalComparison(BaseModel):
    """Statistical comparison results (comprehensive mode only)"""
    numeric_summary: List[NumericSummary] = Field(default_factory=list)


class DatasetComparisonResult(BaseModel):
    """Complete dataset comparison result"""
    overall_match: float = Field(..., ge=0, le=100, description="Overall match percentage")
    metadata: Dict[str, Any] = Field(..., description="Metadata comparison")
    structure: StructureComparison
    observations: ObservationComparison
    values: ValueComparison
    statistics: Optional[StatisticalComparison] = None
    execution_time: int = Field(..., description="Execution time in milliseconds")
