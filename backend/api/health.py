"""Health check endpoint."""

from fastapi import APIRouter

from backend.collectors.health import collect_health
from .serialize import to_dict
from ..async_utils import run_blocking

router = APIRouter()


@router.get("/health")
async def get_health():
    return to_dict(await run_blocking(collect_health))
