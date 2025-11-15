"""
API v1 Router
Consolidates all API endpoints
"""

from fastapi import APIRouter

api_router = APIRouter()

# Import and include endpoint routers
from app.api.v1.endpoints import (
    llm_config,
    specification,
    code_generation,
    rules,
    standards,
    program_generation,
    llm_models,
    test_data,
    traceability
)
from app.api import auth_routes, validation_routes, performance_routes, review_routes

# Authentication routes (no auth required for these endpoints)
api_router.include_router(auth_routes.router, tags=["authentication"])

# Validation routes (auth required)
api_router.include_router(validation_routes.router, tags=["validation"])

# Performance routes (auth required)
api_router.include_router(performance_routes.router, tags=["performance"])

# Review routes (auth required)
api_router.include_router(review_routes.router, tags=["reviews"])

# Application routes (auth required)
api_router.include_router(llm_config.router, prefix="/llm", tags=["llm-config"])
api_router.include_router(specification.router, prefix="/specification", tags=["specification"])
api_router.include_router(code_generation.router, prefix="/code-generation", tags=["code-generation"])
api_router.include_router(rules.router, prefix="/rules", tags=["rules"])
api_router.include_router(standards.router, prefix="/standards", tags=["standards"])
api_router.include_router(program_generation.router, prefix="/program-generation", tags=["program-generation"])
api_router.include_router(llm_models.router, prefix="/llm-models", tags=["llm-models"])
api_router.include_router(test_data.router, prefix="/test-data", tags=["test-data"])
api_router.include_router(traceability.router, prefix="/traceability", tags=["traceability"])


@api_router.get("/status")
async def api_status():
    """API v1 status endpoint"""
    return {
        "api_version": "v1",
        "status": "active"
    }
