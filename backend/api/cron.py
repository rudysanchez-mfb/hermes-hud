"""Cron jobs endpoints."""

from __future__ import annotations

from fastapi import APIRouter

from backend.collectors.cron import collect_cron
from .serialize import to_dict
from ..async_utils import run_blocking

router = APIRouter()


@router.get("/cron")
async def get_cron():
    return to_dict(await run_blocking(collect_cron))
