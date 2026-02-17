"""
Database connection and session management.

- Uses SQLite + aiosqlite for local development.
- Easily switchable to PostgreSQL by changing DATABASE_URL to
  ``postgresql+asyncpg://user:pass@host:5432/dbname``
- Async engine with connection-health pre-ping.
- Proper connection pooling (pool_size / max_overflow for non-SQLite).
- ``get_db`` FastAPI dependency with auto commit / rollback.
- ``create_tables``  initialise all ORM tables.
- ``check_db_connection`` lightweight connectivity probe.
"""

import logging
from typing import AsyncGenerator

from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    create_async_engine,
    async_sessionmaker,
)
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

logger = logging.getLogger(__name__)

# ── Normalise DATABASE_URL for async drivers ──────────────────────────────────
# Render (and many cloud hosts) provide postgresql:// but SQLAlchemy async
# requires the +asyncpg dialect marker.
_db_url = settings.DATABASE_URL
if _db_url.startswith("postgres://"):
    _db_url = _db_url.replace("postgres://", "postgresql+asyncpg://", 1)
elif _db_url.startswith("postgresql://"):
    _db_url = _db_url.replace("postgresql://", "postgresql+asyncpg://", 1)

# ── Engine kwargs ─────────────────────────────────────────────────────────────
# SQLite doesn't support pool_size / max_overflow, so only apply them for
# server-class databases (PostgreSQL, MySQL, …).
_is_sqlite = _db_url.startswith("sqlite")

_engine_kwargs: dict = dict(
    echo=settings.DEBUG,
    future=True,
    pool_pre_ping=True,          # detect stale connections before use
)

if not _is_sqlite:
    _engine_kwargs.update(
        pool_size=5,             # persistent connections kept in the pool
        max_overflow=10,         # extra connections allowed beyond pool_size
        pool_timeout=30,         # seconds to wait for a free connection
        pool_recycle=1800,       # recycle connections after 30 min
    )

# ── Async engine ──────────────────────────────────────────────────────────────
engine = create_async_engine(_db_url, **_engine_kwargs)

# ── Session factory ───────────────────────────────────────────────────────────
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


# ── Declarative base ─────────────────────────────────────────────────────────
class Base(DeclarativeBase):
    """Base class for all ORM models."""
    pass


# ── FastAPI dependency ────────────────────────────────────────────────────────
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Yield an async DB session.

    * On normal exit the transaction is **committed**.
    * On exception the transaction is **rolled back** and the error re-raised.
    * The session is always closed in ``finally``.
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


# ── Table creation ────────────────────────────────────────────────────────────
async def create_tables() -> None:
    """Create all tables defined in ``Base.metadata``.

    Safe to call repeatedly — SQLAlchemy's ``create_all`` is a no-op for
    tables that already exist.
    """
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables created / verified")
    except Exception as exc:
        logger.error("Failed to create database tables: %s", exc)
        raise


# Keep the old name as alias so callers that imported ``init_db`` still work.
init_db = create_tables


# ── Health check helper ──────────────────────────────────────────────────────
async def check_db_connection() -> bool:
    """Return ``True`` if the database is reachable, ``False`` otherwise."""
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return True
    except Exception as exc:
        logger.warning("Database connectivity check failed: %s", exc)
        return False


# ── Cleanup ───────────────────────────────────────────────────────────────────
async def close_db() -> None:
    """Dispose of the engine's connection pool (call on shutdown)."""
    await engine.dispose()
    logger.info("Database engine disposed")
