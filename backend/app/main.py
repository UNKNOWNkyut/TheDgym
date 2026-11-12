import asyncio
from contextlib import asynccontextmanager, suppress
import logging
import mimetypes
import os
from pathlib import Path
import re

from fastapi import Depends, FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import AsyncSessionLocal, Base, engine, get_db
from app.database_migrations import run_startup_column_migrations
from app.routers import (
    access_control_router,
    account_router,
    analytics_router,
    auth_router,
    class_sessions_router,
    finance_router,
    members_router,
    membership_plans_router,
    notifications_router,
    payments_router,
    pt_sessions_router,
    retention_router,
    users_router,
    visits_router,
)
from app.seed import seed_users
from app.seed_keycards import seed_keycards
from app.seed_members import seed_members
from app.seed_phase5 import seed_phase5
from app.seed_plans import seed_plans
from app.services.audit import redact_sensitive_text
from app.services.churn_pipeline import seed_simulated_gym_analytics
from app.services.visit_sweeper import sweep_overdue_open_visits

def _configure_logging() -> None:
    raw_level = os.getenv("LOG_LEVEL", "INFO").upper().strip()
    level = getattr(logging, raw_level, logging.INFO)
    if not isinstance(level, int):
        level = logging.INFO

    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    )
    logging.getLogger("dgym").setLevel(level)
    logging.getLogger("app").setLevel(level)
    logging.getLogger("httpcore").setLevel(logging.WARNING)


_configure_logging()
logger = logging.getLogger("dgym.security")

_STATE_CHANGING_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})
_API_CSP = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
_DOCS_CSP = (
    "default-src 'self'; "
    "script-src 'self' https://cdn.jsdelivr.net 'unsafe-inline'; "
    "style-src 'self' https://cdn.jsdelivr.net 'unsafe-inline'; "
    "img-src 'self' https://fastapi.tiangolo.com data:; "
    "frame-ancestors 'none'"
)
_HASHED_ASSET_RE = re.compile(r"^/assets/.+-[A-Za-z0-9_-]{8}\.(?:js|css)$")
_STATIC_METADATA_PATHS = frozenset({"/robots.txt", "/sitemap.xml", "/site.webmanifest"})
_STATIC_ASSET_EXTENSIONS = frozenset(
    {
        ".js",
        ".mjs",
        ".css",
        ".map",
        ".png",
        ".jpg",
        ".jpeg",
        ".gif",
        ".svg",
        ".webp",
        ".ico",
        ".woff",
        ".woff2",
        ".ttf",
        ".eot",
        ".mp3",
        ".wav",
        ".json",
        ".txt",
        ".xml",
        ".webmanifest",
        ".wasm",
        ".bin",
        ".gz",
        ".traineddata",
    }
)

for _ext, _mime in (
    (".js", "text/javascript"),
    (".mjs", "text/javascript"),
    (".css", "text/css"),
    (".svg", "image/svg+xml"),
    (".webp", "image/webp"),
    (".woff2", "font/woff2"),
    (".webmanifest", "application/manifest+json"),
    (".wasm", "application/wasm"),
    (".bin", "application/octet-stream"),
):
    mimetypes.add_type(_mime, _ext)


def _resolve_frontend_dist_dir() -> Path | None:
    raw_dir = os.getenv("FRONTEND_DIST_DIR", "").strip()
    candidates = (
        [Path(raw_dir)]
        if raw_dir
        else [Path(__file__).resolve().parent.parent / "frontend_dist"]
    )
    for candidate in candidates:
        resolved = candidate.resolve()
        if (resolved / "index.html").is_file():
            return resolved
    return None


_FRONTEND_DIST_DIR = _resolve_frontend_dist_dir()


def _resolve_spa_file(dist_dir: Path, request_path: str) -> Path | None:
    rel = request_path.lstrip("/")
    if not rel:
        index_file = dist_dir / "index.html"
        return index_file if index_file.is_file() else None

    candidate = (dist_dir / rel).resolve()
    if not candidate.is_relative_to(dist_dir):
        return None
    if candidate.is_file():
        return candidate
    if rel.startswith("assets/") or Path(rel).suffix.lower() in _STATIC_ASSET_EXTENSIONS:
        return None
    index_file = dist_dir / "index.html"
    return index_file if index_file.is_file() else None


