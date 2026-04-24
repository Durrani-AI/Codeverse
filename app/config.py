"""
Application configuration via pydantic-settings.
All values can be overridden through environment variables or a .env file.
"""

import logging
import secrets
from functools import lru_cache
from typing import List

import json
from pydantic_settings import BaseSettings

logger = logging.getLogger(__name__)

_INSECURE_KEY_MARKERS = (
    "your-secret-key",
    "your-super-secret",
    "change-this",
    "changeme",
    "secret",
)


class Settings(BaseSettings):
    """Central configuration object for the platform.

    Reads from environment variables and .env file automatically.
    Supports both local (Ollama) and cloud (Groq) AI providers.
    """

    # App
    APP_NAME: str = "Codeverse"
    DEBUG: bool = True
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # CORS - stored as a plain string so pydantic-settings never tries JSON-parsing.
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://localhost:3001,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:3001,http://127.0.0.1:5173,https://ai-codeverse.vercel.app"

    def get_cors_origins(self) -> List[str]:
        """Parse ALLOWED_ORIGINS string into a list.

        Accepts:
        - JSON array:       '["http://a.com", "http://b.com"]'
        - Comma-separated:  'http://a.com,http://b.com'
        - Single value:     '*' or 'https://myapp.vercel.app'
        """
        v = self.ALLOWED_ORIGINS.strip()
        if v.startswith("["):
            try:
                return json.loads(v)
            except json.JSONDecodeError:
                pass
        if "," in v:
            return [s.strip() for s in v.split(",") if s.strip()]
        return [v] if v else []

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./interview_platform.db"

    # JWT / Auth
    SECRET_KEY: str = "your-secret-key-change-this-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # CSRF
    CSRF_SECRET: str = ""  # auto-generated at startup if empty

    # Cookie settings
    COOKIE_SECURE: bool = True     # True in production (HTTPS)
    COOKIE_SAMESITE: str = "none"  # "none" for cross-origin, "lax" for same-origin
    COOKIE_DOMAIN: str = ""        # empty = default to response domain

    # AI Provider - "ollama" for local development, "groq" for cloud deployment
    AI_PROVIDER: str = "ollama"

    # Ollama (local)
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3.2:1b"
    OLLAMA_TIMEOUT: int = 120

    # Groq (cloud)
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.3-70b-versatile"

    # Monitoring
    SENTRY_DSN: str = ""

    # Interview defaults
    MAX_INTERVIEW_DURATION_MINUTES: int = 60
    MIN_INTERVIEW_DURATION_MINUTES: int = 15
    DEFAULT_QUESTIONS_COUNT: int = 5

    # Rate limiting (per-minute)
    RATE_LIMIT_PER_MINUTE: int = 60         # general endpoints
    RATE_LIMIT_AUTH_PER_MINUTE: int = 10    # login / register
    RATE_LIMIT_AI_PER_MINUTE: int = 20     # AI-heavy endpoints (interview start, answer, feedback)

    # Security
    MAX_REQUEST_BODY_BYTES: int = 1_048_576  # 1 MB

    def validate_production_security(self) -> None:
        """Enforce critical security invariants in production.

        Called during application startup. In production (DEBUG=False),
        refuses to start with a known-insecure SECRET_KEY.
        """
        key_lower = self.SECRET_KEY.lower()
        is_insecure = any(marker in key_lower for marker in _INSECURE_KEY_MARKERS)

        if not self.DEBUG and is_insecure:
            raise RuntimeError(
                "FATAL: SECRET_KEY is insecure. Set a strong random SECRET_KEY "
                "via environment variable before running in production. "
                "Generate one with: python -c \"import secrets; print(secrets.token_urlsafe(64))\""
            )

        if not self.DEBUG and is_insecure:
            logger.critical("Insecure SECRET_KEY detected in production!")

        if self.DEBUG and is_insecure:
            logger.warning(
                "SECRET_KEY is the default insecure value. "
                "This is acceptable for local development only."
            )

        # Auto-generate CSRF secret if not provided
        if not self.CSRF_SECRET:
            object.__setattr__(self, "CSRF_SECRET", secrets.token_urlsafe(32))
            logger.info("Auto-generated CSRF_SECRET (ephemeral, per-process)")

        # In development, relax cookie settings
        if self.DEBUG:
            object.__setattr__(self, "COOKIE_SECURE", False)
            object.__setattr__(self, "COOKIE_SAMESITE", "lax")

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
