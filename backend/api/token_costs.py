"""Token cost endpoint — calculates estimated USD costs per model."""

import re
import sqlite3
from calendar import monthrange
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import APIRouter, HTTPException

from backend.collectors.utils import default_hermes_dir

try:
    router = APIRouter()
except TypeError:
    class _NoopRouter:
        def get(self, *_args, **_kwargs):
            return lambda fn: fn

    router = _NoopRouter()

# ── Pricing per 1M tokens (USD) ──────────────────────────
# Source: https://www.anthropic.com/pricing (April 2026)
# Source: https://openai.com/api/pricing/ (April 2026)

# Shared pricing tiers (reused by aliases below)
_SONNET = {"input": 3.00, "output": 15.00, "cache_read": 0.30, "cache_write": 3.75, "reasoning": 3.00}
_GPT52 = {"input": 1.75, "output": 14.00, "cache_read": 0.88, "cache_write": 1.75, "reasoning": 1.75}
_O_MINI = {"input": 1.10, "output": 4.40, "cache_read": 0.55, "cache_write": 1.10, "reasoning": 1.10}
_DEEPSEEK_V3 = {"input": 0.27, "output": 1.10, "cache_read": 0.07, "cache_write": 0.27, "reasoning": 0.27}
_GROK_FAST = {"input": 0.30, "output": 0.50, "cache_read": 0.075, "cache_write": 0.30, "reasoning": 0.30}
_GEMINI_FLASH_OLD = {"input": 0.10, "output": 0.40, "cache_read": 0.025, "cache_write": 0.10, "reasoning": 0.10}
_LLAMA = {"input": 0.10, "output": 0.10, "cache_read": 0.025, "cache_write": 0.10, "reasoning": 0.10}
_FREE = {"input": 0.0, "output": 0.0, "cache_read": 0.0, "cache_write": 0.0, "reasoning": 0.0}

