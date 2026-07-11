"""Tiny TTL cache so identical searches return instantly (snappiness)."""
from __future__ import annotations

from cachetools import TTLCache

# Up to 256 distinct searches cached for 10 minutes.
_search_cache: TTLCache = TTLCache(maxsize=256, ttl=600)


def get(key: str):
    return _search_cache.get(key)


def put(key: str, value) -> None:
    _search_cache[key] = value
