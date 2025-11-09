"""
API v1 Router
Consolidates all API endpoints
"""

from fastapi import APIRouter

api_router = APIRouter()

# Import and include endpoint routers
from app.api.v1.endpoints import llm_config, specification
api_router.include_router(llm_config.router, prefix="/llm", tags=["llm-config"])
api_router.include_router(specification.router, prefix="/specification", tags=["specification"])


@api_router.get("/status")
async def api_status():
    """API v1 status endpoint"""
    return {
        "api_version": "v1",
        "status": "active"
    }
