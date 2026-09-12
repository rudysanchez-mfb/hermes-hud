"""Prompt patterns endpoint."""

from fastapi import APIRouter

from backend.collectors.patterns import collect_patterns
from .serialize import to_dict
from ..async_utils import run_blocking

router = APIRouter()


@router.get("/patterns")
async def get_patterns():
    return to_dict(await run_blocking(collect_patterns))
