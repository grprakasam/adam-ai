"""
Caching Service
Implements response caching for LLM calls and code generation
"""

from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
import hashlib
import json
from loguru import logger


class CacheEntry:
    """Represents a single cache entry"""
    
    def __init__(self, key: str, value: Any, ttl: int = 3600):
        self.key = key
        self.value = value
        self.created_at = datetime.now()
        self.expires_at = datetime.now() + timedelta(seconds=ttl)
        self.hit_count = 0
    
    def is_expired(self) -> bool:
        """Check if cache entry has expired"""
        return datetime.now() > self.expires_at
    
    def refresh(self, ttl: int = 3600):
        """Refresh expiration time"""
        self.expires_at = datetime.now() + timedelta(seconds=ttl)
        self.hit_count += 1
    
    def to_dict(self) -> Dict:
        return {
            "key": self.key,
            "created_at": self.created_at.isoformat(),
            "expires_at": self.expires_at.isoformat(),
            "hit_count": self.hit_count,
            "is_expired": self.is_expired()
        }


class CacheService:
    """
    In-memory cache service for API responses
    Reduces redundant LLM calls and improves performance
    """
    
    def __init__(self, max_size: int = 1000, default_ttl: int = 3600):
        self._cache: Dict[str, CacheEntry] = {}
        self.max_size = max_size
        self.default_ttl = default_ttl
        self.hits = 0
        self.misses = 0
        logger.info(f"Cache initialized with max_size={max_size}, default_ttl={default_ttl}s")
    
    def _generate_key(self, prefix: str, params: Dict[str, Any]) -> str:
        """Generate cache key from parameters"""
        # Sort params for consistent hashing
        sorted_params = json.dumps(params, sort_keys=True)
        param_hash = hashlib.sha256(sorted_params.encode()).hexdigest()[:16]
        return f"{prefix}:{param_hash}"
    
    def get(self, key: str) -> Optional[Any]:
        """Get value from cache"""
        entry = self._cache.get(key)
        
        if entry is None:
            self.misses += 1
            logger.debug(f"Cache MISS: {key}")
            return None
        
        if entry.is_expired():
            self.delete(key)
            self.misses += 1
            logger.debug(f"Cache EXPIRED: {key}")
            return None
        
        entry.refresh(self.default_ttl)
        self.hits += 1
        logger.debug(f"Cache HIT: {key} (hit_count={entry.hit_count})")
        return entry.value
    
    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        """Set value in cache"""
        if len(self._cache) >= self.max_size:
            self._evict_oldest()
        
        ttl = ttl or self.default_ttl
        self._cache[key] = CacheEntry(key, value, ttl)
        logger.debug(f"Cache SET: {key} (ttl={ttl}s)")
    
    def delete(self, key: str) -> bool:
        """Delete entry from cache"""
        if key in self._cache:
            del self._cache[key]
            logger.debug(f"Cache DELETE: {key}")
            return True
        return False
    
    def clear(self) -> None:
        """Clear all cache entries"""
        count = len(self._cache)
        self._cache.clear()
        self.hits = 0
        self.misses = 0
        logger.info(f"Cache cleared ({count} entries removed)")
    
    def _evict_oldest(self) -> None:
        """Evict oldest cache entry (LRU-like)"""
        if not self._cache:
            return
        
        # Find entry with oldest created_at
        oldest_key = min(self._cache.keys(), key=lambda k: self._cache[k].created_at)
        self.delete(oldest_key)
        logger.debug(f"Cache evicted oldest entry: {oldest_key}")
    
    def cleanup_expired(self) -> int:
        """Remove all expired entries"""
        expired_keys = [k for k, v in self._cache.items() if v.is_expired()]
        for key in expired_keys:
            self.delete(key)
        
        if expired_keys:
            logger.info(f"Cache cleanup: removed {len(expired_keys)} expired entries")
        
        return len(expired_keys)
    
    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        total_requests = self.hits + self.misses
        hit_rate = (self.hits / total_requests * 100) if total_requests > 0 else 0
        
        return {
            "size": len(self._cache),
            "max_size": self.max_size,
            "hits": self.hits,
            "misses": self.misses,
            "total_requests": total_requests,
            "hit_rate": round(hit_rate, 2),
            "entries": [entry.to_dict() for entry in list(self._cache.values())[:10]]  # First 10 entries
        }
    
    def get_code_generation_key(self, variable: str, spec: str, language: str, 
                                  adam_version: str, model: str) -> str:
        """Generate cache key for code generation"""
        params = {
            "variable": variable,
            "spec": spec,
            "language": language,
            "adam_version": adam_version,
            "model": model
        }
        return self._generate_key("codegen", params)
    
    def get_validation_key(self, code: str, language: str) -> str:
        """Generate cache key for validation"""
        params = {
            "code": code,
            "language": language
        }
        return self._generate_key("validation", params)
    
    def get_categorization_key(self, variables: List[str], dataset: str) -> str:
        """Generate cache key for variable categorization"""
        params = {
            "variables": sorted(variables),  # Sort for consistent hashing
            "dataset": dataset
        }
        return self._generate_key("categorize", params)


# Global cache instance
_cache_instance: Optional[CacheService] = None


def get_cache() -> CacheService:
    """Get or create cache service instance"""
    global _cache_instance
    if _cache_instance is None:
        _cache_instance = CacheService(
            max_size=1000,  # Store up to 1000 entries
            default_ttl=3600  # 1 hour default TTL
        )
    return _cache_instance


def clear_cache() -> None:
    """Clear the global cache"""
    global _cache_instance
    if _cache_instance:
        _cache_instance.clear()


def get_cache_stats() -> Dict[str, Any]:
    """Get cache statistics"""
    cache = get_cache()
    return cache.get_stats()
