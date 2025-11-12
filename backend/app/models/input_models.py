"""
Input Models
Pydantic models for user input validation
"""

from pydantic import BaseModel, Field, ConfigDict
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
    model_config = ConfigDict(json_schema_extra={
        "example": {
            "name": "DM.csv",
            "domain": "DM",
            "file_path": "/path/to/DM.csv",
            "file_type": "csv",
            "file_size": 1024000
        }
    })
    
    name: str = Field(..., description="Dataset filename")
    domain: str = Field(..., description="SDTM domain (e.g., DM, AE, LB)")
    file_path: str = Field(..., description="Full path to the dataset file")
    file_type: str = Field(..., description="File type (csv, sas7bdat, xpt)")
    file_size: int = Field(..., description="File size in bytes")


class SpecificationFile(BaseModel):
    """ADAM specification file information"""
    model_config = ConfigDict(json_schema_extra={
        "example": {
            "name": "ADSL_Specification.xlsx",
            "file_path": "/path/to/ADSL_Specification.xlsx",
            "file_type": "xlsx",
            "file_size": 512000,
            "spec_type": "ADSL"
        }
    })
    
    name: str = Field(..., description="Specification filename")
    file_path: str = Field(..., description="Full path to the specification file")
    file_type: str = Field(..., description="File type (xlsx, docx, pdf)")
    file_size: int = Field(..., description="File size in bytes")
    spec_type: str = Field(..., description="Type of specification (ADSL, ADAE, etc.)")


class GenerationParameters(BaseModel):
    """Parameters for code generation"""
    model_config = ConfigDict(json_schema_extra={
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
    })
    
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


class ProjectInput(BaseModel):
    """Complete project input for ADAM code generation"""
    model_config = ConfigDict(json_schema_extra={
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
    })
    
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


class CodeSnippetRequest(BaseModel):
    """Request model for generating code snippet for a single variable"""
    model_config = ConfigDict(json_schema_extra={
        "example": {
            "study_id": "STUDY123",
            "dataset": "ADSL",
            "variable": "AGE",
            "derivation": "Age in years at time of informed consent",
            "spec_row": {
                "Variable": "AGE",
                "Label": "Age",
                "Type": "Num",
                "Length": "8",
                "Format": "",
                "Source/Derivation": "DM.AGE"
            },
            "standards": {
                "sdtm_version": "3.4",
                "adam_ig_version": "1.3",
                "meddra_version": "26.0"
            },
            "language": "R",
            "context": {
                "available_sdtm_domains": ["DM", "EX", "AE"],
                "required_variables": ["AGE"],
                "category": "Demographics"
            }
        }
    })

    study_id: str = Field(..., description="Study identifier")
    dataset: str = Field(..., description="ADAM dataset name (e.g., ADSL)")
    variable: str = Field(..., description="Variable name to generate code for")
    derivation: str = Field(..., description="Derivation logic for the variable")
    spec_row: dict = Field(..., description="Full specification row for the variable")
    standards: dict = Field(..., description="Standards versions (SDTM, ADaM IG, MedDRA)")
    language: str = Field(default="R", description="Programming language (R or SAS)")
    context: Optional[dict] = Field(default=None, description="Additional context (available domains, required variables, category)")
    llm_provider: Optional[str] = Field(default=None, description="LLM provider to use (groq, openai, anthropic, google)")


class CodeSnippetResponse(BaseModel):
    """Response model for generated code snippet"""
    model_config = ConfigDict(json_schema_extra={
        "example": {
            "variable": "AGE",
            "code_snippet": "# Derive AGE from DM domain\nADSL$AGE <- DM$AGE",
            "coding_rationale": "Age is directly mapped from the Demographics (DM) domain.",
            "metadata": {
                "llm_provider": "google",
                "model": "gemini-2.5-flash",
                "tokens_used": 450,
                "generation_time": 1.2
            }
        }
    })

    variable: str = Field(..., description="Variable name")
    code_snippet: str = Field(..., description="Generated code snippet")
    coding_rationale: str = Field(..., description="Explanation of the coding logic")
    metadata: Optional[dict] = Field(default=None, description="Metadata about the generation (model, tokens, etc.)")


class BulkCodeGenerationRequest(BaseModel):
    """Request model for bulk code generation for all variables"""
    model_config = ConfigDict(json_schema_extra={
        "example": {
            "study_id": "STUDY123",
            "dataset": "ADSL",
            "categorized_variables": {
                "categories": [],
                "total_variables": 45,
                "categorized_count": 42,
                "uncategorized_count": 3,
                "dataset_type": "ADSL"
            },
            "language": "R",
            "standards": {
                "sdtm_version": "3.4",
                "adam_ig_version": "1.3",
                "meddra_version": "26.0"
            },
            "llm_provider": "groq"
        }
    })

    study_id: str = Field(..., description="Study identifier")
    dataset: str = Field(..., description="ADAM dataset name (e.g., ADSL)")
    categorized_variables: dict = Field(..., description="Categorization result with all variables")
    language: str = Field(default="R", description="Programming language (R or SAS)")
    standards: dict = Field(..., description="Standards versions (SDTM, ADaM IG, MedDRA)")
    llm_provider: Optional[str] = Field(default=None, description="LLM provider to use (groq, openai, anthropic, google)")
