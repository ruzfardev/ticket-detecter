"""Send messages to configured admins (in-process bot)."""

from __future__ import annotations

from typing import Any

from app.bot.dispatcher import get_bot
from app.core.config import settings
from app.core.logging import logger


async def notify_admins(text: str, reply_markup: Any | None = None) -> None:
    """Deliver `text` to every admin in ADMIN_IDS. Best-effort, never raises."""
    admin_ids = settings.admin_id_set
    if not admin_ids:
        return
    bot = get_bot()
    for admin_id in admin_ids:
        try:
            await bot.send_message(admin_id, text, reply_markup=reply_markup)
        except Exception as e:  # admin blocked the bot, bad id, etc.
            logger.warning("notify_admin_failed", admin=admin_id, error=str(e))
