"""
Internal JWT — used for bot ↔ backend HTTP authentication.

Short-lived (60s) HS256-signed tokens. Both sides share INTERNAL_JWT_SECRET.
"""

from __future__ import annotations

import time

import jwt

from app.core.config import settings
from app.core.errors import AuthError


def make_internal_jwt(issuer: str = "bot", ttl_seconds: int = 60) -> str:
    now = int(time.time())
    payload = {"iss": issuer, "iat": now, "exp": now + ttl_seconds}
    return jwt.encode(payload, settings.internal_jwt_secret, algorithm="HS256")


def verify_internal_jwt(token: str) -> dict:
    try:
        return jwt.decode(token, settings.internal_jwt_secret, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise AuthError("Internal token expired")
    except jwt.InvalidTokenError as e:
        raise AuthError(f"Invalid internal token: {e}")
