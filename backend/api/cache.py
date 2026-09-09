"""Cache management endpoints."""

from fastapi import APIRouter

from backend.cache import get_cache_stats

router = APIRouter()


@router.get("/cache/stats")
async def cache_stats():
    """Get cache statistics for monitoring."""
    return get_cache_stats()
