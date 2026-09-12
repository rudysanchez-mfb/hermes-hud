"""Agents endpoint."""

from fastapi import APIRouter

from backend.collectors.agents import collect_agents
from .serialize import to_dict
from ..async_utils import run_blocking

router = APIRouter()


@router.get("/agents")
async def get_agents():
    return to_dict(await run_blocking(collect_agents))
