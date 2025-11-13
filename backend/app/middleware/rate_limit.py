"""
Rate Limiting Middleware
Protects API from abuse and manages concurrent requests
"""

from fastapi import Request, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Dict, Tuple
import asyncio
from loguru import logger


class RateLimiter:
    """
    Token bucket rate limiter with per-user tracking
    Supports concurrent request limiting for multi-user scenarios
    """
    
    def __init__(
        self,
        requests_per_minute: int = 60,
        max_concurrent: int = 10,
        burst_size: int = 20
    ):
        self.requests_per_minute = requests_per_minute
        self.max_concurrent = max_concurrent
        self.burst_size = burst_size
        
        # Track requests per user
        self.user_requests: Dict[str, list] = defaultdict(list)
        # Track concurrent requests per user
        self.user_concurrent: Dict[str, int] = defaultdict(int)
        # Semaphore for global concurrent limit
        self.global_semaphore = asyncio.Semaphore(max_concurrent * 2)  # Allow some headroom
        
        logger.info(
            f"RateLimiter initialized: {requests_per_minute} req/min, "
            f"{max_concurrent} concurrent, burst={burst_size}"
        )
    
    async def check_rate_limit(self, user_id: str) -> Tuple[bool, str]:
        """
        Check if request is allowed under rate limits
        
        Returns:
            (allowed, message) tuple
        """
        now = datetime.now()
        
        # Cleanup old requests (older than 1 minute)
        cutoff = now - timedelta(minutes=1)
        self.user_requests[user_id] = [
            req_time for req_time in self.user_requests[user_id]
            if req_time > cutoff
        ]
        
        # Check requests per minute limit
        recent_requests = len(self.user_requests[user_id])
        if recent_requests >= self.requests_per_minute:
            return False, f"Rate limit exceeded: {self.requests_per_minute} requests per minute"
        
        # Check burst limit
        last_second = now - timedelta(seconds=1)
        burst_requests = sum(1 for req_time in self.user_requests[user_id] if req_time > last_second)
        if burst_requests >= self.burst_size:
            return False, f"Burst limit exceeded: {self.burst_size} requests per second"
        
        # Check concurrent requests limit
        if self.user_concurrent[user_id] >= self.max_concurrent:
            return False, f"Concurrent request limit exceeded: {self.max_concurrent} concurrent requests"
        
        return True, "OK"
    
    async def acquire(self, user_id: str):
        """Acquire rate limit token"""
        allowed, message = await self.check_rate_limit(user_id)
        
        if not allowed:
            logger.warning(f"Rate limit exceeded for user {user_id}: {message}")
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=message
            )
        
        # Record request
        self.user_requests[user_id].append(datetime.now())
        self.user_concurrent[user_id] += 1
        
        # Acquire global semaphore
        await self.global_semaphore.acquire()
    
    def release(self, user_id: str):
        """Release rate limit token"""
        if self.user_concurrent[user_id] > 0:
            self.user_concurrent[user_id] -= 1
        
        # Release global semaphore
        try:
            self.global_semaphore.release()
        except ValueError:
            pass  # Already released
    
    def get_stats(self) -> Dict:
        """Get rate limiter statistics"""
        return {
            "requests_per_minute_limit": self.requests_per_minute,
            "max_concurrent_limit": self.max_concurrent,
            "burst_size": self.burst_size,
            "active_users": len([u for u, c in self.user_concurrent.items() if c > 0]),
            "total_concurrent": sum(self.user_concurrent.values()),
            "top_users": [
                {
                    "user_id": user_id[:8] + "...",  # Truncate for privacy
                    "concurrent": count,
                    "recent_requests": len(self.user_requests[user_id])
                }
                for user_id, count in sorted(
                    self.user_concurrent.items(),
                    key=lambda x: x[1],
                    reverse=True
                )[:5]
            ]
        }


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Middleware to apply rate limiting to API requests
    """
    
    def __init__(self, app, rate_limiter: RateLimiter):
        super().__init__(app)
        self.rate_limiter = rate_limiter
        self.exempt_paths = [
            "/docs",
            "/redoc",
            "/openapi.json",
            "/api/v1/auth/login",
            "/api/status",
            "/health"
        ]
    
    async def dispatch(self, request: Request, call_next):
        # Skip rate limiting for exempt paths
        if any(request.url.path.startswith(path) for path in self.exempt_paths):
            return await call_next(request)
        
        # Get user ID from request (from token or IP)
        user_id = self._get_user_id(request)
        
        try:
            # Acquire rate limit token
            await self.rate_limiter.acquire(user_id)
            
            # Process request
            response = await call_next(request)
            
            # Add rate limit headers
            response.headers["X-RateLimit-Limit"] = str(self.rate_limiter.requests_per_minute)
            response.headers["X-RateLimit-Concurrent"] = str(self.rate_limiter.user_concurrent[user_id])
            
            return response
        
        except HTTPException:
            raise
        
        except Exception as e:
            logger.error(f"Rate limit error: {str(e)}")
            raise
        
        finally:
            # Always release token
            self.rate_limiter.release(user_id)
    
    def _get_user_id(self, request: Request) -> str:
        """Extract user ID from request"""
        # Try to get from authorization header
        auth_header = request.headers.get("authorization", "")
        if auth_header.startswith("Bearer "):
            # Use token as user ID (could decode JWT for actual user ID)
            return auth_header[7:50]  # Truncate token
        
        # Fallback to IP address
        client_host = request.client.host if request.client else "unknown"
        return f"ip:{client_host}"


# Global rate limiter instance
_rate_limiter: RateLimiter = None


def get_rate_limiter() -> RateLimiter:
    """Get or create rate limiter instance"""
    global _rate_limiter
    if _rate_limiter is None:
        _rate_limiter = RateLimiter(
            requests_per_minute=60,  # 60 requests per minute per user
            max_concurrent=10,  # 10 concurrent requests per user
            burst_size=20  # Allow burst of 20 requests per second
        )
    return _rate_limiter
