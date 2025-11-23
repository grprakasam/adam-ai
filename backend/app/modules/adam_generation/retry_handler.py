"""
Retry handler for ADAM generation with exponential backoff
"""

import asyncio
import logging
from typing import Callable, TypeVar, Optional
from functools import wraps
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

T = TypeVar('T')


class RetryConfig:
    """Configuration for retry behavior"""
    def __init__(
        self,
        max_attempts: int = 3,
        initial_delay: float = 1.0,
        max_delay: float = 60.0,
        exponential_base: float = 2.0,
        retryable_exceptions: tuple = (Exception,)
    ):
        self.max_attempts = max_attempts
        self.initial_delay = initial_delay
        self.max_delay = max_delay
        self.exponential_base = exponential_base
        self.retryable_exceptions = retryable_exceptions


def retry_with_backoff(
    config: Optional[RetryConfig] = None,
    on_retry: Optional[Callable[[Exception, int], None]] = None
):
    """
    Decorator for retrying async functions with exponential backoff
    
    Args:
        config: Retry configuration
        on_retry: Callback called on each retry (exception, attempt_number)
    """
    if config is None:
        config = RetryConfig()
    
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @wraps(func)
        async def wrapper(*args, **kwargs) -> T:
            last_exception = None
            
            for attempt in range(1, config.max_attempts + 1):
                try:
                    return await func(*args, **kwargs)
                except config.retryable_exceptions as e:
                    last_exception = e
                    
                    if attempt < config.max_attempts:
                        delay = min(
                            config.initial_delay * (config.exponential_base ** (attempt - 1)),
                            config.max_delay
                        )
                        
                        logger.warning(
                            f"Attempt {attempt}/{config.max_attempts} failed for {func.__name__}: {e}. "
                            f"Retrying in {delay:.2f}s..."
                        )
                        
                        if on_retry:
                            on_retry(e, attempt)
                        
                        await asyncio.sleep(delay)
                    else:
                        logger.error(
                            f"All {config.max_attempts} attempts failed for {func.__name__}: {e}"
                        )
            
            raise last_exception
        
        return wrapper
    return decorator


class RetryableOperation:
    """Context manager for retryable operations"""
    
    def __init__(self, config: Optional[RetryConfig] = None):
        self.config = config or RetryConfig()
        self.attempt = 0
        self.start_time = None
    
    async def __aenter__(self):
        self.start_time = datetime.utcnow()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if exc_type and exc_type in self.config.retryable_exceptions:
            self.attempt += 1
            if self.attempt < self.config.max_attempts:
                delay = min(
                    self.config.initial_delay * (self.config.exponential_base ** (self.attempt - 1)),
                    self.config.max_delay
                )
                await asyncio.sleep(delay)
                return False  # Don't suppress exception, let it retry
        return None
    
    def should_retry(self) -> bool:
        """Check if operation should be retried"""
        return self.attempt < self.config.max_attempts

