"""Corrections endpoint."""

from fastapi import APIRouter

from backend.collectors.corrections import collect_corrections
from .serialize import to_dict
from ..async_utils import run_blocking

router = APIRouter()


@router.get("/corrections")
async def get_corrections():
    return to_dict(await run_blocking(collect_corrections))
