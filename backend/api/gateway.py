"""Gateway status + action endpoints."""

from fastapi import APIRouter, HTTPException

from backend.collectors.gateway import (
    ACTION_NAMES,
    collect_gateway_status,
    read_action_status,
)
from .serialize import to_dict

router = APIRouter()


@router.get("/gateway")
async def get_gateway():
    return to_dict(collect_gateway_status())


@router.get("/actions/{name}/status")
async def action_status(name: str):
    if name not in ACTION_NAMES:
        raise HTTPException(status_code=404, detail=f"Unknown action: {name}")
    return read_action_status(name)
