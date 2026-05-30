"""
Per-user eticket.railway.uz authentication.

A user links their personal account via the mini-app; we persist the
encrypted password + JWT + CSRF/cookies in `user_railway_accounts`.
Token refresh is mutex-guarded with a per-user Postgres advisory lock.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone

import asyncpg

from app.core.errors import AppError, RailwayUnavailable
from app.core.logging import logger
from app.railway._auth_common import (
    AuthHeaders,
    LoginResult,
    decrypt,
    encrypt,
    extract_railway_user_id,
    is_jwt_expiring,
    login_flow,
)

# Per-user advisory lock = high 32 bits of "RALU" XOR low 32 bits = user_id.
# Postgres advisory locks accept a single bigint (64-bit) here.
_USER_LOCK_BASE = 0x52414C5500000000


def _user_lock_key(user_id: int) -> int:
    # Postgres expects signed bigint; mask to 63 bits to stay safe.
    return (_USER_LOCK_BASE | (user_id & 0xFFFFFFFF)) & ((1 << 63) - 1)


class RailwayLoginFailed(AppError):
    code = "railway_login_failed"
    status_code = 400


class RailwayAccountRequired(AppError):
    code = "railway_account_required"
    status_code = 412  # Precondition Failed — user must link first


@dataclass(slots=True)
class UserAccountRow:
    id: int
    user_id: int
    username: str
    railway_user_id: str | None
    link_status: str
    last_login_at: datetime | None
    last_sync_at: datetime | None
    cooldown_until: datetime | None


async def _fetch_account(
    conn: asyncpg.Connection | asyncpg.Pool, user_id: int,
) -> asyncpg.Record | None:
    return await conn.fetchrow(
        """
        SELECT id, user_id, username, password_enc, railway_user_id,
               access_token, refresh_token, csrf_token, cookie_str,
               token_exp_at, last_login_at, last_sync_at, cooldown_until,
               link_status
        FROM user_railway_accounts
        WHERE user_id = $1
        """,
        user_id,
    )


def _row_to_account(row: asyncpg.Record) -> UserAccountRow:
    return UserAccountRow(
        id=row["id"],
        user_id=row["user_id"],
        username=row["username"],
        railway_user_id=row["railway_user_id"],
        link_status=row["link_status"],
        last_login_at=row["last_login_at"],
        last_sync_at=row["last_sync_at"],
        cooldown_until=row["cooldown_until"],
    )


async def get_account(pool: asyncpg.Pool, user_id: int) -> UserAccountRow | None:
    row = await _fetch_account(pool, user_id)
    return _row_to_account(row) if row else None


async def login_for_user(
    pool: asyncpg.Pool, user_id: int, username: str, password: str,
) -> UserAccountRow:
    """Authenticate the user against eticket and upsert the encrypted row.

    Raises `RailwayLoginFailed` if credentials are rejected,
    `RailwayUnavailable` if the upstream is down.
    """
    try:
        result: LoginResult = await login_flow(username, password)
    except RuntimeError as exc:
        # `login_flow` raises RuntimeError for non-2xx login responses
        logger.info("railway_account_link_failed", user_id=user_id, reason=str(exc)[:120])
        raise RailwayLoginFailed("Invalid eticket.railway.uz credentials")

    pwd_enc = encrypt(password)
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO user_railway_accounts
              (user_id, username, password_enc, railway_user_id,
               access_token, refresh_token, csrf_token, cookie_str,
               token_exp_at, last_login_at, link_status)
            VALUES
              ($1, $2, $3, $4, $5, $6, $7, $8, $9, now(), 'active')
            ON CONFLICT (user_id) DO UPDATE SET
              username        = EXCLUDED.username,
              password_enc    = EXCLUDED.password_enc,
              railway_user_id = COALESCE(EXCLUDED.railway_user_id,
                                         user_railway_accounts.railway_user_id),
              access_token    = EXCLUDED.access_token,
              refresh_token   = EXCLUDED.refresh_token,
              csrf_token      = EXCLUDED.csrf_token,
              cookie_str      = EXCLUDED.cookie_str,
              token_exp_at    = EXCLUDED.token_exp_at,
              last_login_at   = now(),
              cooldown_until  = NULL,
              link_status     = 'active'
            RETURNING id, user_id, username, password_enc, railway_user_id,
                      access_token, refresh_token, csrf_token, cookie_str,
                      token_exp_at, last_login_at, last_sync_at, cooldown_until,
                      link_status
            """,
            user_id, username, pwd_enc, result.railway_user_id,
            result.access_token, result.refresh_token, result.csrf_token,
            result.cookie_str, result.exp_at,
        )

    logger.info("railway_account_linked", user_id=user_id, username_masked=_mask(username))
    return _row_to_account(row)


