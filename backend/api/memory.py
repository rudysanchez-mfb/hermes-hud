"""Memory endpoints."""

from __future__ import annotations

from fastapi import APIRouter

from backend.collectors.memory import collect_memory
from backend.collectors.config import collect_config
from .serialize import to_dict
from ..async_utils import run_blocking

router = APIRouter()


@router.get("/memory")
async def get_memory():
    """Memory and user profile state."""
    config = await run_blocking(collect_config)
    memory, user = await run_blocking(
        collect_memory,
        memory_char_limit=config.memory_char_limit,
        user_char_limit=config.user_char_limit,
    )
    return {
        "memory": to_dict(memory),
        "user": to_dict(user),
    }
