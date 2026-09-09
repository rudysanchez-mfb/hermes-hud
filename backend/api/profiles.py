"""Profiles endpoints."""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException

from backend.collectors.profiles import collect_profiles
from backend.collectors.utils import default_hermes_dir, load_yaml
from .serialize import to_dict

router = APIRouter()

PROFILE_NAME_RE = re.compile(r"^[A-Za-z0-9_.-]+$")

PROVIDER_OPTIONS = [
    "openai-codex",
    "anthropic",
    "openrouter",
    "zai",
    "google",
    "xai",
    "custom",
]

TOOLSET_OPTIONS = [
    "hermes-cli",
    "web",
    "browser",
    "terminal",
    "file",
    "code_execution",
    "vision",
    "image_gen",
    "skills",
    "todo",
    "memory",
    "session_search",
    "clarify",
    "delegation",
    "cronjob",
    "messaging",
]


def _profile_dir(profile_name: str) -> Path:
    hermes_dir = Path(default_hermes_dir())
    if profile_name == "default":
        return hermes_dir
    if not PROFILE_NAME_RE.match(profile_name) or profile_name in {".", ".."}:
        raise HTTPException(status_code=400, detail="invalid profile name")
    path = hermes_dir / "profiles" / profile_name
    try:
        path.relative_to(hermes_dir / "profiles")
    except ValueError:
        raise HTTPException(status_code=400, detail="invalid profile name") from None
    if not path.is_dir():
        raise HTTPException(status_code=404, detail="profile not found")
    return path


def _read_config(profile_dir: Path) -> dict[str, Any]:
    config_path = profile_dir / "config.yaml"
    if not config_path.exists():
        return {}
    try:
        data = load_yaml(config_path.read_text(encoding="utf-8")) or {}
        return data if isinstance(data, dict) else {}
    except OSError:
        raise HTTPException(status_code=500, detail="failed to read config.yaml") from None


def _read_soul(profile_dir: Path) -> str:
    soul_path = profile_dir / "SOUL.md"
    if not soul_path.exists():
        return ""
    try:
        return soul_path.read_text(encoding="utf-8")
    except OSError:
        raise HTTPException(status_code=500, detail="failed to read SOUL.md") from None


def _profile_edit_payload(profile_name: str, profile_dir: Path) -> dict[str, Any]:
    config = _read_config(profile_dir)
    model_cfg = config.get("model", {})
    if isinstance(model_cfg, str):
        model_cfg = {"default": model_cfg}
    if not isinstance(model_cfg, dict):
        model_cfg = {}

    display_cfg = config.get("display", {})
    if not isinstance(display_cfg, dict):
        display_cfg = {}

    compression_cfg = config.get("compression", {})
    if not isinstance(compression_cfg, dict):
        compression_cfg = {}

    toolsets = config.get("toolsets", [])
    if isinstance(toolsets, str):
        toolsets = [toolsets]
    if not isinstance(toolsets, list):
        toolsets = []

    return {
        "name": profile_name,
        "model": {
            "provider": str(model_cfg.get("provider") or ""),
            "default": str(model_cfg.get("default") or model_cfg.get("model") or ""),
            "base_url": str(model_cfg.get("base_url") or ""),
            "api_mode": str(model_cfg.get("api_mode") or ""),
            "context_length": model_cfg.get("context_length"),
        },
        "toolsets": [str(t) for t in toolsets],
        "skin": str(display_cfg.get("skin") or ""),
        "compression": {
            "enabled": bool(compression_cfg.get("enabled", False)),
            "summary_provider": str(compression_cfg.get("summary_provider") or ""),
            "summary_model": str(compression_cfg.get("summary_model") or ""),
        },
        "soul": _read_soul(profile_dir),
    }


@router.get("/profiles")
async def get_profiles():
    return to_dict(collect_profiles())


@router.get("/profiles/options")
async def profile_options():
    return {
        "providers": PROVIDER_OPTIONS,
        "toolsets": TOOLSET_OPTIONS,
    }


@router.get("/profiles/{profile_name}/edit")
def get_profile_edit(profile_name: str):
    profile_dir = _profile_dir(profile_name)
    return _profile_edit_payload(profile_name, profile_dir)
