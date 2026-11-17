"""
Reusable `limit + 1` pagination helpers and a lightweight in-memory TTL read cache.
Avoids expensive `SELECT COUNT(*)` queries on large tables while supporting
prefix-based invalidation on writes without requiring external Redis.
"""
from collections import OrderedDict
from dataclasses import dataclass
from threading import Lock
import time
from typing import Any, Dict, Generic, List, Optional, Sequence, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class PaginatedPage(BaseModel, Generic[T]):
    items: List[T]
    skip: int
    limit: int
    has_next: bool
    next_skip: Optional[int] = None


@dataclass(frozen=True)
class SliceResult(Generic[T]):
    items: List[T]
    has_next: bool
    next_skip: Optional[int]


def slice_limit_plus_one(rows: Sequence[T], *, skip: int, limit: int) -> SliceResult[T]:
    """Slice a `limit + 1` query result into page items and `has_next` metadata."""
    has_next = len(rows) > limit
    items = list(rows[:limit])
    next_skip = skip + limit if has_next else None
    return SliceResult(items=items, has_next=has_next, next_skip=next_skip)


class ReadTTLCache:
    """Bounded thread-safe in-memory TTL cache for hot read pages."""

    def __init__(self, *, ttl_seconds: float = 15.0, max_entries: int = 256) -> None:
        self._ttl = ttl_seconds
        self._max_entries = max_entries
        self._lock = Lock()
        self._store: OrderedDict[str, tuple[float, Any]] = OrderedDict()

    def get(self, key: str) -> Optional[Any]:
        now = time.monotonic()
        with self._lock:
            entry = self._store.get(key)
            if entry is None:
                return None
            expires_at, value = entry
            if expires_at <= now:
                self._store.pop(key, None)
                return None
            self._store.move_to_end(key)
            return value

    def set(self, key: str, value: Any) -> Any:
        expires_at = time.monotonic() + self._ttl
        with self._lock:
            self._store[key] = (expires_at, value)
            self._store.move_to_end(key)
            while len(self._store) > self._max_entries:
                self._store.popitem(last=False)
        return value

    def invalidate_prefix(self, *prefixes: str) -> None:
        with self._lock:
            keys_to_drop = [
                k for k in self._store if any(k.startswith(prefix) for prefix in prefixes)
            ]
            for k in keys_to_drop:
                self._store.pop(k, None)

    def clear(self) -> None:
        with self._lock:
            self._store.clear()


read_page_cache = ReadTTLCache(ttl_seconds=15.0, max_entries=256)


def make_cache_key(namespace: str, **params: Any) -> str:
    parts = [f"{k}={params[k]!r}" for k in sorted(params)]
    return f"{namespace}:{'&'.join(parts)}"
