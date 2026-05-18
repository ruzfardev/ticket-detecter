"""/start, /menu — entry points."""

from __future__ import annotations

from aiogram import Router
from aiogram.filters import Command, CommandStart
from aiogram.types import Message

from app.bot.handlers._helpers import ensure_user
from app.bot.i18n import t
from app.bot.keyboards import main_menu

router = Router()


@router.message(CommandStart())
async def cmd_start(message: Message) -> None:
    user = await ensure_user(message.from_user)
    name = message.from_user.first_name or "🙂"
    text = "\n\n".join([
        t("start.greeting", user.lang, name=name),
        t("start.intro", user.lang),
    ])
    await message.answer(text, reply_markup=main_menu(user.lang))


@router.message(Command("menu"))
async def cmd_menu(message: Message) -> None:
    user = await ensure_user(message.from_user)
    await message.answer(t("start.intro", user.lang), reply_markup=main_menu(user.lang))
