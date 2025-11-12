"""
Google Gemini API Client

Handles communication with Google Gemini AI for code generation.
Includes rate limiting, retry logic, and error handling.
"""

import asyncio
import time
from typing import Optional, Dict, Any
from loguru import logger
import google.generativeai as genai
from google.generativeai.types import GenerationConfig


class RateLimiter:
    """Simple rate limiter for API calls"""
    
    def __init__(self, max_calls: int = 60, period: int = 60):
        self.max_calls = max_calls
        self.period = period
        self.calls = []
    
    async def acquire(self):
        """Wait if necessary to respect rate limits"""
        now = time.time()
        # Remove old calls outside the time window
        self.calls = [call_time for call_time in self.calls if now - call_time < self.period]
        
        if len(self.calls) >= self.max_calls:
            # Need to wait
            sleep_time = self.period - (now - self.calls[0])
            if sleep_time > 0:
                logger.info(f"Rate limit reached, waiting {sleep_time:.2f}s")
                await asyncio.sleep(sleep_time)
                self.calls = []
        
        self.calls.append(now)


class GeminiClient:
    """Client for Google Gemini API"""
    
    def __init__(
        self,
        api_key: str,
        model: str = "gemini-2.0-flash-exp",
        max_retries: int = 3,
        timeout: int = 30
    ):
        """
        Initialize Gemini client
        
        Args:
            api_key: Google Gemini API key
            model: Model name to use
            max_retries: Maximum number of retry attempts
            timeout: Request timeout in seconds
        """
        self.api_key = api_key
        self.model = model
        self.max_retries = max_retries
        self.timeout = timeout
        self.rate_limiter = RateLimiter(max_calls=60, period=60)
        
        # Configure Gemini
        genai.configure(api_key=api_key)
        self.client = genai.GenerativeModel(model)
        
        logger.info(f"Initialized Gemini client with model: {model}")
    
    async def generate_code(
        self,
        prompt: str,
        language: str,
        temperature: float = 0.2,
        max_tokens: int = 2048
    ) -> str:
        """
        Generate code using Gemini
        
        Args:
            prompt: The prompt to send to Gemini
            language: Programming language (R or SAS)
            temperature: Sampling temperature (0-1)
            max_tokens: Maximum tokens to generate
            
        Returns:
            Generated code snippet
            
        Raises:
            Exception: If generation fails after all retries
        """
        for attempt in range(self.max_retries):
            try:
                # Wait for rate limit
                await self.rate_limiter.acquire()
                
                # Configure generation
                generation_config = GenerationConfig(
                    temperature=temperature,
                    max_output_tokens=max_tokens,
                    candidate_count=1
                )
                
                # Generate response
                logger.debug(f"Sending request to Gemini (attempt {attempt + 1})")
                start_time = time.time()
                
                response = await asyncio.wait_for(
                    asyncio.to_thread(
                        self.client.generate_content,
                        prompt,
                        generation_config=generation_config
                    ),
                    timeout=self.timeout
                )
                
                latency = (time.time() - start_time) * 1000  # ms
                
                if not response or not response.text:
                    raise ValueError("Empty response from Gemini")
                
                generated_text = response.text.strip()
                
                # Clean up code blocks if present
                generated_text = self._clean_code_response(generated_text, language)
                
                logger.info(f"Successfully generated {language} code (latency: {latency:.0f}ms)")
                return generated_text
                
            except asyncio.TimeoutError:
                logger.warning(f"Request timeout on attempt {attempt + 1}")
                if attempt == self.max_retries - 1:
                    raise Exception(f"Request timed out after {self.max_retries} attempts")
                await asyncio.sleep(2 ** attempt)  # Exponential backoff
                
            except Exception as e:
                logger.error(f"Generation failed on attempt {attempt + 1}: {str(e)}")
                if attempt == self.max_retries - 1:
                    raise Exception(f"Code generation failed: {str(e)}")
                await asyncio.sleep(2 ** attempt)  # Exponential backoff
        
        raise Exception("Code generation failed after all retries")
    
    def _clean_code_response(self, text: str, language: str) -> str:
        """Clean up code response by removing markdown code blocks"""
        # Remove markdown code fences
        if "```" in text:
            # Extract code from markdown blocks
            parts = text.split("```")
            for i, part in enumerate(parts):
                if i % 2 == 1:  # Odd indices are code blocks
                    # Remove language identifier if present
                    lines = part.strip().split("\n")
                    if lines and lines[0].lower() in ["r", "sas", "python"]:
                        return "\n".join(lines[1:])
                    return part.strip()
        return text
    
    async def generate_text(
        self,
        prompt: str,
        temperature: float = 0.3,
        max_tokens: int = 512
    ) -> str:
        """
        Generate text (for rationale, explanations, etc.)
        
        Args:
            prompt: The prompt to send to Gemini
            temperature: Sampling temperature (0-1)
            max_tokens: Maximum tokens to generate
            
        Returns:
            Generated text
        """
        return await self.generate_code(
            prompt=prompt,
            language="text",
            temperature=temperature,
            max_tokens=max_tokens
        )
    
    def get_usage_stats(self) -> Dict[str, Any]:
        """Get API usage statistics"""
        return {
            "model": self.model,
            "recent_calls": len(self.rate_limiter.calls),
            "rate_limit": f"{self.rate_limiter.max_calls}/{self.rate_limiter.period}s"
        }
