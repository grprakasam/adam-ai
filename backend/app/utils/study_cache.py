"""
Study-Aware Cache Manager Mixin

This module provides a mixin and utilities for ensuring that all cached data
is properly isolated by study ID. This prevents stale data from one study
being served to another study.

Industry Best Practice: All caches that store study-specific data MUST include
the study_id in the cache key to ensure proper data isolation.
"""

import hashlib
from typing import Optional
from loguru import logger


class StudyAwareCacheMixin:
    """
    Mixin that provides study-aware cache key generation.
    
    Use this mixin in any cache manager that handles study-specific data
    to ensure proper data isolation between studies.
    """
    
    @staticmethod
    def generate_study_aware_key(
        study_id: str,
        *key_parts,
        include_hash: bool = True
    ) -> str:
        """
        Generate a cache key that includes the study_id for proper isolation.
        
        Args:
            study_id: The study identifier (REQUIRED for data isolation)
            key_parts: Additional parts to include in the key
            include_hash: Whether to hash the key parts for shorter keys
            
        Returns:
            A cache key string that uniquely identifies the cached item
            for a specific study.
        """
        if not study_id:
            logger.warning("generate_study_aware_key called without study_id - data isolation compromised!")
            study_id = "UNKNOWN_STUDY"
        
        # Build the key with study_id as prefix
        parts = [study_id] + list(str(p) for p in key_parts if p)
        
        if include_hash:
            # Hash the non-study parts for shorter, consistent keys
            content = "|".join(parts[1:])  # Everything after study_id
            content_hash = hashlib.md5(content.encode()).hexdigest()[:16]
            return f"study:{study_id}:{content_hash}"
        else:
            return ":".join(parts)
    
    @staticmethod
    def validate_study_context(
        study_id: Optional[str],
        context_name: str = "operation"
    ) -> str:
        """
        Validate that a study_id is provided for a study-specific operation.
        
        Args:
            study_id: The study ID to validate
            context_name: Name of the operation for logging
            
        Returns:
            The validated study_id
            
        Raises:
            ValueError: If study_id is None or empty
        """
        if not study_id or study_id.strip() == "":
            error_msg = f"study_id is required for {context_name} but was not provided"
            logger.error(error_msg)
            raise ValueError(error_msg)
        
        return study_id.strip()


def invalidate_study_cache(cache_manager, study_id: str) -> int:
    """
    Invalidate all cache entries for a specific study.
    
    This should be called when:
    - A study is deleted
    - A study's specification is changed
    - User explicitly requests a refresh
    
    Args:
        cache_manager: The cache manager instance
        study_id: The study ID to invalidate
        
    Returns:
        Number of entries invalidated
    """
    if not hasattr(cache_manager, 'cache'):
        logger.warning("Cache manager does not have 'cache' attribute")
        return 0
    
    count = 0
    keys_to_delete = []
    
    for key in cache_manager.cache.keys():
        if f"study:{study_id}:" in key or f":{study_id}:" in key:
            keys_to_delete.append(key)
    
    for key in keys_to_delete:
        if hasattr(cache_manager, 'invalidate'):
            cache_manager.invalidate(key)
        else:
            del cache_manager.cache[key]
        count += 1
    
    if count > 0:
        logger.info(f"Invalidated {count} cache entries for study {study_id}")
    
    return count


# List of common cache key patterns that should include study_id
STUDY_AWARE_CACHE_PATTERNS = [
    "traceability",
    "code_generation",
    "validation",
    "specification",
    "categorization",
    "submission",
    "review",
    "analysis",
]

def audit_cache_key(key: str, require_study: bool = True) -> bool:
    """
    Audit a cache key to ensure it follows study-aware conventions.
    
    Args:
        key: The cache key to audit
        require_study: Whether study_id is required in the key
        
    Returns:
        True if the key is compliant, False otherwise
    """
    if not require_study:
        return True
    
    # Check if key starts with study prefix or contains study pattern
    has_study_prefix = key.startswith("study:")
    has_study_pattern = any(
        f":{pattern}:" in key.lower() 
        for pattern in STUDY_AWARE_CACHE_PATTERNS
    )
    
    if has_study_pattern and not has_study_prefix:
        logger.warning(
            f"Cache key '{key[:50]}...' appears to be study-specific "
            f"but does not include study_id prefix. This may cause data isolation issues."
        )
        return False
    
    return True
