"""
LLM Integration Service - Production-Ready Implementation
Manages interactions with OpenAI, Anthropic, Google, and Groq LLM providers

Features:
- Custom exception hierarchy for precise error handling
- Automatic retry logic with exponential backoff
- Input validation and type safety
- Configurable timeouts
- DRY principle with base classes for similar providers
- Comprehensive logging
"""

from typing import Optional, Dict, Any, List, TypedDict
from abc import ABC, abstractmethod
from loguru import logger
from functools import wraps
import os
import asyncio

from app.config import settings


# ============================================================================
# Custom Exceptions
# ============================================================================

class LLMProviderError(Exception):
    """Base exception for LLM provider errors"""
    pass


class LLMConnectionError(LLMProviderError):
    """Raised when unable to connect to LLM provider"""
    pass


class LLMRateLimitError(LLMProviderError):
    """Raised when rate limit is exceeded"""
    pass


class LLMValidationError(LLMProviderError):
    """Raised when input validation fails"""
    pass


# ============================================================================
# Type Definitions
# ============================================================================

class UsageMetrics(TypedDict):
    """Token usage metrics from LLM response"""
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int


class LLMResponse(TypedDict):
    """Standard LLM response structure"""
    content: str
    model: str
    usage: UsageMetrics
    finish_reason: str


# ============================================================================
# Configuration Constants
# ============================================================================

# System prompt for ADAM code generation
SYSTEM_PROMPT = (
    "You are an expert R programmer specializing in clinical trial ADAM datasets "
    "following CDISC standards. Generate clean, efficient, and well-documented R code."
)

# Retry configuration
MAX_RETRIES = 3
RETRY_DELAY = 1.0  # seconds
RETRY_BACKOFF = 2.0  # exponential backoff multiplier

# Rate limit retry configuration
RATE_LIMIT_RETRY_DELAY = 60.0  # Wait 60 seconds when rate limited
RATE_LIMIT_MAX_RETRIES = 2  # Retry rate-limited requests up to 2 times

# Request timeout (seconds)
REQUEST_TIMEOUT = getattr(settings, 'REQUEST_TIMEOUT', 30)


# ============================================================================
# Retry Decorator
# ============================================================================

