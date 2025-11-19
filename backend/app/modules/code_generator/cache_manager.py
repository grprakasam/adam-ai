"""
Cache Manager for Code Generation

Implements caching to avoid redundant API calls and improve performance.
"""

import hashlib
import time
from typing import Optional, Dict, Any, Tuple, List
from loguru import logger


class CacheManager:
    """Manage caching of generated code snippets"""
    
    def __init__(self, ttl: int = 3600):
        """
        Initialize cache manager
        
        Args:
            ttl: Time to live in seconds (default 1 hour)
        """
        self.cache: Dict[str, Dict[str, Any]] = {}
        self.ttl = ttl
        self.hits = 0
        self.misses = 0
        logger.info(f"Initialized CacheManager with TTL={ttl}s")
    
    def generate_cache_key(
        self,
        variable_name: str,
        derivation: str,
        language: str,
        adam_dataset: str,
        variable_type: str = ""
    ) -> str:
        """
        Generate unique cache key for a variable
        
        Args:
            variable_name: Variable name
            derivation: Derivation logic
            language: Programming language
            adam_dataset: ADAM dataset name
            variable_type: Variable type
            
        Returns:
            MD5 hash of the combined inputs
        """
        content = f"{variable_name}|{derivation}|{language}|{adam_dataset}|{variable_type}"
        return hashlib.md5(content.encode()).hexdigest()
    
    def get(self, key: str) -> Optional[Dict[str, Any]]:
        """
        Get cached result
        
        Args:
            key: Cache key
            
        Returns:
            Cached data if found and not expired, None otherwise
        """
        if key in self.cache:
            entry = self.cache[key]
            age = time.time() - entry['timestamp']
            ttl_value = entry.get('ttl', self.ttl)
            
            if age < ttl_value:
                self.hits += 1
                logger.debug(f"Cache HIT for key {key[:8]}... (age: {age:.0f}s)")
                return entry['data']
            else:
                # Expired entry
                logger.debug(f"Cache EXPIRED for key {key[:8]}... (age: {age:.0f}s)")
                del self.cache[key]
        
        self.misses += 1
        logger.debug(f"Cache MISS for key {key[:8]}...")
        return None
    
    def set(self, key: str, data: Dict[str, Any], ttl: Optional[int] = None):
        """
        Cache result
        
        Args:
            key: Cache key
            data: Data to cache
        """
        entry_ttl = ttl if ttl is not None else self.ttl
        self.cache[key] = {
            'data': data,
            'timestamp': time.time(),
            'ttl': entry_ttl
        }
        logger.debug(f"Cached result for key {key[:8]}...")
    
    def invalidate(self, key: str) -> bool:
        """Remove a specific cache entry."""
        if key in self.cache:
            del self.cache[key]
            logger.debug(f"Invalidated cache key {key[:8]}...")
            return True
        return False
    
    def clear(self):
        """Clear all cache entries"""
        count = len(self.cache)
        self.cache.clear()
        self.hits = 0
        self.misses = 0
        logger.info(f"Cleared {count} cache entries")
    
    def clear_expired(self):
        """Remove expired cache entries"""
        now = time.time()
        expired_keys = [
            key for key, entry in self.cache.items()
            if now - entry['timestamp'] >= entry.get('ttl', self.ttl)
        ]
        
        for key in expired_keys:
            del self.cache[key]
        
        if expired_keys:
            logger.info(f"Removed {len(expired_keys)} expired cache entries")
    
    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        total_requests = self.hits + self.misses
        hit_rate = (self.hits / total_requests * 100) if total_requests > 0 else 0
        
        return {
            "total_entries": len(self.cache),
            "hits": self.hits,
            "misses": self.misses,
            "hit_rate_percent": round(hit_rate, 2),
            "ttl_seconds": self.ttl
        }
    
    def split_cached_uncached(
        self,
        variables: List[Dict[str, Any]],
        language: str,
        adam_dataset: str
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """
        Split variables into cached and uncached lists
        
        Args:
            variables: List of variable dictionaries
            language: Programming language
            adam_dataset: ADAM dataset name
            
        Returns:
            Tuple of (cached_results, uncached_variables)
        """
        cached_results = []
        uncached_variables = []
        
        for variable in variables:
            key = self.generate_cache_key(
                variable_name=variable.get('name', ''),
                derivation=variable.get('derivation', ''),
                language=language,
                adam_dataset=adam_dataset,
                variable_type=variable.get('type', '')
            )
            
            cached_data = self.get(key)
            if cached_data:
                # Add variable name to cached result
                cached_data['variable'] = variable.get('name', '')
                cached_results.append(cached_data)
            else:
                uncached_variables.append(variable)
        
        logger.info(
            f"Cache split: {len(cached_results)} cached, "
            f"{len(uncached_variables)} uncached out of {len(variables)} total"
        )
        
        return cached_results, uncached_variables
