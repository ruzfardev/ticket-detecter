"""Shared helpers for handlers: get user, send error fallback."""

from __future__ import annotations

from aiogram.types import Message, User

from app.auth.init_data import TgUser
from app.bot.i18n import t
from app.bot.keyboards import main_menu
from app.core.logging import logger
from app.db import get_pool
from app.services import user_service
from app.services.user_service import UserRow


async def ensure_user(tg_from: User) -> UserRow:
    """Upsert user based on the message's `from_user`, return our row."""
    fake = TgUser(
        id=tg_from.id,
        first_name=tg_from.first_name or "",
        last_name=tg_from.last_name or "",
        username=tg_from.username or "",
        language_code=(tg_from.language_code or "uz")[:2],
        is_premium=bool(tg_from.is_premium),
    )
    user, is_new = await user_service.upsert_from_tg(get_pool(), fake)
    if is_new:
        logger.info("bot_user_started", tg_user_id=tg_from.id)
    return user


async def send_safe(message: Message, text: str, lang: str = "uz", **kwargs) -> None:
    try:
        await message.answer(text, reply_markup=main_menu(lang), **kwargs)
    except Exception as e:
        logger.warning("bot_send_failed", error=str(e), chat_id=message.chat.id)
        try:
            await message.answer(t("fallback.error", lang))
        except Exception:
            pass
