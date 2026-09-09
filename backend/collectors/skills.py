"""Scan Hermes skills directory and extract metadata."""

from __future__ import annotations

import json
import os
import sqlite3
from collections import Counter
from datetime import datetime
from pathlib import Path

from ..cache import get_cached_or_compute
from .models import SkillInfo, SkillsState
from .utils import default_hermes_dir


def _parse_frontmatter(content: str) -> dict:
    """Extract YAML frontmatter between --- markers."""
    if not content.startswith("---"):
        return {}
    end = content.find("\n---", 3)
    if end == -1:
        return {}
    try:
        import yaml
        return yaml.safe_load(content[3:end]) or {}
    except Exception:
        # Fallback: minimal line parser
        fm = {}
        for line in content[3:end].split("\n"):
            if ":" in line:
                key, _, val = line.partition(":")
                key = key.strip()
                val = val.strip().strip("'\"")
                fm[key] = val
        return fm


def _parse_skill_md(path: Path) -> dict:
    """Extract metadata from a SKILL.md file."""
    try:
        content = path.read_text(encoding="utf-8")
    except Exception:
        return {}

    fm = _parse_frontmatter(content)

    # Derive name from frontmatter or directory
    name = fm.get("name", "")
    category = fm.get("category", "")
    description = fm.get("description", "")
    version = fm.get("version", "")
    author = fm.get("author", "")
    triggers = []
    raw_triggers = fm.get("trigger", [])
    if isinstance(raw_triggers, str):
        triggers = [raw_triggers]
    elif isinstance(raw_triggers, list):
        triggers = [str(t) for t in raw_triggers]

    # Fallback description from first non-empty, non-heading line
    if not description:
        for line in content.split("\n"):
            stripped = line.strip()
            if stripped and not stripped.startswith("#") and not stripped.startswith("---"):
                description = stripped[:200]
                break

    return {
        "name": name,
        "category": category,
        "description": description,
        "version": version,
        "author": author,
        "triggers": triggers,
        "content": content,
    }


def _scan_linked_files(skill_dir: Path) -> dict[str, list[str]]:
    """Scan references/, templates/, scripts/ subdirectories."""
    linked: dict[str, list[str]] = {}
    for subdir_name in ("references", "templates", "scripts"):
        subdir = skill_dir / subdir_name
        if subdir.exists() and subdir.is_dir():
            files = sorted(
                str(p.relative_to(skill_dir))
                for p in subdir.rglob("*")
                if p.is_file()
            )
            if files:
                linked[subdir_name] = files
    return linked


def _mine_skill_usage(hermes_dir: str | None) -> dict[str, tuple[int, datetime | None]]:
    """Mine state.db for skill_view tool call counts per skill.

    Returns {skill_name: (count, last_used)}.
    """
    if hermes_dir is None:
        hermes_dir = default_hermes_dir()

    db_path = Path(hermes_dir) / "state.db"
    if not db_path.exists():
        return {}

    usage: dict[str, list[int]] = {}  # name -> [timestamps]
    try:
        conn = sqlite3.connect(str(db_path))
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()

        cur.execute(
            """
            SELECT timestamp, tool_calls
            FROM (SELECT timestamp, tool_calls FROM messages ORDER BY rowid DESC LIMIT 150000)
            WHERE tool_calls LIKE '%skill_view%'
            ORDER BY timestamp DESC
            """
        )

        for row in cur:
            try:
                ts_raw = row["timestamp"]
                ts = datetime.fromtimestamp(ts_raw) if ts_raw else None
                calls = json.loads(row["tool_calls"])
                if not isinstance(calls, list):
                    continue
                for call in calls:
                    fn = call.get("function", {})
                    if fn.get("name") != "skill_view":
                        continue
                    args = json.loads(fn.get("arguments", "{}"))
                    name = args.get("name", "")
                    # Strip plugin: prefix and category: prefix
                    if ":" in name:
                        parts = name.split(":")
                        if len(parts) == 2 and parts[0] not in ("http", "https"):
                            name = parts[1]
                    if not name:
                        continue
                    usage.setdefault(name, []).append(int(ts_raw) if ts_raw else 0)
            except Exception:
                continue

        conn.close()
    except Exception:
        return {}

    # Aggregate
    result: dict[str, tuple[int, datetime | None]] = {}
    for name, timestamps in usage.items():
        count = len(timestamps)
        last_ts = max(timestamps) if timestamps else None
        last_used = datetime.fromtimestamp(last_ts) if last_ts else None
        result[name] = (count, last_used)

    return result


def _detect_custom(skill: SkillInfo, bulk_timestamps: set[int]) -> bool:
    """Heuristic: a skill is 'custom' if its mtime doesn't match a bulk install timestamp."""
    skill_minute = int(skill.modified_at.timestamp()) // 60
    return skill_minute not in bulk_timestamps


def _do_collect_skills(skills_dir: Path, hermes_dir: str | None) -> SkillsState:
    """Actually scan skills directory (internal, uncached)."""
    skills: list[SkillInfo] = []
    mtimes: list[int] = []

    # Pre-compute usage stats
    usage_stats = _mine_skill_usage(hermes_dir)

    for skill_md in skills_dir.rglob("SKILL.md"):
        stat = skill_md.stat()
        mtime = datetime.fromtimestamp(stat.st_mtime)
        mtime_minute = int(stat.st_mtime) // 60

        rel = skill_md.relative_to(skills_dir)
        parts = rel.parts[:-1]  # remove SKILL.md
        if len(parts) >= 2:
            category = parts[0]
            name = parts[-1]
        elif len(parts) == 1:
            category = "uncategorized"
            name = parts[0]
        else:
            continue

        meta = _parse_skill_md(skill_md)
        # Override category/name from frontmatter if present
        if meta.get("category"):
            category = meta["category"]
        if meta.get("name"):
            name = meta["name"]

        # Usage stats
        usage_count, last_used = usage_stats.get(name, (0, None))

        # Linked files
        linked = _scan_linked_files(skill_md.parent)

        skills.append(
            SkillInfo(
                name=meta.get("name", name),
                category=category,
                description=meta.get("description", ""),
                path=str(skill_md),
                modified_at=mtime,
                file_size=stat.st_size,
                triggers=meta.get("triggers", []),
                linked_files=linked,
                usage_count=usage_count,
                last_used=last_used,
                version=meta.get("version", ""),
                author=meta.get("author", ""),
            )
        )
        mtimes.append(mtime_minute)

    # Detect bulk install timestamps (most common minute-rounded mtimes)
    if mtimes:
        counter = Counter(mtimes)
        bulk_timestamps = {t for t, count in counter.items() if count >= 5}

        for skill in skills:
            skill.is_custom = _detect_custom(skill, bulk_timestamps)

    return SkillsState(skills=skills)


def collect_skills(hermes_dir: str | None = None) -> SkillsState:
    """Collect all skills metadata (cached, invalidates on directory changes)."""
    if hermes_dir is None:
        hermes_dir = default_hermes_dir(hermes_dir)

    skills_dir = Path(hermes_dir) / "skills"
    if not skills_dir.exists():
        return SkillsState()

    return get_cached_or_compute(
        cache_key=f"skills:v2:{hermes_dir}",
        compute_fn=lambda: _do_collect_skills(skills_dir, hermes_dir),
        dir_paths=[skills_dir],
        ttl=60,  # 60 second cache even if unchanged
    )
