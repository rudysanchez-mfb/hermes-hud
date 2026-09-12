"""Billing API endpoint — provider actual costs vs estimates."""

from fastapi import APIRouter

from backend.collectors.billing import collect_billing
from backend.api.serialize import to_dict
from backend.async_utils import run_blocking

router = APIRouter()


@router.get("/billing")
async def get_billing():
    """Per-provider actual costs (receipts + API balances) vs HUD estimates."""
    return to_dict(await run_blocking(collect_billing))
