"""/help, /contact."""

from __future__ import annotations

from aiogram import Router
from aiogram.filters import Command
from aiogram.types import Message

from app.bot.handlers._helpers import ensure_user
from app.bot.i18n import t
from app.bot.keyboards import main_menu

router = Router()


@router.message(Command("help"))
async def cmd_help(message: Message) -> None:
    user = await ensure_user(message.from_user)
    text = f"{t('help.title', user.lang)}\n\n{t('help.body', user.lang)}"
    await message.answer(text, reply_markup=main_menu(user.lang))


@router.message(Command("contact"))
async def cmd_contact(message: Message) -> None:
    user = await ensure_user(message.from_user)
    text = f"{t('contact.title', user.lang)}\n\n{t('contact.body', user.lang)}"
    await message.answer(text, reply_markup=main_menu(user.lang))
