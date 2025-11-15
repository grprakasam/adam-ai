"""
Application Configuration Management
Handles environment variables and application settings
"""

import os
from pathlib import Path
from pydantic_settings import BaseSettings
from pydantic import ConfigDict, field_validator
from typing import Optional

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
    DEFAULT_TEMPERATURE: float = 0.2
    DEFAULT_MAX_TOKENS: int = 4000
    
    # OpenRouter Configuration
    OPENROUTER_MODEL: str = "meta-llama/llama-3.1-70b-instruct"  # Default model
    OPENROUTER_SITE_URL: str = "https://adam-ai.app"  # Your site URL for OpenRouter
    OPENROUTER_APP_NAME: str = "ADAM AI Code Generator"  # Your app name
    
    # Gemini Configuration (using stable model instead of experimental)
    GEMINI_MODEL: str = "gemini-1.5-flash"  # Stable, fast, and cost-effective
    GEMINI_TEMPERATURE: float = 0.2
    GEMINI_MAX_TOKENS: int = 2048
    
    # Code Generation Configuration
    BATCH_SIZE: int = 10
    MAX_CONCURRENT_REQUESTS: int = 5
    REQUEST_TIMEOUT: int = 30
    CACHE_TTL: int = 3600  # 1 hour
    
    # File Paths
    CONTENT_DIR: str = "../Content"
    CONTEXT_DIR: str = "../Context"
    RULES_DIR: str = "../Context/ADAMRules"
    
    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FILE: str = "logs/adam_ai.log"


# Global settings instance
settings = Settings()

# Debug logging to verify .env file is loaded
print(f"CONFIG: Loading .env from: {ENV_FILE}")
print(f"CONFIG: .env file exists: {ENV_FILE.exists()}")
if settings.OPENROUTER_API_KEY:
    print(f"CONFIG: OPENROUTER_API_KEY loaded ({len(settings.OPENROUTER_API_KEY)} chars)")
else:
    print(f"CONFIG: OPENROUTER_API_KEY not loaded!")
