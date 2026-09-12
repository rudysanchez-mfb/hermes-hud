"""Timeline endpoint."""

from fastapi import APIRouter

from backend.collectors.collect import collect_all
from .serialize import to_dict
from ..async_utils import run_blocking

router = APIRouter()


@router.get("/timeline")
async def get_timeline():
    state = await run_blocking(collect_all)
    return to_dict(state.timeline)
