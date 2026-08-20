"""Deliver a ticket PDF to the user through the bot.

Telegram Mini Apps run in a WebView where downloads are commonly blocked, so
handing the file to the chat is the reliable route — it lands as a document the
user can open, save or forward.
"""

from __future__ import annotations

import httpx

from app.core.config import settings
from app.core.logging import logger

TG_DOC_URL = "https://api.telegram.org/bot{token}/sendDocument"

CAPTION = (
    "🎫 <b>Chiptangiz</b>\n\n"
    "Faylni saqlab qo'ying yoki chop eting.\n"
    "<i>Nazorat paytida shu hujjatni ko'rsatasiz.</i>"
)


async def send_ticket_pdf(*, tg_user_id: int, pdf: bytes, filename: str) -> bool:
    if not settings.bot_token:
        logger.warning("ticket_pdf_no_bot_token")
        return False
    url = TG_DOC_URL.format(token=settings.bot_token)
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.post(
                url,
                data={
                    "chat_id": str(tg_user_id),
                    "caption": CAPTION,
                    "parse_mode": "HTML",
                },
                files={"document": (filename, pdf, "application/pdf")},
            )
        body = r.json()
        if not body.get("ok"):
            logger.warning("ticket_pdf_send_failed",
                           tg_user_id=tg_user_id,
                           error=str(body.get("description"))[:200])
            return False
        return True
    except Exception as exc:
        logger.warning("ticket_pdf_send_exception",
                       tg_user_id=tg_user_id, error=str(exc)[:200])
        return False
