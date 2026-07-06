"""Debrid pipeline collector — Premiumize, TorBox, DebridLink, plex-debrid"""

import json
import subprocess
import time
import urllib.request
import urllib.error
from pathlib import Path
from dataclasses import dataclass, field
from typing import Optional

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

@dataclass
class Transfer:
    name: str
    service: str
    status: str
    progress: float = 0.0
    speed: Optional[str] = None
    size: Optional[str] = None

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

def _load_keys() -> dict[str, str]:
    settings_path = Path("/opt/media-stack/plex-debrid/config/settings.json")
    with open(settings_path) as f:
        s = json.load(f)
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

def _mount_ok(path: str) -> MountStatus:
    try:
        subprocess.run(["timeout", "5", "ls", path],
                       capture_output=True, timeout=10, check=False)
        return MountStatus(path=path, ok=True)
    except Exception as e:
        return MountStatus(path=path, ok=False, error=str(e)[:100])


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
            for t in active:
                state.transfers.append(Transfer(
                    name=t.get("name", "?"), service="Premiumize",
                    status="downloading", progress=t.get("progress", 0) * 100,
                    speed=t.get("speed"), size=str(t.get("filesize", ""))))
            if pm_active == 0:
                # Count errors
                failed = [t for t in xfers.get("transfers", []) if t.get("status") == "error"]
                if failed:
                    pm_svc = state.services[-1]
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
            for t in active:
                state.transfers.append(Transfer(
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
            for d in dl_active:
                state.transfers.append(Transfer(
                    name=d.get("name", "?"), service="DebridLink",
                    status="downloading", progress=d.get("downloadPercent", 0),
                    speed=str(d.get("downloadSpeed", "")) + " B/s"))
    except Exception as e:
        alerts.append(Alert("warning", f"DebridLink API: {str(e)[:80]}"))
        state.services.append(DebridService(name="DebridLink", errors=[str(e)[:80]]))

    # ── Mounts ──
    for mp in ["/mnt/premiumize", "/mnt/debridlink", "/mnt/media_pool"]:
        ms = _mount_ok(mp)
        state.mounts.append(ms)
        if not ms.ok:
            alerts.append(Alert("critical", f"Mount missing: {mp}"))

    # ── plex-debrid container ──
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
