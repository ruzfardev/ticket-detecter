"""
Payments service — invoice link generation + Stars-flow processing.

Telegram Stars are paid in XTR with `createInvoiceLink`. The `payload`
field encodes `<plan_id>:<user_id>` so precheck and success handlers can
identify the buyer.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Literal

import asyncpg
import httpx

from app.core.config import settings
from app.core.errors import InvalidAmount, UnknownPlan
from app.core.logging import logger
from app.services.plans import (
    DONATE_CUSTOM_MAX,
    DONATE_CUSTOM_MIN,
    DONATE_OPTIONS,
    PREMIUM_PLANS,
)

TG_API = "https://api.telegram.org/bot{token}/{method}"


# ---- Invoice creation -------------------------------------------------------

async def create_invoice_link(
    user_id: int,
    plan_id: str,
    amount_override: int | None = None,
) -> dict:
    """
    Returns: {invoice_link, type, plan, stars_amount, duration_days?}
    """
    if plan_id.startswith("premium_"):
        plan = PREMIUM_PLANS.get(plan_id)
        if not plan:
            raise UnknownPlan(f"Unknown premium plan: {plan_id}")
        title = f"⭐ Premium — {plan.days} kun"
        desc = (
            f"• 3 ta aktiv xabarnoma\n"
            f"• Har 10 sekundda tekshirish\n"
            f"• {plan.days} kun davomida"
        )
        amount = plan.stars
        duration_days = plan.days
        ptype: Literal["premium", "donate"] = "premium"
    elif plan_id == "donate_custom":
        if amount_override is None:
            raise InvalidAmount("amount required for donate_custom")
        if not (DONATE_CUSTOM_MIN <= amount_override <= DONATE_CUSTOM_MAX):
            raise InvalidAmount(
                f"amount must be {DONATE_CUSTOM_MIN}-{DONATE_CUSTOM_MAX}",
                {"min": DONATE_CUSTOM_MIN, "max": DONATE_CUSTOM_MAX},
            )
        title = "💝 Botni qo'llab-quvvatlash"
        desc = "Custom amount donation"
        amount = amount_override
        duration_days = None
        ptype = "donate"
    elif plan_id.startswith("donate_"):
        opt = DONATE_OPTIONS.get(plan_id)
        if not opt:
            raise UnknownPlan(f"Unknown donate option: {plan_id}")
        title = "💝 Botni qo'llab-quvvatlash"
        desc = f"{opt.emoji} {opt.label_uz}"
        amount = opt.stars
        duration_days = None
        ptype = "donate"
    else:
        raise UnknownPlan(f"Unknown plan: {plan_id}")

    payload = f"{plan_id}:{user_id}:{amount}"

    url = TG_API.format(token=settings.bot_token, method="createInvoiceLink")
    body = {
        "title": title,
        "description": desc,
        "payload": payload,
        "currency": "XTR",
        "prices": [{"label": title, "amount": amount}],
    }
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.post(url, json=body)
    data = r.json()
    if not data.get("ok"):
        raise RuntimeError(f"Telegram createInvoiceLink failed: {data}")

    return {
        "invoice_link": data["result"],
        "type": ptype,
        "plan": plan_id,
        "stars_amount": amount,
        "duration_days": duration_days,
    }


# ---- Precheck (called from bot pre_checkout_query) --------------------------

async def precheck(
    pool: asyncpg.Pool,
    tg_user_id: int,
    invoice_payload: str,
    stars_amount: int,
) -> dict:
    try:
        plan_id, user_id_str, expected_str = invoice_payload.split(":")
        target_user_id = int(user_id_str)
        expected_amount = int(expected_str)
    except (ValueError, IndexError):
        return {"ok": False, "error_message": "Malformed payload"}

    if stars_amount != expected_amount:
        return {"ok": False, "error_message": "Amount mismatch"}

    # Confirm payload's user_id maps to the actual TG user buying
    actual = await pool.fetchval(
        "SELECT id FROM users WHERE tg_user_id = $1", tg_user_id,
    )
    if actual != target_user_id:
        return {"ok": False, "error_message": "User mismatch"}

    # Validate plan_id makes sense
    if plan_id.startswith("premium_") and plan_id not in PREMIUM_PLANS:
        return {"ok": False, "error_message": "Unknown plan"}
    if plan_id.startswith("donate_") and plan_id != "donate_custom" and plan_id not in DONATE_OPTIONS:
        return {"ok": False, "error_message": "Unknown plan"}

    return {"ok": True}


# ---- Successful payment processing ------------------------------------------

async def record_success(
    pool: asyncpg.Pool,
    tg_user_id: int,
    tg_payment_charge_id: str,
    provider_charge_id: str | None,
    invoice_payload: str,
    stars_amount: int,
    raw: dict,
) -> dict:
    plan_id, user_id_str, _ = invoice_payload.split(":")
    user_id = int(user_id_str)

    async with pool.acquire() as conn:
        async with conn.transaction():
            # Idempotency
            existing = await conn.fetchval(
                "SELECT id FROM payments WHERE tg_payment_charge_id = $1",
                tg_payment_charge_id,
            )
            if existing:
                logger.info("payment_already_processed",
                            payment_id=existing, charge=tg_payment_charge_id)
                return {"already_processed": True, "payment_id": existing}

            now = datetime.now(timezone.utc)

            if plan_id.startswith("premium_"):
                plan = PREMIUM_PLANS[plan_id]
                user = await conn.fetchrow(
                    "SELECT premium_until FROM users WHERE id = $1 FOR UPDATE", user_id,
                )
                pu = user["premium_until"]
                granted_from = max(now, pu) if pu else now
                granted_until = granted_from + timedelta(days=plan.days)
                payment_id = await conn.fetchval(
                    """
                    INSERT INTO payments
                      (user_id, tg_payment_charge_id, provider_charge_id,
                       stars_amount, type, plan, granted_from, granted_until, raw)
                    VALUES ($1, $2, $3, $4, 'premium', $5, $6, $7, $8)
                    RETURNING id
                    """,
                    user_id, tg_payment_charge_id, provider_charge_id,
                    stars_amount, plan_id, granted_from, granted_until, raw,
                )
                await conn.execute(
                    "UPDATE users SET tier = 'premium', premium_until = $1 WHERE id = $2",
                    granted_until, user_id,
                )
                # Mark watch_groups recompute (premium status changed)
                await _refresh_groups_for_user(conn, user_id)
                logger.info("payment_premium_success",
                            payment_id=payment_id, plan=plan_id, stars=stars_amount,
                            until=granted_until.isoformat())
                return {
                    "type": "premium",
                    "payment_id": payment_id,
                    "plan": plan_id,
                    "granted_from": granted_from.isoformat(),
                    "granted_until": granted_until.isoformat(),
                    "stars": stars_amount,
                }

            else:  # donate
                payment_id = await conn.fetchval(
                    """
                    INSERT INTO payments
                      (user_id, tg_payment_charge_id, provider_charge_id,
                       stars_amount, type, plan, granted_from, granted_until, raw)
                    VALUES ($1, $2, $3, $4, 'donate', $5, $6, $6, $7)
                    RETURNING id
                    """,
                    user_id, tg_payment_charge_id, provider_charge_id,
                    stars_amount, plan_id, now, raw,
                )
                logger.info("payment_donate_success",
                            payment_id=payment_id, stars=stars_amount)
                return {
                    "type": "donate",
                    "payment_id": payment_id,
                    "plan": plan_id,
                    "stars": stars_amount,
                }


async def _refresh_groups_for_user(conn: asyncpg.Connection, user_id: int) -> None:
    await conn.execute(
        """
        WITH groups AS (
            SELECT DISTINCT dep_code, arr_code, travel_date
            FROM subscriptions WHERE user_id = $1 AND is_active
        )
        INSERT INTO watch_groups (dep_code, arr_code, travel_date, has_premium, subscriber_count)
        SELECT g.dep_code, g.arr_code, g.travel_date,
               COALESCE(bool_or(u.tier = 'premium'), FALSE),
               COUNT(s.id)
        FROM groups g
        LEFT JOIN subscriptions s ON s.is_active
            AND s.dep_code = g.dep_code AND s.arr_code = g.arr_code AND s.travel_date = g.travel_date
        LEFT JOIN users u ON u.id = s.user_id
        GROUP BY g.dep_code, g.arr_code, g.travel_date
        ON CONFLICT (dep_code, arr_code, travel_date) DO UPDATE
        SET has_premium = EXCLUDED.has_premium,
            subscriber_count = EXCLUDED.subscriber_count,
            updated_at = now();
        """,
        user_id,
    )


async def list_history(pool: asyncpg.Pool, user_id: int, limit: int = 50) -> list[dict]:
    rows = await pool.fetch(
        """
        SELECT id, type, plan, stars_amount, granted_from, granted_until,
               refunded_at, created_at
        FROM payments WHERE user_id = $1
        ORDER BY created_at DESC LIMIT $2
        """,
        user_id, limit,
    )
    return [
        {
            "id": r["id"],
            "type": r["type"],
            "plan": r["plan"],
            "stars_amount": r["stars_amount"],
            "granted_from": r["granted_from"].isoformat() if r["granted_from"] else None,
            "granted_until": r["granted_until"].isoformat() if r["granted_until"] else None,
            "refunded_at": r["refunded_at"].isoformat() if r["refunded_at"] else None,
            "created_at": r["created_at"].isoformat(),
        }
        for r in rows
    ]
