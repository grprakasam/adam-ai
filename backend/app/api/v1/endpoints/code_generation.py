"""
API endpoints for code generation using Google Gemini
"""

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from fastapi.encoders import jsonable_encoder
from loguru import logger
from typing import List
import json
import asyncio

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
        logger.info(f"Received bulk generation request: study_id={request.study_id}, dataset={request.dataset}")
        logger.debug(f"Request data: categorized_variables keys={list(request.categorized_variables.keys()) if isinstance(request.categorized_variables, dict) else 'not a dict'}")
        
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
        
        # Check if there are any variables to process
        total_vars = request.categorized_variables.get('total_variables', 0)
        if total_vars == 0:
            logger.warning("No variables to generate code for")
            return []

        results = await service.generate_code_for_all_variables(
            study_id=study_id,
            dataset=dataset,
            categorized_variables=request.categorized_variables,
            language=language,
            standards=request.standards,
            llm_provider=request.llm_provider
        )
        
        logger.info(f"Successfully generated {len(results)} code snippets")
        return results
        
    except CustomValidationError as e:
        logger.error(f"Validation error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=400, detail=str(e))
    except LLMError as e:
        logger.error(f"LLM error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=503, detail=f"LLM service error: {str(e)}")
    except HTTPException:
        raise  # Re-raise HTTPExceptions as-is
    except Exception as e:
        error_msg = str(e) if str(e) else f"{type(e).__name__}: {repr(e)}"
        logger.error(f"Bulk code generation failed: {error_msg}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Code generation failed: {error_msg}"
        )


@router.post("/generate-code-bulk-stream")
async def generate_code_bulk_stream(
    request: BulkCodeGenerationRequest,
    service: CodeGeneratorService = Depends(get_service)
):
    """
    Generate code snippets for ALL variables in bulk with real-time progress streaming
    
    This endpoint uses Server-Sent Events (SSE) to stream progress updates in real-time.
    
    Args:
        request: Bulk generation request with all variables
        service: Code generator service (injected)
        
    Returns:
        StreamingResponse with SSE events for progress updates
        
    Event format:
        - event: progress
        - data: {"status": "started|variable_completed|completed", "total": N, "completed": M, "message": "..."}
        
        - event: result
        - data: [array of CodeSnippetResponse objects]
        
        - event: error
        - data: {"error": "error message"}
    """
    # Store progress updates in a queue
    progress_queue = asyncio.Queue()
    
    async def event_generator():
        try:
            logger.info(f"Received streaming bulk generation request: study_id={request.study_id}, dataset={request.dataset}")
            
            # Validate inputs
            study_id = validate_study_id(request.study_id)
            dataset = validate_dataset_type(request.dataset)
            language = validate_programming_language(request.language)
            validate_categorized_variables(request.categorized_variables)
            validate_standards(request.standards)

            logger.info(
                f"Bulk code generation request (streaming): study={study_id}, "
                f"dataset={dataset}, language={language}"
            )
            
            # Check if there are any variables to process
            total_vars = request.categorized_variables.get('total_variables', 0)
            if total_vars == 0:
                logger.warning("No variables to generate code for")
                yield f"event: progress\ndata: {json.dumps({'status': 'completed', 'total': 0, 'completed': 0, 'message': 'No variables to process'})}\n\n"
                yield f"event: result\ndata: {json.dumps([])}\n\n"
                return

            # Collect all variables
            all_variables = service.collect_all_variables(request.categorized_variables)
            
            # Build generation context
            context = service.build_generation_context(
                study_id=study_id,
                dataset=dataset,
                standards=request.standards,
                categorized_variables=request.categorized_variables
            )
            
            # Progress callback to send SSE updates
            async def progress_callback(progress_data):
                await progress_queue.put(progress_data)
            
            # Start the generation task
            generation_task = asyncio.create_task(
                service.process_variables_with_llm(
                    variables=all_variables,
                    language=language,
                    context=context,
                    llm_provider=request.llm_provider,
                    model=request.model,
                    progress_callback=progress_callback
                )
            )
            
            # OPTIMIZATION: Stream results progressively as they complete
            # Collect all results in a separate queue for streaming individual results
            results_queue = asyncio.Queue()
            results_collected = []

            # Enhanced progress callback to also queue results
            original_progress_callback = progress_callback

            async def enhanced_progress_callback(progress_data):
                await original_progress_callback(progress_data)
                # Queue individual variable results for streaming
                if progress_data.get('status') == 'variable_completed':
                    # Mark that this variable is complete for frontend to consume it
                    await results_queue.put({'type': 'progress', 'data': progress_data})

            # Update progress callback
            progress_callback = enhanced_progress_callback

            # Stream progress and results updates
            # OPTIMIZATION: Use non-blocking queue check with tuned timeout for throughput
            while not generation_task.done():
                try:
                    # Check for progress updates with optimized timeout
                    # Slightly longer timeout reduces CPU overhead while maintaining responsiveness
                    progress_data = await asyncio.wait_for(progress_queue.get(), timeout=0.1)
                    # Encode to ensure datetimes and other complex types serialize
                    event_data = json.dumps(jsonable_encoder(progress_data))
                    yield f"event: progress\ndata: {event_data}\n\n"
                except asyncio.TimeoutError:
                    # Non-blocking: continue loop to check if task is done
                    # This allows batches to complete faster without waiting
                    await asyncio.sleep(0.01)  # Small sleep to prevent tight loop

            # Drain any remaining progress updates
            while not progress_queue.empty():
                try:
                    progress_data = progress_queue.get_nowait()
                    event_data = json.dumps(jsonable_encoder(progress_data))
                    yield f"event: progress\ndata: {event_data}\n\n"
                except asyncio.QueueEmpty:
                    break

            # Get final results
            results = await generation_task
            results_collected = results

            # Send final results with completion marker
            logger.info(f"Successfully generated {len(results)} code snippets (streaming)")
            yield f"event: complete\ndata: {json.dumps(jsonable_encoder({'status': 'success', 'data': results}))}\n\n"
            
        except CustomValidationError as e:
            logger.error(f"Validation error: {str(e)}", exc_info=True)
            yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"
        except LLMError as e:
            logger.error(f"LLM error: {str(e)}", exc_info=True)
            yield f"event: error\ndata: {json.dumps({'error': f'LLM service error: {str(e)}'})}\n\n"
        except Exception as e:
            error_msg = str(e) if str(e) else f"{type(e).__name__}: {repr(e)}"
            logger.error(f"Bulk code generation failed: {error_msg}", exc_info=True)
            yield f"event: error\ndata: {json.dumps({'error': f'Code generation failed: {error_msg}'})}\n\n"
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"  # Disable nginx buffering
        }
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
        
        study_id = validate_study_id(request.study_id)
        dataset = validate_dataset_type(request.dataset)
        language = validate_programming_language(request.language)
        validate_standards(request.standards)
        
        # Build context
        request_context = request.context or {}
        context = {
            'study_id': study_id,
            'adam_dataset': dataset,
            'sdtm_domains': request_context.get('available_sdtm_domains', []),
            'sdtm_version': request.standards.get('sdtm_version', '1.7'),
            'adam_ig_version': request.standards.get('adam_ig_version', '1.3'),
            'meddra_version': request.standards.get('meddra_version', '26.0'),
            'required_variables': request_context.get('required_variables', []),
            'category': request_context.get('category', 'General'),
            'language': language
        }
        
        result = await service.generate_code_snippet(
            study_id=study_id,
            dataset=dataset,
            variable=request.variable,
            derivation=request.derivation,
            spec_row=request.spec_row,
            standards=request.standards,
            language=language,
            context=context,
            llm_provider=request.llm_provider,
            user_note=request.user_note
        )
        
        logger.info(f"Successfully generated code for {request.variable}")
        return result
        
    except CustomValidationError as e:
        logger.error(f"Validation error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
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
