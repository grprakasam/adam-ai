"""
LLM Integration Service
Manages interactions with OpenAI, Anthropic, and Google LLM providers
"""

from typing import Optional, Dict, Any, List
from abc import ABC, abstractmethod
from loguru import logger

from app.config import settings


class BaseLLMProvider(ABC):
    """Abstract base class for LLM providers"""
    
    def __init__(self, api_key: str, model: str):
        self.api_key = api_key
        self.model = model
    
    @abstractmethod
    async def generate(
        self,
        prompt: str,
        temperature: float = 0.2,
        max_tokens: int = 4000,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Generate response from LLM
        
        Args:
            prompt: The prompt to send to the LLM
            temperature: Temperature parameter for generation
            max_tokens: Maximum tokens in response
            **kwargs: Additional provider-specific parameters
            
        Returns:
            Dictionary with response and metadata
        """
        pass
    
    @abstractmethod
    async def validate_connection(self) -> bool:
        """Validate that the provider is accessible"""
        pass


class OpenAIProvider(BaseLLMProvider):
    """OpenAI GPT provider"""
    
    def __init__(self, api_key: str, model: str = "gpt-4"):
        super().__init__(api_key, model)
        try:
            from openai import AsyncOpenAI
            self.client = AsyncOpenAI(api_key=self.api_key)
            logger.info(f"Initialized OpenAI provider with model: {self.model}")
        except ImportError:
            logger.error("OpenAI package not installed")
            raise
    
    async def generate(
        self,
        prompt: str,
        temperature: float = 0.2,
        max_tokens: int = 4000,
        **kwargs
    ) -> Dict[str, Any]:
        """Generate response using OpenAI GPT"""
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are an expert R programmer specializing in clinical trial ADAM datasets following CDISC standards."},
                    {"role": "user", "content": prompt}
                ],
                temperature=temperature,
                max_tokens=max_tokens,
                **kwargs
            )
            
            result = {
                "content": response.choices[0].message.content,
                "model": response.model,
                "usage": {
                    "prompt_tokens": response.usage.prompt_tokens,
                    "completion_tokens": response.usage.completion_tokens,
                    "total_tokens": response.usage.total_tokens
                },
                "finish_reason": response.choices[0].finish_reason
            }
            
            logger.info(f"OpenAI generation completed: {result['usage']['total_tokens']} tokens")
            return result
            
        except Exception as e:
            logger.error(f"OpenAI generation error: {str(e)}")
            raise
    
    async def validate_connection(self) -> bool:
        """Validate OpenAI connection"""
        try:
            # Make a minimal API call to test connection
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": "test"}],
                max_tokens=5
            )
            logger.info("OpenAI connection validated")
            return True
        except Exception as e:
            logger.error(f"OpenAI connection validation failed: {str(e)}")
            return False


class AnthropicProvider(BaseLLMProvider):
    """Anthropic Claude provider"""
    
    def __init__(self, api_key: str, model: str = "claude-3-5-sonnet-20241022"):
        super().__init__(api_key, model)
        try:
            from anthropic import AsyncAnthropic
            self.client = AsyncAnthropic(api_key=self.api_key)
            logger.info(f"Initialized Anthropic provider with model: {self.model}")
        except ImportError:
            logger.error("Anthropic package not installed")
            raise
    
    async def generate(
        self,
        prompt: str,
        temperature: float = 0.2,
        max_tokens: int = 4000,
        **kwargs
    ) -> Dict[str, Any]:
        """Generate response using Anthropic Claude"""
        try:
            response = await self.client.messages.create(
                model=self.model,
                max_tokens=max_tokens,
                temperature=temperature,
                system="You are an expert R programmer specializing in clinical trial ADAM datasets following CDISC standards.",
                messages=[
                    {"role": "user", "content": prompt}
                ],
                **kwargs
            )
            
            result = {
                "content": response.content[0].text,
                "model": response.model,
                "usage": {
                    "prompt_tokens": response.usage.input_tokens,
                    "completion_tokens": response.usage.output_tokens,
                    "total_tokens": response.usage.input_tokens + response.usage.output_tokens
                },
                "finish_reason": response.stop_reason
            }
            
            logger.info(f"Anthropic generation completed: {result['usage']['total_tokens']} tokens")
            return result
            
        except Exception as e:
            logger.error(f"Anthropic generation error: {str(e)}")
            raise
    
    async def validate_connection(self) -> bool:
        """Validate Anthropic connection"""
        try:
            response = await self.client.messages.create(
                model=self.model,
                max_tokens=5,
                messages=[{"role": "user", "content": "test"}]
            )
            logger.info("Anthropic connection validated")
            return True
        except Exception as e:
            logger.error(f"Anthropic connection validation failed: {str(e)}")
            return False


class GoogleProvider(BaseLLMProvider):
    """Google Gemini provider"""

    def __init__(self, api_key: str, model: str = None):
        # default model will be provided by settings.DEFAULT_MODEL when constructing
        model_to_use = model or getattr(settings, 'DEFAULT_MODEL', 'gemini-pro')
        super().__init__(api_key, model_to_use)
        try:
            import google.generativeai as genai
            genai.configure(api_key=self.api_key)
            self.client = genai.GenerativeModel(self.model)
            logger.info(f"Initialized Google provider with model: {self.model}")
        except ImportError:
            logger.error("Google Generative AI package not installed")
            raise
    
    async def generate(
        self,
        prompt: str,
        temperature: float = 0.2,
        max_tokens: int = 4000,
        **kwargs
    ) -> Dict[str, Any]:
        """Generate response using Google Gemini"""
        try:
            # Add system context to the prompt
            full_prompt = (
                "You are an expert R programmer specializing in clinical trial ADAM datasets "
                "following CDISC standards.\n\n" + prompt
            )

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
                raise ValueError("Google API returned no candidates. The prompt may have been blocked due to safety filters.")

            # Extract text from first candidate
            text_content = response.candidates[0].content.parts[0].text if response.candidates[0].content.parts else ""

            if not text_content:
                logger.error("Google API returned empty response")
                raise ValueError("Google API returned empty response")

            result = {
                "content": text_content,
                "model": self.model,
                "usage": {
                    "prompt_tokens": response.usage_metadata.prompt_token_count if hasattr(response, 'usage_metadata') else 0,
                    "completion_tokens": response.usage_metadata.candidates_token_count if hasattr(response, 'usage_metadata') else 0,
                    "total_tokens": response.usage_metadata.total_token_count if hasattr(response, 'usage_metadata') else 0
                },
                "finish_reason": response.candidates[0].finish_reason.name if hasattr(response.candidates[0], 'finish_reason') else "completed"
            }

            logger.info(f"Google generation completed: {result['usage']['total_tokens']} tokens")
            return result

        except Exception as e:
            logger.error(f"Google generation error: {str(e)}")
            raise
    
    async def validate_connection(self) -> bool:
        """Validate Google connection"""
        try:
            response = await self.client.generate_content_async("test")
            logger.info("Google connection validated")
            return True
        except Exception as e:
            logger.error(f"Google connection validation failed: {str(e)}")
            return False


class LLMIntegrationService:
    """Service for managing LLM provider interactions"""
    
    def __init__(self):
        self.providers: Dict[str, BaseLLMProvider] = {}
        self._initialize_providers()
    
    def _initialize_providers(self):
        """Initialize available LLM providers based on API keys"""
        
        # Initialize OpenAI
        if settings.OPENAI_API_KEY:
            try:
                self.providers["openai"] = OpenAIProvider(
                    api_key=settings.OPENAI_API_KEY,
                    model=(getattr(settings, 'DEFAULT_MODEL') if getattr(settings, 'DEFAULT_LLM_PROVIDER', 'openai') == 'openai' else 'gpt-4')
                )
            except Exception as e:
                logger.error(f"Failed to initialize OpenAI provider: {str(e)}")
        
        # Initialize Anthropic
        if settings.ANTHROPIC_API_KEY:
            try:
                self.providers["anthropic"] = AnthropicProvider(
                    api_key=settings.ANTHROPIC_API_KEY,
                    model=(getattr(settings, 'DEFAULT_MODEL') if getattr(settings, 'DEFAULT_LLM_PROVIDER', '') == 'anthropic' else 'claude-3-5-sonnet-20241022')
                )
            except Exception as e:
                logger.error(f"Failed to initialize Anthropic provider: {str(e)}")
        
        # Initialize Google
        if settings.GOOGLE_API_KEY:
            try:
                self.providers["google"] = GoogleProvider(
                    api_key=settings.GOOGLE_API_KEY,
                    model=(getattr(settings, 'DEFAULT_MODEL') if getattr(settings, 'DEFAULT_LLM_PROVIDER', '') == 'google' else 'gemini-pro')
                )
            except Exception as e:
                logger.error(f"Failed to initialize Google provider: {str(e)}")
        
        logger.info(f"Initialized {len(self.providers)} LLM providers: {list(self.providers.keys())}")
    
    async def generate(
        self,
        prompt: str,
        provider: str = None,
        model: Optional[str] = None,
        temperature: float = 0.2,
        max_tokens: int = 4000,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Generate response using specified LLM provider
        
        Args:
            prompt: The prompt to send
            provider: Provider name (openai, anthropic, google)
            model: Optional specific model override
            temperature: Temperature parameter
            max_tokens: Maximum tokens
            **kwargs: Additional provider-specific parameters
            
        Returns:
            Generation result dictionary
        """
        # If provider not specified, fall back to default from settings
        provider_to_use = provider or getattr(settings, 'DEFAULT_LLM_PROVIDER', 'openai')
        if provider_to_use not in self.providers:
            raise ValueError(f"Provider '{provider_to_use}' not available. Available: {list(self.providers.keys())}")
        
        llm_provider = self.providers[provider_to_use]
        
        # Override model if specified
        # Override model if specified, otherwise keep provider default
        if model:
            llm_provider.model = model
        
        return await llm_provider.generate(
            prompt=prompt,
            temperature=temperature,
            max_tokens=max_tokens,
            **kwargs
        )
    
    async def validate_provider(self, provider: str) -> bool:
        """Validate that a specific provider is accessible"""
        if provider not in self.providers:
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
                "available": True
            }
        return info


# Global service instance
llm_service = LLMIntegrationService()
