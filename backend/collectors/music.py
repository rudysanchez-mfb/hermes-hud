"""Music pipeline collector — Lidarr, Transmission, Nicotine+, enricher"""

import json
import os
import subprocess
import time
import urllib.request
import urllib.error
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

# ═══ TTL cache (30s) ═══
_cache: Optional[tuple[float, "MusicPipelineState"]] = None


# ═══ Dataclasses ═══

@dataclass
class LidarrQueue:
    active: int = 0
    items: list[dict] = field(default_factory=list)

@dataclass
class TorrentItem:
    name: str
    status: str
    progress: float = 0.0
    download_dir: str = ""

@dataclass
class NicotineStatus:
    running: bool = False
    healthy: Optional[bool] = None
    recent_files: int = 0

@dataclass
class EnricherStatus:
    last_run: Optional[str] = None
    enriched: int = 0
    with_artwork: int = 0
    no_bio: int = 0
    total_processed: int = 0
    artists: list[dict] = field(default_factory=list)
    runs: list[dict] = field(default_factory=list)  # [{started_at, ended_at, stats}]
    selected_run: Optional[str] = None

@dataclass
class Alert:
    severity: str
    label: str

@dataclass
class MusicPipelineState:
    lidarr_queue: LidarrQueue = field(default_factory=LidarrQueue)
    lidarr_wanted: int = 0
    recent_imports: list[dict] = field(default_factory=list)
    torrents: list[TorrentItem] = field(default_factory=list)
    nicotine: NicotineStatus = field(default_factory=NicotineStatus)
    enricher: EnricherStatus = field(default_factory=EnricherStatus)
    alerts: list[Alert] = field(default_factory=list)
    updated_at: Optional[str] = None


# ═══ Helpers ═══

LIDARR_KEY = ""  # lazy init

def _get_lidarr_key() -> str:
    global LIDARR_KEY
    if LIDARR_KEY:
        return LIDARR_KEY
    try:
        r = subprocess.run(
            ["docker", "exec", "lidarr", "cat", "/config/config.xml"],
            capture_output=True, text=True, timeout=5)
        import re
        m = re.search(r'<ApiKey>([^<]+)', r.stdout)
        if m:
            LIDARR_KEY = m.group(1)
    except Exception:
        pass
    return LIDARR_KEY

def _get_json(url: str, timeout: int = 10) -> dict:
    req = urllib.request.Request(url)
    req.add_header("X-Api-Key", _get_lidarr_key())
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read())

def _transmission_rpc(method: str, args: dict) -> dict:
    """Transmission RPC with CSRF token dance."""
    url = "http://localhost:9091/transmission/rpc"
    session_id: str | None = None

    # First try — get session ID from 409
    try:
        req = urllib.request.Request(url, data=b"", method="POST")
        urllib.request.urlopen(req, timeout=5)
    except urllib.error.HTTPError as e:
        session_id = e.headers.get("X-Transmission-Session-Id")

    if not session_id:
        return {}

    body = json.dumps({"method": method, "arguments": args}).encode()
    req = urllib.request.Request(url, data=body, method="POST")
    req.add_header("X-Transmission-Session-Id", session_id)
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return json.loads(r.read())
    except Exception:
        return {}


# ═══ Main collector ═══

