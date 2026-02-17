"""
Application configuration via pydantic-settings.
All values can be overridden through environment variables or a .env file.
"""

from pydantic_settings import BaseSettings
from typing import List
from functools import lru_cache


class Settings(BaseSettings):
    """Central configuration – reads from .env automatically."""

    # ── App ───────────────────────────────────────────────────────────────────
    APP_NAME: str = "AI Technical Interview Platform"
    DEBUG: bool = True
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # ── CORS ──────────────────────────────────────────────────────────────────
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://127.0.0.1:5173",
    ]

    # ── Database ──────────────────────────────────────────────────────────────
    DATABASE_URL: str = "sqlite+aiosqlite:///./interview_platform.db"

    # ── JWT / Auth ────────────────────────────────────────────────────────────
    SECRET_KEY: str = "your-secret-key-change-this-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # ── AI Provider ───────────────────────────────────────────────────────────
    # "ollama" for local development, "groq" for cloud deployment
    AI_PROVIDER: str = "ollama"

    # ── Ollama (local) ────────────────────────────────────────────────────────
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3.2:1b"
    OLLAMA_TIMEOUT: int = 120

    # ── Groq (cloud) ─────────────────────────────────────────────────────────
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.3-70b-versatile"

    # ── Interview defaults ────────────────────────────────────────────────────
    MAX_INTERVIEW_DURATION_MINUTES: int = 60
    MIN_INTERVIEW_DURATION_MINUTES: int = 15
    DEFAULT_QUESTIONS_COUNT: int = 5

    # ── Rate limiting ─────────────────────────────────────────────────────────
    RATE_LIMIT_PER_MINUTE: int = 60

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
