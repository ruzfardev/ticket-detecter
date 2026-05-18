"""Register bot's `/setMyCommands` list (autocomplete menu)."""

from __future__ import annotations

from aiogram.types import BotCommand

from app.bot.dispatcher import get_bot
from app.core.logging import logger


COMMANDS_UZ = [
    BotCommand(command="start",    description="Botni ishga tushirish"),
    BotCommand(command="menu",     description="Asosiy menyu"),
    BotCommand(command="help",     description="Yordam"),
    BotCommand(command="contact",  description="Aloqa"),
    BotCommand(command="language", description="Tilni tanlash"),
    BotCommand(command="premium",  description="Premium obuna"),
    BotCommand(command="donate",   description="Loyihani qo'llab-quvvatlash"),
]


async def set_bot_commands() -> None:
    try:
        bot = get_bot()
        await bot.set_my_commands(COMMANDS_UZ)
        logger.info("bot_commands_registered", count=len(COMMANDS_UZ))
    except Exception as e:
        logger.warning("bot_commands_register_failed", error=str(e))