async def get_or_refresh_for_user(pool: asyncpg.Pool, user_id: int) -> AuthHeaders:
    row = await _fetch_account(pool, user_id)
    if not row or row["link_status"] != "active":
        raise RailwayAccountRequired("Link your eticket.railway.uz account first")

    if row["cooldown_until"] and row["cooldown_until"] > datetime.now(timezone.utc):
        raise RailwayUnavailable(
            "railway.uz cooldown active",
            {"until": row["cooldown_until"].isoformat()},
        )

    if (row["access_token"]
            and not is_jwt_expiring(row["access_token"])
            and row["csrf_token"] and row["cookie_str"]):
        return AuthHeaders(
            access_token=row["access_token"],
            csrf_token=row["csrf_token"],
            cookie_str=row["cookie_str"],
        )

    lock_key = _user_lock_key(user_id)
    async with pool.acquire() as conn:
        await conn.execute("SELECT pg_advisory_lock($1)", lock_key)
        try:
            row = await _fetch_account(conn, user_id)
            if not row or row["link_status"] != "active":
                raise RailwayAccountRequired("Account no longer active")

            if (row["access_token"]
                    and not is_jwt_expiring(row["access_token"])
                    and row["csrf_token"] and row["cookie_str"]):
                return AuthHeaders(
                    access_token=row["access_token"],
                    csrf_token=row["csrf_token"],
                    cookie_str=row["cookie_str"],
                )

            try:
                new = await login_flow(row["username"], decrypt(row["password_enc"]))
            except RuntimeError:
                # Password changed on eticket side — flip status, surface to caller.
                await conn.execute(
                    """
                    UPDATE user_railway_accounts
                    SET link_status = 'login_failed',
                        access_token = NULL,
                        refresh_token = NULL,
                        csrf_token = NULL,
                        cookie_str = NULL,
                        token_exp_at = NULL
                    WHERE user_id = $1
                    """,
                    user_id,
                )
                logger.warning("railway_account_relogin_failed", user_id=user_id)
                raise RailwayLoginFailed("Stored password no longer valid; please re-link")

            await conn.execute(
                """
                UPDATE user_railway_accounts SET
                  access_token = $1,
                  refresh_token = $2,
                  csrf_token = $3,
                  cookie_str = $4,
                  token_exp_at = $5,
                  last_login_at = now()
                WHERE user_id = $6
                """,
                new.access_token, new.refresh_token, new.csrf_token,
                new.cookie_str, new.exp_at, user_id,
            )
            logger.info("railway_user_relogin_ok", user_id=user_id, exp_at=new.exp_at.isoformat())
            return AuthHeaders(
                access_token=new.access_token,
                csrf_token=new.csrf_token,
                cookie_str=new.cookie_str,
            )
        finally:
            await conn.execute("SELECT pg_advisory_unlock($1)", lock_key)


async def store_railway_user_id(pool: asyncpg.Pool, user_id: int, railway_user_id: str) -> None:
    await pool.execute(
        "UPDATE user_railway_accounts SET railway_user_id = $1 WHERE user_id = $2",
        railway_user_id, user_id,
    )


async def resolve_railway_user_id(pool: asyncpg.Pool, user_id: int) -> str | None:
    """Lazy resolve eticket userId from the cached JWT 'id' claim.

    Use this for accounts linked before the JWT-decoding path existed
    (they have railway_user_id=NULL but a valid access_token).
    """
    row = await _fetch_account(pool, user_id)
    if not row or not row["access_token"]:
        return None
    uid = extract_railway_user_id(row["access_token"])
    if uid:
        await store_railway_user_id(pool, user_id, uid)
    return uid


async def mark_sync(pool: asyncpg.Pool, user_id: int) -> None:
    await pool.execute(
        "UPDATE user_railway_accounts SET last_sync_at = now() WHERE user_id = $1",
        user_id,
    )


async def revoke_user(pool: asyncpg.Pool, user_id: int) -> None:
    """Mark account revoked and clear all in-memory tokens / cached doc data.

    Also disables auto-buy on all of the user's subscriptions and removes the
    cached friends list. Idempotent.
    """
    async with pool.acquire() as conn, conn.transaction():
        await conn.execute(
            """
            UPDATE user_railway_accounts SET
              link_status   = 'revoked',
              access_token  = NULL,
              refresh_token = NULL,
              csrf_token    = NULL,
              cookie_str    = NULL,
              token_exp_at  = NULL,
              cooldown_until = NULL
            WHERE user_id = $1
            """,
            user_id,
        )
        await conn.execute(
            """
            UPDATE subscriptions
            SET autobuy_enabled = FALSE,
                autobuy_friend_id = NULL,
                autobuy_payment_method = NULL
            WHERE user_id = $1
            """,
            user_id,
        )
        await conn.execute(
            "DELETE FROM railway_friends_cache WHERE user_id = $1",
            user_id,
        )
    logger.info("railway_account_unlinked", user_id=user_id)


def _mask(username: str) -> str:
    """Mask username for logs: 'john@example.com' -> 'j••••@example.com'."""
    if "@" in username:
        local, _, domain = username.partition("@")
        return f"{local[:1]}{'•' * max(1, len(local) - 1)}@{domain}"
    if username.startswith("+998") and len(username) >= 7:
        return f"{username[:5]}••{username[-2:]}"
    return username[:2] + "•••"
