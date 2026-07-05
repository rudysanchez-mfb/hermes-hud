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
    scraped_file = hermes_dir / "state" / "provider-scraped.json"

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

    # ── Load scraped data (from Playwright scraper, console-only providers) ──
    scraped_data = {}
    if scraped_file.exists():
        try:
            with open(scraped_file) as f:
                scraped_data = json.load(f).get("providers", {})
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
            bal = bd.get("total_balance")
            if bal is None:
                bal = bd.get("daily_cost_usd")
            # Leave api_balance None for usage-billed providers (e.g. gemini) that
            # report token usage instead of a prepaid balance — avoids a misleading $0.00.
            entry["api_balance"] = bal
            entry["api_currency"] = bd.get("currency", "USD")
            entry["api_is_available"] = bd.get("is_available")
            entry["has_data"] = True
            # Pass through optional usage / credit fields for the Costs tab to render.
            for f in (
                "usage_output_tokens_30d", "usage_by_model_30d", "usage_unit",
                "remaining_credits", "plan_credits", "used_credits",
                "billing_period_end", "daily_cost_usd",
            ):
                if bd.get(f) is not None:
                    entry[f] = bd[f]

        # Scraped data (console-only providers, no API — populated once logged in)
        sc = scraped_data.get(key)
        if sc and not sc.get("error") and sc.get("value") is not None:
            entry["scraped_credits"] = sc.get("value")
            entry["scraped_currency"] = sc.get("currency")
            entry["scraped_unit"] = sc.get("unit")
            entry["scraped_url"] = sc.get("url")
            entry["scraped_date"] = sc.get("scraped_at")
            entry["has_data"] = True

        providers[key] = entry

    # ── Mark iframe-only / console URLs ──
    # Google SSO providers redirect via window.top.location — impossible inside sandboxed iframe.
    CONSOLE_URLS = {
        "gemini":     ("https://console.cloud.google.com/billing",           True),
        "firecrawl":  ("https://www.firecrawl.dev/app/usage",               True),
        "kimi":       ("https://platform.moonshot.ai/console/billing/overview", True),
        "minimax":    ("https://platform.minimax.io/console/usage",          True),
        "zai-glm":    ("https://open.bigmodel.cn/usercenter/billing",       False),
        "novita":     ("https://novita.ai/dashboard/billing",               False),
        "xai":        ("https://console.x.ai/usage",                        False),
        "nvidia":     ("https://build.nvidia.com/explore/discover#billing", False),
        "krea":       ("https://www.krea.ai/settings/billing",              False),
        "fal":        ("https://fal.ai/dashboard/billing",                  False),
        "stepfun":    ("https://platform.stepfun.ai/user/billing",          False),
        "arcee":     ("https://app.arcee.ai/billing",                      False),
        "mistral":    ("https://console.mistral.ai/billing/overview",       False),
    }
    for key, (url, blocked) in CONSOLE_URLS.items():
        if key in providers:
            providers[key]["iframe_url"] = url
            providers[key]["iframe_blocked"] = blocked

    return {
        "updated_at": datetime.now().isoformat(),
        "providers": providers,
        "providers_with_data": sum(1 for p in providers.values() if p["has_data"]),
        "total_providers": len(providers),
    }
