"""
AI Technical Interview Platform – FastAPI entry point.

Run (development):
    uvicorn main:app --reload

Run (production):
    uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
"""

import logging
import time
import uuid
from collections import defaultdict
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from pathlib import Path

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import check_db_connection, close_db, create_tables, engine
from app.routes import analytics, auth, interviews

# ══════════════════════════════════════════════════════════════════════════════
# Logging
# ══════════════════════════════════════════════════════════════════════════════
logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s  %(levelname)-8s  [%(name)s]  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
# Silence overly-chatty libraries
logging.getLogger("httpcore").setLevel(logging.WARNING)
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("sqlalchemy.engine").setLevel(
    logging.INFO if settings.DEBUG else logging.WARNING
)

logger = logging.getLogger(__name__)

# ══════════════════════════════════════════════════════════════════════════════
# Constants
# ══════════════════════════════════════════════════════════════════════════════
API_VERSION = "3.0.0"
API_PREFIX = "/api/v1"

# ══════════════════════════════════════════════════════════════════════════════
# OpenAPI tag metadata (rendered in /docs sidebar)
# ══════════════════════════════════════════════════════════════════════════════
tags_metadata = [
    {
        "name": "Interviews",
        "description": (
            "Core interview flow – start a session, submit answers with "
            "AI-powered evaluation, and receive session-level feedback.\n\n"
            "**Typical workflow:**\n"
            "1. `POST /start` → creates a session and returns the first question\n"
            "2. `POST /{session_id}/answer` → submit your answer, get feedback + next question\n"
            "3. Repeat step 2 until `is_complete` is `true`\n"
            "4. `POST /{session_id}/feedback` → get a holistic session debrief"
        ),
    },
    {
        "name": "Auth",
        "description": (
            "User registration, login (JWT), and profile retrieval.\n\n"
            "- Register with email + username + password\n"
            "- Login returns a Bearer token\n"
            "- Use the token in the `Authorization` header for protected endpoints"
        ),
    },
    {
        "name": "Analytics",
        "description": (
            "Performance analytics and progress tracking.\n\n"
            "- Aggregated scores by interview type\n"
            "- Improvement trend analysis (improving / stable / declining)\n"
            "- Recent activity feed"
        ),
    },
    {
        "name": "System",
        "description": "Health checks, version info, and operational endpoints.",
    },
]


