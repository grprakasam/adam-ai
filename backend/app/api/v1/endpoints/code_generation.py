"""
API endpoints for code generation using Google Gemini
"""

from fastapi import APIRouter, HTTPException, Depends
from loguru import logger
from typing import List

from app.models.input_models import (
    CodeSnippetRequest,
    CodeSnippetResponse,
    BulkCodeGenerationRequest
)
from app.modules.code_generator.service import get_code_generator_service, CodeGeneratorService
from app.utils.validators import (
    validate_study_id,
    validate_dataset_type,
    validate_programming_language,
    validate_categorized_variables,
    validate_standards
)
from app.utils.error_handlers import LLMError, ValidationError as CustomValidationError


router = APIRouter()


def get_service() -> CodeGeneratorService:
    """Dependency to get code generator service"""
    return get_code_generator_service()


@router.post("/generate-code-bulk", response_model=List[CodeSnippetResponse])
async def generate_code_bulk(
    request: BulkCodeGenerationRequest,
    service: CodeGeneratorService = Depends(get_service)
):
    """
    Generate code snippets for ALL variables in bulk
    
    This endpoint is called when user clicks "Get AI Inputs" → "Proceed"
    
    Args:
        request: Bulk generation request with all variables
        service: Code generator service (injected)
        
    Returns:
        List of CodeSnippetResponse objects
        
    Raises:
        HTTPException: If generation fails
    """
    try:
        # Validate inputs
        study_id = validate_study_id(request.study_id)
        dataset = validate_dataset_type(request.dataset)
        language = validate_programming_language(request.language)
        validate_categorized_variables(request.categorized_variables)
        validate_standards(request.standards)

        logger.info(
            f"Bulk code generation request: study={study_id}, "
            f"dataset={dataset}, language={language}"
        )

        results = await service.generate_code_for_all_variables(
            study_id=study_id,
            dataset=dataset,
            categorized_variables=request.categorized_variables,
            language=language,
            standards=request.standards
        )
        
        logger.info(f"Successfully generated {len(results)} code snippets")
        return results
        
    except Exception as e:
        logger.error(f"Bulk code generation failed: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Code generation failed: {str(e)}"
        )


@router.post("/generate-code-snippet", response_model=CodeSnippetResponse)
async def generate_code_snippet(
    request: CodeSnippetRequest,
    service: CodeGeneratorService = Depends(get_service)
):
    """
    Generate code snippet for a single variable (fallback/retry)
    
    This endpoint is used for:
    - Retrying failed generations
    - Regenerating specific variables
    - Testing individual variables
    
    Args:
        request: Code snippet request
        service: Code generator service (injected)
        
    Returns:
        CodeSnippetResponse object
        
    Raises:
        HTTPException: If generation fails
    """
    try:
        logger.info(f"Single variable code generation: {request.variable}")
        
        # Build variable dict from request
        variable = {
            'name': request.variable,
            'label': request.spec_row.get('Label', ''),
            'type': request.spec_row.get('Type', ''),
            'derivation': request.derivation,
            'is_required': request.spec_row.get('Core', '') == 'Req'
        }
        
        # Build context
        context = {
            'study_id': request.study_id,
            'adam_dataset': request.dataset,
            'sdtm_domains': request.context.get('available_sdtm_domains', []),
            'sdtm_version': request.standards.get('sdtm_version', '1.7'),
            'adam_ig_version': request.standards.get('adam_ig_version', '1.3'),
            'meddra_version': request.standards.get('meddra_version', '26.0'),
            'required_variables': request.context.get('required_variables', []),
            'category': request.context.get('category', 'General')
        }
        
        result = await service.generate_single_variable(
            variable=variable,
            language=request.language,
            context=context
        )
        
        logger.info(f"Successfully generated code for {request.variable}")
        return CodeSnippetResponse(**result)
        
    except Exception as e:
        logger.error(f"Single variable code generation failed: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Code generation failed: {str(e)}"
        )


@router.post("/clear-cache")
async def clear_cache(service: CodeGeneratorService = Depends(get_service)):
    """
    Clear the code generation cache
    
    Returns:
        Success message
    """
    try:
        service.clear_cache()
        return {"message": "Cache cleared successfully"}
    except Exception as e:
        logger.error(f"Failed to clear cache: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats")
async def get_stats(service: CodeGeneratorService = Depends(get_service)):
    """
    Get code generation service statistics
    
    Returns:
        Service statistics including cache hit rate, API usage, etc.
    """
    try:
        stats = service.get_stats()
        return stats
    except Exception as e:
        logger.error(f"Failed to get stats: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# Legacy endpoint for backward compatibility
@router.post("/generate-code-snippet-legacy")
async def generate_code_snippet_legacy(request: CodeSnippetRequest):
    """Legacy endpoint - redirects to new implementation"""
    return await generate_code_snippet(request)