def retry_on_failure(max_retries: int = MAX_RETRIES):
    """
    Decorator to retry failed async operations with exponential backoff
    
    Args:
        max_retries: Maximum number of retry attempts
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            last_exception = None
            delay = RETRY_DELAY
            rate_limit_retries = 0
            
            for attempt in range(max_retries + 1):
                try:
                    return await func(*args, **kwargs)
                    
                except LLMRateLimitError as e:
                    # Retry rate limit errors with longer delay
                    last_exception = e
                    rate_limit_retries += 1
                    
                    if rate_limit_retries <= RATE_LIMIT_MAX_RETRIES:
                        wait_time = RATE_LIMIT_RETRY_DELAY * rate_limit_retries
                        logger.warning(
                            f"⏳ Rate limit hit (retry {rate_limit_retries}/{RATE_LIMIT_MAX_RETRIES}), "
                            f"waiting {wait_time}s before retry: {str(e)}"
                        )
                        await asyncio.sleep(wait_time)
                    else:
                        logger.error(f"❌ Rate limit retries exhausted: {str(e)}")
                        raise
                    
                except LLMConnectionError as e:
                    last_exception = e
                    if attempt < max_retries:
                        logger.warning(
                            f"Connection failed (attempt {attempt + 1}/{max_retries + 1}), "
                            f"retrying in {delay}s: {str(e)}"
                        )
                        await asyncio.sleep(delay)
                        delay *= RETRY_BACKOFF
                    else:
                        logger.error(f"All retry attempts failed: {str(e)}")
                        
                except Exception as e:
                    # For unknown errors, retry but log
                    last_exception = e
                    if attempt < max_retries:
                        logger.warning(
                            f"Request failed (attempt {attempt + 1}/{max_retries + 1}), "
                            f"retrying in {delay}s: {str(e)}"
                        )
                        await asyncio.sleep(delay)
                        delay *= RETRY_BACKOFF
                    else:
                        logger.error(f"All retry attempts failed: {str(e)}")
            
            raise last_exception
        
        return wrapper
    return decorator


# ============================================================================
# Input Validation
# ============================================================================

def validate_generation_params(
    prompt: str,
    temperature: float,
    max_tokens: int
) -> None:
    """
    Validate generation parameters
    
    Args:
        prompt: Input prompt text
        temperature: Temperature value (0.0 - 2.0)
        max_tokens: Maximum tokens to generate
        
    Raises:
        LLMValidationError: If validation fails
    """
    if not prompt or not isinstance(prompt, str):
        raise LLMValidationError("Prompt must be a non-empty string")
    
    if len(prompt.strip()) == 0:
        raise LLMValidationError("Prompt cannot be empty or whitespace only")
    
    if not 0.0 <= temperature <= 2.0:
        raise LLMValidationError(f"Temperature must be between 0.0 and 2.0, got {temperature}")
    
    if not 1 <= max_tokens <= 32000:
        raise LLMValidationError(f"Max tokens must be between 1 and 32000, got {max_tokens}")
    
    # Warn if prompt is very large
    if len(prompt) > 50000:
        logger.warning(f"Large prompt detected: {len(prompt)} characters")


# ============================================================================
# Rate Limiter for Request Throttling
# ============================================================================

import time
from collections import deque


class TokenBucketRateLimiter:
    """
    Token bucket rate limiter to prevent hitting API rate limits
    Tracks both requests per minute and tokens per minute
    """
    
    def __init__(
        self,
        requests_per_minute: int = 30,
        tokens_per_minute: int = 10000,
        buffer_factor: float = 0.8  # Use only 80% of limit as safety buffer
    ):
        """
        Initialize rate limiter
        
        Args:
            requests_per_minute: Max requests allowed per minute
            tokens_per_minute: Max tokens allowed per minute
            buffer_factor: Safety factor (0-1) to stay below limits
        """
        self.max_requests = int(requests_per_minute * buffer_factor)
        self.max_tokens = int(tokens_per_minute * buffer_factor)
        self.request_window = deque()
        self.token_window = deque()
        self.window_size = 60.0  # 60 seconds
        
        logger.info(
            f"🛡️  Rate limiter initialized: {self.max_requests} req/min, "
            f"{self.max_tokens} tokens/min (buffer: {buffer_factor*100}%)"
        )
    
    async def acquire(self, estimated_tokens: int = 1000):
        """
        Acquire permission to make a request
        Waits if necessary to stay within rate limits
        
        Args:
            estimated_tokens: Estimated tokens for this request
        """
        current_time = time.time()
        
        # Clean up old entries
        self._cleanup_window(current_time)
        
        # Check if we need to wait
        wait_time = self._calculate_wait_time(current_time, estimated_tokens)
        
        if wait_time > 0:
            logger.info(f"⏳ Rate limit throttling: waiting {wait_time:.1f}s")
            await asyncio.sleep(wait_time)
            current_time = time.time()
            self._cleanup_window(current_time)
        
        # Record this request
        self.request_window.append(current_time)
        self.token_window.append((current_time, estimated_tokens))
    
    def _cleanup_window(self, current_time: float):
        """Remove entries older than the window size"""
        cutoff_time = current_time - self.window_size
        
        while self.request_window and self.request_window[0] < cutoff_time:
            self.request_window.popleft()
        
        while self.token_window and self.token_window[0][0] < cutoff_time:
            self.token_window.popleft()
    
    def _calculate_wait_time(self, current_time: float, estimated_tokens: int) -> float:
        """Calculate how long to wait before making request"""
        wait_time = 0.0
        
        # Check request count
        if len(self.request_window) >= self.max_requests:
            if not self.request_window:
                wait_time = max(wait_time, self.window_size)
            else:
                oldest_request = self.request_window[0]
                wait_for_request = (oldest_request + self.window_size) - current_time
                wait_time = max(wait_time, wait_for_request)
        
        # Check token count
        total_tokens = sum(tokens for _, tokens in self.token_window)
        if total_tokens + estimated_tokens > self.max_tokens:
            if not self.token_window:
                # If window is empty but request is still too large, it exceeds the rate limit entirely
                # Just wait the full window size
                wait_time = max(wait_time, self.window_size)
            else:
                oldest_token_time = self.token_window[0][0]
                wait_for_tokens = (oldest_token_time + self.window_size) - current_time
                wait_time = max(wait_time, wait_for_tokens)
        
        return max(0, wait_time)


# ============================================================================
# Base Provider Classes
# ============================================================================

class BaseLLMProvider(ABC):
    """Abstract base class for LLM providers"""
    
    def __init__(self, api_key: str, model: str):
        if not api_key or not isinstance(api_key, str):
            raise LLMValidationError("API key must be a non-empty string")
        if not model or not isinstance(model, str):
            raise LLMValidationError("Model name must be a non-empty string")
            
        self.api_key = api_key
        self.model = model
        self.provider_name = self.__class__.__name__.replace("Provider", "").lower()
    
    @abstractmethod
    async def generate(
        self,
        prompt: str,
        temperature: float = 0.2,
        max_tokens: int = 4000,
        **kwargs
    ) -> LLMResponse:
        """
        Generate response from LLM
        
        Args:
            prompt: The prompt to send to the LLM
            temperature: Temperature parameter for generation (0.0-2.0)
            max_tokens: Maximum tokens in response
            **kwargs: Additional provider-specific parameters
            
        Returns:
            LLMResponse dictionary with content, model, usage, and finish_reason
            
        Raises:
            LLMConnectionError: If connection to provider fails
            LLMRateLimitError: If rate limit is exceeded
            LLMValidationError: If input validation fails
        """
        pass
    
    @abstractmethod
    async def validate_connection(self) -> bool:
        """
        Validate that the provider is accessible
        
        Returns:
            True if connection is valid, False otherwise
        """
        pass


class OpenAICompatibleProvider(BaseLLMProvider):
    """
    Base class for OpenAI-compatible API providers (OpenAI, Groq)
    Reduces code duplication by implementing shared logic
    """
    
    def __init__(self, api_key: str, model: str, client_class, base_url: Optional[str] = None):
        super().__init__(api_key, model)
        try:
            client_kwargs = {"api_key": self.api_key, "timeout": REQUEST_TIMEOUT}
            if base_url:
                client_kwargs["base_url"] = base_url
            self.client = client_class(**client_kwargs)
            logger.info(f"✅ Initialized {self.provider_name} provider with model: {self.model}")
        except ImportError as e:
            logger.error(f"❌ {self.provider_name} package not installed: {str(e)}")
            raise LLMConnectionError(f"{self.provider_name} package not installed")
    
    @retry_on_failure(max_retries=MAX_RETRIES)
    async def generate(
        self,
        prompt: str,
        temperature: float = 0.2,
        max_tokens: int = 4000,
        **kwargs
    ) -> LLMResponse:
        """Generate response using OpenAI-compatible API"""
        # Validate inputs
        validate_generation_params(prompt, temperature, max_tokens)
        
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": prompt}
                ],
                temperature=temperature,
                max_tokens=max_tokens,
                **kwargs
            )
            
            result: LLMResponse = {
                "content": response.choices[0].message.content or "",
                "model": response.model,
                "usage": {
                    "prompt_tokens": response.usage.prompt_tokens,
                    "completion_tokens": response.usage.completion_tokens,
                    "total_tokens": response.usage.total_tokens
                },
                "finish_reason": response.choices[0].finish_reason
            }
            
            logger.info(
                f"✅ {self.provider_name} generation completed: "
                f"{result['usage']['total_tokens']} tokens, "
                f"finish_reason: {result['finish_reason']}"
            )
            return result
            
        except Exception as e:
            error_msg = str(e).lower()
            
            # Check for rate limit errors
            if "rate limit" in error_msg or "429" in error_msg or "quota" in error_msg:
                logger.error(f"❌ {self.provider_name} rate limit exceeded: {str(e)}")
                raise LLMRateLimitError(f"Rate limit exceeded for {self.provider_name}: {str(e)}")
            
            # Check for connection errors
            if any(term in error_msg for term in ["connection", "timeout", "network", "unreachable"]):
                logger.error(f"❌ {self.provider_name} connection error: {str(e)}")
                raise LLMConnectionError(f"Connection failed for {self.provider_name}: {str(e)}")
            
            # Generic error
            logger.error(f"❌ {self.provider_name} generation error: {str(e)}")
            raise LLMProviderError(f"{self.provider_name} error: {str(e)}")
    
    async def validate_connection(self) -> bool:
        """Validate provider connection"""
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": "test"}],
                max_tokens=5
            )
            logger.info(f"✅ {self.provider_name} connection validated successfully")
            return True
        except Exception as e:
            logger.error(f"❌ {self.provider_name} connection validation failed: {str(e)}")
            return False


class OpenAIProvider(OpenAICompatibleProvider):
    """OpenAI GPT provider"""
    
    def __init__(self, api_key: str, model: str = "gpt-4"):
        from openai import AsyncOpenAI
        super().__init__(api_key, model, AsyncOpenAI)


class GroqProvider(OpenAICompatibleProvider):
    """Groq provider with Llama, Mixtral, and Gemma models"""
    
    def __init__(self, api_key: str, model: str = "llama-3.3-70b-versatile"):
        from groq import AsyncGroq
        super().__init__(api_key, model, AsyncGroq)


class AnthropicProvider(BaseLLMProvider):
    """Anthropic Claude provider"""
    
    def __init__(self, api_key: str, model: str = "claude-3-5-sonnet-20241022"):
        super().__init__(api_key, model)
        try:
            from anthropic import AsyncAnthropic
            self.client = AsyncAnthropic(api_key=self.api_key, timeout=REQUEST_TIMEOUT)
            logger.info(f"✅ Initialized Anthropic provider with model: {self.model}")
        except ImportError as e:
            logger.error(f"❌ Anthropic package not installed: {str(e)}")
            raise LLMConnectionError("Anthropic package not installed")
    
    @retry_on_failure(max_retries=MAX_RETRIES)
    async def generate(
        self,
        prompt: str,
        temperature: float = 0.2,
        max_tokens: int = 4000,
        **kwargs
    ) -> LLMResponse:
        """Generate response using Anthropic Claude"""
        # Validate inputs
        validate_generation_params(prompt, temperature, max_tokens)
        
        try:
            response = await self.client.messages.create(
                model=self.model,
                max_tokens=max_tokens,
                temperature=temperature,
                system=SYSTEM_PROMPT,
                messages=[{"role": "user", "content": prompt}],
                **kwargs
            )
            
            result: LLMResponse = {
                "content": response.content[0].text if response.content else "",
                "model": response.model,
                "usage": {
                    "prompt_tokens": response.usage.input_tokens,
                    "completion_tokens": response.usage.output_tokens,
                    "total_tokens": response.usage.input_tokens + response.usage.output_tokens
                },
                "finish_reason": response.stop_reason or "completed"
            }
            
            logger.info(
                f"✅ Anthropic generation completed: "
                f"{result['usage']['total_tokens']} tokens, "
                f"finish_reason: {result['finish_reason']}"
            )
            return result
            
        except Exception as e:
            error_msg = str(e).lower()
            
            # Check for rate limit errors
            if "rate limit" in error_msg or "429" in error_msg or "overload" in error_msg:
                logger.error(f"❌ Anthropic rate limit exceeded: {str(e)}")
                raise LLMRateLimitError(f"Rate limit exceeded for Anthropic: {str(e)}")
            
            # Check for connection errors
            if any(term in error_msg for term in ["connection", "timeout", "network"]):
                logger.error(f"❌ Anthropic connection error: {str(e)}")
                raise LLMConnectionError(f"Connection failed for Anthropic: {str(e)}")
            
            logger.error(f"❌ Anthropic generation error: {str(e)}")
            raise LLMProviderError(f"Anthropic error: {str(e)}")
    
    async def validate_connection(self) -> bool:
        """Validate Anthropic connection"""
        try:
            response = await self.client.messages.create(
                model=self.model,
                max_tokens=5,
                messages=[{"role": "user", "content": "test"}]
            )
            logger.info("✅ Anthropic connection validated successfully")
            return True
        except Exception as e:
            logger.error(f"❌ Anthropic connection validation failed: {str(e)}")
            return False


class GoogleProvider(BaseLLMProvider):
    """Google Gemini provider"""

    def __init__(self, api_key: str, model: str = None):
        model_to_use = model or getattr(settings, 'GEMINI_MODEL', 'gemini-1.5-flash')
        super().__init__(api_key, model_to_use)
        try:
            import google.generativeai as genai
            genai.configure(api_key=self.api_key)
            self.client = genai.GenerativeModel(self.model)
            logger.info(f"✅ Initialized Google provider with model: {self.model}")
        except ImportError as e:
            logger.error(f"❌ Google Generative AI package not installed: {str(e)}")
            raise LLMConnectionError("Google Generative AI package not installed")
    
    @retry_on_failure(max_retries=MAX_RETRIES)
    async def generate(
        self,
        prompt: str,
        temperature: float = 0.2,
        max_tokens: int = 4000,
        **kwargs
    ) -> LLMResponse:
        """Generate response using Google Gemini"""
        # Validate inputs
        validate_generation_params(prompt, temperature, max_tokens)
        
        try:
            # Add system context to the prompt
            full_prompt = f"{SYSTEM_PROMPT}\n\n{prompt}"

            generation_config = {
                "temperature": temperature,
                "max_output_tokens": max_tokens,
                **kwargs
            }

            response = await self.client.generate_content_async(
                full_prompt,
                generation_config=generation_config
            )

            # Check if response has candidates and extract text safely
            if not response.candidates or len(response.candidates) == 0:
                logger.error("Google API returned no candidates. Response may be blocked.")
                raise LLMProviderError(
                    "Google API returned no candidates. "
                    "The prompt may have been blocked due to safety filters."
                )

            # Extract text from first candidate
            text_content = (
                response.candidates[0].content.parts[0].text 
                if response.candidates[0].content.parts 
                else ""
            )

            if not text_content:
                logger.error("Google API returned empty response")
                raise LLMProviderError("Google API returned empty response")

            result: LLMResponse = {
                "content": text_content,
                "model": self.model,
                "usage": {
                    "prompt_tokens": (
                        response.usage_metadata.prompt_token_count 
                        if hasattr(response, 'usage_metadata') else 0
                    ),
                    "completion_tokens": (
                        response.usage_metadata.candidates_token_count 
                        if hasattr(response, 'usage_metadata') else 0
                    ),
                    "total_tokens": (
                        response.usage_metadata.total_token_count 
                        if hasattr(response, 'usage_metadata') else 0
                    )
                },
                "finish_reason": (
                    response.candidates[0].finish_reason.name 
                    if hasattr(response.candidates[0], 'finish_reason') 
                    else "completed"
                )
            }

            logger.info(
                f"✅ Google generation completed: "
                f"{result['usage']['total_tokens']} tokens, "
                f"finish_reason: {result['finish_reason']}"
            )
            return result

        except Exception as e:
            error_msg = str(e).lower()
            
            # Check for rate limit/quota errors
            if any(term in error_msg for term in ["rate limit", "429", "quota", "resource exhausted"]):
                logger.error(f"❌ Google rate limit/quota exceeded: {str(e)}")
                raise LLMRateLimitError(f"Rate limit/quota exceeded for Google: {str(e)}")
            
            # Check for connection errors
            if any(term in error_msg for term in ["connection", "timeout", "network"]):
                logger.error(f"❌ Google connection error: {str(e)}")
                raise LLMConnectionError(f"Connection failed for Google: {str(e)}")
            
            logger.error(f"❌ Google generation error: {str(e)}")
            raise LLMProviderError(f"Google error: {str(e)}")
    
    async def validate_connection(self) -> bool:
        """Validate Google connection"""
        try:
            response = await self.client.generate_content_async("test")
            logger.info("✅ Google connection validated successfully")
            return True
        except Exception as e:
            logger.error(f"❌ Google connection validation failed: {str(e)}")
            return False


class OpenRouterProvider(BaseLLMProvider):
    """OpenRouter provider - Access to 100+ models via unified API"""

    def __init__(self, api_key: str, model: str = None):
        model_to_use = model or getattr(settings, 'OPENROUTER_MODEL', 'meta-llama/llama-3.1-70b-instruct')
        super().__init__(api_key, model_to_use)
        self.base_url = "https://openrouter.ai/api/v1"
        self.site_url = getattr(settings, 'OPENROUTER_SITE_URL', 'https://adam-ai.app')
        self.app_name = getattr(settings, 'OPENROUTER_APP_NAME', 'ADAM AI Code Generator')
        logger.info(f"✅ Initialized OpenRouter provider with model: {self.model}")
    
    @retry_on_failure(max_retries=MAX_RETRIES)
    async def generate(
        self,
        prompt: str,
        system_prompt: str = SYSTEM_PROMPT,
        temperature: float = 0.2,
        max_tokens: int = 4000
    ) -> LLMResponse:
        """Generate text using OpenRouter"""
        try:
            import httpx
            
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "HTTP-Referer": self.site_url,
                "X-Title": self.app_name,
                "Content-Type": "application/json"
            }
            
            payload = {
                "model": self.model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ],
                "temperature": temperature,
                "max_tokens": max_tokens
            }
            
            async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
                response = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers=headers,
                    json=payload
                )
                response.raise_for_status()
                data = response.json()
            
            content = data["choices"][0]["message"]["content"]
            usage = data.get("usage", {})
            
            result: LLMResponse = {
                "content": content,
                "model": self.model,
                "usage": {
                    "prompt_tokens": usage.get("prompt_tokens", 0),
                    "completion_tokens": usage.get("completion_tokens", 0),
                    "total_tokens": usage.get("total_tokens", 0)
                },
                "finish_reason": data["choices"][0].get("finish_reason", "stop")
            }
            
            logger.info(
                f"✅ OpenRouter generation completed: "
                f"{result['usage']['total_tokens']} tokens, "
                f"model: {self.model}"
            )
            return result

        except Exception as e:
            error_msg = str(e).lower()
            
            if any(term in error_msg for term in ["rate limit", "429", "quota"]):
                logger.error(f"❌ OpenRouter rate limit exceeded: {str(e)}")
                raise LLMRateLimitError(f"Rate limit exceeded for OpenRouter: {str(e)}")
            
            if any(term in error_msg for term in ["connection", "timeout", "network"]):
                logger.error(f"❌ OpenRouter connection error: {str(e)}")
                raise LLMConnectionError(f"Connection failed for OpenRouter: {str(e)}")
            
            logger.error(f"❌ OpenRouter generation error: {str(e)}")
            raise LLMProviderError(f"OpenRouter error: {str(e)}")
    
    async def validate_connection(self) -> bool:
        """Validate OpenRouter connection"""
        try:
            import httpx
            
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "HTTP-Referer": self.site_url,
                "X-Title": self.app_name
            }
            
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.get(
                    f"{self.base_url}/models",
                    headers=headers
                )
                response.raise_for_status()
            
            logger.info("✅ OpenRouter connection validated successfully")
            return True
        except Exception as e:
            logger.error(f"❌ OpenRouter connection validation failed: {str(e)}")
            return False
    
    async def get_available_models(self) -> List[Dict[str, Any]]:
        """Fetch list of available models from OpenRouter"""
        try:
            import httpx
            
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "HTTP-Referer": self.site_url,
                "X-Title": self.app_name
            }
            
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.get(
                    f"{self.base_url}/models",
                    headers=headers
                )
                response.raise_for_status()
                data = response.json()
            
            models = data.get("data", [])
            logger.info(f"✅ Fetched {len(models)} models from OpenRouter")
            return models
            
        except Exception as e:
            logger.error(f"❌ Failed to fetch OpenRouter models: {str(e)}")
            raise LLMProviderError(f"Failed to fetch models: {str(e)}")


# ============================================================================
# Ollama Provider - Local AI for Offline Mode
# ============================================================================

class OllamaProvider(BaseLLMProvider):
    """
    Local Ollama provider for secure offline AI operation.
    Connects to Ollama running on localhost - no data leaves your device.
    """
    
    def __init__(self, base_url: str = "http://localhost:11434", model: str = "llama3.2"):
        # Skip API key validation for Ollama (it's local)
        self.base_url = base_url
        self.model = model
        self.api_key = "local"  # Placeholder for interface compatibility
        self.provider_name = "ollama"
        logger.info(f"✅ Initialized Ollama provider with model: {self.model} at {self.base_url}")
    
    @retry_on_failure(max_retries=2)  # Fewer retries for local service
    async def generate(
        self,
        prompt: str,
        temperature: float = 0.2,
        max_tokens: int = 4000,
        **kwargs
    ) -> LLMResponse:
        """Generate response using local Ollama"""
        validate_generation_params(prompt, temperature, max_tokens)
        
        try:
            import httpx
            
            # Ollama API format
            payload = {
                "model": self.model,
                "prompt": f"{SYSTEM_PROMPT}\n\n{prompt}",
                "stream": False,
                "options": {
                    "temperature": temperature,
                    "num_predict": max_tokens,
                }
            }
            
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(
                    f"{self.base_url}/api/generate",
                    json=payload
                )
                response.raise_for_status()
                data = response.json()
            
            # Extract response content
            content = data.get("response", "")
            eval_count = data.get("eval_count", 0)
            prompt_count = data.get("prompt_eval_count", 0)
            
            result: LLMResponse = {
                "content": content,
                "model": self.model,
                "usage": {
                    "prompt_tokens": prompt_count,
                    "completion_tokens": eval_count,
                    "total_tokens": prompt_count + eval_count
                },
                "finish_reason": "stop" if data.get("done", False) else "incomplete"
            }
            
            logger.info(
                f"✅ Ollama generation completed: "
                f"{result['usage']['total_tokens']} tokens (local)"
            )
            return result
            
        except Exception as e:
            error_msg = str(e).lower()
            
            if any(term in error_msg for term in ["connection", "refused", "unreachable", "timeout"]):
                logger.error(f"❌ Ollama connection error: {str(e)}")
                raise LLMConnectionError(
                    f"Cannot connect to Ollama at {self.base_url}. "
                    "Make sure Ollama is running (ollama serve)"
                )
            
            if "model" in error_msg and "not found" in error_msg:
                logger.error(f"❌ Ollama model not found: {str(e)}")
                raise LLMProviderError(
                    f"Model '{self.model}' not found. "
                    f"Run 'ollama pull {self.model}' to download it."
                )
            
            logger.error(f"❌ Ollama generation error: {str(e)}")
            raise LLMProviderError(f"Ollama error: {str(e)}")
    
    async def validate_connection(self) -> bool:
        """Validate that Ollama is running locally"""
        try:
            import httpx
            
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self.base_url}/api/tags")
                response.raise_for_status()
            
            logger.info("✅ Ollama connection validated successfully")
            return True
        except Exception as e:
            logger.error(f"❌ Ollama connection validation failed: {str(e)}")
            return False
    
    async def get_available_models(self) -> List[Dict[str, Any]]:
        """Fetch list of locally available Ollama models"""
        try:
            import httpx
            
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(f"{self.base_url}/api/tags")
                response.raise_for_status()
                data = response.json()
            
            models = data.get("models", [])
            logger.info(f"✅ Fetched {len(models)} models from Ollama")
            return models
            
        except Exception as e:
            logger.error(f"❌ Failed to fetch Ollama models: {str(e)}")
            raise LLMProviderError(f"Failed to fetch Ollama models: {str(e)}")


# ============================================================================
# LLM Integration Service
# ============================================================================



class LLMIntegrationService:
    """Service for managing LLM provider interactions"""
    
    def __init__(self):
        self.providers: Dict[str, BaseLLMProvider] = {}
        self.rate_limiters: Dict[str, TokenBucketRateLimiter] = {}

        # Allow skipping provider initialization in test/dev workflows
        if os.getenv("DISABLE_LLM_PROVIDERS", "").lower() in {"1", "true", "yes"}:
            logger.info("Skipping LLM provider initialization (DISABLE_LLM_PROVIDERS enabled)")
            return

        # Initialize rate limiters for each provider
        # Groq: 30 requests/min, 14,400/day (tokens ~12,000/min based on error)
        # Google: 60 requests/min (free tier)
        self.rate_limiters = {
            'groq': TokenBucketRateLimiter(
                requests_per_minute=25,  # Conservative limit
                tokens_per_minute=10000,  # 80% of 12,000 TPM
                buffer_factor=0.8
            ),
            'google': TokenBucketRateLimiter(
                requests_per_minute=50,
                tokens_per_minute=30000,
                buffer_factor=0.8
            ),
            # OpenAI and Anthropic are paid, higher limits
            'openai': TokenBucketRateLimiter(
                requests_per_minute=200,
                tokens_per_minute=200000,
                buffer_factor=0.9
            ),
            'anthropic': TokenBucketRateLimiter(
                requests_per_minute=200,
                tokens_per_minute=200000,
                buffer_factor=0.9
            ),
            'openrouter': TokenBucketRateLimiter(
                requests_per_minute=100,
                tokens_per_minute=100000,
                buffer_factor=0.9
            )
        }
        
        self._initialize_providers()
    
    def _initialize_provider(
        self, 
        name: str, 
        provider_class: type, 
        api_key: Optional[str], 
        model: str
    ) -> None:
        """
        Initialize a single provider with error handling
        
        Args:
            name: Provider name (e.g., "groq", "openai")
            provider_class: Provider class to instantiate
            api_key: API key for the provider
            model: Model name to use
        """
        if not api_key:
            logger.debug(f"Skipping {name} provider: No API key configured")
            return
        
        try:
            self.providers[name] = provider_class(api_key=api_key, model=model)
            logger.info(f"✅ Successfully initialized {name} provider")
        except LLMValidationError as e:
            logger.error(f"❌ Validation error initializing {name} provider: {str(e)}")
        except LLMConnectionError as e:
            logger.error(f"❌ Connection error initializing {name} provider: {str(e)}")
        except Exception as e:
            logger.error(f"❌ Failed to initialize {name} provider: {str(e)}")
    
    def _initialize_providers(self):
        """Initialize available LLM providers based on API keys"""
        logger.info("🚀 Initializing LLM providers...")
        
        # Initialize Groq (Priority: Free tier with high limits)
        self._initialize_provider(
            name="groq",
            provider_class=GroqProvider,
            api_key=getattr(settings, 'GROQ_API_KEY', None),
            model=(
                getattr(settings, 'DEFAULT_MODEL') 
                if getattr(settings, 'DEFAULT_LLM_PROVIDER', '') == 'groq' 
                else 'llama-3.3-70b-versatile'
            )
        )
        
        # Initialize OpenAI
        self._initialize_provider(
            name="openai",
            provider_class=OpenAIProvider,
            api_key=settings.OPENAI_API_KEY,
            model=(
                getattr(settings, 'DEFAULT_MODEL') 
                if getattr(settings, 'DEFAULT_LLM_PROVIDER', '') == 'openai' 
                else 'gpt-4'
            )
        )
        
        # Initialize Anthropic
        self._initialize_provider(
            name="anthropic",
            provider_class=AnthropicProvider,
            api_key=settings.ANTHROPIC_API_KEY,
            model=(
                getattr(settings, 'DEFAULT_MODEL') 
                if getattr(settings, 'DEFAULT_LLM_PROVIDER', '') == 'anthropic' 
                else 'claude-3-5-sonnet-20241022'
            )
        )
        
        # Initialize Google
        self._initialize_provider(
            name="google",
            provider_class=GoogleProvider,
            api_key=settings.GOOGLE_API_KEY,
            model=(
                getattr(settings, 'GEMINI_MODEL', 'gemini-1.5-flash')
                if getattr(settings, 'DEFAULT_LLM_PROVIDER', '') == 'google' 
                else getattr(settings, 'GEMINI_MODEL', 'gemini-1.5-flash')
            )
        )
        
        # Initialize OpenRouter (Access to 100+ models)
        self._initialize_provider(
            name="openrouter",
            provider_class=OpenRouterProvider,
            api_key=getattr(settings, 'OPENROUTER_API_KEY', None),
            model=(
                getattr(settings, 'DEFAULT_MODEL') 
                if getattr(settings, 'DEFAULT_LLM_PROVIDER', '') == 'openrouter' 
                else getattr(settings, 'OPENROUTER_MODEL', 'meta-llama/llama-3.1-70b-instruct')
            )
        )
        
        # Initialize Ollama (Local AI - Always available if running)
        # No API key needed - just try to connect
        try:
            self.providers["ollama"] = OllamaProvider(
                base_url="http://localhost:11434",
                model="llama3.2"
            )
            logger.info("✅ Ollama provider registered for local AI operations")
        except Exception as e:
            logger.debug(f"Ollama provider not available: {str(e)}")
        
        # Summary of initialized providers
        cloud_providers = [p for p in self.providers.keys() if p != 'ollama']
        local_providers = ['ollama'] if 'ollama' in self.providers else []
        
        if not cloud_providers and not local_providers:
            logger.error("⚠️  WARNING: No LLM providers initialized! Please configure at least one API key in .env")
        else:
            if cloud_providers:
                logger.info(f"✅ Initialized {len(cloud_providers)} cloud provider(s): {cloud_providers}")
            if local_providers:
                logger.info(f"🔒 Local AI provider available: {local_providers}")
    
    async def generate(
        self,
        prompt: str,
        provider: str = None,
        model: Optional[str] = None,
        temperature: float = 0.2,
        max_tokens: int = 4000,
        **kwargs
    ) -> LLMResponse:
        """
        Generate response using specified LLM provider with automatic fallback
        
        Args:
            prompt: The prompt to send
            provider: Provider name (groq, openai, anthropic, google)
            model: Optional specific model override
            temperature: Temperature parameter
            max_tokens: Maximum tokens
            **kwargs: Additional provider-specific parameters
            
        Returns:
            LLMResponse dictionary with content, model, usage, and finish_reason
            
        Raises:
            LLMValidationError: If provider not available or inputs invalid
            LLMConnectionError: If connection to provider fails
            LLMRateLimitError: If all providers hit rate limits
        """
        # Determine provider to use
        provider_to_use = provider or getattr(settings, 'DEFAULT_LLM_PROVIDER', 'groq')
        
        if not self.providers:
            raise LLMValidationError(
                "No LLM providers configured. Please set up at least one API key in .env file."
            )
        
        if provider_to_use not in self.providers:
            available = list(self.providers.keys())
            raise LLMValidationError(
                f"Provider '{provider_to_use}' not available. "
                f"Available providers: {available}. "
                f"Please configure the API key in .env file."
            )
        
        # Define fallback provider priority order
        fallback_order = self._get_fallback_order(provider_to_use)
        
        last_error = None
        
        # Try primary provider first, then fallbacks
        for idx, current_provider in enumerate(fallback_order):
            if current_provider not in self.providers:
                continue
                
            llm_provider = self.providers[current_provider]
            is_fallback = idx > 0
            
            # Override model if specified (only for primary provider)
            original_model = None
            if model and not is_fallback:
                original_model = llm_provider.model
                llm_provider.model = model
                logger.debug(f"Model override: {original_model} -> {model}")
            
            try:
                if is_fallback:
                    logger.warning(f"🔄 Attempting fallback to provider: {current_provider}")
                
                # Apply rate limiting before making request
                rate_limiter = self.rate_limiters.get(current_provider)
                if rate_limiter:
                    # Estimate tokens: rough estimate based on prompt + max_tokens
                    estimated_tokens = len(prompt) // 4 + max_tokens
                    await rate_limiter.acquire(estimated_tokens)
                    
                result = await llm_provider.generate(
                    prompt=prompt,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    **kwargs
                )
                
                if is_fallback:
                    logger.info(f"✅ Fallback successful using {current_provider}")
                    
                return result
                
            except LLMRateLimitError as e:
                last_error = e
                logger.warning(f"⚠️ Rate limit hit for {current_provider}: {str(e)}")
                # Try next provider in fallback chain
                continue
                
            except (LLMConnectionError, LLMProviderError) as e:
                last_error = e
                logger.warning(f"⚠️ Error with {current_provider}: {str(e)}")
                # Try next provider in fallback chain
                continue
                
            finally:
                # Restore original model if it was overridden
                if original_model:
                    llm_provider.model = original_model
        
        # All providers failed
        error_msg = f"All providers failed. Last error: {str(last_error)}"
        logger.error(f"❌ {error_msg}")
        
        if isinstance(last_error, LLMRateLimitError):
            raise LLMRateLimitError(error_msg)
        else:
            raise LLMProviderError(error_msg)
    
    def _get_fallback_order(self, primary_provider: str) -> List[str]:
        """
        Get provider fallback order
        
        Args:
            primary_provider: The primary provider to use
            
        Returns:
            List of provider names in order of preference (primary first)
        """
        # Define fallback chains based on cost and availability
        fallback_chains = {
            'groq': ['groq', 'google', 'openai', 'anthropic', 'openrouter'],
            'google': ['google', 'groq', 'openai', 'anthropic', 'openrouter'],
            'openai': ['openai', 'groq', 'google', 'anthropic', 'openrouter'],
            'anthropic': ['anthropic', 'openai', 'groq', 'google', 'openrouter'],
            'openrouter': ['openrouter', 'groq', 'google', 'openai', 'anthropic']
        }
        
        return fallback_chains.get(primary_provider, [primary_provider])
    
    async def validate_provider(self, provider: str) -> bool:
        """
        Validate that a specific provider is accessible
        
        Args:
            provider: Provider name to validate
            
        Returns:
            True if provider is available and connection is valid
        """
        if provider not in self.providers:
            logger.warning(f"Provider '{provider}' not initialized")
            return False
        return await self.providers[provider].validate_connection()
    
    async def get_available_providers(self) -> List[str]:
        """Get list of available LLM providers"""
        return list(self.providers.keys())
    
    async def get_provider_info(self) -> Dict[str, Dict[str, Any]]:
        """Get information about all available providers"""
        info = {}
        for provider_name, provider in self.providers.items():
            info[provider_name] = {
                "model": provider.model,
                "available": True,
                "provider_class": provider.__class__.__name__
            }
        return info
    
    async def get_openrouter_models(self) -> List[Dict[str, Any]]:
        """
        Get list of available models from OpenRouter
        
        Returns:
            List of model dictionaries with id, name, pricing, context length, etc.
        """
        if 'openrouter' not in self.providers:
            raise LLMValidationError("OpenRouter provider not initialized. Please configure OPENROUTER_API_KEY in .env")
        
        provider = self.providers['openrouter']
        if not isinstance(provider, OpenRouterProvider):
            raise LLMProviderError("OpenRouter provider not properly initialized")
        
        return await provider.get_available_models()
    
    async def generate_completion(self, **kwargs) -> LLMResponse:
        """
        Backward-compatible alias for tests expecting a generate_completion method.
        """
        return await self.generate(**kwargs)


# Global service instance
llm_service = LLMIntegrationService()


def get_llm_service() -> LLMIntegrationService:
    """Get the global LLM service instance"""
    return llm_service
