"""Debrid pipeline collector — Premiumize, TorBox, DebridLink, plex-debrid"""

from __future__ import annotations

import json
import logging
import os
import shutil
import subprocess
import time
import urllib.request
import urllib.error
from pathlib import Path
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)

# ═══ TTL cache (30s) ═══
_cache: Optional[tuple[float, "DebridPipelineState"]] = None


# ═══ Dataclasses ═══

@dataclass
class DebridService:
    name: str
    premium_until: Optional[str] = None
    storage_pct: Optional[float] = None
    active: int = 0
    total: int = 0
    errors: list[str] = field(default_factory=list)
    recent_transfers: list[Transfer] = field(default_factory=list)

@dataclass
class Transfer:
    name: str
    service: str
    status: str
    progress: float = 0.0
    speed: Optional[str] = None
    size: Optional[str] = None
    id: Optional[str] = None

@dataclass
class MountStatus:
    path: str
    ok: bool
    error: Optional[str] = None

@dataclass
class Alert:
    severity: str   # "critical" | "warning"
    label: str

@dataclass
class DebridPipelineState:
    services: list[DebridService] = field(default_factory=list)
    transfers: list[Transfer] = field(default_factory=list)
    mounts: list[MountStatus] = field(default_factory=list)
    plex_debrid: Optional[str] = None   # running status
    last_cycle: Optional[str] = None     # last cache check time
    alerts: list[Alert] = field(default_factory=list)
    updated_at: Optional[str] = None


# ═══ Helpers ═══

_SETTINGS_PATHS = (
    Path("/opt/media-stack/plex-debrid/config/settings.json"),   # media server
    Path("/root/state/plex-debrid-settings.json"),               # VPS synced copy
)

_REMOTE_SSH = [
    "ssh", "-i", "/root/.ssh/id_rsa",
    "-o", "StrictHostKeyChecking=no", "-o", "BatchMode=yes",
    "-o", "ConnectTimeout=8", "rsanchez@100.109.101.96",
]


def _remote_available() -> bool:
    return Path("/root/.ssh/id_rsa").exists()


def _remote_run(cmd: str, timeout: int = 12) -> subprocess.CompletedProcess:
    return subprocess.run(_REMOTE_SSH + [cmd],
                          capture_output=True, text=True, timeout=timeout)


def _load_keys() -> dict[str, str]:
    empty = {"premiumize": "", "torbox": "", "debridlink": ""}
    s = None
    for settings_path in _SETTINGS_PATHS:
        try:
            with open(settings_path) as f:
                s = json.load(f)
            break
        except (FileNotFoundError, NotADirectoryError, PermissionError, json.JSONDecodeError, OSError):
            continue
    if s is None:
        return empty
    return {
        "premiumize": s.get("Premiumize API Key", ""),
        "torbox": s.get("Torbox API Key", ""),
        "debridlink": s.get("Debrid Link API Key", ""),
    }

def _get(url: str, headers: dict | None = None, timeout: int = 10) -> dict:
    h = headers or {}
    h.setdefault("User-Agent", "hermes-hudui/1.0")
    req = urllib.request.Request(url, headers=h)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read())


def _docker_available() -> bool:
    """Cheap docker availability check — CLI present + a local socket (or DOCKER_HOST)."""
    if shutil.which("docker") is None:
        return False
    if os.environ.get("DOCKER_HOST"):
        return True
    return os.path.exists("/var/run/docker.sock") or os.path.exists("/run/docker.sock")


def _mount_ok(path: str) -> MountStatus:
    # Cheap existence check first — if the mount point is absent (e.g. the
    # cloud VPS has no /mnt/* debrid mounts), report unavailable without
    # spawning a subprocess that could hang on a stale FUSE mount.
    if not os.path.exists(path):
        return MountStatus(path=path, ok=False, error="not present")
    try:
        # `timeout 5 ls` guards against hung network/FUSE mounts. Honor the
        # exit code: a missing or unreadable path returns non-zero, which must
        # report ok=False (previously it was always ok=True).
        result = subprocess.run(["timeout", "5", "ls", path],
                                capture_output=True, timeout=10, check=False)
        if result.returncode != 0:
            err = result.stderr.decode(errors="replace").strip() or f"ls exited {result.returncode}"
            return MountStatus(path=path, ok=False, error=err[:100])
        return MountStatus(path=path, ok=True)
    except Exception as e:
        return MountStatus(path=path, ok=False, error=str(e)[:100])


def invalidate_debrid_cache() -> None:
    """Clear the TTL cache so the next collect_debrid() call fetches fresh data."""
    global _cache
    _cache = None


# ═══ Main collector ═══