MODEL_PRICING: dict[str, dict] = {
    # Anthropic — current pricing: https://platform.claude.com/docs/en/about-claude/pricing (verified 2026-07-03)
    # Opus 4.5+ dropped from $15/$75 to $5/$25 per MTok
    "claude-opus-4.8": {"input": 5.00, "output": 25.00, "cache_read": 0.50, "cache_write": 6.25, "reasoning": 5.00},
    "claude-opus-4.7": {"input": 5.00, "output": 25.00, "cache_read": 0.50, "cache_write": 6.25, "reasoning": 5.00},
    "claude-opus-4-6": {"input": 5.00, "output": 25.00, "cache_read": 0.50, "cache_write": 6.25, "reasoning": 5.00},
    "claude-sonnet-4-6": _SONNET,
    "claude-sonnet-4.6": _SONNET,
    "claude-sonnet-4-20250514": _SONNET,
    "claude-haiku-3-5": {"input": 0.80, "output": 4.00, "cache_read": 0.08, "cache_write": 1.00, "reasoning": 0.80},
    "claude-4-sonnet": _SONNET,
    "claude-3-7-sonnet": _SONNET,
    "claude-3.7-sonnet": _SONNET,
    # OpenAI
    "gpt-5.4-pro": {"input": 30.00, "output": 180.00, "cache_read": 15.00, "cache_write": 30.00, "reasoning": 30.00},
    "gpt-5.4": {"input": 2.50, "output": 15.00, "cache_read": 1.25, "cache_write": 2.50, "reasoning": 2.50},
    "gpt-5.5": _GPT52,
    "gpt-5.3-codex": {"input": 1.75, "output": 14.00, "cache_read": 0.88, "cache_write": 1.75, "reasoning": 1.75},
    "gpt-5.2-codex": _GPT52,
    "gpt-5.2": _GPT52,
    "gpt-4o": {"input": 2.50, "output": 10.00, "cache_read": 1.25, "cache_write": 2.50, "reasoning": 2.50},
    "gpt-4o-mini": {"input": 0.15, "output": 0.60, "cache_read": 0.075, "cache_write": 0.15, "reasoning": 0.15},
    "gpt-4.1-mini": {"input": 0.40, "output": 1.60, "cache_read": 0.20, "cache_write": 0.40, "reasoning": 0.40},
    "gpt-4.1": {"input": 2.00, "output": 8.00, "cache_read": 1.00, "cache_write": 2.00, "reasoning": 2.00},
    "o4-mini": _O_MINI,
    "o3-mini": _O_MINI,
    "o1": {"input": 15.00, "output": 60.00, "cache_read": 7.50, "cache_write": 15.00, "reasoning": 15.00},
    # DeepSeek — https://api-docs.deepseek.com/quick_start/pricing (verified 2026-07-03)
    "deepseek-v4-pro": {"input": 0.435, "output": 0.87, "cache_read": 0.003625, "cache_write": 0.435, "reasoning": 0.435},
    "deepseek-v4-flash": {"input": 0.14, "output": 0.28, "cache_read": 0.0028, "cache_write": 0.14, "reasoning": 0.14},
    "deepseek-v3": _DEEPSEEK_V3,
    "deepseek-chat": _DEEPSEEK_V3,
    "deepseek-r1": {"input": 0.55, "output": 2.19, "cache_read": 0.14, "cache_write": 0.55, "reasoning": 0.55},
    # xAI
    "grok-4": {"input": 2.00, "output": 6.00, "cache_read": 0.50, "cache_write": 2.00, "reasoning": 2.00},
    "grok-3": {"input": 3.00, "output": 15.00, "cache_read": 0.75, "cache_write": 3.00, "reasoning": 3.00},
    "grok-code-fast": _GROK_FAST,
    "grok-3-mini-fast": _GROK_FAST,
    "grok-composer-2.5-fast": _GROK_FAST,
    # Google
    "gemini-3.5-flash": {"input": 0.15, "output": 0.60, "cache_read": 0.04, "cache_write": 0.15, "reasoning": 0.15},
    "gemini-3.1-pro": {"input": 2.00, "output": 12.00, "cache_read": 0.50, "cache_write": 2.00, "reasoning": 2.00},
    "gemini-3-pro-preview": {"input": 2.00, "output": 12.00, "cache_read": 0.50, "cache_write": 2.00, "reasoning": 2.00},
    "gemini-3-flash": {"input": 0.50, "output": 3.00, "cache_read": 0.13, "cache_write": 0.50, "reasoning": 0.50},
    "gemini-2.5-pro": {"input": 1.25, "output": 10.00, "cache_read": 0.31, "cache_write": 4.50, "reasoning": 1.25},
    "gemini-2.5-flash": {"input": 0.15, "output": 0.60, "cache_read": 0.04, "cache_write": 0.15, "reasoning": 0.15},
    "gemini-2.0-flash": _GEMINI_FLASH_OLD,
    "gemini-flash": _GEMINI_FLASH_OLD,
    # Xiaomi
    "mimo-v2.5-pro": {"input": 1.00, "output": 3.00, "cache_read": 0.20, "cache_write": 1.00, "reasoning": 1.00},
    "mimo-v2-pro": {"input": 1.00, "output": 3.00, "cache_read": 0.20, "cache_write": 1.00, "reasoning": 1.00},
    # MiniMax — M3 verified $0.30/$1.20 via OpenRouter (2026-07-03)
    "MiniMax-M3": {"input": 0.30, "output": 1.20, "cache_read": 0.08, "cache_write": 0.30, "reasoning": 0.30},
    "minimax-m2.7": {"input": 0.20, "output": 1.20, "cache_read": 0.05, "cache_write": 0.20, "reasoning": 0.20},
    "minimax-m2.5": {"input": 0.12, "output": 0.99, "cache_read": 0.06, "cache_write": 0.12, "reasoning": 0.12},
    # GLM / Z.AI — $1.40/$4.40 per Z.AI docs, $0.26 cached input (verified 2026-07-03)
    "glm-5.2": {"input": 1.40, "output": 4.40, "cache_read": 0.26, "cache_write": 1.40, "reasoning": 1.40},
    "@cf/zai-org/glm-5.2": {"input": 1.40, "output": 4.40, "cache_read": 0.26, "cache_write": 1.40, "reasoning": 1.40},
    # Kimi / Moonshot — K2.7 Code $0.74/$3.50 via OpenRouter (verified 2026-07-03)
    "kimi-k2.7-code": {"input": 0.74, "output": 3.50, "cache_read": 0.19, "cache_write": 0.74, "reasoning": 0.74},
    "kimi-k2.6": {"input": 0.60, "output": 2.40, "cache_read": 0.15, "cache_write": 0.60, "reasoning": 0.60},
    # Meta
    "llama-3.3-70b": _LLAMA,
    "llama-4": _LLAMA,
    # Qwen
    "qwen3.7-max": {"input": 0.40, "output": 2.40, "cache_read": 0.10, "cache_write": 0.40, "reasoning": 0.40},
    "qwen3-coder": {"input": 0.15, "output": 0.80, "cache_read": 0.04, "cache_write": 0.15, "reasoning": 0.15},
    "qwen-3.5-plus": {"input": 0.26, "output": 1.56, "cache_read": 0.065, "cache_write": 0.26, "reasoning": 0.26},
    "qwen-3.5-flash": {"input": 0.065, "output": 0.26, "cache_read": 0.016, "cache_write": 0.065, "reasoning": 0.065},
    # Mistral
    "mistral-small": {"input": 0.15, "output": 0.60, "cache_read": 0.04, "cache_write": 0.15, "reasoning": 0.15},
    "devstral": {"input": 0.40, "output": 2.00, "cache_read": 0.10, "cache_write": 0.40, "reasoning": 0.40},
    # Local / free
    "local": _FREE,
    "default": _FREE,
    "Default": _FREE,
}

