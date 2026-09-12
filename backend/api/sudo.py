"""Sudo endpoint."""

from fastapi import APIRouter

from backend.collectors.sudo import collect_sudo
from .serialize import to_dict
from ..async_utils import run_blocking

router = APIRouter()


@router.get("/sudo")
async def get_sudo():
    return to_dict(await run_blocking(collect_sudo))
