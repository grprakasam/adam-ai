"""
Application Configuration Management
Handles environment variables and application settings
"""

from pathlib import Path
from pydantic_settings import BaseSettings
from pydantic import ConfigDict, Field, field_validator
from typing import Optional
import logging

logger = logging.getLogger(__name__)

# Get the absolute path to the backend directory
BACKEND_DIR = Path(__file__).resolve().parent.parent
ENV_FILE = BACKEND_DIR / ".env"


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""
    
    model_config = ConfigDict(
        env_file=str(ENV_FILE),
        env_file_encoding="utf-8",
        case_sensitive=True
    )
    
    # Application
    APP_NAME: str = "ADAM AI Code Generator"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    
    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    
    # CORS
    CORS_ORIGINS: str = "http://localhost:3000,https://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001,http://localhost:3002,http://127.0.0.1:3002,http://localhost:5173,https://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,https://localhost:4173,http://127.0.0.1:4173,http://localhost:4174,https://localhost:4174,http://127.0.0.1:4174"
    
    @field_validator('CORS_ORIGINS')
    @classmethod
    def parse_cors_origins(cls, v):
        """Parse comma-separated CORS origins"""
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(',')]
        return v
    
    # LLM API Keys
    GROQ_API_KEY: Optional[str] = None  # Free tier: 30 req/min, 14,400 req/day
    OPENAI_API_KEY: Optional[str] = None
    ANTHROPIC_API_KEY: Optional[str] = None
    GOOGLE_API_KEY: Optional[str] = None
    GEMINI_API_KEY: Optional[str] = None  # Primary key for Gemini
    OPENROUTER_API_KEY: Optional[str] = None  # Access to 100+ models
    
    # Default LLM Configuration
    DEFAULT_LLM_PROVIDER: str = "groq"  # groq, openai, anthropic, google, openrouter
    DEFAULT_MODEL: str = "llama-3.3-70b-versatile"  # Groq's fastest 70B model
    DEFAULT_TEMPERATURE: float = 0.3  # Slightly higher for faster generation
    DEFAULT_MAX_TOKENS: int = 400  # OPTIMIZED: Reduced from 800 to 400 for 2x faster responses

    # OpenRouter Configuration
    OPENROUTER_MODEL: str = "meta-llama/llama-3.1-70b-instruct"  # Default model
    OPENROUTER_SITE_URL: str = "https://adam-ai.app"  # Your site URL for OpenRouter
    OPENROUTER_APP_NAME: str = "ADAM AI Code Generator"  # Your app name

    # Gemini Configuration (using fast experimental model for speed)
    GEMINI_MODEL: str = "gemini-2.0-flash-exp"  # Fast experimental model for best speed
    GEMINI_TEMPERATURE: float = 0.3  # Slightly higher for faster generation
    GEMINI_MAX_TOKENS: int = 400  # OPTIMIZED: Reduced from 800 to 400 for 2x faster responses
    
    # Code Generation Configuration - OPTIMIZED for speed
    BATCH_SIZE: int = 25  # OPTIMIZED: Increased from 10 to 25 for 2.5x fewer API calls
    MAX_CONCURRENT_REQUESTS: int = 15  # OPTIMIZED: Increased from 5 to 15 for 3x parallel processing
    REQUEST_TIMEOUT: int = 45  # Slightly increased for reliability
    CACHE_TTL: int = 3600  # 1 hour
    
    # File Paths
    CONTENT_DIR: str = "../Content"
    CONTEXT_DIR: str = "../Context"
    RULES_DIR: str = "../Context/ADAMRules"
    
    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FILE: str = "logs/adam_ai.log"
    
    # Security
    SECRET_KEY: str = Field(
        default="dev-secret-key-change-me",
        min_length=16,
        description="JWT signing key loaded from environment; override in production",
    )


# Global settings instance
settings = Settings()

# Debug logging to verify .env file is loaded
logger.info(f"CONFIG: Loading .env from: {ENV_FILE}")
logger.info(f"CONFIG: .env file exists: {ENV_FILE.exists()}")
if settings.OPENROUTER_API_KEY:
    logger.info(f"CONFIG: OPENROUTER_API_KEY loaded ({len(settings.OPENROUTER_API_KEY)} chars)")
else:
    logger.warning(f"CONFIG: OPENROUTER_API_KEY not loaded!")
