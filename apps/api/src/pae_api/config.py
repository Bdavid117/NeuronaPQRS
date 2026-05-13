from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(Path(__file__).parents[4] / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # LLM
    openrouter_api_key: str = "sk-or-placeholder"
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    model_intake: str = "google/gemma-3-27b-it:free"
    model_classifier: str = "google/gemma-3-12b-it:free"
    model_vision: str = "google/gemma-3-27b-it:free"
    model_resolver: str = "google/gemma-3-27b-it:free"
    model_escalator: str = "google/gemma-3-12b-it:free"

    # DB
    database_url: str = "postgresql+asyncpg://pae:pae123@localhost:5432/pae_pqrs"
    database_url_sync: str = "postgresql+psycopg2://pae:pae123@localhost:5432/pae_pqrs"

    # Vault
    vault_root: str = str(Path(__file__).parents[4] / "Neurona")

    # App
    app_env: str = "development"
    secret_key: str = "dev-secret-key-change-in-production"
    allowed_origins: str = "http://localhost:3000"
    upload_dir: str = "./uploads"
    max_upload_size_mb: int = 10
    app_url: str = "http://localhost:3000"

    # Admin
    admin_username: str = "admin"
    admin_password: str = "change-me-in-production"
    admin_token_secret: str = "admin-token-secret-change-in-production"

    @field_validator("upload_dir", mode="before")
    @classmethod
    def ensure_upload_dir(cls, v: str) -> str:
        Path(v).mkdir(parents=True, exist_ok=True)
        return v

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",")]


@lru_cache
def get_settings() -> Settings:
    return Settings()
