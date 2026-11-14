import logging
import time
from collections import OrderedDict, deque
from datetime import datetime, timedelta, timezone
from typing import Callable, Deque, Optional

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from app.config import is_trusted_proxy
from app.database import get_db

logger = logging.getLogger("dgym.security")

_MAX_TRACKED_BUCKETS = 10_000


def resolve_client_ip(request: Optional[Request], default: str = "127.0.0.1") -> str:
    """Resolve client IP, trusting X-Forwarded-For only from configured reverse proxies."""
    if not request:
        return default
    peer_ip = (
        request.client.host.strip()
        if (request.client and request.client.host)
        else default
    )
    if is_trusted_proxy(peer_ip):
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            hops = [part.strip() for part in forwarded.split(",") if part.strip()]
            if hops:
                return hops[-1][:64]
    return peer_ip[:64]


class SlidingWindowRateLimiter:
    """
    Thread-safe in-memory sliding window rate limiter (Check 28, Check 64 & ANTIGRAV-05).
    Prevents brute-force authentication attacks, API scraping, and AI/ML spend exhaustion.
    """

    def __init__(self, max_buckets: int = _MAX_TRACKED_BUCKETS) -> None:
        self._max_buckets = max_buckets
        # shortcut: per-process memory store; move to Redis if running multiple Uvicorn workers
        self._buckets: OrderedDict[str, Deque[float]] = OrderedDict()

    def _get_client_ip(self, request: Request) -> str:
        return resolve_client_ip(request, default="127.0.0.1")

    def _evict_if_full(self, cutoff: float) -> None:
        while self._buckets and len(self._buckets) >= self._max_buckets:
            oldest_key, oldest_bucket = next(iter(self._buckets.items()))
            while oldest_bucket and oldest_bucket[0] < cutoff:
                oldest_bucket.popleft()
            # Evict idle expired bucket first, or FIFO-evict oldest active bucket if still at cap
            self._buckets.pop(oldest_key, None)
            if len(self._buckets) < self._max_buckets:
                break

    def check(self, key: str, max_requests: int, window_seconds: int) -> None:
        now = time.monotonic()
        cutoff = now - window_seconds

        bucket = self._buckets.get(key)
        if bucket is not None:
            while bucket and bucket[0] < cutoff:
                bucket.popleft()
            self._buckets.move_to_end(key)
        else:
            self._evict_if_full(cutoff)
            bucket = deque()
            self._buckets[key] = bucket

        if len(bucket) >= max_requests:
            retry_after = max(1, int(window_seconds - (now - bucket[0])))
            logger.warning(
                "[SECURITY ALERT] Rate limit exceeded for key=%s (limit=%s/%ss)",
                key,
                max_requests,
                window_seconds,
            )
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Too many requests. Please wait {retry_after} seconds before trying again.",
                headers={"Retry-After": str(retry_after)},
            )

        bucket.append(now)


rate_limiter = SlidingWindowRateLimiter()


def _as_async_bind(db: AsyncSession) -> AsyncEngine:
    return db.bind if isinstance(db.bind, AsyncEngine) else AsyncEngine(db.get_bind())


async def _check_persistent_bucket(
    db: AsyncSession,
    *,
    key: str,
    max_requests: int,
    window_seconds: int,
) -> None:
    """Enforce sliding-window limits in an isolated committed session so 401/400 attempts persist."""
    from app.models.revoked_token import RateLimitHit

    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(seconds=window_seconds)

    async with AsyncSession(bind=_as_async_bind(db), expire_on_commit=False) as rl_db:
        await rl_db.execute(
            delete(RateLimitHit).where(
                RateLimitHit.bucket_key == key,
                RateLimitHit.created_at < cutoff,
            )
        )
        rows = (
            await rl_db.execute(
                select(RateLimitHit.created_at)
                .where(
                    RateLimitHit.bucket_key == key,
                    RateLimitHit.created_at >= cutoff,
                )
                .order_by(RateLimitHit.created_at.asc())
            )
        ).scalars().all()

        if len(rows) >= max_requests:
            oldest = rows[0] if rows[0].tzinfo is not None else rows[0].replace(tzinfo=timezone.utc)
            retry_after = max(1, int(window_seconds - (now - oldest).total_seconds()))
            await rl_db.commit()
            logger.warning(
                "[SECURITY ALERT] Persistent rate limit exceeded for key=%s (limit=%s/%ss)",
                key,
                max_requests,
                window_seconds,
            )
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Too many requests. Please wait {retry_after} seconds before trying again.",
                headers={"Retry-After": str(retry_after)},
            )

        rl_db.add(RateLimitHit(bucket_key=key, created_at=now))
        await rl_db.commit()


async def reset_rate_limit_state(db: Optional[AsyncSession] = None) -> None:
    """Clear both in-memory and persistent rate-limit windows (used by test suites)."""
    rate_limiter._buckets.clear()
    if db is not None:
        from app.models.revoked_token import RateLimitHit

        async with AsyncSession(bind=_as_async_bind(db), expire_on_commit=False) as rl_db:
            await rl_db.execute(delete(RateLimitHit))
            await rl_db.commit()


def require_rate_limit(
    scope: str,
    max_requests: int,
    window_seconds: int = 60,
    *,
    per_ip: bool = True,
    persistent: bool = False,
) -> Callable:
    """FastAPI dependency factory for route-level rate limiting."""

    async def _rate_limit_dep(
        request: Request,
        db: AsyncSession = Depends(get_db),
    ) -> None:
        subject = rate_limiter._get_client_ip(request) if per_ip else "global"
        key = f"{scope}:{subject}"
        rate_limiter.check(key, max_requests=max_requests, window_seconds=window_seconds)
        if persistent:
            await _check_persistent_bucket(
                db,
                key=key,
                max_requests=max_requests,
                window_seconds=window_seconds,
            )

    return _rate_limit_dep


# Pre-configured rate limit dependencies
rate_limit_auth = require_rate_limit("auth", max_requests=15, window_seconds=60, persistent=True)
rate_limit_sensitive = require_rate_limit("sensitive", max_requests=10, window_seconds=60, persistent=True)
rate_limit_ai = require_rate_limit("ai_compute", max_requests=15, window_seconds=60)
rate_limit_ocr_burst = require_rate_limit("ocr_burst", max_requests=4, window_seconds=60, persistent=True)
rate_limit_ocr_hourly = require_rate_limit("ocr_hourly", max_requests=12, window_seconds=3600, persistent=True)
rate_limit_ocr_global_daily = require_rate_limit(
    "ocr_global_daily", max_requests=250, window_seconds=86400, per_ip=False, persistent=True
)
