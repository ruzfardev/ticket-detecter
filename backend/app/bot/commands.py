"""Register bot's `/setMyCommands` list (autocomplete menu)."""

from __future__ import annotations

from aiogram.types import BotCommand, BotCommandScopeChat

from app.bot.dispatcher import get_bot
from app.core.config import settings
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

# Shown only in admin chats (scoped), on top of the public list.
ADMIN_COMMANDS = COMMANDS_UZ + [
    BotCommand(command="stats",     description="📊 Statistika (admin)"),
    BotCommand(command="refund",    description="↩️ Refund (admin)"),
    BotCommand(command="broadcast", description="📣 Broadcast (admin)"),
]


async def set_bot_commands() -> None:
    try:
        bot = get_bot()
        await bot.set_my_commands(COMMANDS_UZ)
        for admin_id in settings.admin_id_set:
            try:
                await bot.set_my_commands(
                    ADMIN_COMMANDS, scope=BotCommandScopeChat(chat_id=admin_id),
                )
            except Exception as e:
                logger.warning("admin_commands_register_failed",
                               admin=admin_id, error=str(e))
        logger.info("bot_commands_registered",
                    count=len(COMMANDS_UZ), admins=len(settings.admin_id_set))
    except Exception as e:
        logger.warning("bot_commands_register_failed", error=str(e))
