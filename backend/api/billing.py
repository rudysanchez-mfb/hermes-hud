"""Billing API endpoint — provider actual costs vs estimates."""

import subprocess
from pathlib import Path

from fastapi import APIRouter

from backend.collectors.billing import collect_billing
from backend.api.serialize import to_dict

router = APIRouter()


@router.get("/billing")
async def get_billing():
    """Per-provider actual costs (receipts + API balances) vs HUD estimates."""
    return to_dict(collect_billing())


@router.post("/billing/refresh")
async def refresh_billing():
    """Run provider-balance-check.py to pull live balances, then return updated data."""
    script = Path.home() / ".hermes" / "scripts" / "provider-balance-check.py"
    try:
        result = subprocess.run(
            ["python3", str(script)],
            capture_output=True, text=True, timeout=60,
        )
        output = result.stdout.strip()[-500:]  # tail of summary line(s)
        success = result.returncode == 0
    except subprocess.TimeoutExpired:
        output = "Provider balance check timed out after 60s"
        success = False
    except Exception as e:
        output = f"Failed to run provider balance check: {e}"
        success = False

    data = collect_billing()
    resp = to_dict(data)
    resp["_refresh"] = {
        "success": success,
        "output": output,
    }
    return resp