# =========================================================
# UPLOAD DIRECTORY
# =========================================================

UPLOADS_DIR = Path(__file__).resolve().parent.parent / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)


# =========================================================
# APPLICATION LIFESPAN
# =========================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create any missing database tables automatically & run column migrations.
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await run_startup_column_migrations(engine)

    # Seed baseline plans in all environments; gate demo users/members/keycards to development (ANTIGRAV-06).
    async with AsyncSessionLocal() as session:
        await seed_plans(session)
        if settings.ENVIRONMENT == "development":
            await seed_users(session)
            await seed_members(session)
            await seed_phase5(session)
            await seed_keycards(session)
            await seed_simulated_gym_analytics(session)
        await sweep_overdue_open_visits(session)

    async def _periodic_auto_checkout_loop():
        while True:
            await asyncio.sleep(60)
            try:
                async with AsyncSessionLocal() as bg_session:
                    await sweep_overdue_open_visits(bg_session)
            except Exception as exc:
                logger.warning("Auto-checkout background sweep error: %s", exc)

    sweeper_task = asyncio.create_task(_periodic_auto_checkout_loop())

    try:
        yield
    finally:
        sweeper_task.cancel()
        with suppress(asyncio.CancelledError):
            await sweeper_task
        await engine.dispose()


# =========================================================
# FASTAPI APP (Check 10: Disable Swagger/OpenAPI in prod)
# =========================================================

_is_prod = settings.ENVIRONMENT == "production"
_SPA_CSP = (
    "default-src 'self'; "
    "script-src 'self' 'wasm-unsafe-eval' https://accounts.google.com/gsi/client; "
    "worker-src 'self' blob:; "
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com/gsi/style; "
    "font-src 'self' https://fonts.gstatic.com data:; "
    "img-src 'self' data: blob: https://lh3.googleusercontent.com https://*.googleusercontent.com; "
    f"connect-src 'self' blob: https://accounts.google.com {'wss:' if _is_prod else 'ws: wss:'}; "
    "frame-src https://accounts.google.com/gsi/; "
    "frame-ancestors 'none'; "
    "base-uri 'self'; "
    "form-action 'self'"
)

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description=(
        "The DGym API — Authentication, Management, Finance, "
        "Member Services, and Analytics Platform"
    ),
    lifespan=lifespan,
    docs_url=None if _is_prod else "/docs",
    redoc_url=None if _is_prod else "/redoc",
    openapi_url=None if _is_prod else "/openapi.json",
)


# =========================================================
# SECURITY HEADERS, CSRF & PAYLOAD SIZE LIMIT MIDDLEWARE
# (Checks 21, 46, 64, ANTIGRAV-07, ANTIGRAV-10)
# =========================================================

def _requires_csrf_header(request: Request) -> bool:
    if request.method not in _STATE_CHANGING_METHODS:
        return False
    if not request.cookies.get("access_token"):
        return False
    # Explicit Bearer or hardware scanner key auth is immune to ambient-cookie CSRF
    if (
        request.headers.get("authorization")
        or request.headers.get("x-scanner-key")
        or request.headers.get("x-scanner-api-key")
    ):
        return False
    return True


