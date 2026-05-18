"""
Railway.uz authentication — CSRF + JWT login, token caching in DB.

Port of legacy/src/auth.py (sync requests) to async httpx, with the JWT
+ refresh token + cookie state persisted to `railway_credentials` so
multiple workers / restarts share one logged-in session.

Login is mutex-protected via pg_advisory_lock so concurrent workers
don't stampede.
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import asyncpg
import httpx
import jwt
from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings
from app.core.errors import RailwayUnavailable
from app.core.logging import logger

BASE_URL = "https://eticket.railway.uz"
CSRF_URL = f"{BASE_URL}/api/v1/csrf-token"
LOGIN_URL = f"{BASE_URL}/api/v1/auth/login"

COMMON_HEADERS = {
    "Origin": BASE_URL,
    "Referer": f"{BASE_URL}/uz/auth/login",
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/145.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json",
    "Accept-Language": "uz",
    "device-type": "BROWSER",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
}

# Postgres advisory-lock key (hashtext('railway_login') equivalent)
LOGIN_LOCK_KEY = 0x52414C57   # arbitrary stable int — "RALW"


@dataclass(slots=True)
class AuthHeaders:
    access_token: str
    csrf_token: str
    cookie_str: str

    def as_headers(self) -> dict[str, str]:
        return {
            **COMMON_HEADERS,
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.access_token}",
            "X-XSRF-TOKEN": self.csrf_token,
            "Cookie": self.cookie_str,
        }


def _fernet() -> Fernet:
    if not settings.railway_cred_key:
        raise RuntimeError("RAILWAY_CRED_KEY env var is empty — generate with cryptography.fernet")
    return Fernet(settings.railway_cred_key.encode())


def _decrypt(enc: str) -> str:
    try:
        return _fernet().decrypt(enc.encode()).decode()
    except InvalidToken:
        raise RuntimeError("railway_credentials.password_enc has wrong RAILWAY_CRED_KEY")


def _encrypt(plain: str) -> str:
    return _fernet().encrypt(plain.encode()).decode()


def _is_jwt_expiring(token: str, buffer_seconds: int = 60) -> bool:
    try:
        payload = jwt.decode(token, options={"verify_signature": False})
        return time.time() >= (payload.get("exp", 0) - buffer_seconds)
    except Exception:
        return True


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
            and not _is_jwt_expiring(cred["access_token"])
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
            # Re-check after taking lock — another worker may have refreshed
            cred = await conn.fetchrow(
                """
                SELECT id, username, password_enc, access_token, csrf_token, cookie_str,
                       token_exp_at
                FROM railway_credentials WHERE is_active LIMIT 1
                """
            )
            if (cred["access_token"]
                    and not _is_jwt_expiring(cred["access_token"])
                    and cred["csrf_token"] and cred["cookie_str"]):
                return AuthHeaders(
                    access_token=cred["access_token"],
                    csrf_token=cred["csrf_token"],
                    cookie_str=cred["cookie_str"],
                )

            new = await _login_flow(cred["username"], _decrypt(cred["password_enc"]))
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


@dataclass(slots=True)
class _LoginResult:
    access_token: str
    refresh_token: str
    csrf_token: str
    cookie_str: str
    exp_at: datetime


async def _login_flow(username: str, password: str) -> _LoginResult:
    async with httpx.AsyncClient(timeout=20, follow_redirects=False) as client:
        # Step 1: CSRF
        try:
            r = await client.get(CSRF_URL, headers=COMMON_HEADERS)
            r.raise_for_status()
        except httpx.HTTPError as e:
            raise RailwayUnavailable(f"csrf step failed: {e}")

        csrf_value = None
        cookies: dict[str, str] = {}
        for name, value in r.cookies.items():
            cookies[name] = value
            if name == "XSRF-TOKEN":
                csrf_value = value
        if not csrf_value:
            raise RuntimeError("No XSRF-TOKEN cookie returned by /api/v1/csrf-token")

        cookie_str = "; ".join(f"{k}={v}" for k, v in cookies.items())

        # Step 2: login
        try:
            r = await client.post(
                LOGIN_URL,
                json={"username": username, "password": password},
                headers={
                    **COMMON_HEADERS,
                    "Content-Type": "application/json",
                    "X-XSRF-TOKEN": csrf_value,
                    "Cookie": cookie_str,
                },
            )
        except httpx.HTTPError as e:
            raise RailwayUnavailable(f"login step failed: {e}")
        if r.status_code != 200:
            raise RuntimeError(f"railway login {r.status_code}: {r.text[:200]}")

        data = r.json()
        access = data.get("token") or ""
        refresh = data.get("refreshToken") or ""

        # Merge response cookies into the cookie string
        for name, value in r.cookies.items():
            cookies[name] = value
        cookie_str = "; ".join(f"{k}={v}" for k, v in cookies.items())

        try:
            payload = jwt.decode(access, options={"verify_signature": False})
            exp_at = datetime.fromtimestamp(int(payload["exp"]), tz=timezone.utc)
        except Exception:
            exp_at = datetime.now(timezone.utc) + timedelta(minutes=30)

        return _LoginResult(
            access_token=access,
            refresh_token=refresh,
            csrf_token=csrf_value,
            cookie_str=cookie_str,
            exp_at=exp_at,
        )


async def set_cooldown(pool: asyncpg.Pool, duration_seconds: int) -> None:
    until = datetime.now(timezone.utc) + timedelta(seconds=duration_seconds)
    await pool.execute(
        "UPDATE railway_credentials SET cooldown_until = $1 WHERE is_active",
        until,
    )
    logger.warning("railway_cooldown_set", until=until.isoformat())
