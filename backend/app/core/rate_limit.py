import logging
import time
from collections import OrderedDict, deque
from typing import Callable, Deque, Optional

from fastapi import HTTPException, Request, status

from app.config import is_trusted_proxy

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


def require_rate_limit(scope: str, max_requests: int, window_seconds: int = 60) -> Callable:
    """FastAPI dependency factory for route-level rate limiting."""

    async def _rate_limit_dep(request: Request) -> None:
        ip = rate_limiter._get_client_ip(request)
        key = f"{scope}:{ip}"
        rate_limiter.check(key, max_requests=max_requests, window_seconds=window_seconds)

    return _rate_limit_dep


# Pre-configured rate limit dependencies
rate_limit_auth = require_rate_limit("auth", max_requests=15, window_seconds=60)
rate_limit_sensitive = require_rate_limit("sensitive", max_requests=10, window_seconds=60)
rate_limit_ai = require_rate_limit("ai_compute", max_requests=15, window_seconds=60)
