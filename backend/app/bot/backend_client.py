"""
Backend HTTP client used by bot handlers (same process, but goes through
HTTP for clean separation — internal JWT-signed).
"""

from __future__ import annotations

import httpx

from app.auth.internal_jwt import make_internal_jwt
from app.core.config import settings
from app.core.logging import logger

_BACKEND_BASE = "http://localhost:8000"   # same-process; overridable if split


def _auth_headers() -> dict[str, str]:
    return {"Authorization": f"Bearer {make_internal_jwt()}"}


async def precheck_payment(
    tg_user_id: int, invoice_payload: str, stars_amount: int,
) -> dict:
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.post(
            f"{_BACKEND_BASE}/internal/v1/payments/precheck",
            json={
                "tg_user_id": tg_user_id,
                "invoice_payload": invoice_payload,
                "stars_amount": stars_amount,
            },
            headers=_auth_headers(),
        )
    return r.json()


async def record_payment_success(
    *, tg_user_id: int, tg_payment_charge_id: str,
    provider_charge_id: str | None,
    invoice_payload: str, stars_amount: int, raw: dict,
) -> dict:
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.post(
            f"{_BACKEND_BASE}/internal/v1/payments/successful",
            json={
                "tg_user_id": tg_user_id,
                "tg_payment_charge_id": tg_payment_charge_id,
                "provider_charge_id": provider_charge_id,
                "invoice_payload": invoice_payload,
                "stars_amount": stars_amount,
                "raw": raw,
            },
            headers=_auth_headers(),
        )
    if r.status_code >= 400:
        logger.warning("backend_success_call_failed",
                       status=r.status_code, body=r.text[:200])
    return r.json()
