"""Billing collector — reads provider-billing.json + balance API output, merges with HUD estimates."""

import json
from datetime import datetime, timedelta
from pathlib import Path

from backend.collectors.utils import default_hermes_dir


def collect_billing() -> dict:
    """Read provider billing data and merge with token cost estimates."""
    hermes_dir = Path(default_hermes_dir())
    billing_file = hermes_dir / "state" / "provider-billing.json"
    balance_file = hermes_dir / "state" / "provider-balances.json"

    # ── Load receipts (from Gmail scanner) ──
    receipt_data = {}
    if billing_file.exists():
        try:
            with open(billing_file) as f:
                receipt_data = json.load(f).get("providers", {})
        except (json.JSONDecodeError, KeyError):
            pass

    # ── Load balances (from API collector) ──
    balance_data = {}
    if balance_file.exists():
        try:
            with open(balance_file) as f:
                raw = json.load(f)
                for b in raw.get("balances", []):
                    balance_data[b["provider"]] = b
        except (json.JSONDecodeError, KeyError):
            pass

    # ── Merge ──
    # Provider mapping: receipt keys → display names / provider groups
    PROVIDER_MAP = {
        "deepseek": "deepseek",
        "openai": "openai",
        "anthropic": "anthropic",
        "xai": "xai",
        "mistral": "mistral",
        "gemini": "gemini",
        "firecrawl": "firecrawl",
        "github-copilot": "github-copilot",
        "xiaomi": "xiaomi",
        "novita": "novita",
        "kimi": "kimi",
        "zai-glm": "zai-glm",
        "minimax": "minimax",
        "nvidia": "nvidia",
        "krea": "krea",
        "fal": "fal",
        "stepfun": "stepfun",
        "arcee": "arcee",
    }

    providers = {}
    for key, display in PROVIDER_MAP.items():
        entry = {
            "key": key,
            "display": display,
            "receipt_total_30d": 0.0,
            "receipt_total_all_time": 0.0,
            "receipt_count": 0,
            "last_receipt_date": None,
            "api_balance": None,
            "api_currency": None,
            "api_is_available": None,
            "scraped_credits": None,
            "scraped_date": None,
            "iframe_url": None,
            "has_data": False,
        }

        # Receipts
        rd = receipt_data.get(key, {})
        if rd:
            entry["receipt_total_30d"] = rd.get("total_30d", 0)
            entry["receipt_total_all_time"] = rd.get("total_all_time", 0)
            entry["receipt_count"] = rd.get("receipt_count", 0)
            entry["last_receipt_date"] = rd.get("last_receipt_date")
            if entry["receipt_count"] > 0:
                entry["has_data"] = True

        # API balance
        bd = balance_data.get(display) or balance_data.get(key)
        if bd and not bd.get("error"):
            entry["api_balance"] = bd.get("total_balance") or bd.get("daily_cost_usd")
            entry["api_currency"] = bd.get("currency", "USD")
            entry["api_is_available"] = bd.get("is_available")
            entry["has_data"] = True

        providers[key] = entry

    # ── Mark iframe-only / console URLs ──
    CONSOLE_URLS = {
        "gemini": "https://console.cloud.google.com/billing",
        "firecrawl": "https://www.firecrawl.dev/app",
        "kimi": "https://platform.moonshot.ai",
        "zai-glm": "https://open.bigmodel.cn",
        "minimax": "https://platform.minimax.io",
        "novita": "https://novita.ai",
        "xai": "https://console.x.ai",
        "nvidia": "https://build.nvidia.com",
        "krea": "https://www.krea.ai",
        "fal": "https://fal.ai/dashboard",
        "stepfun": "https://platform.stepfun.ai",
        "arcee": "https://app.arcee.ai",
        "mistral": "https://console.mistral.ai",
    }
    for key, url in CONSOLE_URLS.items():
        if key in providers:
            providers[key]["iframe_url"] = url

    return {
        "updated_at": datetime.now().isoformat(),
        "providers": providers,
        "providers_with_data": sum(1 for p in providers.values() if p["has_data"]),
        "total_providers": len(providers),
    }
