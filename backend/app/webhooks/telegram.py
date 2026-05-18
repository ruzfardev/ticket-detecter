"""POST /webhooks/telegram — feed updates into aiogram dispatcher."""

from __future__ import annotations

from aiogram.types import Update
from fastapi import APIRouter, Header, HTTPException, Request

from app.bot.dispatcher import get_bot, get_dispatcher
from app.core.config import settings
from app.core.logging import logger

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.post("/telegram")
async def telegram_webhook(
    request: Request,
    x_telegram_bot_api_secret_token: str = Header(default=""),
) -> dict:
    if settings.webhook_secret and x_telegram_bot_api_secret_token != settings.webhook_secret:
        logger.warning("webhook_secret_mismatch")
        raise HTTPException(status_code=403, detail="forbidden")

    try:
        data = await request.json()
        update = Update.model_validate(data)
        await get_dispatcher().feed_update(get_bot(), update)
    except Exception as e:
        # Never raise to Telegram — they'll retry forever
        logger.exception("webhook_handler_error", error=str(e))

    return {"ok": True}
