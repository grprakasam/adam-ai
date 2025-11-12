"""
Unit tests for CacheManager module
"""
import pytest
import time
from app.modules.code_generator.cache_manager import CacheManager


class TestCacheManager:
    """Test cases for CacheManager caching logic"""
    
    def setup_method(self):
        """Setup test fixtures"""
        self.cache = CacheManager(ttl=2)  # 2 second TTL for testing
    
    def teardown_method(self):
        """Cleanup after tests"""
        self.cache.clear()
    
    def test_cache_key_generation(self):
        """Test that cache keys are generated consistently"""
        key1 = self.cache.generate_cache_key(
            variable="AGEGR1",
            derivation="Test derivation",
            language="R",
            dataset="ADSL"
        )
        
        key2 = self.cache.generate_cache_key(
            variable="AGEGR1",
            derivation="Test derivation",
            language="R",
            dataset="ADSL"
        )
        
        # Same input should generate same key
        assert key1 == key2
        assert isinstance(key1, str)
        assert len(key1) == 32  # MD5 hash length
    
    def test_cache_key_uniqueness(self):
        """Test that different inputs generate different keys"""
        key1 = self.cache.generate_cache_key("VAR1", "deriv1", "R", "ADSL")
        key2 = self.cache.generate_cache_key("VAR2", "deriv1", "R", "ADSL")
        key3 = self.cache.generate_cache_key("VAR1", "deriv2", "R", "ADSL")
        key4 = self.cache.generate_cache_key("VAR1", "deriv1", "SAS", "ADSL")
        
        # All keys should be different
        keys = [key1, key2, key3, key4]
        assert len(keys) == len(set(keys))
    
    def test_cache_set_and_get(self):
        """Test basic cache set and get operations"""
        key = "test_key"
        value = {
            "code_snippet": "test <- 'code'",
            "coding_rationale": "Test rationale"
        }
        
        self.cache.set(key, value)
        retrieved = self.cache.get(key)
        
        assert retrieved == value
    
    def test_cache_miss(self):
        """Test that cache miss returns None"""
        result = self.cache.get("nonexistent_key")
        assert result is None
    
    def test_cache_expiration(self):
        """Test that cache entries expire after TTL"""
        key = "expiring_key"
        value = {"test": "data"}
        
        self.cache.set(key, value)
        assert self.cache.get(key) == value
        
        # Wait for expiration
        time.sleep(2.5)
        
        # Should be expired
        assert self.cache.get(key) is None
    
    def test_cache_clear(self):
        """Test cache clearing"""
        self.cache.set("key1", {"data": "1"})
        self.cache.set("key2", {"data": "2"})
        
        assert self.cache.get("key1") is not None
        assert self.cache.get("key2") is not None
        
        self.cache.clear()
        
        assert self.cache.get("key1") is None
        assert self.cache.get("key2") is None
    
    def test_cache_hit_tracking(self):
        """Test that cache hits and misses are tracked"""
        key = "tracked_key"
        self.cache.set(key, {"data": "test"})
        
        # First get - should be hit
        self.cache.get(key)
        
        # Get nonexistent - should be miss
        self.cache.get("nonexistent")
        
        stats = self.cache.get_stats()
        
        assert stats["hits"] >= 1
        assert stats["misses"] >= 1
        assert stats["total_requests"] >= 2
    
    def test_cache_hit_rate_calculation(self):
        """Test hit rate calculation"""
        # Add some cache entries
        for i in range(5):
            self.cache.set(f"key{i}", {"data": i})
        
        # 5 hits
        for i in range(5):
            self.cache.get(f"key{i}")
        
        # 5 misses
        for i in range(5, 10):
            self.cache.get(f"key{i}")
        
        stats = self.cache.get_stats()
        
        # Hit rate should be 50%
        assert 0.4 <= stats["hit_rate"] <= 0.6
    
    def test_split_cached_uncached(self):
        """Test splitting variables into cached and uncached"""
        # Cache some variables
        cached_vars = [
            {"variable": "VAR1", "derivation": "deriv1"},
            {"variable": "VAR2", "derivation": "deriv2"}
        ]
        
        for var in cached_vars:
            key = self.cache.generate_cache_key(
                variable=var["variable"],
                derivation=var["derivation"],
                language="R",
                dataset="ADSL"
            )
            self.cache.set(key, {"code": "test"})
        
        # Create mixed list
        all_variables = cached_vars + [
            {"variable": "VAR3", "derivation": "deriv3"},
            {"variable": "VAR4", "derivation": "deriv4"}
        ]
        
        cached, uncached = self.cache.split_cached_uncached(
            variables=all_variables,
            language="R",
            dataset="ADSL"
        )
        
        assert len(cached) == 2
        assert len(uncached) == 2
        assert cached[0]["variable"] in ["VAR1", "VAR2"]
        assert uncached[0]["variable"] in ["VAR3", "VAR4"]
    
    def test_cache_clear_expired(self):
        """Test clearing only expired entries"""
        # Add entry that won't expire
        self.cache.set("persistent", {"data": "keep"})
        
        # Add entry that will expire
        expired_cache = CacheManager(ttl=0.5)
        expired_cache.set("temporary", {"data": "expire"})
        
        time.sleep(1)
        
        # Clear expired entries
        expired_cache.clear_expired()
        
        # Temporary should be gone
        assert expired_cache.get("temporary") is None
    
    def test_cache_stats_initial_state(self):
        """Test that stats are initialized correctly"""
        fresh_cache = CacheManager()
        stats = fresh_cache.get_stats()
        
        assert stats["hits"] == 0
        assert stats["misses"] == 0
        assert stats["total_requests"] == 0
        assert stats["hit_rate"] == 0.0
        assert stats["total_entries"] == 0
    
    def test_cache_with_complex_values(self):
        """Test caching complex nested structures"""
        complex_value = {
            "code_snippet": "complex <- list(a=1, b=2)",
            "coding_rationale": "Complex rationale",
            "metadata": {
                "tokens": 100,
                "model": "test-model",
                "nested": {
                    "deep": "value"
                }
            }
        }
        
        self.cache.set("complex", complex_value)
        retrieved = self.cache.get("complex")
        
        assert retrieved == complex_value
        assert retrieved["metadata"]["nested"]["deep"] == "value"