def collect_music() -> MusicPipelineState:
    global _cache
    now = time.time()
    if _cache and (now - _cache[0]) < 30:
        return _cache[1]

    state = MusicPipelineState()
    alerts: list[Alert] = []

    # ── Lidarr queue ──
    try:
        queue = _get_json("http://localhost:8686/api/v1/queue?pageSize=50")
        records = queue.get("records", [])
        state.lidarr_queue = LidarrQueue(
            active=len(records),
            items=[{
                "artist": r.get("artist", {}).get("artistName", "?"),
                "title": r.get("title", "?"),
                "status": r.get("status", "?"),
                "size": r.get("size", 0),
                "timeleft": r.get("timeleft", "?"),
            } for r in records[:10]],
        )
    except Exception as e:
        alerts.append(Alert("warning", f"Lidarr queue: {str(e)[:80]}"))

    # ── Lidarr wanted ──
    try:
        wanted = _get_json("http://localhost:8686/api/v1/wanted/missing?pageSize=1&page=1")
        state.lidarr_wanted = wanted.get("totalRecords", 0)
        if state.lidarr_wanted > 50:
            alerts.append(Alert("warning", f"Lidarr: {state.lidarr_wanted} wanted albums missing"))
    except Exception:
        pass

    # ── Recent imports ──
    try:
        history = _get_json("http://localhost:8686/api/v1/history?pageSize=8&sortKey=date&sortDirection=descending&includeArtist=true")
        state.recent_imports = [{
            "artist": h.get("artist", {}).get("artistName", "?"),
            "title": h.get("sourceTitle", "?"),
            "date": h.get("date", "")[:10],
            "quality": h.get("quality", {}).get("quality", {}).get("name", "?"),
        } for h in history.get("records", [])[:8]]
    except Exception:
        pass

    # ── Transmission ──
    try:
        r = _transmission_rpc("torrent-get", {
            "fields": ["name", "status", "percentDone", "downloadDir"]
        })
        all_torrents = r.get("arguments", {}).get("torrents", [])
        # Filter to music-related dirs or all if small set
        music_torrents = [
            t for t in all_torrents
            if "music" in (t.get("downloadDir", "")).lower()
            or "lidarr" in (t.get("downloadDir", "")).lower()
        ] or all_torrents[:20]  # fallback: show first 20
        STATUS_MAP = {
            0: "paused", 1: "queued", 2: "checking",
            3: "queued", 4: "downloading", 5: "queued", 6: "seeding",
        }
        for t in music_torrents[:15]:
            state.torrents.append(TorrentItem(
                name=t.get("name", "?")[:80],
                status=STATUS_MAP.get(t.get("status", 0), "?"),
                progress=t.get("percentDone", 0) * 100,
                download_dir=t.get("downloadDir", ""),
            ))
    except Exception as e:
        alerts.append(Alert("warning", f"Transmission: {str(e)[:80]}"))

    # ── Nicotine+ ──
    try:
        insp = subprocess.run(
            ["docker", "inspect", "nicotine", "--format",
             "{{.State.Status}} {{.State.Health.Status}}"],
            capture_output=True, text=True, timeout=5)
        parts = insp.stdout.strip().split()
        state.nicotine.running = parts[0] == "running" if parts else False
        state.nicotine.healthy = parts[1] == "healthy" if len(parts) > 1 else None

        # Recent files
        dl_dir = "/mnt/media-ext1/soulseek/downloads"
        if os.path.isdir(dl_dir):
            count = 0
            cutoff = time.time() - 1800  # 30 min
            for root, _, files in os.walk(dl_dir):
                for f in files:
                    fp = os.path.join(root, f)
                    if os.path.getmtime(fp) > cutoff:
                        count += 1
                        if count > 50:
                            break
                if count > 50:
                    break
            state.nicotine.recent_files = count

        if not state.nicotine.running:
            alerts.append(Alert("critical", "Nicotine+ container not running"))
    except Exception as e:
        alerts.append(Alert("warning", f"Nicotine+: {str(e)[:80]}"))

    # ── Enricher ──
    try:
        # Hermes agent runs in a sandboxed HOME; enricher writes there
        sandbox_path = Path("/home/rsanchez/.hermes/home/.hermes/state/music-enricher-state.json")
        real_path = Path.home() / ".hermes" / "state" / "music-enricher-state.json"
        candidates = [p for p in (sandbox_path, real_path) if p.exists()]
        enricher_path = max(candidates, key=lambda p: p.stat().st_mtime) if candidates else None
        if enricher_path and enricher_path.exists():
            data = json.loads(enricher_path.read_text(encoding="utf-8"))
            stats = data.get("stats", {})
            processed = data.get("processed", {})
            runs_raw = data.get("runs", [])

            # Build runs metadata for the frontend selector
            runs_meta = []
            for run in runs_raw:
                run_stats = run.get("stats", {})
                runs_meta.append({
                    "started_at": run.get("started_at", ""),
                    "ended_at": run.get("ended_at", ""),
                    "enriched": run_stats.get("enriched", 0),
                    "no_bio": run_stats.get("no_bio", 0),
                    "total": run_stats.get("total", len(run.get("artists", []))),
                })

            def _build_artist_entry(src: dict, key: str = "") -> dict:
                """Build a normalized artist entry from either processed dict or run artist."""
                entry = {
                    "name": src.get("name", "?"),
                    "status": src.get("status", "?"),
                    "key": src.get("key", key),
                }
                if src.get("status") == "enriched":
                    entry["chars"] = src.get("chars", 0)
                    entry["source"] = src.get("source", "?")
                    entry["artwork"] = src.get("artwork", False)
                    entry["description"] = src.get("description", "")
                    entry["artwork_source"] = src.get("artwork_source", "")
                    if not src.get("artwork"):
                        if entry["chars"] < 200:
                            entry["reason"] = "Bio too short for artwork (< 200 chars)"
                        else:
                            entry["reason"] = "No Wikipedia image available"
                return entry

            def _count_stats(artist_list: list[dict]) -> tuple[int, int, int]:
                enriched = sum(1 for a in artist_list if a.get("status") == "enriched")
                artwork = sum(1 for a in artist_list if a.get("artwork"))
                no_bio = sum(1 for a in artist_list if a.get("status") == "no_bio")
                return enriched, artwork, no_bio

            # Build full artist list from processed dict (represents current library state)
            artist_list = []
            for key, val in processed.items():
                artist_list.append(_build_artist_entry(val, key))
            artist_list.sort(key=lambda a: (0 if a["status"] == "enriched" else 1, a["name"]))
            enriched_count, artwork_count, no_bio_count = _count_stats(list(processed.values()))

            if runs_raw:
                latest_run = runs_raw[-1]
                state.enricher = EnricherStatus(
                    last_run=latest_run.get("started_at", stats.get("last_run", "")),
                    enriched=enriched_count,
                    with_artwork=artwork_count,
                    no_bio=no_bio_count,
                    total_processed=len(processed),
                    artists=artist_list,
                    runs=runs_meta,
                    selected_run=latest_run.get("started_at", ""),
                )
            else:
                # Backward compat: flat processed dict
                state.enricher = EnricherStatus(
                    last_run=stats.get("last_run", ""),
                    enriched=enriched_count,
                    with_artwork=artwork_count,
                    no_bio=no_bio_count,
                    total_processed=len(processed),
                    artists=artist_list,
                    runs=runs_meta,
                )
    except Exception:
        pass

    state.alerts = alerts
    state.updated_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    _cache = (now, state)
    return state


