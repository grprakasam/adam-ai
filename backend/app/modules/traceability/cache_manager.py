"""
Cache Manager - Simple in-memory cache for traceability results
(In production, use Redis)
"""

from typing import Optional, Dict, Any
from datetime import datetime, timedelta
from loguru import logger


class CacheManager:
    """Simple in-memory cache manager (placeholder for Redis)"""

    def __init__(self):
        self._cache: Dict[str, Dict[str, Any]] = {}

    async def get(self, key: str) -> Optional[Dict]:
        """Get cached value"""
        if key in self._cache:
            entry = self._cache[key]
            # Check if expired
            if datetime.utcnow() < entry['expires_at']:
                logger.debug(f"Cache hit: {key}")
                return entry['value']
            else:
                # Expired, remove it
                del self._cache[key]
                logger.debug(f"Cache expired: {key}")
                return None
        logger.debug(f"Cache miss: {key}")
        return None

    async def set(self, key: str, value: Dict, ttl: int = 3600) -> None:
        """Set cached value with TTL in seconds"""
        expires_at = datetime.utcnow() + timedelta(seconds=ttl)
        self._cache[key] = {
            'value': value,
            'expires_at': expires_at
        }
        logger.debug(f"Cache set: {key} (TTL: {ttl}s)")

    async def delete(self, key: str) -> None:
        """Delete cached value"""
        if key in self._cache:
            del self._cache[key]
            logger.debug(f"Cache deleted: {key}")

    async def clear(self) -> None:
        """Clear all cached values"""
        self._cache.clear()
        logger.debug("Cache cleared")
