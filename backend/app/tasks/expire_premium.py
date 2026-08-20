"""
Downgrade users whose premium_until has passed.

The worker calls `run()` once a day (see app/worker/main.py). Nothing on the
server ever scheduled this — there was no cron entry and no systemd timer — so
premium never actually expired. Keeping it in the worker means it ships with the
app instead of depending on host configuration that has to be remembered on
every new machine.

Still runnable by hand:
    python -m app.tasks.expire_premium
"""

from __future__ import annotations

import asyncio
import sys

import asyncpg
import httpx

from app.core.config import settings
from app.core.logging import configure_logging, logger
from app.db import close_pool, get_pool, init_pool


TG_SEND_URL = "https://api.telegram.org/bot{token}/sendMessage"


async def run(pool: asyncpg.Pool) -> int:
    """Downgrade expired premium users. Returns how many were downgraded."""
    expired = await pool.fetch(
        """
        UPDATE users
        SET tier = 'free'
        WHERE tier = 'premium' AND premium_until < now()
        RETURNING id, tg_user_id, lang
        """
    )
    if not expired:
        logger.info("expire_premium_nothing_to_do")
        return 0

    logger.info("expire_premium_downgraded", count=len(expired))

    # Refresh watch_groups (premium status changed)
    await pool.execute(
        """
        INSERT INTO watch_groups (dep_code, arr_code, travel_date, has_premium, subscriber_count)
        SELECT s.dep_code, s.arr_code, s.travel_date,
               bool_or(u.tier = 'premium'),
               COUNT(*)
        FROM subscriptions s
        JOIN users u ON u.id = s.user_id
        WHERE s.is_active AND s.travel_date >= CURRENT_DATE
        GROUP BY s.dep_code, s.arr_code, s.travel_date
        ON CONFLICT (dep_code, arr_code, travel_date) DO UPDATE
        SET has_premium = EXCLUDED.has_premium,
            subscriber_count = EXCLUDED.subscriber_count,
            updated_at = now();
        """
    )

    # Notify each user (best-effort)
    if settings.bot_token:
        async with httpx.AsyncClient(timeout=10) as client:
            for u in expired:
                try:
                    await client.post(
                        TG_SEND_URL.format(token=settings.bot_token),
                        json={
                            "chat_id": u["tg_user_id"],
                            "text": _msg_for(u["lang"]),
                            "parse_mode": "HTML",
                        },
                    )
                except Exception as e:
                    logger.warning("expire_premium_notify_failed",
                                   user_id=u["id"], error=str(e))

    return len(expired)


async def amain() -> int:
    configure_logging()
    await init_pool(min_size=1, max_size=2)
    try:
        await run(get_pool())
        return 0
    finally:
        await close_pool()


def _msg_for(lang: str) -> str:
    if lang == "ru":
        return (
            "⏰ <b>Premium закончился</b>\n\n"
            "Активные уведомления продолжают работать, но новое добавить нельзя "
            "(на бесплатном тарифе доступен 1 слот). Скорость проверки: 30 сек.\n\n"
            "Используйте /premium чтобы продлить."
        )
    if lang == "en":
        return (
            "⏰ <b>Premium expired</b>\n\n"
            "Your active notifications keep working, but you can't add new ones "
            "(Free tier has 1 slot). Check cadence: 30 seconds.\n\n"
            "Use /premium to renew."
        )
    return (
        "⏰ <b>Premium muddati tugadi</b>\n\n"
        "Aktiv xabarnomalaringiz ishlashda davom etmoqda, lekin yangisini "
        "qo'sha olmaysiz (Free planda 1 ta slot mavjud). Tekshirish chastotasi: "
        "har 30 sekundda.\n\n"
        "Uzaytirish: /premium"
    )


if __name__ == "__main__":
    sys.exit(asyncio.run(amain()))
