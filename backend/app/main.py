"""
FastAPI application entry point.

Lifespan: init DB pool on startup, close on shutdown.
Mounts only the `/health` and `/metrics` endpoints at this stage — domain
routers land in M2+ milestones.
"""

from __future__ import annotations

import time
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app import __version__
from app.core.config import settings
from app.core.errors import AppError, InvalidPayload
from app.core.logging import configure_logging, logger
from app.db import close_pool, init_pool, ping as db_ping

_started_at = time.monotonic()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    configure_logging()
    logger.info("app_starting", version=__version__, mode=settings.mode)
    await init_pool()
    try:
        yield
    finally:
        await close_pool()
        logger.info("app_stopped")


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

    # ---- CORS (Mini App is hosted on web.telegram.org) ----
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "https://web.telegram.org",
            "https://k.web.telegram.org",
            "https://z.web.telegram.org",
            "https://a.web.telegram.org",
            # dev:
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ],
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

    # ---- Health endpoints ----
    @app.get("/health", tags=["meta"])
    async def health() -> dict[str, Any]:
        db_ok = await db_ping()
        uptime = time.monotonic() - _started_at
        return {
            "status": "ok" if db_ok else "degraded",
            "version": __version__,
            "db": "ok" if db_ok else "down",
            "uptime_s": round(uptime, 1),
        }

    @app.get("/ready", tags=["meta"])
    async def ready() -> dict[str, Any]:
        # Readiness is stricter — DB must be reachable
        db_ok = await db_ping()
        return {"ready": db_ok, "checks": {"db": "ok" if db_ok else "down"}}

    return app


app = create_app()