# Precomputed for _get_pricing (avoid sorting on every call)
DEFAULT_PRICING = _FREE
_SORTED_KEYS = sorted(MODEL_PRICING, key=len, reverse=True)
_SMALL_MODEL_RE = re.compile(r'[-_](?:1\.?[58]b|3b|4b|7b|8b|9b|13b|14b)\b')

# ── Provider grouping for provider_breakdown ───────────────
PROVIDER_GROUP_MAP = {
    "deepseek": ["deepseek"],
    "anthropic": ["claude", "anthropic"],
    "openai": ["gpt", "openai"],
    "gemini": ["gemini"],
    "xai": ["grok", "xai"],
    "mistral": ["mistral", "devstral"],
    "xiaomi": ["mimo"],
    "minimax": ["minimax"],
    "kimi": ["kimi"],
    "zai-glm": ["glm", "zai"],
    "qwen": ["qwen"],
    "other": ["llama", "local", "default"],
}


def _date_range(range_key: str, since: str | None, until: str | None) -> tuple[float | None, float | None, str, str]:
    """Convert range + since/until to (start_ts, end_ts, start_iso, end_iso)."""
    VALID_RANGES = {"today", "7d", "30d", "90d", "this_month", "last_month", "all"}
    if range_key not in VALID_RANGES:
        raise HTTPException(status_code=400, detail=f"Invalid range '{range_key}'; expected one of: {', '.join(sorted(VALID_RANGES))}")

    now = datetime.now(timezone.utc)
    end = now

    if range_key == "today":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif range_key == "7d":
        start = now - timedelta(days=7)
    elif range_key == "30d":
        start = now - timedelta(days=30)
    elif range_key == "90d":
        start = now - timedelta(days=90)
    elif range_key == "this_month":
        start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    elif range_key == "last_month":
        if now.month == 1:
            start = now.replace(year=now.year - 1, month=12, day=1, hour=0, minute=0, second=0, microsecond=0)
        else:
            start = now.replace(month=now.month - 1, day=1, hour=0, minute=0, second=0, microsecond=0)
        _, last_day = monthrange(start.year, start.month)
        end = start.replace(day=last_day, hour=23, minute=59, second=59, microsecond=999999)
    else:  # "all"
        start = None
        end = None

    # Override with explicit since/until
    if since:
        try:
            start = datetime.strptime(since, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid 'since' date; expected YYYY-MM-DD")
    if until:
        try:
            end = datetime.strptime(until, "%Y-%m-%d").replace(hour=23, minute=59, second=59, microsecond=999999, tzinfo=timezone.utc)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid 'until' date; expected YYYY-MM-DD")

    start_ts = start.timestamp() if start else None
    end_ts = end.timestamp() if end else None
    start_iso = start.isoformat() if start else "all"
    end_iso = end.isoformat() if end else "now"

    return start_ts, end_ts, start_iso, end_iso


def _group_key(started: datetime | None, group_by: str) -> str:
    """Return the grouping key for a session based on started time and group_by."""
    if not started:
        return "unknown"
    if group_by == "week":
        iso = started.isocalendar()
        return f"{iso.year}-W{iso.week:02d}"
    elif group_by == "month":
        return started.strftime("%Y-%m")
    else:  # "day"
        return started.strftime("%Y-%m-%d")


def _assign_provider(model: str) -> str:
    """Assign a model to a provider bucket based on PROVIDER_GROUP_MAP."""
    lower = model.lower()
    for provider, prefixes in PROVIDER_GROUP_MAP.items():
        for prefix in prefixes:
            if lower.startswith(prefix) or prefix in lower:
                return provider
    return "other"


def _get_pricing(model: str | None) -> tuple[dict, str]:
    """Return (pricing_dict, matched_key) for a model."""
    if not model:
        return DEFAULT_PRICING, "unpriced (unknown)"
    # Exact match
    if model in MODEL_PRICING:
        return MODEL_PRICING[model], model
    # Partial match (strip provider prefix, try longest key first)
    base = model.split("/")[-1] if "/" in model else model
    for key in _SORTED_KEYS:
        if base.startswith(key):
            return MODEL_PRICING[key], key
    # Check if it's a local/inference/free model (zero cost)
    lower = model.lower()
    if any(kw in lower for kw in ("local", "localhost", ":free", "gemma", "nemotron", "mimo-free")):
        return _FREE, "local (free)"
    if _SMALL_MODEL_RE.search(lower):
        return _FREE, "local (free)"
    return DEFAULT_PRICING, f"unpriced ({model})"


def _calc_cost(tokens: dict, pricing: dict) -> float:
    return sum(
        (tokens.get(k, 0) / 1_000_000) * pricing.get(k, 0)
        for k in ("input", "output", "cache_read", "cache_write", "reasoning")
    )


def _round_money(value: float | None) -> float:
    return round(float(value or 0), 2)


def _pct(delta: float, base: float) -> float | None:
    if not base:
        return None
    return round((delta / base) * 100, 1)


def _cache_savings(tokens: dict, pricing: dict) -> float:
    full_price = (tokens.get("cache_read", 0) / 1_000_000) * pricing.get("input", 0)
    discounted = (tokens.get("cache_read", 0) / 1_000_000) * pricing.get("cache_read", 0)
    return max(0.0, full_price - discounted)


def _new_bucket() -> dict:
    return {
        "session_count": 0, "message_count": 0,
        "input_tokens": 0, "output_tokens": 0,
        "cache_read_tokens": 0, "cache_write_tokens": 0,
        "reasoning_tokens": 0, "cost": 0.0,
        "estimated_cost": 0.0, "actual_cost": 0.0, "billed_cost": 0.0,
        "actual_estimated_cost": 0.0,
        "actual_session_count": 0, "cache_savings": 0.0,
    }


def _add_usage(
    bucket: dict,
    row: sqlite3.Row,
    tokens: dict,
    estimated: float,
    actual: float | None,
    savings: float,
) -> None:
    billed = actual if actual is not None else estimated
    bucket["session_count"] += 1
    bucket["message_count"] += row["message_count"] or 0
    bucket["input_tokens"] += tokens["input"]
    bucket["output_tokens"] += tokens["output"]
    bucket["cache_read_tokens"] += tokens["cache_read"]
    bucket["cache_write_tokens"] += tokens["cache_write"]
    bucket["reasoning_tokens"] += tokens["reasoning"]
    bucket["cost"] += billed
    bucket["estimated_cost"] += estimated
    bucket["billed_cost"] += billed
    bucket["cache_savings"] += savings
    if actual is not None:
        bucket["actual_cost"] += actual
        bucket["actual_estimated_cost"] += estimated
        bucket["actual_session_count"] += 1


def _finalize_bucket(bucket: dict) -> dict:
    estimated = bucket["estimated_cost"]
    actual = bucket["actual_cost"]
    actual_estimated = bucket["actual_estimated_cost"]
    actual_delta = actual - actual_estimated
    total_tokens = bucket["input_tokens"] + bucket["output_tokens"]
    coverage = (
        bucket["actual_session_count"] / bucket["session_count"] * 100
        if bucket["session_count"] else 0
    )
    return {
        **bucket,
        "total_tokens": total_tokens,
        "cost": _round_money(bucket["cost"]),
        "estimated_cost": _round_money(estimated),
        "actual_cost": _round_money(actual),
        "billed_cost": _round_money(bucket["billed_cost"]),
        "actual_estimated_cost_usd": _round_money(actual_estimated),
        "estimated_cost_usd": _round_money(estimated),
        "actual_cost_usd": _round_money(actual),
        "billed_cost_usd": _round_money(bucket["billed_cost"]),
        "actual_delta_usd": _round_money(actual_delta),
        "actual_delta_pct": _pct(actual_delta, actual_estimated),
        "actual_coverage_pct": round(coverage, 1),
        "cache_savings_usd": _round_money(bucket["cache_savings"]),
    }


@router.get("/token-costs")
async def get_token_costs(
    range: str = "all",
    since: str | None = None,
    until: str | None = None,
    group_by: str = "day",
):
    """Token usage and estimated costs, broken down by model.

    Args:
        range: "today", "7d", "30d", "90d", "this_month", "last_month", "all"
        since: YYYY-MM-DD override for start date
        until: YYYY-MM-DD override for end date
        group_by: "day", "week", or "month"
    """
    if group_by not in {"day", "week", "month"}:
        raise HTTPException(status_code=400, detail=f"Invalid group_by '{group_by}'; expected day, week, or month")

    hermes_dir = default_hermes_dir()
    db_path = str(Path(hermes_dir) / "state.db")

    if not Path(db_path).exists():
        return {"error": "state.db not found"}

    start_ts, end_ts, start_iso, end_iso = _date_range(range, since, until)

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    today = datetime.now().strftime("%Y-%m-%d")

    cur.execute("PRAGMA table_info(sessions)")
    columns = {row["name"] for row in cur.fetchall()}
    title_column = "title" if "title" in columns else "id AS title"
    actual_cost_column = (
        "actual_cost_usd"
        if "actual_cost_usd" in columns else "NULL AS actual_cost_usd"
    )

    # Build query with optional date filtering
    where_clause = ""
    params: list = []
    if start_ts is not None and end_ts is not None:
        where_clause = "WHERE started_at >= ? AND started_at <= ?"
        params = [start_ts, end_ts]
    elif start_ts is not None:
        where_clause = "WHERE started_at >= ?"
        params = [start_ts]
    elif end_ts is not None:
        where_clause = "WHERE started_at <= ?"
        params = [end_ts]

    cur.execute(f"""
        SELECT id, source, {title_column}, started_at, model,
               message_count, tool_call_count,
               input_tokens, output_tokens,
               cache_read_tokens, cache_write_tokens,
               reasoning_tokens,
               {actual_cost_column}
        FROM sessions
        {where_clause}
        ORDER BY started_at ASC
    """, params)

    # Per-model aggregation
    by_model: dict[str, dict] = {}

    # Today aggregation
    today_data = _new_bucket()

    # All-time totals
    all_input = all_output = all_cache_r = all_cache_w = all_reasoning = 0
    all_messages = all_tool_calls = 0
    all_estimated_cost = 0.0
    all_actual_cost = 0.0
    all_actual_estimated_cost = 0.0
    all_billed_cost = 0.0
    all_cache_savings = 0.0
    actual_sessions = 0
    total_sessions = 0

    # Daily trend (uses group_by key)
    daily: dict[str, dict] = {}
    top_sessions: list[dict] = []
    recent_start = datetime.now() - timedelta(days=7)
    previous_start = datetime.now() - timedelta(days=14)
    recent_7d_cost = 0.0
    previous_7d_cost = 0.0

    for row in cur.fetchall():
        model = row["model"] or "unknown"
        started_ts = row["started_at"]
        started = datetime.fromtimestamp(started_ts) if started_ts else None
        day_key = _group_key(started, group_by)
        day = started.strftime("%Y-%m-%d") if started else "unknown"
        is_today = day == today

        tokens = {
            "input": row["input_tokens"] or 0,
            "output": row["output_tokens"] or 0,
            "cache_read": row["cache_read_tokens"] or 0,
            "cache_write": row["cache_write_tokens"] or 0,
            "reasoning": row["reasoning_tokens"] or 0,
        }

        pricing, matched = _get_pricing(model)
        actual_cost = row["actual_cost_usd"]
        actual = float(actual_cost) if actual_cost is not None else None
        estimated = _calc_cost(tokens, pricing)
        cost = actual if actual is not None else estimated
        savings = _cache_savings(tokens, pricing)

        # Per-model
        if model not in by_model:
            by_model[model] = {
                "model": model, "matched_pricing": matched,
                **_new_bucket(),
            }
        m = by_model[model]
        _add_usage(m, row, tokens, estimated, actual, savings)

        # Today
        if is_today:
            _add_usage(today_data, row, tokens, estimated, actual, savings)

        # All-time
        total_sessions += 1
        all_messages += row["message_count"] or 0
        all_tool_calls += row["tool_call_count"] or 0
        all_input += tokens["input"]
        all_output += tokens["output"]
        all_cache_r += tokens["cache_read"]
        all_cache_w += tokens["cache_write"]
        all_reasoning += tokens["reasoning"]
        all_estimated_cost += estimated
        all_billed_cost += cost
        all_cache_savings += savings
        if actual is not None:
            all_actual_cost += actual
            all_actual_estimated_cost += estimated
            actual_sessions += 1

        # Daily
        if day_key not in daily:
            daily[day_key] = {
                "cost": 0.0,
                "estimated_cost": 0.0,
                "actual_cost": 0.0,
                "tokens": 0,
                "sessions": 0,
                "cache_savings": 0.0,
            }
        daily[day_key]["cost"] += cost
        daily[day_key]["estimated_cost"] += estimated
        if actual is not None:
            daily[day_key]["actual_cost"] += actual
        daily[day_key]["tokens"] += tokens["input"] + tokens["output"]
        daily[day_key]["sessions"] += 1
        daily[day_key]["cache_savings"] += savings

        if started:
            if started >= recent_start:
                recent_7d_cost += cost
            elif started >= previous_start:
                previous_7d_cost += cost

        top_sessions.append({
            "id": row["id"],
            "source": row["source"] or "unknown",
            "title": row["title"] or row["id"],
            "date": day,
            "model": model,
            "matched_pricing": matched,
            "message_count": row["message_count"] or 0,
            "tool_call_count": row["tool_call_count"] or 0,
            "input_tokens": tokens["input"],
            "output_tokens": tokens["output"],
            "cache_read_tokens": tokens["cache_read"],
            "cache_write_tokens": tokens["cache_write"],
            "reasoning_tokens": tokens["reasoning"],
            "total_tokens": tokens["input"] + tokens["output"],
            "estimated_cost_usd": _round_money(estimated),
            "actual_cost_usd": _round_money(actual),
            "billed_cost_usd": _round_money(cost),
            "actual_delta_usd": _round_money(
                (actual - estimated) if actual is not None else 0
            ),
            "cache_savings_usd": _round_money(savings),
        })

    conn.close()

    # Sort models by cost descending
    model_list = sorted(by_model.values(), key=lambda m: -m["cost"])

    model_list = [_finalize_bucket(m) for m in model_list]
    today_final = _finalize_bucket(today_data)

    # ── Provider breakdown ─────────────────────────────────
    provider_buckets: dict[str, dict] = {}
    for m in model_list:
        provider = _assign_provider(m["model"])
        if provider not in provider_buckets:
            provider_buckets[provider] = {
                "provider": provider,
                "total_cost": 0.0,
                "total_tokens": 0,
                "session_count": 0,
                "models": [],
            }
        pb = provider_buckets[provider]
        pb["total_cost"] += m["billed_cost_usd"]
        pb["total_tokens"] += m["total_tokens"]
        pb["session_count"] += m["session_count"]
        pb["models"].append(m["model"])

    # Sort provider buckets by total_cost descending
    provider_list = sorted(provider_buckets.values(), key=lambda p: -p["total_cost"])
    for p in provider_list:
        p["total_cost"] = _round_money(p["total_cost"])

    sorted_days = sorted(daily.keys())
    delta = recent_7d_cost - previous_7d_cost

    return {
        "range": {
            "start": start_iso,
            "end": end_iso,
            "group_by": group_by,
        },
        "today": {
            "date": today,
            **today_final,
        },
        "all_time": {
            "session_count": total_sessions,
            "message_count": all_messages,
            "tool_call_count": all_tool_calls,
            "input_tokens": all_input,
            "output_tokens": all_output,
            "cache_read_tokens": all_cache_r,
            "cache_write_tokens": all_cache_w,
            "reasoning_tokens": all_reasoning,
            "total_tokens": all_input + all_output,
            "cost": _round_money(all_billed_cost),
            "estimated_cost_usd": _round_money(all_estimated_cost),
            "actual_cost_usd": _round_money(all_actual_cost),
            "actual_estimated_cost_usd": _round_money(all_actual_estimated_cost),
            "billed_cost_usd": _round_money(all_billed_cost),
            "actual_delta_usd": _round_money(all_actual_cost - all_actual_estimated_cost),
            "actual_delta_pct": _pct(
                all_actual_cost - all_actual_estimated_cost,
                all_actual_estimated_cost,
            ),
            "actual_session_count": actual_sessions,
            "actual_coverage_pct": round(
                (actual_sessions / total_sessions * 100) if total_sessions else 0,
                1,
            ),
            "cache_savings_usd": _round_money(all_cache_savings),
        },
        "by_model": model_list,
        "provider_breakdown": provider_list,
        "top_sessions": sorted(top_sessions, key=lambda s: -s["billed_cost_usd"])[:10],
        "trend_summary": {
            "recent_7d_cost_usd": _round_money(recent_7d_cost),
            "previous_7d_cost_usd": _round_money(previous_7d_cost),
            "delta_usd": _round_money(delta),
            "delta_pct": _pct(delta, previous_7d_cost),
            "direction": "up" if delta > 0 else "down" if delta < 0 else "flat",
        },
        "daily_trend": [
            {
                "date": dkey,
                "cost": round(daily[dkey]["cost"], 2),
                "estimated_cost_usd": round(daily[dkey]["estimated_cost"], 2),
                "actual_cost_usd": round(daily[dkey]["actual_cost"], 2),
                "billed_cost_usd": round(daily[dkey]["cost"], 2),
                "cache_savings_usd": round(daily[dkey]["cache_savings"], 2),
                "tokens": daily[dkey]["tokens"],
                "sessions": daily[dkey]["sessions"],
            }
            for dkey in sorted_days
        ],
        "pricing_table": {k: {kk: vv for kk, vv in v.items()} for k, v in MODEL_PRICING.items()},
    }
