"""
Input Models
Pydantic models for user input validation
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from enum import Enum


class ProgrammingLanguage(str, Enum):
    """Supported programming languages"""
    R = "R"
    SAS = "SAS"


class LLMProvider(str, Enum):
    """Supported LLM providers"""
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    GOOGLE = "google"


class ADAMDatasetType(str, Enum):
    """ADAM dataset types"""
    ADSL = "ADSL"
    ADAE = "ADAE"
    ADLB = "ADLB"
    ADCM = "ADCM"
    ADVS = "ADVS"
    ADTTE = "ADTTE"


class SDTMDataset(BaseModel):
    """SDTM dataset information"""
    name: str = Field(..., description="Dataset filename")
    domain: str = Field(..., description="SDTM domain (e.g., DM, AE, LB)")
    file_path: str = Field(..., description="Full path to the dataset file")
    file_type: str = Field(..., description="File type (csv, sas7bdat, xpt)")
    file_size: int = Field(..., description="File size in bytes")
    
    class Config:
        json_schema_extra = {
            "example": {
                "name": "DM.csv",
                "domain": "DM",
                "file_path": "/path/to/DM.csv",
                "file_type": "csv",
                "file_size": 1024000
            }
        }


class SpecificationFile(BaseModel):
    """ADAM specification file information"""
    name: str = Field(..., description="Specification filename")
    file_path: str = Field(..., description="Full path to the specification file")
    file_type: str = Field(..., description="File type (xlsx, docx, pdf)")
    file_size: int = Field(..., description="File size in bytes")
    spec_type: str = Field(..., description="Type of specification (ADSL, ADAE, etc.)")
    
    class Config:
        json_schema_extra = {
            "example": {
                "name": "ADSL_Specification.xlsx",
                "file_path": "/path/to/ADSL_Specification.xlsx",
                "file_type": "xlsx",
                "file_size": 512000,
                "spec_type": "ADSL"
            }
        }


class GenerationParameters(BaseModel):
    """Parameters for code generation"""
    adam_dataset: ADAMDatasetType = Field(..., description="Target ADAM dataset type")
    programming_language: ProgrammingLanguage = Field(
        default=ProgrammingLanguage.R,
        description="Target programming language"
    )
    llm_provider: LLMProvider = Field(
        default=LLMProvider.OPENAI,
        description="LLM provider to use"
    )
    model: Optional[str] = Field(
        default=None,
        description="Specific model to use (defaults to provider's default)"
    )
    temperature: float = Field(
        default=0.2,
        ge=0.0,
        le=1.0,
        description="LLM temperature parameter"
    )
    max_tokens: int = Field(
        default=4000,
        ge=100,
        le=8000,
        description="Maximum tokens for LLM response"
    )
    include_comments: bool = Field(
        default=True,
        description="Include detailed comments in generated code"
    )
    include_validation: bool = Field(
        default=True,
        description="Include validation checks in generated code"
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "adam_dataset": "ADSL",
                "programming_language": "R",
                "llm_provider": "openai",
                "model": "gpt-4",
                "temperature": 0.2,
                "max_tokens": 4000,
                "include_comments": True,
                "include_validation": True
            }
        }


class ProjectInput(BaseModel):
    """Complete project input for ADAM code generation"""
    project_name: str = Field(..., description="Project name or identifier")
    sdtm_datasets: List[SDTMDataset] = Field(
        default_factory=list,
        description="List of SDTM datasets to use"
    )
    specifications: List[SpecificationFile] = Field(
        default_factory=list,
        description="List of specification files"
    )
    parameters: GenerationParameters = Field(..., description="Generation parameters")
    user_notes: Optional[str] = Field(
        default=None,
        description="Additional notes or requirements from user"
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "project_name": "Study XYZ ADSL Generation",
                "sdtm_datasets": [],
                "specifications": [],
                "parameters": {
                    "adam_dataset": "ADSL",
                    "programming_language": "R",
                    "llm_provider": "openai"
                },
                "user_notes": "Focus on baseline characteristics"
            }
        }


class FileUploadRequest(BaseModel):
    """Request model for file upload"""
    file_name: str
    file_type: str
    file_category: str  # "sdtm" or "specification"


class FileUploadResponse(BaseModel):
    """Response model for file upload"""
    success: bool
    message: str
    file_path: Optional[str] = None
