"""/holat — the user's own account summary.

Answers the questions people otherwise have to open the mini-app for: which
tariff am I on, how long is it good for, how many slots am I using, is my
eticket account linked, and is auto-buy actually armed.
"""

from __future__ import annotations

from datetime import datetime, timezone

from aiogram import Router
from aiogram.filters import Command
from aiogram.types import Message

from app.bot.handlers._helpers import ensure_user
from app.bot.keyboards import main_menu
from app.db import get_pool
from app.services import user_service

router = Router()


@router.message(Command("holat", "status"))
async def cmd_status(message: Message) -> None:
    user = await ensure_user(message.from_user)
    pool = get_pool()

    slot = await user_service.get_slot_stats(pool, user.id)
    row = await pool.fetchrow(
        """
        SELECT
          (SELECT count(*) FROM subscriptions s
            WHERE s.user_id = $1 AND s.is_active)                      AS active_subs,
          (SELECT count(*) FROM subscriptions s
            WHERE s.user_id = $1 AND s.is_active AND s.autobuy_enabled) AS autobuy_subs,
          (SELECT count(*) FROM autobuy_orders o
            WHERE o.user_id = $1 AND o.status = 'paid')                AS paid_orders,
          (SELECT count(*) FROM autobuy_orders o
            WHERE o.user_id = $1
              AND o.status IN ('reserving','awaiting_otp','paying'))   AS live_orders,
          EXISTS (SELECT 1 FROM user_railway_accounts a
                   WHERE a.user_id = $1 AND a.link_status = 'active')  AS eticket_linked,
          EXISTS (SELECT 1 FROM user_railway_cards c
                   WHERE c.user_id = $1)                               AS has_card
        """,
        user.id,
    )

    lines = ["👤 <b>Mening holatim</b>", "━━━━━━━━━━━━━━━"]

    if user.tier == "premium" and user.premium_until:
        days = (user.premium_until - datetime.now(timezone.utc)).days
        lines.append("💎 Tarif: <b>Premium</b>")
        if days > 3650:
            lines.append("♾ Muddatsiz")
        else:
            lines.append(
                f"📅 Amal qiladi: <b>{user.premium_until.strftime('%d.%m.%Y')}</b>"
                f" ({max(days, 0)} kun qoldi)"
            )
        lines.append("⚡️ Tekshiruv: har 10 soniyada")
    else:
        lines.append("🆓 Tarif: <b>Bepul</b>")
        lines.append("⏱ Tekshiruv: har 30 soniyada")
        lines.append("<i>Premium — 3 ta slot va 3× tezroq tekshiruv: /premium</i>")

    lines += [
        "━━━━━━━━━━━━━━━",
        f"🔔 Xabarnomalar: <b>{row['active_subs']}/{slot.max}</b>",
        f"⚡️ Avto sotib olish yoqilgan: <b>{row['autobuy_subs']}</b>",
        f"🎫 Sotib olingan chiptalar: <b>{row['paid_orders']}</b>",
    ]
    if row["live_orders"]:
        lines.append(f"⏳ Jarayondagi buyurtma: <b>{row['live_orders']}</b>")

    lines += [
        "━━━━━━━━━━━━━━━",
        f"🔗 eticket akkount: {'✅ ulangan' if row['eticket_linked'] else '❌ ulanmagan'}",
        f"💳 Karta: {'✅ saqlangan' if row['has_card'] else '❌ saqlanmagan'}",
    ]
    if not row["eticket_linked"] or not row["has_card"]:
        lines.append("<i>Avto sotib olish uchun ikkalasi ham kerak.</i>")

    await message.answer("\n".join(lines), reply_markup=main_menu(user.lang))
