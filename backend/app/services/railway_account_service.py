"""Per-user eticket.railway.uz account linking."""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime
from typing import Any

import asyncpg

from app.core.errors import InvalidPayload
from app.core.logging import logger
from app.railway import user_auth

_EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
_PHONE_RE = re.compile(r"^\+998\d{9}$")


def validate_railway_username(value: str) -> str:
    v = (value or "").strip()
    if _EMAIL_RE.match(v) or _PHONE_RE.match(v):
        return v
    raise InvalidPayload("username must be an email or +998XXXXXXXXX phone")


def _mask_username(username: str) -> str:
    return user_auth._mask(username)  # noqa: SLF001


@dataclass(slots=True)
class AccountStatus:
    linked: bool
    link_status: str | None
    last_sync_at: datetime | None
    last_login_at: datetime | None
    masked_username: str | None
    railway_user_id: str | None

    def to_dict(self) -> dict[str, Any]:
        return {
            "linked": self.linked,
            "link_status": self.link_status,
            "last_sync_at": self.last_sync_at.isoformat() if self.last_sync_at else None,
            "last_login_at": self.last_login_at.isoformat() if self.last_login_at else None,
            "masked_username": self.masked_username,
            "railway_user_id": self.railway_user_id,
        }


async def get_status(pool: asyncpg.Pool, user_id: int) -> AccountStatus:
    row = await user_auth.get_account(pool, user_id)
    if row is None:
        return AccountStatus(
            linked=False, link_status=None,
            last_sync_at=None, last_login_at=None,
            masked_username=None, railway_user_id=None,
        )
    return AccountStatus(
        linked=row.link_status == "active",
        link_status=row.link_status,
        last_sync_at=row.last_sync_at,
        last_login_at=row.last_login_at,
        masked_username=_mask_username(row.username),
        railway_user_id=row.railway_user_id,
    )


async def link(
    pool: asyncpg.Pool, user_id: int, username: str, password: str,
) -> AccountStatus:
    """Log into eticket, persist tokens, fetch profile, and seed friends cache."""
    username = validate_railway_username(username)
    if not password or len(password) < 4:
        raise InvalidPayload("password is required")

    # login_for_user already decodes the JWT and persists railway_user_id.
    await user_auth.login_for_user(pool, user_id, username, password)

    # Best-effort first sync; failure here doesn't roll back the link.
    try:
        from app.services import friend_sync_service
        await friend_sync_service.sync_friends(pool, user_id, force=True)
    except Exception as exc:
        logger.warning("railway_account_first_sync_failed",
                       user_id=user_id, error=str(exc)[:200])

    return await get_status(pool, user_id)


async def unlink(pool: asyncpg.Pool, user_id: int) -> AccountStatus:
    await user_auth.revoke_user(pool, user_id)
    return await get_status(pool, user_id)
