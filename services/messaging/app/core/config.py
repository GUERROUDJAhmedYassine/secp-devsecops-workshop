from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

class Settings(BaseSettings):
    """Configuration class for loading secure environment variables."""
    database_url: str = Field(..., description="PostgreSQL connection string")
    jwt_secret: str = Field(..., description="Secret for JWT token verification")
    jwt_algorithm: str = Field(default="HS256")
    access_token_expire_minutes: int = Field(default=30)
    service_name: str = Field(default="messaging")

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

settings = Settings()

# Explanation: Loads application configuration from environment variables with strong typing.
# Security note: Explicitly requires secrets (no default values) to prevent accidental insecure deployments.
