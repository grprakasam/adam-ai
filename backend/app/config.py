"""
Application Configuration Management
Handles environment variables and application settings
"""

from pydantic_settings import BaseSettings
from pydantic import ConfigDict, field_validator
from typing import Optional


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""
    
    model_config = ConfigDict(
        env_file=".env",
        env_file_encoding="utf-8"
    )
    
    # Application
    APP_NAME: str = "ADAM AI Code Generator"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    
    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    
    # CORS
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:5173"
    
    @field_validator('CORS_ORIGINS')
    @classmethod
    def parse_cors_origins(cls, v):
        """Parse comma-separated CORS origins"""
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(',')]
        return v
    
    # LLM API Keys
    OPENAI_API_KEY: Optional[str] = None
    ANTHROPIC_API_KEY: Optional[str] = None
    GOOGLE_API_KEY: Optional[str] = None
    
    # Default LLM Configuration
    DEFAULT_LLM_PROVIDER: str = "google"  # openai, anthropic, google
    DEFAULT_MODEL: str = "gemini-2.5-flash"
    DEFAULT_TEMPERATURE: float = 0.2
    DEFAULT_MAX_TOKENS: int = 4000
    
    # File Paths
    CONTENT_DIR: str = "../Content"
    CONTEXT_DIR: str = "../Context"
    RULES_DIR: str = "../Context/ADAMRules"
    
    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FILE: str = "logs/adam_ai.log"


# Global settings instance
settings = Settings()
