"""
Telegram sender for the watcher.

Worker calls Telegram Bot API directly (no bot dispatcher needed).
Returns message_id on success, None on failure.
"""

from __future__ import annotations

import httpx

from app.core.config import settings
from app.core.logging import logger

TG_SEND_URL = "https://api.telegram.org/bot{token}/sendMessage"


async def send_alert(tg_user_id: int, html: str, *, sub_id: int) -> int | None:
    if not settings.bot_token:
        logger.warning("send_alert_skipped_no_bot_token")
        return None

    payload = {
        "chat_id": tg_user_id,
        "text": html,
        "parse_mode": "HTML",
        "disable_web_page_preview": True,
        "reply_markup": {
            "inline_keyboard": [[
                {"text": "🔇 10 daq",  "callback_data": f"mute_sub:{sub_id}:600"},
                {"text": "🔇 1 soat",  "callback_data": f"mute_sub:{sub_id}:3600"},
                {"text": "🗑",         "callback_data": f"del_sub:{sub_id}"},
            ]]
        },
    }
    url = TG_SEND_URL.format(token=settings.bot_token)
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(url, json=payload)
        data = r.json()
        if not data.get("ok"):
            logger.warning("send_alert_failed", error=data.get("description"))
            return None
        return data["result"].get("message_id")
    except Exception as e:
        logger.warning("send_alert_exception", error=str(e))
        return None
