"""
Environment Configuration Management
Centralized configuration using Pydantic Settings
"""

from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache
from typing import Optional


class Settings(BaseSettings):
    """
    Application configuration loaded from environment variables
    
    Usage:
        from app.config_secure import get_settings
        
        settings = get_settings()
        api_key = settings.groq_api_key
    """
    
    # Application Settings
    app_name: str = "ADAM AI Code Generator"
    app_version: str = "1.0.0"
    environment: str = "development"  # development, staging, production
    debug: bool = False
    
    # Server Configuration
    host: str = "0.0.0.0"
    port: int = 8000
    reload: bool = True
    workers: int = 4
    
    # Security Settings
    secret_key: str = "CHANGE-THIS-SECRET-KEY-IN-PRODUCTION"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 480  # 8 hours
    
    # Database Configuration
    database_url: Optional[str] = None  # postgresql://user:pass@localhost/dbname
    database_pool_size: int = 10
    database_max_overflow: int = 20
    
    # LLM Provider API Keys
    groq_api_key: Optional[str] = None
    openai_api_key: Optional[str] = None
    anthropic_api_key: Optional[str] = None
    google_api_key: Optional[str] = None
    openrouter_api_key: Optional[str] = None
    
    # LLM Configuration
    default_llm_provider: str = "groq"
    default_model: Optional[str] = None
    max_tokens: int = 4000
    temperature: float = 0.2
    
    # Cache Configuration
    cache_enabled: bool = True
    cache_ttl: int = 3600  # 1 hour
    cache_max_size: int = 1000
    redis_url: Optional[str] = None  # redis://localhost:6379/0
    
    # Rate Limiting
    rate_limit_enabled: bool = True
    rate_limit_requests_per_minute: int = 60
    rate_limit_max_concurrent: int = 10
    rate_limit_burst_size: int = 20
    
    # Performance Settings
    batch_size: int = 10
    max_concurrent_requests: int = 5
    request_timeout: int = 300  # 5 minutes
    
    # Logging Configuration
    log_level: str = "INFO"  # DEBUG, INFO, WARNING, ERROR, CRITICAL
    log_format: str = "json"  # json, text
    log_file: Optional[str] = None
    
    # CORS Configuration
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:5174"]
    cors_allow_credentials: bool = True
    cors_allow_methods: list[str] = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    cors_allow_headers: list[str] = ["*"]
    
    # File Upload Configuration
    max_file_size: int = 10 * 1024 * 1024  # 10 MB
    allowed_file_extensions: list[str] = [".xlsx", ".xls", ".csv", ".pdf", ".docx"]
    upload_dir: str = "./uploads"
    
    # Feature Flags
    enable_bulk_generation: bool = True
    enable_code_validation: bool = True
    enable_caching: bool = True
    enable_batch_processing: bool = True
    enable_review_workflow: bool = True
    
    # Monitoring & Observability
    sentry_dsn: Optional[str] = None
    enable_metrics: bool = False
    metrics_port: int = 9090
    
    # Email Configuration (for notifications)
    smtp_host: Optional[str] = None
    smtp_port: int = 587
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None
    smtp_from_email: Optional[str] = None
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )
    
    def is_production(self) -> bool:
        """Check if running in production environment"""
        return self.environment.lower() == "production"
    
    def is_development(self) -> bool:
        """Check if running in development environment"""
        return self.environment.lower() == "development"
    
    def validate_production_settings(self) -> list[str]:
        """
        Validate that production-critical settings are configured
        
        Returns:
            List of validation errors (empty if valid)
        """
        errors = []
        
        if not self.is_production():
            return errors
        
        # Check secret key
        if self.secret_key == "CHANGE-THIS-SECRET-KEY-IN-PRODUCTION":
            errors.append("SECRET_KEY must be changed in production")
        
        # Check database
        if not self.database_url:
            errors.append("DATABASE_URL must be configured in production")
        
        # Check at least one LLM API key
        if not any([
            self.groq_api_key,
            self.openai_api_key,
            self.anthropic_api_key,
            self.google_api_key,
            self.openrouter_api_key
        ]):
            errors.append("At least one LLM API key must be configured")
        
        # Check CORS origins
        if "http://localhost" in str(self.cors_origins):
            errors.append("CORS origins should not include localhost in production")
        
        # Check debug mode
        if self.debug:
            errors.append("DEBUG should be False in production")
        
        # Check logging
        if not self.log_file:
            errors.append("LOG_FILE should be configured in production")
        
        return errors


@lru_cache()
def get_settings() -> Settings:
    """
    Get cached settings instance
    
    The settings are cached using lru_cache to avoid
    reading from environment/file on every access
    """
    return Settings()


def validate_settings():
    """
    Validate settings on startup
    
    Usage:
        from app.config_secure import validate_settings
        
        validate_settings()  # Raises error if invalid
    """
    settings = get_settings()
    
    if settings.is_production():
        errors = settings.validate_production_settings()
        if errors:
            error_msg = "\n".join([f"  - {err}" for err in errors])
            raise ValueError(
                f"Production configuration errors:\n{error_msg}"
            )


# Example usage in main.py
if __name__ == "__main__":
    settings = get_settings()
    
    print(f"Environment: {settings.environment}")
    print(f"Debug: {settings.debug}")
    print(f"Default LLM: {settings.default_llm_provider}")
    
    # Validate production settings
    if settings.is_production():
        try:
            validate_settings()
            print("✅ Production settings valid")
        except ValueError as e:
            print(f"❌ Production settings invalid:\n{e}")
