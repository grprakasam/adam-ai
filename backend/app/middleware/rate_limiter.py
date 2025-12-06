"""
Rate Limiting Middleware
Implements rate limiting to prevent API abuse and ensure fair usage
"""

from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Dict, Tuple
import asyncio


class RateLimitConfig:
    """Configuration for rate limiting"""

    # Requests per minute per IP
    REQUESTS_PER_MINUTE = 60

    # Requests per hour per IP
    REQUESTS_PER_HOUR = 500

    # Code generation requests per minute (more restrictive)
    CODE_GEN_PER_MINUTE = 10

    # File upload requests per minute
    FILE_UPLOAD_PER_MINUTE = 10  # Increased from 5

    # Categorization requests per minute (less restrictive - core workflow action)
    CATEGORIZE_PER_MINUTE = 30

    # SDTM test data generation requests per minute (VERY restrictive due to memory usage)
    SDTM_GEN_PER_MINUTE = 5

    # SDTM batch generation requests per 5 minutes (extremely restrictive)
    SDTM_BATCH_PER_5MIN = 2


class RateLimiter:
    """
    Token bucket rate limiter
    Tracks requests by IP address and endpoint
    """

    def __init__(self):
        # Format: {ip: {endpoint: [(timestamp, count), ...]}}
        self.requests: Dict[str, Dict[str, list]] = defaultdict(lambda: defaultdict(list))
        self.lock = asyncio.Lock()

    async def is_allowed(
        self, ip: str, endpoint: str, limit: int, window_seconds: int
    ) -> Tuple[bool, int]:
        """
        Check if request is allowed under rate limit

        Args:
            ip: Client IP address
            endpoint: API endpoint path
            limit: Maximum requests allowed
            window_seconds: Time window in seconds

        Returns:
            Tuple of (is_allowed, remaining_requests)
        """
        async with self.lock:
            now = datetime.now()
            window_start = now - timedelta(seconds=window_seconds)

            # Clean up old requests outside the window
            if ip in self.requests and endpoint in self.requests[ip]:
                self.requests[ip][endpoint] = [
                    timestamp
                    for timestamp in self.requests[ip][endpoint]
                    if timestamp > window_start
                ]

            # Count requests in current window
            current_requests = len(self.requests[ip][endpoint])

            if current_requests < limit:
                # Allow request
                self.requests[ip][endpoint].append(now)
                remaining = limit - current_requests - 1
                return True, remaining
            else:
                # Deny request
                return False, 0

    async def cleanup_old_entries(self):
        """
        Periodically clean up old entries to prevent memory bloat
        Should be called from a background task
        """
        async with self.lock:
            now = datetime.now()
            cutoff = now - timedelta(hours=1)

            # Remove old entries
            for ip in list(self.requests.keys()):
                for endpoint in list(self.requests[ip].keys()):
                    self.requests[ip][endpoint] = [
                        timestamp
                        for timestamp in self.requests[ip][endpoint]
                        if timestamp > cutoff
                    ]

                    # Remove empty endpoint entries
                    if not self.requests[ip][endpoint]:
                        del self.requests[ip][endpoint]

                # Remove empty IP entries
                if not self.requests[ip]:
                    del self.requests[ip]


# Global rate limiter instance
rate_limiter = RateLimiter()


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Middleware to enforce rate limiting on API endpoints
    """

    def __init__(self, app):
        super().__init__(app)

    def get_client_ip(self, request: Request) -> str:
        """Extract client IP from request"""
        # Check for forwarded IP (if behind proxy)
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()

        # Check for real IP
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip

        # Fall back to client host
        return request.client.host if request.client else "unknown"

    def get_rate_limit(self, path: str) -> Tuple[int, int]:
        """
        Get rate limit for specific endpoint

        Returns:
            Tuple of (limit, window_seconds)
        """
        # SDTM batch generation (most restrictive)
        if "/generate-sdtm-batch" in path:
            return RateLimitConfig.SDTM_BATCH_PER_5MIN, 300  # 2 requests per 5 minutes

        # SDTM single domain generation (very restrictive)
        if "/generate-sdtm" in path or "/download-sdtm" in path:
            return RateLimitConfig.SDTM_GEN_PER_MINUTE, 60  # 5 requests per minute

        # Code generation endpoints (restrictive)
        if "/code-generation/" in path or "/generate" in path:
            return RateLimitConfig.CODE_GEN_PER_MINUTE, 60

        # Categorization endpoints (core workflow - more lenient)
        if "/categorize" in path:
            return RateLimitConfig.CATEGORIZE_PER_MINUTE, 60  # 30 requests per minute

        # File upload endpoints
        if "/upload" in path:
            return RateLimitConfig.FILE_UPLOAD_PER_MINUTE, 60

        # Default rate limit
        return RateLimitConfig.REQUESTS_PER_MINUTE, 60

    async def dispatch(self, request: Request, call_next):
        """Process request with rate limiting"""

        # Skip rate limiting for certain paths
        exempt_paths = [
            "/",
            "/health",
            "/api/docs",
            "/api/redoc",
            "/api/openapi.json",
            "/api/v1/auth/login",
            "/api/v1/auth/refresh",
            "/api/v1/auth/me",
        ]
        
        # Also exempt read operations for studies (GET requests)
        if request.method == "GET" and (
            request.url.path.startswith("/api/v1/studies") or
            request.url.path == "/" or
            request.url.path in exempt_paths
        ):
            return await call_next(request)
            
        if request.url.path in exempt_paths:
            return await call_next(request)

        # Get client IP
        client_ip = self.get_client_ip(request)

        # Get rate limit for this endpoint
        limit, window_seconds = self.get_rate_limit(request.url.path)

        # Check rate limit
        is_allowed, remaining = await rate_limiter.is_allowed(
            client_ip, request.url.path, limit, window_seconds
        )

        if not is_allowed:
            # Rate limit exceeded
            retry_after = window_seconds
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "detail": f"Rate limit exceeded. Please try again in {window_seconds} seconds.",
                    "error": "too_many_requests",
                    "retry_after": retry_after,
                },
                headers={
                    "Retry-After": str(retry_after),
                    "X-RateLimit-Limit": str(limit),
                    "X-RateLimit-Remaining": "0",
                },
            )

        # Request allowed, proceed
        response = await call_next(request)

        # Add rate limit headers to response
        response.headers["X-RateLimit-Limit"] = str(limit)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Window"] = str(window_seconds)

        return response


async def cleanup_rate_limiter():
    """Background task to clean up old rate limiter entries"""
    while True:
        await asyncio.sleep(3600)  # Run every hour
        await rate_limiter.cleanup_old_entries()