@app.middleware("http")
async def security_hardening_middleware(request: Request, call_next):
    # Check 64: Reject oversized request bodies early
    content_length = request.headers.get("content-length")
    if content_length:
        try:
            if int(content_length) > settings.MAX_REQUEST_BODY_BYTES:
                return JSONResponse(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    content={"detail": "Request payload exceeds maximum allowed size."},
                )
        except ValueError:
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={"detail": "Invalid Content-Length header."},
            )

    # ANTIGRAV-07: Enforce X-Requested-With custom header on cookie-authenticated mutations
    if _requires_csrf_header(request):
        if request.headers.get("x-requested-with", "").lower() != "xmlhttprequest":
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={"detail": "CSRF validation failed: missing X-Requested-With header."},
            )

    path = request.url.path
    is_api_or_docs = (
        path == "/api"
        or path.startswith("/api/")
        or path in ("/docs", "/redoc", "/openapi.json")
        or path.startswith("/docs/")
    )

    response = await call_next(request)

    served_spa = False
    if (
        response.status_code == status.HTTP_404_NOT_FOUND
        and _FRONTEND_DIST_DIR is not None
        and not is_api_or_docs
        and request.method in ("GET", "HEAD")
    ):
        spa_file = _resolve_spa_file(_FRONTEND_DIST_DIR, path)
        if spa_file is not None:
            response = FileResponse(spa_file)
            served_spa = True

    # Check 46 & ANTIGRAV-10: Standard HTTP Security Headers
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    response.headers["X-XSS-Protection"] = "0"
    response.headers["Cross-Origin-Opener-Policy"] = "same-origin-allow-popups"

    if _is_prod:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

    # Check 21/22 & ANTIGRAV-10: Content-Security-Policy & Cache-Control
    if path.startswith("/api/uploads"):
        response.headers["Content-Security-Policy"] = "default-src 'none'; img-src 'self'; sandbox"
    elif path in ("/docs", "/redoc") or path.startswith("/docs/"):
        response.headers["Content-Security-Policy"] = _DOCS_CSP
    elif served_spa:
        response.headers["Content-Security-Policy"] = _SPA_CSP
        if _HASHED_ASSET_RE.match(path):
            response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        elif path.startswith("/assets/"):
            response.headers["Cache-Control"] = "public, max-age=604800"
        elif path in _STATIC_METADATA_PATHS:
            response.headers["Cache-Control"] = "public, max-age=3600"
        else:
            response.headers["Cache-Control"] = "no-cache"
    else:
        response.headers["Content-Security-Policy"] = _API_CSP

    if path.startswith("/api/auth") or path.startswith("/api/account"):
        response.headers["Cache-Control"] = "no-store"
        response.headers["Pragma"] = "no-cache"

    return response


# =========================================================
# GLOBAL EXCEPTION HANDLER (Check 12: No Stack Trace Leaks)
# =========================================================

@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.error(
        "Unhandled server exception on %s %s: %s",
        request.method,
        request.url.path,
        redact_sensitive_text(str(exc)),
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An unexpected internal server error occurred."},
    )


# =========================================================
# PROFILE PICTURE FILES
# =========================================================

app.mount("/api/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")


# =========================================================
# CORS (Check 19: Explicit Origin, Method & Header Whitelist)
# =========================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=(
        None
        if _is_prod
        else r"^https?://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?$"
    ),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=[
        "Authorization",
        "Content-Type",
        "Accept",
        "X-Requested-With",
        "X-Scanner-Key",
        "X-Scanner-API-Key",
    ],
)


# =========================================================
# ROUTERS
# =========================================================

app.include_router(auth_router)
app.include_router(account_router)
app.include_router(users_router)
app.include_router(members_router)
app.include_router(membership_plans_router)
app.include_router(visits_router)
app.include_router(class_sessions_router)
app.include_router(pt_sessions_router)
app.include_router(finance_router)
app.include_router(analytics_router)
app.include_router(retention_router)
app.include_router(notifications_router)
app.include_router(access_control_router)
app.include_router(payments_router)


# =========================================================
# HEALTH CHECK
# =========================================================

@app.get("/api/health", tags=["Health"])
async def health_check(db: AsyncSession = Depends(get_db)):
    try:
        await asyncio.wait_for(db.execute(text("SELECT 1")), timeout=3.0)
    except Exception as exc:
        logger.error("Health check database ping failed: %s", redact_sensitive_text(str(exc)))
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "status": "degraded",
                "database": "unavailable",
                "service": settings.PROJECT_NAME,
                "version": settings.VERSION,
            },
        )
    return {
        "status": "online",
        "database": "ok",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
    }
