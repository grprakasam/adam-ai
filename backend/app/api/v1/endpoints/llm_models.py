"""
API endpoints for LLM model management
"""

from fastapi import APIRouter, HTTPException, Depends
from loguru import logger
from typing import List, Dict, Any, Optional
from pydantic import BaseModel

from app.modules.llm_integration.service import get_llm_service, LLMIntegrationService
from app.utils.error_handlers import LLMError, ValidationError as CustomValidationError
from app.config import settings


router = APIRouter()


class TestConnectionRequest(BaseModel):
    """Request model for testing LLM connection"""
    provider: str
    model: Optional[str] = None


def get_service() -> LLMIntegrationService:
    """Dependency to get LLM service"""
    return get_llm_service()


@router.get("/debug/config")
async def debug_config():
    """Debug endpoint to check configuration"""
    return {
        "openrouter_api_key_configured": bool(settings.OPENROUTER_API_KEY),
        "openrouter_api_key_length": len(settings.OPENROUTER_API_KEY) if settings.OPENROUTER_API_KEY else 0,
        "openrouter_model": settings.OPENROUTER_MODEL,
        "groq_api_key_configured": bool(settings.GROQ_API_KEY),
        "google_api_key_configured": bool(settings.GOOGLE_API_KEY),
        "default_provider": settings.DEFAULT_LLM_PROVIDER
    }


@router.get("/openrouter/models")
async def get_openrouter_models(service: LLMIntegrationService = Depends(get_service)):
    """
    Get list of available models from OpenRouter
    
    Returns:
        List of model dictionaries containing:
        - id: Model identifier
        - name: Human-readable name
        - pricing: Cost information
        - context_length: Maximum context window
        - description: Model description
        - architecture: Model architecture info
    """
    try:
        # Check available providers for debugging
        available_providers = await service.get_available_providers()
        logger.info(f"Available providers: {available_providers}")
        
        if 'openrouter' not in available_providers:
            logger.error("OpenRouter provider not initialized! Available providers: " + str(available_providers))
            raise HTTPException(
                status_code=503, 
                detail="OpenRouter provider not initialized. Please ensure OPENROUTER_API_KEY is configured in backend/.env file and restart the server."
            )
        
        models = await service.get_openrouter_models()
        
        # Filter and format models for frontend
        formatted_models = []
        for model in models:
            formatted_models.append({
                "id": model.get("id"),
                "name": model.get("name", model.get("id")),
                "context_length": model.get("context_length", 0),
                "pricing": model.get("pricing", {}),
                "description": model.get("description", ""),
                "architecture": model.get("architecture", {}),
                "top_provider": model.get("top_provider", {})
            })
        
        logger.info(f"Successfully retrieved {len(formatted_models)} OpenRouter models")
        return formatted_models
        
    except HTTPException:
        raise  # Re-raise HTTP exceptions
    except CustomValidationError as e:
        logger.error(f"Validation error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=400, detail=str(e))
    except LLMError as e:
        logger.error(f"LLM error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=503, detail=f"LLM service error: {str(e)}")
    except Exception as e:
        error_msg = str(e) if str(e) else f"{type(e).__name__}: {repr(e)}"
        logger.error(f"Failed to fetch OpenRouter models: {error_msg}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch models: {error_msg}"
        )


@router.get("/providers")
async def get_available_providers(service: LLMIntegrationService = Depends(get_service)):
    """
    Get list of available LLM providers
    
    Returns:
        Dictionary with provider information
    """
    try:
        providers = await service.get_available_providers()
        provider_info = await service.get_provider_info()
        
        return {
            "providers": providers,
            "details": provider_info
        }
        
    except Exception as e:
        error_msg = str(e) if str(e) else f"{type(e).__name__}: {repr(e)}"
        logger.error(f"Failed to fetch providers: {error_msg}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch providers: {error_msg}"
        )


@router.post("/test-connection")
async def test_llm_connection(
    request: TestConnectionRequest,
    service: LLMIntegrationService = Depends(get_service)
):
    """
    Test connection to LLM provider with a simple prompt
    
    Args:
        request: Contains provider name and optional model
        
    Returns:
        Dictionary with connection status and response details
    """
    try:
        # Check if provider is available
        available_providers = await service.get_available_providers()
        
        if request.provider not in available_providers:
            logger.error(f"Provider '{request.provider}' not available. Available: {available_providers}")
            return {
                "success": False,
                "provider": request.provider,
                "message": f"Provider '{request.provider}' is not configured. Please check your API key configuration.",
                "available_providers": available_providers
            }
        
        # Test with a simple prompt
        test_prompt = "Say 'Hello' in one word."
        
        logger.info(f"Testing connection to provider: {request.provider}, model: {request.model}")
        
        response = await service.generate(
            prompt=test_prompt,
            provider=request.provider,
            model=request.model,
            temperature=0.1,
            max_tokens=10
        )
        
        logger.info(f"Connection test successful for {request.provider}")
        
        # response is a TypedDict, access with dictionary keys
        return {
            "success": True,
            "provider": request.provider,
            "model": request.model or "default",
            "message": f"Successfully connected to {request.provider}",
            "response_preview": response.get("content", "")[:50] if response.get("content") else "No response",
            "tokens_used": response.get("usage", {}).get("total_tokens", 0) if response.get("usage") else 0
        }
        
    except LLMError as e:
        logger.error(f"LLM error during connection test: {str(e)}", exc_info=True)
        return {
            "success": False,
            "provider": request.provider,
            "message": f"Connection failed: {str(e)}",
            "error_type": "LLMError"
        }
    except Exception as e:
        error_msg = str(e) if str(e) else f"{type(e).__name__}: {repr(e)}"
        logger.error(f"Connection test failed: {error_msg}", exc_info=True)
        return {
            "success": False,
            "provider": request.provider,
            "message": f"Connection failed: {error_msg}",
            "error_type": type(e).__name__
        }
