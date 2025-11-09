"""
Pydantic models for variable categorization
"""

from typing import Optional, List
from pydantic import BaseModel, Field


class VariableInfo(BaseModel):
    """Information about a single ADAM variable"""

    name: str = Field(..., description="Variable name (e.g., USUBJID, TRTSDT)")
    label: Optional[str] = Field(None, description="Variable label/description")
    type: Optional[str] = Field(
        None, description="Variable type (e.g., Char, Num, Date, DateTime)"
    )
    length: Optional[str] = Field(None, description="Variable length")
    format: Optional[str] = Field(None, description="Variable format (e.g., DATE9., $200.)")
    category: str = Field(..., description="Category name (e.g., Identifier Variables)")
    derivation: Optional[str] = Field(
        None, description="Brief derivation hint or source"
    )
    is_required: bool = Field(
        default=False, description="Whether this is a required variable"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "name": "USUBJID",
                "label": "Unique Subject Identifier",
                "type": "Char",
                "length": "200",
                "format": "$200.",
                "category": "Identifier Variables",
                "derivation": "Derived from SDTM DM.USUBJID",
                "is_required": True,
            }
        }


class VariableCategory(BaseModel):
    """A category containing related variables"""

    name: str = Field(..., description="Category name")
    description: Optional[str] = Field(None, description="Category description")
    variables: List[VariableInfo] = Field(
        default_factory=list, description="List of variables in this category"
    )
    count: int = Field(default=0, description="Number of variables in category")

    class Config:
        json_schema_extra = {
            "example": {
                "name": "Identifier Variables",
                "description": "Subject and study identification variables",
                "variables": [],
                "count": 5,
            }
        }


class CategorizationResult(BaseModel):
    """Result of variable categorization"""

    categories: List[VariableCategory] = Field(
        default_factory=list, description="Categorized variables"
    )
    total_variables: int = Field(default=0, description="Total number of variables")
    categorized_count: int = Field(
        default=0, description="Number of categorized variables"
    )
    uncategorized_count: int = Field(
        default=0, description="Number of uncategorized variables"
    )
    dataset_type: str = Field(default="ADSL", description="Dataset type (ADSL, ADAE, ADLB)")

    class Config:
        json_schema_extra = {
            "example": {
                "categories": [],
                "total_variables": 45,
                "categorized_count": 42,
                "uncategorized_count": 3,
                "dataset_type": "ADSL",
            }
        }
