"""Skills endpoints."""

from __future__ import annotations

import os
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import PlainTextResponse

from backend.collectors.skills import collect_skills
from backend.collectors.utils import default_hermes_dir
from .serialize import to_dict

router = APIRouter()


@router.get("/skills")
async def get_skills():
    state = collect_skills()
    result = to_dict(state)
    # These are methods, not properties, so they're not auto-serialized
    result["by_category"] = to_dict(state.by_category())
    result["category_counts"] = to_dict(state.category_counts())
    result["recently_modified"] = to_dict(state.recently_modified(10))
    result["most_used"] = to_dict(state.most_used(10))
    return result


@router.get("/skills/{name}")
async def get_skill_detail(name: str):
    """Get full detail for a single skill including content."""
    state = collect_skills()

    # Find skill by name (case-insensitive exact match)
    skill = None
    for s in state.skills:
        if s.name.lower() == name.lower():
            skill = s
            break

    if skill is None:
        raise HTTPException(status_code=404, detail=f"Skill '{name}' not found")

    # Read full content
    content = ""
    try:
        content = Path(skill.path).read_text(encoding="utf-8")
    except Exception:
        pass

    result = to_dict(skill)
    result["content"] = content
    return result


@router.get("/skills/{name}/file")
async def get_skill_file(name: str, path: str = Query(..., description="Relative path within skill dir")):
    """Serve a linked file (references/, templates/, scripts/) for a skill."""
    state = collect_skills()

    skill = None
    for s in state.skills:
        if s.name.lower() == name.lower():
            skill = s
            break

    if skill is None:
        raise HTTPException(status_code=404, detail=f"Skill '{name}' not found")

    skill_dir = Path(skill.path).parent
    target = skill_dir / path

    # Path traversal guard: ensure target is within skill_dir
    try:
        target.resolve().relative_to(skill_dir.resolve())
    except ValueError:
        raise HTTPException(status_code=403, detail="Access denied")

    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=404, detail=f"File '{path}' not found")

    try:
        text = target.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        # Try binary read and return as-is for non-text files
        text = target.read_bytes().decode("utf-8", errors="replace")

    return PlainTextResponse(text)
