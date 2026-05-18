"""FastAPI dependencies — initData verification, internal JWT, DB pool."""

from __future__ import annotations

import asyncpg
from fastapi import Depends, Header

from app.auth.init_data import TgUser, verify_init_data
from app.auth.internal_jwt import verify_internal_jwt
from app.core.config import settings
from app.core.errors import AuthError
from app.db import get_pool
from app.services import user_service
from app.services.user_service import UserRow


def db_pool() -> asyncpg.Pool:
    return get_pool()


async def current_tg_user(
    x_tg_init_data: str = Header(..., alias="X-Tg-Init-Data"),
) -> TgUser:
    """Verify initData HMAC, return parsed TG user."""
    return verify_init_data(x_tg_init_data, settings.bot_token)


async def current_user(
    tg_user: TgUser = Depends(current_tg_user),
    pool: asyncpg.Pool = Depends(db_pool),
) -> UserRow:
    """Verify initData and upsert/return our internal user row."""
    user, _ = await user_service.upsert_from_tg(pool, tg_user)
    return user


async def require_internal_jwt(
    authorization: str = Header(..., alias="Authorization"),
) -> dict:
    """Verify the internal Bearer JWT (bot ↔ backend)."""
    if not authorization.startswith("Bearer "):
        raise AuthError("Missing Bearer token")
    return verify_internal_jwt(authorization[7:])
