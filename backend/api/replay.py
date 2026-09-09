"""Replay endpoints."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from backend.collectors.replay import get_replay_detail, list_replay_runs
from backend.api.serialize import to_dict
from backend.services.replay_exporter import (
    get_replay_gallery,
    get_skill_provenance_index,
    get_replay_settings,
)

router = APIRouter()


@router.get("/replay/runs")
async def get_replay_runs(limit: int = Query(50, ge=1, le=500)):
    return {"runs": to_dict(list_replay_runs(limit=limit))}


@router.get("/replay/settings")
async def get_settings():
    return get_replay_settings()


@router.get("/replay/skills")
async def get_replay_skills():
    return get_skill_provenance_index()


@router.get("/replay/gallery")
async def get_gallery():
    return get_replay_gallery()


@router.get("/replay/runs/{session_id}")
async def get_replay_run(session_id: str):
    replay = get_replay_detail(session_id)
    if replay is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return to_dict(replay)
