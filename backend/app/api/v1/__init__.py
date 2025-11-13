"""
API v1 Router
Consolidates all API endpoints
"""

from fastapi import APIRouter

api_router = APIRouter()

# Import and include endpoint routers
from app.api.v1.endpoints import llm_config, specification, code_generation, rules, standards, program_generation, llm_models
api_router.include_router(llm_config.router, prefix="/llm", tags=["llm-config"])
api_router.include_router(specification.router, prefix="/specification", tags=["specification"])
api_router.include_router(code_generation.router, prefix="/code-generation", tags=["code-generation"])
api_router.include_router(rules.router, prefix="/rules", tags=["rules"])
api_router.include_router(standards.router, prefix="/standards", tags=["standards"])
api_router.include_router(program_generation.router, prefix="/program-generation", tags=["program-generation"])
api_router.include_router(llm_models.router, prefix="/llm-models", tags=["llm-models"])


@api_router.get("/status")
async def api_status():
    """API v1 status endpoint"""
    return {
        "api_version": "v1",
        "status": "active"
    }
