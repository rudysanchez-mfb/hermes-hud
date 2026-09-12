"""Projects endpoint."""

from fastapi import APIRouter

from backend.collectors.projects import collect_projects
from .serialize import to_dict
from ..async_utils import run_blocking

router = APIRouter()


@router.get("/projects")
async def get_projects():
    return to_dict(await run_blocking(collect_projects))
