"""
Railway.uz authentication for the SHARED service account.

The CSRF + JWT login flow itself lives in `_auth_common.py` and is reused
by per-user authentication (`user_auth.py`). This module persists the
shared service account state in `railway_credentials` and mutex-guards
re-login with a Postgres advisory lock so concurrent workers don't
stampede.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import asyncpg

from app.core.errors import RailwayUnavailable
from app.core.logging import logger
from app.railway._auth_common import (
    AuthHeaders,
    BASE_URL,
    COMMON_HEADERS,
    CSRF_URL,
    LOGIN_URL,
    LoginResult,
    decrypt,
    encrypt,
    fernet,
    is_jwt_expiring,
    login_flow,
)

# Re-exports kept for backward compatibility with callers importing from auth.py.
__all__ = [
    "AuthHeaders",
    "BASE_URL",
    "COMMON_HEADERS",
    "CSRF_URL",
    "LOGIN_URL",
    "get_or_refresh_auth",
    "set_cooldown",
    "_fernet",
    "_decrypt",
    "_encrypt",
    "_is_jwt_expiring",
]

# Postgres advisory-lock key (hashtext('railway_login') equivalent)
LOGIN_LOCK_KEY = 0x52414C57   # arbitrary stable int — "RALW"


# ---- Backwards-compat shims ----
# Several worker/service modules still reference the leading-underscore
# helpers. Keep them as thin aliases over the shared implementation.

_fernet = fernet
_decrypt = decrypt
_encrypt = encrypt
_is_jwt_expiring = is_jwt_expiring


async def get_or_refresh_auth(pool: asyncpg.Pool) -> AuthHeaders:
    """Return cached headers or re-login under advisory lock if needed."""
    cred = await pool.fetchrow(
        """
        SELECT id, username, password_enc, access_token, csrf_token, cookie_str,
               token_exp_at, cooldown_until
        FROM railway_credentials WHERE is_active LIMIT 1
        """
    )
    if not cred:
        raise RuntimeError(
            "No railway_credentials row found. Seed via app.scripts.seed_credentials."
        )

    if cred["cooldown_until"] and cred["cooldown_until"] > datetime.now(timezone.utc):
        raise RailwayUnavailable(
            "railway.uz cooldown active",
            {"until": cred["cooldown_until"].isoformat()},
        )

    if (cred["access_token"]
            and not is_jwt_expiring(cred["access_token"])
            and cred["csrf_token"] and cred["cookie_str"]):
        return AuthHeaders(
            access_token=cred["access_token"],
            csrf_token=cred["csrf_token"],
            cookie_str=cred["cookie_str"],
        )

    # ---- Need to re-login. Acquire advisory lock (only one worker logs in) ----
    async with pool.acquire() as conn:
        await conn.execute("SELECT pg_advisory_lock($1)", LOGIN_LOCK_KEY)
        try:
            cred = await conn.fetchrow(
                """
                SELECT id, username, password_enc, access_token, csrf_token, cookie_str,
                       token_exp_at
                FROM railway_credentials WHERE is_active LIMIT 1
                """
            )
            if (cred["access_token"]
                    and not is_jwt_expiring(cred["access_token"])
                    and cred["csrf_token"] and cred["cookie_str"]):
                return AuthHeaders(
                    access_token=cred["access_token"],
                    csrf_token=cred["csrf_token"],
                    cookie_str=cred["cookie_str"],
                )

            new: LoginResult = await login_flow(cred["username"], decrypt(cred["password_enc"]))
            await conn.execute(
                """
                UPDATE railway_credentials SET
                    access_token = $1,
                    refresh_token = $2,
                    csrf_token = $3,
                    cookie_str = $4,
                    token_exp_at = $5,
                    last_login_at = now()
                WHERE id = $6
                """,
                new.access_token,
                new.refresh_token,
                new.csrf_token,
                new.cookie_str,
                new.exp_at,
                cred["id"],
            )
            logger.info("railway_relogin_ok", exp_at=new.exp_at.isoformat())
            return AuthHeaders(
                access_token=new.access_token,
                csrf_token=new.csrf_token,
                cookie_str=new.cookie_str,
            )
        finally:
            await conn.execute("SELECT pg_advisory_unlock($1)", LOGIN_LOCK_KEY)


async def set_cooldown(pool: asyncpg.Pool, duration_seconds: int) -> None:
    until = datetime.now(timezone.utc) + timedelta(seconds=duration_seconds)
    await pool.execute(
        "UPDATE railway_credentials SET cooldown_until = $1 WHERE is_active",
        until,
    )
    logger.warning("railway_cooldown_set", until=until.isoformat())
