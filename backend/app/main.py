"""
FastAPI Main Application
Entry point for the ADAM AI Code Generator backend
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from loguru import logger
import sys
import asyncio
import platform

# Windows-specific fix for asyncio subprocess support
# This prevents NotImplementedError when using asyncio.create_subprocess_exec on Windows
if platform.system() == 'Windows':
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

from app.config import settings
from app.api.v1 import api_router
from app.utils.error_handlers import (
    adam_error_handler,
    http_exception_handler,
    validation_exception_handler,
    general_exception_handler,
    ADAMError
)
from app.utils.health_check import HealthCheck
from app.middleware import RateLimitMiddleware, cleanup_rate_limiter
from app.core.database import init_db, close_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    # Startup
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    logger.info(f"Debug mode: {settings.DEBUG}")
    logger.info(f"Default LLM Provider: {settings.DEFAULT_LLM_PROVIDER}")

    # Initialize database
    try:
        await init_db()
        logger.info("✅ Database initialized successfully")
    except Exception as e:
        logger.error(f"❌ Database initialization failed: {e}")
        logger.warning("⚠️  Application will continue but database features will be unavailable")

    # Start background task for rate limiter cleanup
    cleanup_task = asyncio.create_task(cleanup_rate_limiter())
    logger.info("Rate limiter cleanup task started")

    yield

    # Shutdown
    cleanup_task.cancel()
    try:
        await cleanup_task
    except asyncio.CancelledError:
        pass

    # Close database connections
    await close_db()
    logger.info("Database connections closed")

    logger.info(f"Shutting down {settings.APP_NAME}")


# Configure logging
logger.remove()
logger.add(
    sys.stderr,
    level=settings.LOG_LEVEL,
    format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan> - <level>{message}</level>"
)
logger.add(
    settings.LOG_FILE,
    rotation="10 MB",
    retention="10 days",
    level=settings.LOG_LEVEL
)


# Create FastAPI application
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="AI-powered ADAM code generator for clinical trials following CDISC standards",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan
)


# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add rate limiting middleware
app.add_middleware(RateLimitMiddleware)


# Register error handlers
app.add_exception_handler(ADAMError, adam_error_handler)
app.add_exception_handler(HTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(Exception, general_exception_handler)


# Include API routers
app.include_router(api_router, prefix="/api/v1")


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "ADAM AI Code Generator API",
        "version": settings.APP_VERSION,
        "status": "running"
    }


@app.get("/health")
async def health_check_quick():
    """Quick health check endpoint (non-blocking)"""
    return HealthCheck.get_quick_status()


@app.get("/health/detailed")
async def health_check_detailed():
    """Detailed health check endpoint with component status"""
    return await HealthCheck.check_all()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG
    )
