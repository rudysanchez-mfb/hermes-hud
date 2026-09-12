"""Startup cache prewarm for expensive Hermes HUD collectors.

Warms the heavy collector caches in a daemon background thread so the first
real request after startup does not trigger a full cold recompute (the worst
case is ~150s for patterns on a 5.7GB DB). Runs entirely off the event loop,
never blocks startup, and never raises: when the data directory or DB is
missing/unreadable each collector already returns an empty state, and any
unexpected error is logged and swallowed.
"""

from __future__ import annotations

import logging
import os
import threading

logger = logging.getLogger(__name__)


def _resolve_hermes_dir() -> str:
    return os.environ.get("HERMES_HOME") or os.path.expanduser("~/.hermes")


def _warm_all(hermes_dir: str | None) -> None:
    """Populate the heavy collector caches. Never raises.

    Warms every collector that writes to the module cache: patterns,
    sessions, profiles, skills, corrections, sudo, agents.
    """
    try:
        from .collectors import (
            agents,
            corrections,
            patterns,
            profiles,
            sessions,
            skills,
            sudo,
        )
        from .collectors import collect as collect_mod
        from .api import token_costs as token_costs_mod
    except Exception:
        logger.exception("Prewarm: failed to import collectors")
        return

    collectors = (
        patterns.collect_patterns,
        sessions.collect_sessions,
        profiles.collect_profiles,
        skills.collect_skills,
        corrections.collect_corrections,
        sudo.collect_sudo,
        agents.collect_agents,
        collect_mod.collect_all,
    )

    # token_costs takes args, warm the dashboard's exact calls separately
    try:
        token_costs_mod._cached_token_costs("all", None, None, "day")
    except Exception:
        logger.exception("Prewarm failed for token_costs")

    for collect in collectors:
        try:
            collect(hermes_dir)
        except Exception:
            logger.exception(
                "Prewarm failed for %s", getattr(collect, "__name__", repr(collect))
            )


def start_prewarm(hermes_dir: str | None = None) -> threading.Thread:
    """Warm the heavy collector caches in a daemon background thread.

    Does not block the caller and never raises. Safe to call when the data
    directory or DB is missing/unreadable.

    Returns the started daemon thread.
    """
    if hermes_dir is None:
        hermes_dir = _resolve_hermes_dir()

    def _run() -> None:
        try:
            _warm_all(hermes_dir)
        except Exception:
            logger.exception("Prewarm thread crashed")

    thread = threading.Thread(target=_run, name="hermes-hud-prewarm", daemon=True)
    thread.start()
    return thread
