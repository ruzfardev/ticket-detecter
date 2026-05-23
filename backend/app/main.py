"""
FastAPI application entry point.

Lifespan:
  - init DB pool
  - register bot commands (BotFather autocomplete)
  - dev mode: start aiogram polling in background task
  - prod mode: webhook endpoint feeds the dispatcher

Mounts api/v1, internal/v1, webhooks. /health and /metrics for ops.
"""

from __future__ import annotations

import asyncio
import time
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app import __version__
from app.api.v1 import router as api_v1_router
from app.core.config import settings
from app.core.errors import AppError, InvalidPayload
from app.core.logging import configure_logging, logger
from app.db import close_pool, init_pool, ping as db_ping
from app.internal.v1 import router as internal_v1_router
from app.webhooks import telegram as webhooks_telegram

_started_at = time.monotonic()
_polling_task: asyncio.Task | None = None


@asynccontextmanager
async def lifespan(_app: FastAPI):
    configure_logging()
    logger.info("app_starting", version=__version__, mode=settings.mode)
    await init_pool()

    # Wire bot (only if token configured)
    if settings.bot_token:
        from app.bot.commands import set_bot_commands
        from app.bot.dispatcher import get_bot, get_dispatcher

        await set_bot_commands()

        if settings.mode == "dev":
            # Polling in a background task. Webhook (if any) is deleted first
            # so getUpdates is allowed.
            global _polling_task
            bot = get_bot()
            dp = get_dispatcher()
            try:
                await bot.delete_webhook(drop_pending_updates=False)
            except Exception:
                pass
            _polling_task = asyncio.create_task(_run_polling(bot, dp))
            logger.info("bot_polling_started")
    else:
        logger.warning("bot_token_missing", hint="bot disabled, set BOT_TOKEN to enable")

    try:
        yield
    finally:
        if _polling_task is not None:
            _polling_task.cancel()
            try:
                await _polling_task
            except (asyncio.CancelledError, Exception):
                pass
        if settings.bot_token:
            try:
                from app.bot.dispatcher import get_bot
                await get_bot().session.close()
            except Exception:
                pass
        await close_pool()
        logger.info("app_stopped")


async def _run_polling(bot, dp) -> None:
    """Run aiogram polling, swallowing the inevitable shutdown CancelledError."""
    try:
        await dp.start_polling(bot, handle_signals=False)
    except asyncio.CancelledError:
        logger.info("bot_polling_cancelled")
        raise
    except Exception as e:
        logger.exception("bot_polling_crashed", error=str(e))


def _error_response(code: str, message: str, status_code: int,
                    details: dict[str, Any] | None = None) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"error": {"code": code, "message": message, "details": details or {}}},
    )


def create_app() -> FastAPI:
    app = FastAPI(
        title="Ticket Detector Backend",
        version=__version__,
        lifespan=lifespan,
        docs_url="/docs" if settings.mode == "dev" else None,
        redoc_url=None,
        openapi_url="/openapi.json" if settings.mode == "dev" else None,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "https://web.telegram.org",
            "https://k.web.telegram.org",
            "https://z.web.telegram.org",
            "https://a.web.telegram.org",
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ],
        allow_origin_regex=r"https://.*\.vercel\.app",
        allow_methods=["GET", "POST", "PATCH", "DELETE"],
        allow_headers=["Content-Type", "X-Tg-Init-Data", "Authorization"],
    )

    # ---- Exception handlers ----
    @app.exception_handler(AppError)
    async def handle_app_error(_req: Request, exc: AppError) -> JSONResponse:
        logger.warning("app_error", code=exc.code, message=exc.message, details=exc.details)
        return _error_response(exc.code, exc.message, exc.status_code, exc.details)

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(_req: Request, exc: RequestValidationError) -> JSONResponse:
        err = InvalidPayload("Request validation failed", {"errors": exc.errors()})
        return _error_response(err.code, err.message, err.status_code, err.details)

    @app.exception_handler(Exception)
    async def handle_unexpected(_req: Request, exc: Exception) -> JSONResponse:
        logger.exception("unhandled_exception", error=str(exc), error_type=type(exc).__name__)
        return _error_response("internal_error", "Internal server error", 500)

    # ---- Health ----
    @app.get("/health", tags=["meta"])
    async def health() -> dict[str, Any]:
        db_ok = await db_ping()
        return {
            "status": "ok" if db_ok else "degraded",
            "version": __version__,
            "db": "ok" if db_ok else "down",
            "uptime_s": round(time.monotonic() - _started_at, 1),
        }

    @app.get("/ready", tags=["meta"])
    async def ready() -> dict[str, Any]:
        db_ok = await db_ping()
        return {"ready": db_ok, "checks": {"db": "ok" if db_ok else "down"}}

    # ---- Routers ----
    app.include_router(api_v1_router)
    app.include_router(internal_v1_router)
    app.include_router(webhooks_telegram.router)

    return app


app = create_app()