def apply_enricher_run_filter(state: MusicPipelineState, run_date: Optional[str]) -> MusicPipelineState:
    """Filter enricher data to a specific run date. Mutates state in-place."""
    if not run_date:
        return state

    if run_date == "all":
        # All-time aggregate — rebuild from flat processed
        sandbox_path = Path("/home/rsanchez/.hermes/home/.hermes/state/music-enricher-state.json")
        real_path = Path.home() / ".hermes" / "state" / "music-enricher-state.json"
        candidates = [p for p in (sandbox_path, real_path) if p.exists()]
        enricher_path = max(candidates, key=lambda p: p.stat().st_mtime) if candidates else None
        if enricher_path and enricher_path.exists():
            data = json.loads(enricher_path.read_text(encoding="utf-8"))
            processed = data.get("processed", {})
            artist_list = []
            for key, val in processed.items():
                entry = {
                    "name": val.get("name", "?"),
                    "status": val.get("status", "?"),
                    "key": key,
                }
                if val.get("status") == "enriched":
                    entry["chars"] = val.get("chars", 0)
                    entry["source"] = val.get("source", "?")
                    entry["artwork"] = val.get("artwork", False)
                    entry["description"] = val.get("description", "")
                    if val.get("artwork"):
                        pass
                    else:
                        if entry["chars"] < 200:
                            entry["reason"] = "Bio too short for artwork (< 200 chars)"
                        else:
                            entry["reason"] = "No Wikipedia image available"
                artist_list.append(entry)
            artist_list.sort(key=lambda a: (0 if a["status"] == "enriched" else 1, a["name"]))
            enriched = sum(1 for a in artist_list if a["status"] == "enriched")
            artwork = sum(1 for a in artist_list if a.get("artwork"))
            no_bio = sum(1 for a in artist_list if a["status"] == "no_bio")
            state.enricher.artists = artist_list
            state.enricher.enriched = enriched
            state.enricher.with_artwork = artwork
            state.enricher.no_bio = no_bio
            state.enricher.total_processed = len(artist_list)
            state.enricher.selected_run = "all"
        return state

    # Specific run — requires runs to exist
    if not state.enricher.runs:
        return state

    # Find matching run by date prefix
    target_run = None
    for run in state.enricher.runs:
        if run.get("started_at", "").startswith(run_date):
            target_run = run
            break

    if not target_run:
        return state  # no match — keep current

    # Re-read the full run data from disk (run artists not kept in memory)
    sandbox_path = Path("/home/rsanchez/.hermes/home/.hermes/state/music-enricher-state.json")
    real_path = Path.home() / ".hermes" / "state" / "music-enricher-state.json"
    enricher_path = sandbox_path if sandbox_path.exists() else real_path
    if enricher_path.exists():
        data = json.loads(enricher_path.read_text(encoding="utf-8"))
        for run in data.get("runs", []):
            if run.get("started_at", "").startswith(run_date):
                run_artists = run.get("artists", [])
                artist_list = []
                for a in run_artists:
                    entry = {
                        "name": a.get("name", "?"),
                        "status": a.get("status", "?"),
                        "key": a.get("key", ""),
                    }
                    if a.get("status") == "enriched":
                        entry["chars"] = a.get("chars", 0)
                        entry["source"] = a.get("source", "?")
                        entry["artwork"] = a.get("artwork", False)
                        entry["description"] = a.get("description", "")
                        entry["artwork_source"] = a.get("artwork_source", "")
                        if not a.get("artwork"):
                            if entry["chars"] < 200:
                                entry["reason"] = "Bio too short for artwork (< 200 chars)"
                            else:
                                entry["reason"] = "No Wikipedia image available"
                    artist_list.append(entry)
                artist_list.sort(key=lambda a: (0 if a["status"] == "enriched" else 1, a["name"]))
                enriched = sum(1 for a in artist_list if a["status"] == "enriched")
                artwork = sum(1 for a in artist_list if a.get("artwork"))
                no_bio = sum(1 for a in artist_list if a["status"] == "no_bio")
                state.enricher.artists = artist_list
                state.enricher.enriched = enriched
                state.enricher.with_artwork = artwork
                state.enricher.no_bio = no_bio
                state.enricher.total_processed = len(artist_list)
                state.enricher.selected_run = run.get("started_at", "")
                break

    return state