# ══════════════════════════════════════════════════════════════════════════════
# Lifespan (startup / shutdown)
# ══════════════════════════════════════════════════════════════════════════════
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown logic.

    Startup:
    - Creates all database tables (safe to call repeatedly)
    - Seeds a default demo user for pre-auth usage

    Shutdown:
    - Disposes the database engine and connection pool
    """
    logger.info("Starting up …")
    await create_tables()
    logger.info("Database tables ready")

    # Ensure the placeholder default user exists (for demo / pre-auth usage)
    from app.database import AsyncSessionLocal
    from app.models import User

    async with AsyncSessionLocal() as session:
        from sqlalchemy import select

        result = await session.execute(
            select(User).where(User.id == "00000000-0000-0000-0000-000000000001")
        )
        if result.scalar_one_or_none() is None:
            session.add(
                User(
                    id="00000000-0000-0000-0000-000000000001",
                    email="demo@example.com",
                    username="demo",
                    hashed_password="not-a-real-hash",
                )
            )
            await session.commit()
            logger.info("Created default demo user")

    logger.info("Application ready – serving on http://%s:%s", settings.HOST, settings.PORT)
    yield

    logger.info("Shutting down …")
    await close_db()
    logger.info("Cleanup complete")


# ══════════════════════════════════════════════════════════════════════════════
# FastAPI application
# ══════════════════════════════════════════════════════════════════════════════
app = FastAPI(
    title="AI Technical Interview Platform",
    description=(
        "A production-ready backend for **AI-powered technical interviews**.\n\n"
        "### Features\n"
        "- AI-generated interview questions (coding, behavioral, system design)\n"
        "- Real-time answer evaluation with detailed feedback\n"
        "- Adaptive follow-up questions based on candidate responses\n"
        "- Session-level holistic analysis and improvement recommendations\n"
        "- Performance analytics and progress tracking\n\n"
        "### Tech Stack\n"
        "FastAPI · SQLAlchemy (async) · Ollama LLM · Pydantic v2 · JWT Auth\n\n"
        "### Quick Start\n"
        "```bash\n"
        "# 1. Start Ollama\n"
        "ollama serve\n"
        "ollama pull llama3.2:1b\n\n"
        "# 2. Run the server\n"
        "uvicorn main:app --reload\n"
        "```"
    ),
    version=API_VERSION,
    openapi_tags=tags_metadata,
    license_info={
        "name": "MIT",
        "url": "https://opensource.org/licenses/MIT",
    },
    contact={
        "name": "AI Interview Platform",
        "url": "https://github.com/your-org/ai-interview-platform",
    },
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)


# ══════════════════════════════════════════════════════════════════════════════
# Middleware
# ══════════════════════════════════════════════════════════════════════════════

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID", "X-Process-Time"],
)


# ── Request ID + timing middleware ────────────────────────────────────────────
@app.middleware("http")
async def request_context_middleware(request: Request, call_next):
    """Attach a unique request ID and measure processing time.

    Response headers:
    - ``X-Request-ID``   – unique identifier for log correlation
    - ``X-Process-Time`` – wall-clock seconds spent handling the request
    """
    request_id = str(uuid.uuid4())
    request.state.request_id = request_id
    start = time.perf_counter()

    response = await call_next(request)

    elapsed = time.perf_counter() - start
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Process-Time"] = f"{elapsed:.4f}"

    logger.info(
        "%s %s → %s (%.3fs) [%s]",
        request.method,
        request.url.path,
        response.status_code,
        elapsed,
        request_id[:8],
    )
    return response


# ── Rate-limiting middleware (in-memory, per-IP) ──────────────────────────────
_rate_limit_store: dict[str, list[float]] = defaultdict(list)


@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    """Enforce a per-IP request limit based on ``RATE_LIMIT_PER_MINUTE``.

    Uses a simple sliding-window counter stored in memory. Returns 429
    when the client exceeds the configured threshold.

    Health-check and docs paths are exempt.
    """
    exempt_prefixes = ("/health", "/docs", "/redoc", "/openapi.json", "/")
    if request.url.path in exempt_prefixes:
        return await call_next(request)

    client_ip = request.client.host if request.client else "unknown"
    now = time.time()
    window = 60.0  # seconds

    # Prune expired entries
    _rate_limit_store[client_ip] = [
        ts for ts in _rate_limit_store[client_ip] if now - ts < window
    ]

    if len(_rate_limit_store[client_ip]) >= settings.RATE_LIMIT_PER_MINUTE:
        logger.warning("Rate limit exceeded for %s", client_ip)
        return JSONResponse(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            content={
                "error": "rate_limited",
                "message": f"Rate limit exceeded. Maximum {settings.RATE_LIMIT_PER_MINUTE} requests per minute.",
                "status_code": 429,
            },
            headers={"Retry-After": "60"},
        )

    _rate_limit_store[client_ip].append(now)
    return await call_next(request)


# ══════════════════════════════════════════════════════════════════════════════
# Exception handlers
# ══════════════════════════════════════════════════════════════════════════════

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Return a structured 422 response for invalid request bodies / params.

    Example response::

        {
            "error": "validation_error",
            "message": "Request validation failed",
            "details": [
                {
                    "field": "body → topic",
                    "message": "String should have at least 2 characters",
                    "type": "string_too_short"
                }
            ]
        }
    """
    details = []
    for err in exc.errors():
        loc_parts = [str(p) for p in err.get("loc", [])]
        details.append(
            {
                "field": " → ".join(loc_parts),
                "message": err.get("msg", ""),
                "type": err.get("type", ""),
            }
        )
    logger.warning(
        "Validation error on %s %s: %s",
        request.method,
        request.url.path,
        details,
    )
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": "validation_error",
            "message": "Request validation failed",
            "details": details,
        },
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Normalise all HTTPException responses into a consistent envelope.

    Example response::

        {
            "error": "not_found",
            "message": "Session not found",
            "status_code": 404
        }
    """
    # Map common status codes to readable labels
    code_labels = {
        400: "bad_request",
        401: "unauthorized",
        403: "forbidden",
        404: "not_found",
        409: "conflict",
        422: "validation_error",
        429: "rate_limited",
        500: "internal_error",
        502: "bad_gateway",
        503: "service_unavailable",
    }
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": code_labels.get(exc.status_code, "error"),
            "message": exc.detail,
            "status_code": exc.status_code,
        },
        headers=exc.headers,
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """Catch-all for unexpected errors – log the traceback and return 500.

    Never leaks internal details to the client in production.
    """
    request_id = getattr(request.state, "request_id", "unknown")
    logger.exception(
        "Unhandled exception on %s %s [request_id=%s]",
        request.method,
        request.url.path,
        request_id,
    )
    body: dict = {
        "error": "internal_error",
        "message": "An unexpected error occurred. Please try again later.",
        "status_code": 500,
        "request_id": request_id,
    }
    # In debug mode, include the error type and message for easier diagnosis
    if settings.DEBUG:
        body["debug"] = {
            "type": type(exc).__name__,
            "detail": str(exc),
        }
    return JSONResponse(status_code=500, content=body)


# ══════════════════════════════════════════════════════════════════════════════
# Routers
# ══════════════════════════════════════════════════════════════════════════════
app.include_router(
    interviews.router,
    prefix=f"{API_PREFIX}/interviews",
    tags=["Interviews"],
)
app.include_router(
    auth.router,
    prefix=f"{API_PREFIX}/auth",
    tags=["Auth"],
)
app.include_router(
    analytics.router,
    prefix=f"{API_PREFIX}/analytics",
    tags=["Analytics"],
)

# ── Static files (frontend) ───────────────────────────────────────────────────
_static_dir = Path(__file__).resolve().parent / "static"
if _static_dir.is_dir():
    app.mount("/static", StaticFiles(directory=str(_static_dir)), name="static")


# ══════════════════════════════════════════════════════════════════════════════
# System endpoints
# ══════════════════════════════════════════════════════════════════════════════

@app.get(
    "/",
    response_class=HTMLResponse,
    tags=["System"],
    summary="Frontend UI",
    include_in_schema=False,
)
async def serve_frontend():
    """Serve the single-page frontend application."""
    index = _static_dir / "index.html"
    if index.exists():
        return HTMLResponse(content=index.read_text(encoding="utf-8"))
    return HTMLResponse(content="<h1>Frontend not found</h1>", status_code=404)


@app.get(
    "/api",
    tags=["System"],
    summary="API root",
    response_description="Basic API information and navigation links",
)
async def root():
    """Return API metadata and useful navigation links.

    **Example response:**
    ```json
    {
        "name": "AI Technical Interview Platform",
        "version": "3.0.0",
        "status": "running",
        "docs": "/docs",
        "redoc": "/redoc",
        "health": "/health",
        "api_prefix": "/api/v1"
    }
    ```
    """
    return {
        "name": settings.APP_NAME,
        "version": API_VERSION,
        "status": "running",
        "docs": "/docs",
        "redoc": "/redoc",
        "health": "/health",
        "api_prefix": API_PREFIX,
    }


@app.get(
    "/health",
    tags=["System"],
    summary="Health check",
    response_description="Service and dependency health status",
)
async def health_check():
    """Check the health of the API and its dependencies.

    Returns connectivity status for the database and the configured
    Ollama model endpoint.

    **Example healthy response:**
    ```json
    {
        "status": "healthy",
        "version": "3.0.0",
        "timestamp": "2026-02-15T12:00:00Z",
        "checks": {
            "database": "connected",
            "ollama_configured": true,
            "ollama_model": "llama3.2:1b"
        }
    }
    ```

    **Example degraded response (503):**
    ```json
    {
        "status": "degraded",
        "version": "3.0.0",
        "timestamp": "2026-02-15T12:00:00Z",
        "checks": {
            "database": "unreachable",
            "ollama_configured": true,
            "ollama_model": "llama3.2:1b"
        }
    }
    ```
    """
    db_ok = await check_db_connection()
    if settings.AI_PROVIDER == "groq":
        ai_info = {
            "ai_provider": "groq",
            "ai_model": settings.GROQ_MODEL,
            "ai_configured": bool(settings.GROQ_API_KEY),
        }
    else:
        ai_info = {
            "ai_provider": "ollama",
            "ai_model": settings.OLLAMA_MODEL,
            "ollama_configured": bool(settings.OLLAMA_BASE_URL),
        }
    checks = {
        "database": "connected" if db_ok else "unreachable",
        **ai_info,
    }
    payload = {
        "status": "healthy" if db_ok else "degraded",
        "version": API_VERSION,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "checks": checks,
    }
    if not db_ok:
        return JSONResponse(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, content=payload)
    return payload


# ══════════════════════════════════════════════════════════════════════════════
# Development entry-point
# ══════════════════════════════════════════════════════════════════════════════
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level="debug" if settings.DEBUG else "info",
        access_log=True,
    )
