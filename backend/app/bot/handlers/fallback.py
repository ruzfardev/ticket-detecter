"""Catch-all handler — last router registered."""

from __future__ import annotations

from aiogram import F, Router
from aiogram.types import Message

from app.bot.handlers._helpers import ensure_user
from app.bot.i18n import t
from app.bot.keyboards import main_menu

router = Router()


@router.message(F.text)
async def fallback_text(message: Message) -> None:
    user = await ensure_user(message.from_user)
    await message.answer(t("fallback.unknown", user.lang), reply_markup=main_menu(user.lang))


@router.message()
async def fallback_anything(message: Message) -> None:
    user = await ensure_user(message.from_user)
    await message.answer(t("fallback.unknown", user.lang), reply_markup=main_menu(user.lang))
