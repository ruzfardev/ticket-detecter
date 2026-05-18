"""/language + lang:{code} callback."""

from __future__ import annotations

from aiogram import F, Router
from aiogram.filters import Command
from aiogram.types import CallbackQuery, Message

from app.bot.handlers._helpers import ensure_user
from app.bot.i18n import t
from app.bot.keyboards import language_picker, main_menu
from app.db import get_pool
from app.services import user_service

router = Router()


@router.message(Command("language"))
async def cmd_language(message: Message) -> None:
    user = await ensure_user(message.from_user)
    await message.answer(t("lang.choose", user.lang), reply_markup=language_picker())


@router.callback_query(F.data.startswith("lang:"))
async def on_lang_pick(cq: CallbackQuery) -> None:
    new_lang = cq.data.split(":", 1)[1]
    if new_lang not in ("uz", "ru", "en"):
        await cq.answer("?")
        return

    user = await ensure_user(cq.from_user)
    await user_service.update_lang(get_pool(), user.id, new_lang)
    await cq.answer("✓")
    await cq.message.answer(t("lang.changed", new_lang), reply_markup=main_menu(new_lang))
