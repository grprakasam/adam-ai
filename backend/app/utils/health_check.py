"""
Health Check Utilities
Comprehensive health monitoring for the application
"""

from typing import Dict, Any, List
from datetime import datetime
from pathlib import Path
from loguru import logger
import asyncio

from app.config import settings
from app.modules.llm_integration.service import llm_service
from app.core.database import db_manager


class HealthCheck:
    """Health check manager for application components"""

    @staticmethod
    async def check_database() -> Dict[str, Any]:
        """
        Check database connectivity

        Returns:
            Dictionary with database status
        """
        try:
            is_healthy = await db_manager.health_check()

            if is_healthy:
                return {
                    "status": "healthy",
                    "connected": True,
                    "message": "Database is accessible"
                }
            else:
                return {
                    "status": "unhealthy",
                    "connected": False,
                    "message": "Database connection failed"
                }
        except Exception as e:
            logger.error(f"Database health check failed: {str(e)}")
            return {
                "status": "unhealthy",
                "connected": False,
                "error": str(e)
            }

    @staticmethod
    async def check_llm_providers() -> Dict[str, Any]:
        """
        Check LLM provider availability

        Returns:
            Dictionary with LLM provider status
        """
        try:
            providers = await llm_service.get_available_providers()
            provider_status = {}

            for provider in providers:
                try:
                    # Quick validation check (non-blocking)
                    is_available = provider in llm_service.providers
                    provider_status[provider] = {
                        "available": is_available,
                        "status": "healthy" if is_available else "unavailable"
                    }
                except Exception as e:
                    provider_status[provider] = {
                        "available": False,
                        "status": "error",
                        "error": str(e)
                    }

            return {
                "status": "healthy" if len(providers) > 0 else "degraded",
                "providers": provider_status,
                "count": len(providers)
            }
        except Exception as e:
            logger.error(f"LLM provider health check failed: {str(e)}")
            return {
                "status": "unhealthy",
                "error": str(e),
                "providers": {},
                "count": 0
            }

    @staticmethod
    def check_file_system() -> Dict[str, Any]:
        """
        Check file system access and required directories

        Returns:
            Dictionary with file system status
        """
        try:
            required_dirs = [
                settings.CONTENT_DIR,
                settings.CONTEXT_DIR,
                settings.RULES_DIR
            ]

            dir_status = {}
            all_accessible = True

            for dir_path in required_dirs:
                path = Path(dir_path)
                exists = path.exists()
                is_dir = path.is_dir() if exists else False
                readable = path.exists() and path.is_dir()

                dir_status[dir_path] = {
                    "exists": exists,
                    "is_directory": is_dir,
                    "readable": readable,
                    "status": "healthy" if readable else "unhealthy"
                }

                if not readable:
                    all_accessible = False

            return {
                "status": "healthy" if all_accessible else "degraded",
                "directories": dir_status
            }
        except Exception as e:
            logger.error(f"File system health check failed: {str(e)}")
            return {
                "status": "unhealthy",
                "error": str(e),
                "directories": {}
            }

    @staticmethod
    def check_configuration() -> Dict[str, Any]:
        """
        Check application configuration

        Returns:
            Dictionary with configuration status
        """
        try:
            config_items = {
                "app_name": bool(settings.APP_NAME),
                "default_llm_provider": bool(settings.DEFAULT_LLM_PROVIDER),
                "default_model": bool(settings.DEFAULT_MODEL),
                "rules_dir": bool(settings.RULES_DIR),
            }

            # Check if at least one LLM API key is configured
            has_llm_key = any([
                settings.OPENAI_API_KEY,
                settings.ANTHROPIC_API_KEY,
                settings.GOOGLE_API_KEY,
                settings.GEMINI_API_KEY
            ])

            config_items["llm_api_key_configured"] = has_llm_key

            all_configured = all(config_items.values())

            return {
                "status": "healthy" if all_configured else "degraded",
                "configuration": config_items,
                "warnings": [] if has_llm_key else ["No LLM API keys configured"]
            }
        except Exception as e:
            logger.error(f"Configuration health check failed: {str(e)}")
            return {
                "status": "unhealthy",
                "error": str(e),
                "configuration": {}
            }

    @staticmethod
    async def check_all() -> Dict[str, Any]:
        """
        Perform comprehensive health check

        Returns:
            Dictionary with all health check results
        """
        start_time = datetime.utcnow()

        # Run checks concurrently
        db_check, llm_check, fs_check, config_check = await asyncio.gather(
            HealthCheck.check_database(),
            HealthCheck.check_llm_providers(),
            asyncio.to_thread(HealthCheck.check_file_system),
            asyncio.to_thread(HealthCheck.check_configuration),
            return_exceptions=True
        )

        # Handle exceptions in checks
        if isinstance(db_check, Exception):
            db_check = {"status": "unhealthy", "error": str(db_check)}
        if isinstance(llm_check, Exception):
            llm_check = {"status": "unhealthy", "error": str(llm_check)}
        if isinstance(fs_check, Exception):
            fs_check = {"status": "unhealthy", "error": str(fs_check)}
        if isinstance(config_check, Exception):
            config_check = {"status": "unhealthy", "error": str(config_check)}

        end_time = datetime.utcnow()
        duration_ms = (end_time - start_time).total_seconds() * 1000

        # Determine overall status
        statuses = [
            db_check.get("status"),
            llm_check.get("status"),
            fs_check.get("status"),
            config_check.get("status")
        ]

        if "unhealthy" in statuses:
            overall_status = "unhealthy"
        elif "degraded" in statuses:
            overall_status = "degraded"
        else:
            overall_status = "healthy"

        return {
            "status": overall_status,
            "timestamp": datetime.utcnow().isoformat(),
            "duration_ms": round(duration_ms, 2),
            "version": settings.APP_VERSION,
            "checks": {
                "database": db_check,
                "llm_providers": llm_check,
                "file_system": fs_check,
                "configuration": config_check
            }
        }

    @staticmethod
    def get_quick_status() -> Dict[str, Any]:
        """
        Get quick health status (non-blocking)

        Returns:
            Dictionary with quick status
        """
        return {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "version": settings.APP_VERSION,
            "message": "Service is running"
        }
