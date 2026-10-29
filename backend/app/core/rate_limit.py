import logging
import time
from collections import defaultdict, deque
from typing import Callable, Deque, Dict
from fastapi import HTTPException, Request, status

logger = logging.getLogger("dgym.security")


class SlidingWindowRateLimiter:
    """
    Thread-safe in-memory sliding window rate limiter (Check 28 & 64).
    Prevents brute-force authentication attacks, API scraping, and AI/ML spend exhaustion.
    """

    def __init__(self) -> None:
        self._buckets: Dict[str, Deque[float]] = defaultdict(deque)

    def _get_client_ip(self, request: Request) -> str:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
        if request.client and request.client.host:
            return request.client.host
        return "127.0.0.1"

    def check(self, key: str, max_requests: int, window_seconds: int) -> None:
        now = time.monotonic()
        bucket = self._buckets[key]
        cutoff = now - window_seconds

        while bucket and bucket[0] < cutoff:
            bucket.popleft()

        if len(bucket) >= max_requests:
            retry_after = max(1, int(window_seconds - (now - bucket[0])))
            logger.warning(f"[SECURITY ALERT] Rate limit exceeded for key={key} (limit={max_requests}/{window_seconds}s)")
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
