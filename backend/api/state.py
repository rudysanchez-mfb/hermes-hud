"""Full HUD state endpoint."""

from fastapi import APIRouter

from backend.collectors.collect import collect_all
from .serialize import to_dict
from ..async_utils import run_blocking

router = APIRouter()


@router.get("/state")
async def get_state():
    """Collect core state: config, memory, user, skills, sessions, timeline."""
    state = await run_blocking(collect_all)
    return to_dict(state)
