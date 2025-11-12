"""
Error Handlers and Custom Exceptions
Centralized error handling for the application
"""

from typing import Optional, Dict, Any
from fastapi import HTTPException, Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError
from loguru import logger
import traceback


class ADAMError(Exception):
    """Base exception for ADAM AI application"""
    def __init__(self, message: str, status_code: int = 500, details: Optional[Dict[str, Any]] = None):
        self.message = message
        self.status_code = status_code
        self.details = details or {}
        super().__init__(self.message)


class FileProcessingError(ADAMError):
    """Error during file processing"""
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message, status_code=422, details=details)


class LLMError(ADAMError):
    """Error during LLM interaction"""
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message, status_code=503, details=details)


class ValidationError(ADAMError):
    """Validation error"""
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message, status_code=400, details=details)


class DatabaseError(ADAMError):
    """Database operation error"""
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message, status_code=500, details=details)


class NotFoundError(ADAMError):
    """Resource not found error"""
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message, status_code=404, details=details)


class RateLimitError(ADAMError):
    """Rate limit exceeded error"""
    def __init__(self, message: str = "Rate limit exceeded", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, status_code=429, details=details)


async def adam_error_handler(request: Request, exc: ADAMError) -> JSONResponse:
    """
    Handler for custom ADAM errors

    Args:
        request: FastAPI request
        exc: ADAM error exception

    Returns:
        JSON response with error details
    """
    logger.error(
        f"ADAM Error: {exc.message} | Status: {exc.status_code} | "
        f"Path: {request.url.path} | Details: {exc.details}"
    )

    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": True,
            "message": exc.message,
            "details": exc.details,
            "path": str(request.url.path)
        }
    )


async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    """
    Handler for FastAPI HTTP exceptions

    Args:
        request: FastAPI request
        exc: HTTP exception

    Returns:
        JSON response with error details
    """
    logger.warning(
        f"HTTP Exception: {exc.detail} | Status: {exc.status_code} | "
        f"Path: {request.url.path}"
    )

    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": True,
            "message": str(exc.detail),
            "status_code": exc.status_code,
            "path": str(request.url.path)
        }
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """
    Handler for request validation errors

    Args:
        request: FastAPI request
        exc: Validation error exception

    Returns:
        JSON response with validation error details
    """
    errors = []
    for error in exc.errors():
        field = ".".join(str(loc) for loc in error["loc"])
        message = error["msg"]
        errors.append({
            "field": field,
            "message": message,
            "type": error["type"]
        })

    logger.warning(
        f"Validation Error: {len(errors)} errors | Path: {request.url.path} | "
        f"Errors: {errors}"
    )

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": True,
            "message": "Validation error",
            "errors": errors,
            "path": str(request.url.path)
        }
    )


async def general_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """
    Handler for unhandled exceptions

    Args:
        request: FastAPI request
        exc: Exception

    Returns:
        JSON response with error details
    """
    # Log full traceback for debugging
    tb = traceback.format_exc()
    logger.error(
        f"Unhandled Exception: {str(exc)} | Path: {request.url.path}\n"
        f"Traceback:\n{tb}"
    )

    # Return generic error to client (don't expose internal details)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": True,
            "message": "An internal error occurred. Please try again later.",
            "type": type(exc).__name__,
            "path": str(request.url.path)
        }
    )


def create_error_response(
    message: str,
    status_code: int = 500,
    details: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Create standardized error response

    Args:
        message: Error message
        status_code: HTTP status code
        details: Additional error details

    Returns:
        Error response dictionary
    """
    return {
        "error": True,
        "message": message,
        "status_code": status_code,
        "details": details or {}
    }


def create_success_response(
    data: Any,
    message: str = "Success"
) -> Dict[str, Any]:
    """
    Create standardized success response

    Args:
        data: Response data
        message: Success message

    Returns:
        Success response dictionary
    """
    return {
        "error": False,
        "message": message,
        "data": data
    }
