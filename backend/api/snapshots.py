"""Snapshot history endpoint for growth delta."""

from fastapi import APIRouter

from backend.collectors.snapshot import load_snapshots
from backend.async_utils import run_blocking

router = APIRouter()


@router.get("/snapshots")
async def get_snapshots():
    """Return all historical snapshots for growth delta display."""
    snapshots = await run_blocking(load_snapshots)
    return {"snapshots": snapshots, "total": len(snapshots)}
