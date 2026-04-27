"""
Codeverse - FastAPI entry point.

Run (development):
    uvicorn main:app --reload

Run (production):
    uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
"""

import hashlib
import hmac
import logging
import secrets
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

from jose import JWTError, jwt

from app.config import settings
from app.database import check_db_connection, close_db, create_tables, engine
from app.routes import analytics, auth, interviews, admin

# --- Logging ---

logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s  %(levelname)-8s  [%(name)s]  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logging.getLogger("httpcore").setLevel(logging.WARNING)
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("sqlalchemy.engine").setLevel(
    logging.INFO if settings.DEBUG else logging.WARNING
)

logger = logging.getLogger(__name__)

# --- Constants ---

API_VERSION = "3.1.0"
API_PREFIX = "/api/v1"

# --- OpenAPI tag metadata ---

tags_metadata = [
    {
        "name": "Interviews",
        "description": (
            "Core interview flow - start a session, submit answers with "
            "real-time evaluation, and receive session-level feedback.\n\n"
            "**Typical workflow:**\n"
            "1. `POST /start` -> creates a session and returns the first question\n"
            "2. `POST /{session_id}/answer` -> submit your answer, get feedback + next question\n"
            "3. Repeat step 2 until `is_complete` is `true`\n"
            "4. `POST /{session_id}/feedback` -> get a holistic session debrief"
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


# --- Lifespan (startup / shutdown) ---

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: validate security, create tables + seed demo user. Shutdown: dispose engine."""
    logger.info("Starting up ...")

    # Enforce production security invariants
    settings.validate_production_security()

    if settings.SENTRY_DSN:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
        from sentry_sdk.integrations.logging import LoggingIntegration

        sentry_sdk.init(
            dsn=settings.SENTRY_DSN,
            environment="development" if settings.DEBUG else "production",
            traces_sample_rate=0.2,          # 20 % of requests → performance traces
            profiles_sample_rate=0.1,        # 10 % of sampled traces → profiling
            send_default_pii=False,          # never attach PII automatically
            integrations=[
                FastApiIntegration(transaction_style="endpoint"),
                SqlalchemyIntegration(),
                LoggingIntegration(
                    level=logging.WARNING,   # breadcrumbs from WARNING+
                    event_level=logging.ERROR,  # Sentry events from ERROR+
                ),
            ],
        )
        logger.info("Sentry initialized")

    await create_tables()
    logger.info("Database tables ready")

    # Seed a default demo user for pre-auth / testing usage (dev only)
    if settings.DEBUG:
        from app.database import AsyncSessionLocal
        from app.models import User
        from passlib.context import CryptContext

        pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

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
                        hashed_password=pwd_context.hash("demo-not-for-production"),
                    )
                )
                await session.commit()
                logger.info("Created default demo user (dev only)")

    logger.info("Application ready - serving on http://%s:%s", settings.HOST, settings.PORT)
    yield

    logger.info("Shutting down ...")
    await close_db()
    logger.info("Cleanup complete")


# --- FastAPI application ---

app = FastAPI(
    title="Codeverse",
    description=(
        "A production-ready backend for **AI-powered technical interviews**.\n\n"
        "### Features\n"
        "- Interview question generation (coding, behavioral, system design)\n"
        "- Real-time answer evaluation with detailed feedback\n"
        "- Adaptive follow-up questions based on candidate responses\n"
        "- Session-level holistic analysis and improvement recommendations\n"
        "- Performance analytics and progress tracking\n\n"
        "### Tech Stack\n"
        "FastAPI - SQLAlchemy (async) - Ollama / Groq LLM - Pydantic v2 - JWT Auth\n\n"
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
        "name": "Codeverse",
        "url": "https://github.com/Durrani-AI/Codeverse",
    },
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)


# --- Middleware ---

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*", "X-CSRF-Token"],
    expose_headers=["X-Request-ID", "X-Process-Time", "X-RateLimit-Remaining", "X-RateLimit-Reset"],
)


# Security headers
@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    """Attach standard security headers to every response."""
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"

    # Content Security Policy
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com; "
        "img-src 'self' data: blob: https:; "
        "connect-src 'self' https://*.onrender.com https://*.vercel.app; "
        "frame-ancestors 'none'; "
        "base-uri 'self'; "
        "form-action 'self'"
    )

    if not settings.DEBUG:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


# Request ID + timing
@app.middleware("http")
async def request_context_middleware(request: Request, call_next):
    """Attach a unique request ID and measure processing time.

    Response headers:
    - X-Request-ID   - unique identifier for log correlation
    - X-Process-Time - wall-clock seconds spent handling the request
    """
    request_id = str(uuid.uuid4())
    request.state.request_id = request_id
    start = time.perf_counter()

    response = await call_next(request)

    elapsed = time.perf_counter() - start
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Process-Time"] = f"{elapsed:.4f}"

    logger.info(
        "%s %s -> %s (%.3fs) [%s]",
        request.method,
        request.url.path,
        response.status_code,
        elapsed,
        request_id[:8],
    )
    return response


# Request body size limit
@app.middleware("http")
async def request_size_limit_middleware(request: Request, call_next):
    """Reject requests with a body larger than MAX_REQUEST_BODY_BYTES.

    Profile picture uploads are exempt (handled by their own 5 MB limit).
    """
    content_length = request.headers.get("content-length")
    is_upload = request.url.path.endswith("/profile-picture") and request.method == "PUT"
    if not is_upload and content_length and int(content_length) > settings.MAX_REQUEST_BODY_BYTES:
        return JSONResponse(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            content={
                "error": "payload_too_large",
                "message": f"Request body exceeds {settings.MAX_REQUEST_BODY_BYTES} bytes.",
                "status_code": 413,
            },
        )
    return await call_next(request)


# --- Per-user + per-IP tiered rate limiting ---

_rate_limit_store: dict[str, list[float]] = defaultdict(list)

_AUTH_PATHS = {"/api/v1/auth/login", "/api/v1/auth/register", "/api/v1/auth/forgot-password"}
_EXEMPT_PATHS = {"/health", "/docs", "/redoc", "/openapi.json", "/", "/api"}


def _get_rate_tier(path: str, method: str) -> tuple[str, int]:
    """Determine the rate-limit tier and max requests for a given path."""
    if path in _AUTH_PATHS:
        return "auth", settings.RATE_LIMIT_AUTH_PER_MINUTE

    if method == "POST" and path.startswith("/api/v1/interviews/"):
        return "ai", settings.RATE_LIMIT_AI_PER_MINUTE

    return "general", settings.RATE_LIMIT_PER_MINUTE


def _extract_user_id_from_request(request: Request) -> str | None:
    """Extract user ID from JWT (cookie or header) without raising."""
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        return None
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload.get("sub")
    except (JWTError, Exception):
        return None


@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    """Enforce sliding-window rate limits.

    - Per-user (by user ID from JWT) for authenticated requests
    - Per-IP for unauthenticated requests
    - Tiered: auth endpoints (10/min), AI endpoints (20/min), general (60/min)
    """
    path = request.url.path

    if path in _EXEMPT_PATHS:
        return await call_next(request)

    tier, max_requests = _get_rate_tier(path, request.method)

    user_id = _extract_user_id_from_request(request)
    client_ip = request.client.host if request.client else "unknown"
    rate_key = f"user:{user_id}:{tier}" if user_id else f"ip:{client_ip}:{tier}"

    now = time.time()
    window = 60.0

    _rate_limit_store[rate_key] = [
        ts for ts in _rate_limit_store[rate_key] if now - ts < window
    ]

    remaining = max_requests - len(_rate_limit_store[rate_key])
    reset_at = int(now + window)

    if remaining <= 0:
        who = f"user={user_id}" if user_id else f"ip={client_ip}"
        logger.warning("Rate limit exceeded: %s on tier=%s path=%s", who, tier, path)
        return JSONResponse(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            content={
                "error": "rate_limited",
                "message": f"Rate limit exceeded. Maximum {max_requests} requests per minute for {tier} endpoints.",
                "status_code": 429,
            },
            headers={
                "Retry-After": "60",
                "X-RateLimit-Remaining": "0",
                "X-RateLimit-Reset": str(reset_at),
                "X-RateLimit-Limit": str(max_requests),
            },
        )

    _rate_limit_store[rate_key].append(now)

    response = await call_next(request)
    response.headers["X-RateLimit-Remaining"] = str(remaining - 1)
    response.headers["X-RateLimit-Reset"] = str(reset_at)
    response.headers["X-RateLimit-Limit"] = str(max_requests)
    return response


# --- CSRF Protection (double-submit cookie pattern) ---

_CSRF_EXEMPT_PATHS = {
    "/api/v1/auth/login",
    "/api/v1/auth/register",
    "/health", "/docs", "/redoc", "/openapi.json", "/api", "/",
}
_CSRF_METHODS = {"POST", "PUT", "DELETE", "PATCH"}


def _generate_csrf_token() -> str:
    """Generate a CSRF token using HMAC with the server's CSRF secret."""
    nonce = secrets.token_urlsafe(32)
    signature = hmac.new(
        settings.CSRF_SECRET.encode(), nonce.encode(), hashlib.sha256,
    ).hexdigest()
    return f"{nonce}.{signature}"


def _verify_csrf_token(token: str) -> bool:
    """Verify a CSRF token's HMAC signature."""
    if not token or "." not in token:
        return False
    try:
        nonce, signature = token.rsplit(".", 1)
        expected = hmac.new(
            settings.CSRF_SECRET.encode(), nonce.encode(), hashlib.sha256,
        ).hexdigest()
        return hmac.compare_digest(signature, expected)
    except Exception:
        return False


@app.middleware("http")
async def csrf_middleware(request: Request, call_next):
    """CSRF protection via double-submit cookie pattern.

    - Verifies X-CSRF-Token header on state-changing requests
    - Exempt: login, register, health, docs, and Authorization-header requests
    """
    path = request.url.path

    if path in _CSRF_EXEMPT_PATHS:
        return await call_next(request)

    # Skip CSRF for requests using Authorization header (API clients / Swagger)
    if request.headers.get("authorization"):
        return await call_next(request)

    if request.method in _CSRF_METHODS:
        cookie_token = request.cookies.get("csrf_token")
        header_token = request.headers.get("x-csrf-token")

        if cookie_token and not header_token:
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={
                    "error": "csrf_failed",
                    "message": "CSRF token missing. Include X-CSRF-Token header.",
                    "status_code": 403,
                },
            )

        if cookie_token and header_token:
            if not _verify_csrf_token(header_token) or cookie_token != header_token:
                return JSONResponse(
                    status_code=status.HTTP_403_FORBIDDEN,
                    content={
                        "error": "csrf_failed",
                        "message": "CSRF token invalid or mismatched.",
                        "status_code": 403,
                    },
                )

    return await call_next(request)


# --- Exception handlers ---

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Structured 422 response for invalid request bodies / params."""
    details = []
    for err in exc.errors():
        loc_parts = [str(p) for p in err.get("loc", [])]
        details.append(
            {
                "field": " -> ".join(loc_parts),
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
    """Normalize all HTTPException responses into a consistent envelope."""
    code_labels = {
        400: "bad_request",
        401: "unauthorized",
        403: "forbidden",
        404: "not_found",
        409: "conflict",
        413: "payload_too_large",
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
    """Catch-all for unexpected errors - never leaks internal details in production."""
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
    if settings.DEBUG:
        body["debug"] = {
            "type": type(exc).__name__,
            "detail": str(exc),
        }
    return JSONResponse(status_code=500, content=body)


# --- Routers ---

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
app.include_router(
    admin.router,
    prefix=f"{API_PREFIX}/admin",
    tags=["Admin"],
)

# Static files (legacy frontend)
_static_dir = Path(__file__).resolve().parent / "static"
if _static_dir.is_dir():
    app.mount("/static", StaticFiles(directory=str(_static_dir)), name="static")

# Uploads directory (profile pictures etc.)
_uploads_dir = Path(__file__).resolve().parent / "uploads"
_uploads_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(_uploads_dir)), name="uploads")


# --- System endpoints ---

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
    """Return API metadata and navigation links."""
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
    LLM model endpoint.
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


# --- Development entry-point ---

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
