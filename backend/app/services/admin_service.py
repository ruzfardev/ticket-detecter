"""
Admin service — aggregate stats, Stars refunds, and broadcast helpers.

All queries are read-only except `refund_payment`, which calls Telegram's
refundStarPayment and reconciles the local payments / users state.
"""

from __future__ import annotations

from datetime import datetime, timezone

import asyncpg
import httpx

from app.core.config import settings
from app.core.logging import logger
from app.services.payments import _refresh_groups_for_user

TG_API = "https://api.telegram.org/bot{token}/{method}"


# ---- Stats ------------------------------------------------------------------

async def get_stats(pool: asyncpg.Pool) -> dict:
    """One-shot dashboard metrics for the /stats command."""
    async with pool.acquire() as conn:
        total_users = await conn.fetchval("SELECT COUNT(*) FROM users")
        new_users_24h = await conn.fetchval(
            "SELECT COUNT(*) FROM users WHERE created_at > now() - interval '1 day'"
        )
        premium_active = await conn.fetchval(
            "SELECT COUNT(*) FROM users WHERE tier = 'premium' AND premium_until > now()"
        )
        active_subs = await conn.fetchval(
            "SELECT COUNT(*) FROM subscriptions WHERE is_active"
        )
        donate_stars = await conn.fetchval(
            "SELECT COALESCE(SUM(stars_amount), 0) FROM payments "
            "WHERE type = 'donate' AND refunded_at IS NULL"
        )
        premium_stars = await conn.fetchval(
            "SELECT COALESCE(SUM(stars_amount), 0) FROM payments "
            "WHERE type = 'premium' AND refunded_at IS NULL"
        )
        payments_count = await conn.fetchval(
            "SELECT COUNT(*) FROM payments WHERE refunded_at IS NULL"
        )
        notif_24h = await conn.fetchval(
            "SELECT COUNT(*) FROM notification_log WHERE sent_at > now() - interval '1 day'"
        )

    return {
        "total_users": total_users,
        "new_users_24h": new_users_24h,
        "premium_active": premium_active,
        "active_subs": active_subs,
        "donate_stars": donate_stars,
        "premium_stars": premium_stars,
        "payments_count": payments_count,
        "notif_24h": notif_24h,
    }


# ---- Refund -----------------------------------------------------------------

async def _telegram_refund(user_tg_id: int, charge_id: str) -> dict:
    url = TG_API.format(token=settings.bot_token, method="refundStarPayment")
    body = {"user_id": user_tg_id, "telegram_payment_charge_id": charge_id}
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.post(url, json=body)
    return r.json()


async def refund_payment(pool: asyncpg.Pool, payment_id: int) -> dict:
    """
    Refund a payment by its DB id via Telegram, then reconcile local state.

    Returns dict with `status` one of: not_found, already_refunded,
    telegram_error, ok.
    """
    row = await pool.fetchrow(
        """
        SELECT p.id, p.tg_payment_charge_id, p.type, p.refunded_at,
               p.stars_amount, p.user_id, u.tg_user_id
        FROM payments p
        JOIN users u ON u.id = p.user_id
        WHERE p.id = $1
        """,
        payment_id,
    )
    if row is None:
        return {"status": "not_found"}
    if row["refunded_at"] is not None:
        return {
            "status": "already_refunded",
            "type": row["type"],
            "stars": row["stars_amount"],
        }

    data = await _telegram_refund(row["tg_user_id"], row["tg_payment_charge_id"])
    if not data.get("ok"):
        err = data.get("description", "unknown error")
        logger.warning("refund_telegram_failed", payment_id=payment_id, error=err)
        return {"status": "telegram_error", "error": err}

    async with pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute(
                "UPDATE payments SET refunded_at = now() WHERE id = $1", payment_id,
            )
            # Premium refunds may revoke / shorten the user's premium window.
            if row["type"] == "premium":
                latest = await conn.fetchval(
                    """
                    SELECT MAX(granted_until) FROM payments
                    WHERE user_id = $1 AND type = 'premium' AND refunded_at IS NULL
                    """,
                    row["user_id"],
                )
                now = datetime.now(timezone.utc)
                if latest and latest > now:
                    await conn.execute(
                        "UPDATE users SET tier = 'premium', premium_until = $1 WHERE id = $2",
                        latest, row["user_id"],
                    )
                else:
                    await conn.execute(
                        "UPDATE users SET tier = 'free', premium_until = NULL WHERE id = $1",
                        row["user_id"],
                    )
                await _refresh_groups_for_user(conn, row["user_id"])

    logger.info("refund_ok", payment_id=payment_id, type=row["type"],
                stars=row["stars_amount"])
    return {
        "status": "ok",
        "type": row["type"],
        "stars": row["stars_amount"],
        "user_tg_id": row["tg_user_id"],
    }


# ---- Broadcast --------------------------------------------------------------

async def list_user_tg_ids(pool: asyncpg.Pool) -> list[int]:
    rows = await pool.fetch("SELECT tg_user_id FROM users ORDER BY id")
    return [r["tg_user_id"] for r in rows]
