"""
aiogram Bot + Dispatcher singletons.

The bot lives in-process with the FastAPI app:
  - Dev: polling task started in lifespan
  - Prod: webhook endpoint feeds updates into this dispatcher
"""

from __future__ import annotations

from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode

from app.core.config import settings

_bot: Bot | None = None
_dp: Dispatcher | None = None


def get_bot() -> Bot:
    global _bot
    if _bot is None:
        if not settings.bot_token:
            raise RuntimeError("BOT_TOKEN env var is not set")
        _bot = Bot(
            token=settings.bot_token,
            default=DefaultBotProperties(
                parse_mode=ParseMode.HTML,
                link_preview_is_disabled=True,
            ),
        )
    return _bot


def get_dispatcher() -> Dispatcher:
    global _dp
    if _dp is None:
        _dp = Dispatcher()
        _register_routers(_dp)
    return _dp


def _register_routers(dp: Dispatcher) -> None:
    # Imported here to avoid circulars
    from app.bot.handlers import (
        admin, callbacks, donate, fallback, help_, language, menu,
        payments, premium, start, status,
    )

    dp.include_router(start.router)
    dp.include_router(help_.router)
    dp.include_router(menu.router)          # reply-keyboard button taps
    dp.include_router(premium.router)       # /premium + ⭐ Premium label
    dp.include_router(donate.router)        # /donate + ❤️ Donate label
    dp.include_router(payments.router)      # pre_checkout_query, successful_payment
    dp.include_router(status.router)        # /holat
    dp.include_router(language.router)
    dp.include_router(admin.router)         # /stats, /refund, /broadcast (admin-only)
    dp.include_router(callbacks.router)     # inline-button generic
    dp.include_router(fallback.router)      # catch-all — must be last
