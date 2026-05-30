"""
Shared helpers for eticket.railway.uz authentication.

Used by both:
- `railway/auth.py` — the single shared service account (worker polling)
- `railway/user_auth.py` — per-user accounts (auto-buy linking)

The CSRF + JWT login flow itself is identical for both; only persistence
differs.
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import httpx
import jwt
from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings
from app.core.errors import RailwayUnavailable

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


@dataclass(slots=True)
class LoginResult:
    access_token: str
    refresh_token: str
    csrf_token: str
    cookie_str: str
    exp_at: datetime


def fernet() -> Fernet:
    if not settings.railway_cred_key:
        raise RuntimeError("RAILWAY_CRED_KEY env var is empty — generate with cryptography.fernet")
    return Fernet(settings.railway_cred_key.encode())


def decrypt(enc: str) -> str:
    try:
        return fernet().decrypt(enc.encode()).decode()
    except InvalidToken:
        raise RuntimeError("Fernet payload has wrong RAILWAY_CRED_KEY")


def encrypt(plain: str) -> str:
    return fernet().encrypt(plain.encode()).decode()


def is_jwt_expiring(token: str, buffer_seconds: int = 60) -> bool:
    try:
        payload = jwt.decode(token, options={"verify_signature": False})
        return time.time() >= (payload.get("exp", 0) - buffer_seconds)
    except Exception:
        return True


async def login_flow(username: str, password: str) -> LoginResult:
    """Run CSRF + login against eticket.railway.uz and return tokens + cookies.

    Raises RailwayUnavailable on network/5xx; raises RuntimeError on 4xx
    (caller maps to a user-visible 'wrong credentials' error).
    """
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

        for name, value in r.cookies.items():
            cookies[name] = value
        cookie_str = "; ".join(f"{k}={v}" for k, v in cookies.items())

        try:
            payload = jwt.decode(access, options={"verify_signature": False})
            exp_at = datetime.fromtimestamp(int(payload["exp"]), tz=timezone.utc)
        except Exception:
            exp_at = datetime.now(timezone.utc) + timedelta(minutes=30)

        return LoginResult(
            access_token=access,
            refresh_token=refresh,
            csrf_token=csrf_value,
            cookie_str=cookie_str,
            exp_at=exp_at,
        )
