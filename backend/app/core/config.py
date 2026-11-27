"""Typed application configuration loaded from environment / .env."""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/app/core/config.py -> backend/
BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    """Runtime settings.

    Values can be supplied through backend/.env or real environment variables.
    """

    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = "Saraban Play Area API"
    environment: str = "development"
    api_prefix: str = "/api"

    secret_key: str = "saraban-demo-secret-key-change-me-before-deploying-2026"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 720  # 12 hours: comfortable for a front desk

    # Absolute default keeps the SQLite file inside backend/ regardless of cwd.
    database_url: str = f"sqlite:///{(BACKEND_DIR / 'saraban.db').as_posix()}"

    cors_origins: str = (
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173"
    )
    # Optional regex for origins that are not known up front (e.g. Render
    # preview/static-site hostnames). Empty means "origins list only".
    cors_origin_regex: str = ""
    timezone: str = "Asia/Kolkata"

    # On Render's free tier the SQLite file is ephemeral. When enabled, a
    # fresh database is filled with the demo dataset during startup.
    demo_seed_on_startup: bool = False

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
