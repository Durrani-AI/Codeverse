"""
Async database engine, session factory, and lifecycle utilities.

Supports both SQLite (aiosqlite) for development and PostgreSQL (asyncpg) for
production. URL normalization and query parameter sanitization happen at import
time so the rest of the app can use the engine/session without worrying about
dialect quirks.
"""

import asyncio
import logging
from typing import AsyncGenerator
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse

from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    create_async_engine,
    async_sessionmaker,
)
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

logger = logging.getLogger(__name__)

# --- Normalize DATABASE_URL for async drivers ---
# Many cloud hosts supply postgresql:// but SQLAlchemy async needs +asyncpg.
_db_url = settings.DATABASE_URL
if _db_url.startswith("postgres://"):
    _db_url = _db_url.replace("postgres://", "postgresql+asyncpg://", 1)
elif _db_url.startswith("postgresql://"):
    _db_url = _db_url.replace("postgresql://", "postgresql+asyncpg://", 1)

# asyncpg does not understand several libpq query parameters.
# Convert sslmode -> ssl and strip unsupported ones.
if "asyncpg" in _db_url:
    _parsed = urlparse(_db_url)
    _qs = parse_qs(_parsed.query)
    _changed = False
    if "sslmode" in _qs:
        _ssl_val = _qs.pop("sslmode")[0]
        _qs.setdefault("ssl", [_ssl_val])
        _changed = True
        logger.info("Converted sslmode -> ssl in DATABASE_URL for asyncpg")
    for _unsupported in ("channel_binding", "options"):
        if _unsupported in _qs:
            _qs.pop(_unsupported)
            _changed = True
            logger.info("Removed unsupported param '%s' from DATABASE_URL", _unsupported)
    if _changed:
        _new_query = urlencode(_qs, doseq=True)
        _db_url = urlunparse(_parsed._replace(query=_new_query))

# --- Engine kwargs ---
_is_sqlite = _db_url.startswith("sqlite")

_engine_kwargs: dict = dict(
    echo=settings.DEBUG,
    future=True,
    pool_pre_ping=True,
)

if not _is_sqlite:
    _engine_kwargs.update(
        pool_size=5,
        max_overflow=10,
        pool_timeout=30,
        pool_recycle=1800,
    )

engine = create_async_engine(_db_url, **_engine_kwargs)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    """Declarative base for all ORM models."""
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that yields a scoped async DB session.

    Commits on success, rolls back on exception, always closes.
    """
    session = AsyncSessionLocal()
    try:
        yield session
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()


async def create_tables(retries: int = 5, delay: float = 2.0) -> None:
    """Create all ORM-defined tables with retry logic.

    Retries with exponential back-off so cloud databases that need a few
    seconds to spin up don't crash the app on the first attempt.
    """
    for attempt in range(1, retries + 1):
        try:
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            logger.info("Database tables created / verified (attempt %d)", attempt)
            break
        except Exception as exc:
            logger.warning(
                "DB table creation attempt %d/%d failed: %s",
                attempt, retries, exc,
            )
            if attempt == retries:
                logger.error("All %d DB connection attempts failed", retries)
                raise
            await asyncio.sleep(delay * attempt)

    # Run lightweight column migrations for existing tables
    await _run_column_migrations()


async def _run_column_migrations() -> None:
    """Add columns that were introduced after initial table creation.

    SQLAlchemy create_all() only creates missing tables, not missing columns.
    This handles schema evolution without requiring Alembic.
    """
    migrations = [
        # Users
        ("users", "profile_picture", "VARCHAR(512)"),
        # InterviewSessions
        ("interview_sessions", "topic", "VARCHAR(255)"),
        ("interview_sessions", "programming_language", "VARCHAR(50)"),
        ("interview_sessions", "completed_at", "TIMESTAMP"),
        # Questions
        ("questions", "question_type", "VARCHAR(20) DEFAULT 'coding'"),
        # UserResponses
        ("user_responses", "response_code", "TEXT"),
        # Feedbacks
        ("feedbacks", "strengths", "JSON"),
        ("feedbacks", "improvements", "JSON"),
    ]

    async with engine.begin() as conn:
        for table, column, col_type in migrations:
            try:
                if _is_sqlite:
                    # SQLite: no IF NOT EXISTS on ADD COLUMN — catch error
                    await conn.execute(
                        text(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}")
                    )
                    logger.info("Added column %s.%s", table, column)
                else:
                    # PostgreSQL: supports IF NOT EXISTS
                    await conn.execute(
                        text(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {column} {col_type}")
                    )
                    logger.info("Ensured column %s.%s exists", table, column)
            except Exception as exc:
                # Column likely already exists (SQLite path)
                if "duplicate column" in str(exc).lower() or "already exists" in str(exc).lower():
                    logger.debug("Column %s.%s already exists, skipping", table, column)
                else:
                    logger.warning("Migration for %s.%s failed: %s", table, column, exc)


# Backwards-compatible alias
init_db = create_tables


async def check_db_connection() -> bool:
    """Lightweight connectivity probe. Returns True if the database is reachable."""
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return True
    except Exception as exc:
        logger.warning("Database connectivity check failed: %s", exc)
        return False


async def close_db() -> None:
    """Dispose of the engine's connection pool (call on app shutdown)."""
    await engine.dispose()
    logger.info("Database engine disposed")
