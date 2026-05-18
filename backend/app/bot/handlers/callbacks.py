"""
Generic inline-button callbacks not handled by feature-specific routers.

Mute / delete sub callbacks land here (M4 worker sends them in the
notification message). Payment-related callbacks live in payments.py (M5).
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from aiogram import F, Router
from aiogram.types import CallbackQuery

from app.bot.i18n import t
from app.core.logging import logger
from app.db import get_pool

router = Router()


@router.callback_query(F.data.startswith("mute_sub:"))
async def on_mute(cq: CallbackQuery) -> None:
    try:
        _, sub_id, seconds = cq.data.split(":")
        until = datetime.now(timezone.utc) + timedelta(seconds=int(seconds))
    except ValueError:
        await cq.answer("✗")
        return

    pool = get_pool()
    result = await pool.execute(
        """
        UPDATE subscriptions SET muted_until = $1
        WHERE id = $2 AND user_id = (SELECT id FROM users WHERE tg_user_id = $3)
        """,
        until, int(sub_id), cq.from_user.id,
    )
    if result.endswith("0"):
        await cq.answer("✗ Topilmadi")
    else:
        await cq.answer(f"🔇 {seconds}s")
        logger.info("sub_muted", sub_id=sub_id, until=until.isoformat())


@router.callback_query(F.data.startswith("del_sub:"))
async def on_delete(cq: CallbackQuery) -> None:
    try:
        sub_id = int(cq.data.split(":", 1)[1])
    except ValueError:
        await cq.answer("✗")
        return

    pool = get_pool()
    result = await pool.execute(
        """
        DELETE FROM subscriptions
        WHERE id = $1 AND user_id = (SELECT id FROM users WHERE tg_user_id = $2)
        """,
        sub_id, cq.from_user.id,
    )
    if result.endswith("0"):
        await cq.answer("✗ Topilmadi")
    else:
        await cq.answer("🗑")
        logger.info("sub_deleted_via_bot", sub_id=sub_id, user=cq.from_user.id)


@router.callback_query(F.data == "cancel")
async def on_cancel(cq: CallbackQuery) -> None:
    await cq.answer()
    try:
        await cq.message.delete()
    except Exception:
        pass