def collect_debrid() -> DebridPipelineState:
    global _cache
    now = time.time()
    if _cache and (now - _cache[0]) < 30:
        return _cache[1]

    keys = _load_keys()
    state = DebridPipelineState()
    alerts: list[Alert] = []

    # ── Premiumize ──
    try:
        if keys["premiumize"]:
            info = _get(f"https://www.premiumize.me/api/account/info?apikey={keys['premiumize']}")
            xfers = _get(f"https://www.premiumize.me/api/transfer/list?apikey={keys['premiumize']}")
            active = [t for t in xfers.get("transfers", []) if t.get("status") == "running"]
            pm_active = len(active)
            pm_total = len(xfers.get("transfers", []))
            space_used = info.get("space_used", 0) or 0
            space_limit = info.get("space_limit") or None
            storage_pct = round((space_used / space_limit) * 100, 1) if space_limit else None
            state.services.append(DebridService(
                name="Premiumize",
                premium_until=info.get("premium_until_str"),
                storage_pct=storage_pct,
                active=pm_active,
                total=pm_total,
            ))
            pm_svc = state.services[-1]
            # Recent transfers (last 5, sorted: error → running → finished)
            _prio = {"error": 0, "running": 1, "finished": 2}
            _all = sorted(xfers.get("transfers", []),
                          key=lambda t: _prio.get(t.get("status", ""), 99))
            for t in _all[:5]:
                pm_svc.recent_transfers.append(Transfer(
                    id=str(t.get("id", "")),
                    name=t.get("name", "?"),
                    service="Premiumize",
                    status=t.get("status", "?"),
                    progress=t.get("progress", 0) * 100 if t.get("status") == "running" else 0,
                ))
            for t in active:
                state.transfers.append(Transfer(
                    id=str(t.get("id", "")),
                    name=t.get("name", "?"), service="Premiumize",
                    status="downloading", progress=t.get("progress", 0) * 100,
                    speed=t.get("speed"), size=str(t.get("filesize", ""))))
            if pm_active == 0:
                # Count errors
                failed = [t for t in xfers.get("transfers", []) if t.get("status") == "error"]
                if failed:
                    pm_svc.errors = [f.get("name", "?")[:60] for f in failed[:3]]
            if storage_pct and storage_pct > 90:
                alerts.append(Alert("warning", f"Premiumize storage at {state.services[-1].storage_pct}%"))
    except Exception as e:
        alerts.append(Alert("warning", f"Premiumize API: {str(e)[:80]}"))
        state.services.append(DebridService(name="Premiumize", errors=[str(e)[:80]]))

    # ── TorBox ──
    try:
        if keys["torbox"]:
            info = _get("https://api.torbox.app/v1/api/user/me",
                        {"Authorization": f"Bearer {keys['torbox']}"})
            mylist = _get("https://api.torbox.app/v1/api/torrents/mylist?bypass_cache=true",
                          {"Authorization": f"Bearer {keys['torbox']}"})
            _plan_id = info.get("data", {}).get("plan", -1)
            _plan_names = {0: "Free", 1: "Essential", 2: "Pro", 3: "Pro+"}
            plan = _plan_names.get(_plan_id, "?")
            active = [t for t in mylist.get("data", []) if t.get("download_state") == "downloading"]
            state.services.append(DebridService(
                name=f"TorBox ({plan})",
                premium_until=info.get("data", {}).get("premium_expires_at"),
                active=len(active),
                total=len(mylist.get("data", [])),
            ))
            tb_svc = state.services[-1]
            # Recent transfers (last 5, sorted: error → downloading → done)
            _prio2 = {"error": 0, "meta": 0, "dead": 0,
                       "downloading": 1, "uploading": 1, "processing": 1,
                       "done": 2, "completed": 2, "seeding": 2, "cached": 2}
            _all2 = sorted(mylist.get("data", []),
                           key=lambda t: _prio2.get(t.get("download_state", ""), 99))
            for t in _all2[:5]:
                tb_svc.recent_transfers.append(Transfer(
                    id=str(t.get("id", t.get("hash", ""))),
                    name=t.get("name", "?"),
                    service="TorBox",
                    status=t.get("download_state", "?"),
                    progress=t.get("progress", 0),
                ))
            for t in active:
                state.transfers.append(Transfer(
                    id=str(t.get("id", t.get("hash", ""))),
                    name=t.get("name", "?"), service="TorBox",
                    status="downloading", progress=t.get("progress", 0),
                    size=t.get("size")))
    except Exception as e:
        alerts.append(Alert("warning", f"TorBox API: {str(e)[:80]}"))
        state.services.append(DebridService(name="TorBox", errors=[str(e)[:80]]))

    # ── DebridLink ──
    try:
        if keys["debridlink"]:
            info = _get("https://debrid-link.com/api/v2/account/infos",
                        {"Authorization": f"Bearer {keys['debridlink']}"})
            dls = _get("https://debrid-link.com/api/v2/downloader/list",
                       {"Authorization": f"Bearer {keys['debridlink']}"})
            dl_active = [d for d in dls.get("value", []) if d.get("downloadPercent", 0) < 100]
            state.services.append(DebridService(
                name="DebridLink",
                premium_until=str(info.get("value", {}).get("premiumLeft", "?")) + "d",
                active=len(dl_active),
                total=len(dls.get("value", [])),
            ))
            dl_svc = state.services[-1]
            # Recent transfers (last 5, sorted: error → downloading → completed)
            _prio3 = {"error": 0, "failed": 0,
                       "downloading": 1, "processing": 1,
                       "completed": 2, "done": 2, "downloaded": 2}
            _all3 = sorted(dls.get("value", []),
                           key=lambda t: _prio3.get(t.get("status", ""), 99))
            for d in _all3[:5]:
                dl_svc.recent_transfers.append(Transfer(
                    id=str(d.get("id", "")),
                    name=d.get("name", "?"),
                    service="DebridLink",
                    status=d.get("status", "?"),
                    progress=d.get("downloadPercent", 0),
                ))
            for d in dl_active:
                state.transfers.append(Transfer(
                    id=str(d.get("id", "")),
                    name=d.get("name", "?"), service="DebridLink",
                    status="downloading", progress=d.get("downloadPercent", 0),
                    speed=str(d.get("downloadSpeed", "")) + " B/s"))
    except Exception as e:
        alerts.append(Alert("warning", f"DebridLink API: {str(e)[:80]}"))
        state.services.append(DebridService(name="DebridLink", errors=[str(e)[:80]]))

    # ── Mounts (local when present, else checked on the media server over SSH) ──
    _mps = ["/mnt/premiumize", "/mnt/debridlink", "/mnt/media_pool"]
    if any(os.path.exists(mp) for mp in _mps):
        for mp in _mps:
            ms = _mount_ok(mp)
            state.mounts.append(ms)
            if not ms.ok:
                alerts.append(Alert("critical", f"Mount missing: {mp}"))
    elif _remote_available():
        try:
            probe = " ; ".join(
                f"timeout 5 ls {mp} >/dev/null 2>&1 && echo {mp}=OK || echo {mp}=FAIL"
                for mp in _mps
            )
            res = _remote_run(probe, timeout=25)
            seen = dict(l.split("=", 1) for l in res.stdout.split() if "=" in l)
            for mp in _mps:
                ok = seen.get(mp) == "OK"
                state.mounts.append(MountStatus(path=mp, ok=ok,
                                                error=None if ok else "remote check failed"))
                if not ok:
                    alerts.append(Alert("critical", f"Mount missing: {mp}"))
        except Exception as e:
            alerts.append(Alert("warning", f"remote mount check: {str(e)[:80]}"))
    else:
        alerts.append(Alert("warning", "mounts unavailable (no local /mnt and no SSH key)"))

    # ── plex-debrid container ──
    if not _docker_available() and _remote_available():
        try:
            pd = _remote_run("docker inspect plex-debrid --format '{{.State.Status}}'")
            state.plex_debrid = pd.stdout.strip()
            logs = _remote_run("docker logs plex-debrid --tail 100 2>&1")
            for line in reversed(logs.stdout.splitlines()):
                if "Cache check" in line or "cache check" in line:
                    state.last_cycle = line.strip()[:120]
                    break
            if pd.returncode != 0 or "running" not in pd.stdout:
                alerts.append(Alert("critical", "plex-debrid container not running"))
        except Exception as e:
            alerts.append(Alert("warning", f"plex-debrid (remote): {str(e)[:80]}"))
    elif not _docker_available():
        logger.warning("plex-debrid unavailable (no docker daemon)")
        alerts.append(Alert("warning", "plex-debrid unavailable (no docker daemon)"))
    else:
        try:
            pd = subprocess.run(
                ["docker", "inspect", "plex-debrid", "--format",
                 "{{.State.Status}}"],
                capture_output=True, text=True, timeout=5)
            state.plex_debrid = pd.stdout.strip()

            # Last cycle from logs
            logs = subprocess.run(
                ["docker", "logs", "plex-debrid", "--tail", "100"],
                capture_output=True, text=True, timeout=5)
            for line in reversed(logs.stdout.splitlines()):
                if "Cache check" in line or "cache check" in line:
                    state.last_cycle = line.strip()[:120]
                    break

            if pd.returncode != 0 or "running" not in pd.stdout:
                alerts.append(Alert("critical", "plex-debrid container not running"))
        except Exception as e:
            alerts.append(Alert("warning", f"plex-debrid: {str(e)[:80]}"))

    state.alerts = alerts
    state.updated_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    _cache = (now, state)
    return state
