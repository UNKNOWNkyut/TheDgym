import ssl
from typing import Any, AsyncGenerator, Tuple
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import declarative_base

from app.config import settings


def prepare_async_database_config(raw_url: str) -> Tuple[str, dict[str, Any]]:
    """
    Normalize PostgreSQL URLs (e.g. Neon/Render `postgresql://...`) for SQLAlchemy + asyncpg,
    converting libpq query options (`sslmode`, `channel_binding`) into asyncpg `connect_args`.
    """
    url = (raw_url or "").strip()
    if not url:
        return "", {}

    if url.startswith("postgres://"):
        url = "postgresql+asyncpg://" + url[len("postgres://") :]
    elif url.startswith("postgresql://"):
        url = "postgresql+asyncpg://" + url[len("postgresql://") :]

    connect_args: dict[str, Any] = {}
    parts = urlsplit(url)
    if parts.scheme.lower() == "postgresql+asyncpg" and parts.query:
        kept_params = []
        for key, value in parse_qsl(parts.query, keep_blank_values=True):
            lower_key = key.lower()
            if lower_key == "sslmode":
                mode = value.strip().lower()
                if mode == "disable":
                    connect_args["ssl"] = False
                elif mode in ("allow", "prefer", "require"):
                    connect_args["ssl"] = mode
                elif mode in ("verify-ca", "verify-full"):
                    ctx = ssl.create_default_context()
                    ctx.check_hostname = mode == "verify-full"
                    connect_args["ssl"] = ctx
            elif lower_key == "channel_binding":
                # asyncpg handles SCRAM TLS channel binding natively when supported and rejects this kwarg
                continue
            else:
                kept_params.append((key, value))
        url = urlunsplit(parts._replace(query=urlencode(kept_params)))

    if parts.scheme.lower() == "postgresql+asyncpg" and "-pooler." in (parts.hostname or "").lower():
        # Neon PgBouncer transaction poolers cannot reuse numeric asyncpg prepared statement names across hops
        connect_args["statement_cache_size"] = 0
        connect_args["prepared_statement_cache_size"] = 0
        connect_args["prepared_statement_name_func"] = lambda: f"__asyncpg_{uuid4()}__"

    return url, connect_args


_db_url, _db_connect_args = prepare_async_database_config(settings.DATABASE_URL)
_engine_kwargs: dict[str, Any] = {
    "echo": False,
    "future": True,
    "pool_pre_ping": True,
}
if _db_connect_args:
    _engine_kwargs["connect_args"] = _db_connect_args
if _db_url and not _db_url.lower().startswith("sqlite"):
    _engine_kwargs["pool_recycle"] = 300

# Create async engine
engine = create_async_engine(_db_url, **_engine_kwargs)

# Async session factory
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

Base = declarative_base()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency for providing database sessions to API routes."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
