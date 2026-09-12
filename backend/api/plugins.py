"""Plugin hub endpoints."""

from fastapi import APIRouter

from backend.collectors.plugins import (
    collect_plugins,
)
from .serialize import to_dict
from ..async_utils import run_blocking

router = APIRouter()


@router.get("/plugins")
async def get_plugins():
    state = await run_blocking(collect_plugins)
    result = to_dict(state)
    result["by_source"] = to_dict(state.by_source())
    return result
