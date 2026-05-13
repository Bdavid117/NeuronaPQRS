from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(Path(__file__).parents[4] / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # LLM — NVIDIA NIM
    nvidia_api_key: str = "nvapi-placeholder"
    nvidia_base_url: str = "https://integrate.api.nvidia.com/v1"
    model_intake: str = "meta/llama-4-maverick-17b-128e-instruct"
    model_classifier: str = "meta/llama-4-maverick-17b-128e-instruct"
    model_vision: str = "meta/llama-4-maverick-17b-128e-instruct"
    model_resolver: str = "mistralai/mistral-large-3-675b-instruct-2512"
    model_escalator: str = "meta/llama-4-maverick-17b-128e-instruct"
    model_embeddings: str = "nvidia/llama-3.2-nv-embedqa-1b-v2"

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

    @model_validator(mode="after")
    def check_production_secrets(self) -> "Settings":
        if self.app_env != "development":
            insecure_markers = ("change", "change-me", "secret-change", "placeholder")
            for field_name in ("admin_password", "admin_token_secret"):
                val = getattr(self, field_name, "")
                if any(marker in val for marker in insecure_markers):
                    raise ValueError(
                        f"{field_name} must be changed from its default before running in a non-development environment"
                    )
        return self

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",")]


@lru_cache
def get_settings() -> Settings:
    return Settings()
