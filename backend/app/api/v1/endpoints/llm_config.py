from fastapi import APIRouter
from typing import Dict, Any

from app.config import settings
from app.modules.llm_integration.service import llm_service

router = APIRouter()


@router.get("/defaults")
async def get_llm_defaults() -> Dict[str, Any]:
    """Return current default LLM provider and model along with available providers info."""
    provider_info = await llm_service.get_provider_info()
    return {
        "default_provider": settings.DEFAULT_LLM_PROVIDER,
        "default_model": settings.DEFAULT_MODEL,
        "available_providers": provider_info
    }
