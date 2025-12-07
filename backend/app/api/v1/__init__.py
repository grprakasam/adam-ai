"""
API v1 Router
Consolidates all API endpoints
"""

from fastapi import APIRouter
from app.utils.health_check import HealthCheck

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
    traceability,
    code_execution,
    validation,
    submission,
    testing,
    adam_generation,
    r_execution,
    code_review_finalization,
    code_comparer,
    adam_analytics,
    study_chatbot,
    tlf_generator,
    studies,
    study_documents,
    study_chat,
    admin,
    cache,
    spec_comparison,
    spec_gap_detector,
    code_refactorer,
    code_understanding,
    sdtm_loader,
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

# Submission readiness routes (auth required) - NEW
api_router.include_router(validation.router, tags=["submission-validation"])
api_router.include_router(submission.router, tags=["submission-documents"])

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
api_router.include_router(code_execution.router, tags=["code-execution"])
api_router.include_router(testing.router, tags=["testing"])
api_router.include_router(adam_generation.router, tags=["adam-generation"])
api_router.include_router(r_execution.router, tags=["r-execution"])
api_router.include_router(code_review_finalization.router, prefix="/code-review", tags=["code-review-finalization"])
api_router.include_router(code_comparer.router, tags=["code-comparer"])
api_router.include_router(study_chatbot.router, tags=["study-chatbot"])
api_router.include_router(adam_analytics.router, tags=["adam-analytics"])
api_router.include_router(tlf_generator.router, tags=["tlf-generator"])
api_router.include_router(studies.router, tags=["studies"])
api_router.include_router(study_documents.router, tags=["study-documents"])
api_router.include_router(study_chat.router, tags=["study-chat"])
api_router.include_router(admin.router, prefix="/admin", tags=["Admin"])
api_router.include_router(cache.router, prefix="/cache", tags=["cache-management"])
api_router.include_router(spec_comparison.router, prefix="/spec-comparison", tags=["spec-comparison"])
api_router.include_router(spec_gap_detector.router, prefix="/spec-gap-detector", tags=["spec-gap-detector"])
api_router.include_router(code_refactorer.router, tags=["code-refactorer"])
api_router.include_router(sdtm_loader.router, tags=["sdtm-loader"])
api_router.include_router(code_understanding.router, tags=["code-understanding"])


@api_router.get("/status")
async def api_status():
    """API v1 status endpoint"""
    return {
        "api_version": "v1",
        "status": "active"
    }


@api_router.get("/health")
async def api_health():
    """API v1 health check endpoint"""
    return HealthCheck.get_quick_status()
