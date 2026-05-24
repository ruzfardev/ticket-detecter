"""User service: upsert from Telegram, slot stats, tier helpers."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone

import asyncpg

from app.auth.init_data import TgUser
from app.core.config import settings
from app.core.logging import logger

# Admins (ADMIN_IDS) get permanent premium and effectively unlimited slots.
_ADMIN_PREMIUM_UNTIL = datetime(2099, 12, 31, tzinfo=timezone.utc)
_ADMIN_SLOT_MAX = 999


@dataclass(slots=True)
class UserRow:
    id: int
    tg_user_id: int
    lang: str
    tier: str
    premium_until: datetime | None
    created_at: datetime


@dataclass(slots=True)
class SlotStats:
    max: int
    used: int

    @property
    def available(self) -> int:
        return max(0, self.max - self.used)


def slot_max_for_tier(tier: str) -> int:
    return 3 if tier == "premium" else 1


async def upsert_from_tg(pool: asyncpg.Pool, tg_user: TgUser) -> tuple[UserRow, bool]:
    """
    Insert user if absent (lang from TG language_code if uz/ru/en, else 'uz').

    Returns (row, is_new).
    """
    lang = tg_user.language_code if tg_user.language_code in ("uz", "ru", "en") else "uz"
    row = await pool.fetchrow(
        """
        INSERT INTO users (tg_user_id, lang)
        VALUES ($1, $2)
        ON CONFLICT (tg_user_id) DO UPDATE
        SET tg_user_id = EXCLUDED.tg_user_id  -- no-op; just so RETURNING fires
        RETURNING id, tg_user_id, lang, tier, premium_until, created_at,
                  (xmax = 0) AS is_new
        """,
        tg_user.id, lang,
    )
    is_new = bool(row["is_new"])
    user = _row_to_user(row)
    if tg_user.id in settings.admin_id_set:
        user = await _ensure_admin_premium(pool, user)
    if is_new:
        logger.info("user_created", tg_user_id=tg_user.id, lang=lang)
    return user, is_new


async def _ensure_admin_premium(pool: asyncpg.Pool, user: UserRow) -> UserRow:
    """Admins always hold permanent premium. Idempotent — one UPDATE at most."""
    if (user.tier == "premium" and user.premium_until
            and user.premium_until >= _ADMIN_PREMIUM_UNTIL):
        return user
    await pool.execute(
        "UPDATE users SET tier = 'premium', premium_until = $1 WHERE id = $2",
        _ADMIN_PREMIUM_UNTIL, user.id,
    )
    logger.info("admin_premium_granted", user_id=user.id, tg_user_id=user.tg_user_id)
    user.tier = "premium"
    user.premium_until = _ADMIN_PREMIUM_UNTIL
    return user


async def get_by_tg_id(pool: asyncpg.Pool, tg_user_id: int) -> UserRow | None:
    row = await pool.fetchrow(
        "SELECT id, tg_user_id, lang, tier, premium_until, created_at FROM users WHERE tg_user_id = $1",
        tg_user_id,
    )
    return _row_to_user(row) if row else None


async def get_by_id(pool: asyncpg.Pool, user_id: int) -> UserRow | None:
    row = await pool.fetchrow(
        "SELECT id, tg_user_id, lang, tier, premium_until, created_at FROM users WHERE id = $1",
        user_id,
    )
    return _row_to_user(row) if row else None


async def get_slot_stats(pool: asyncpg.Pool, user_id: int) -> SlotStats:
    row = await pool.fetchrow(
        """
        SELECT u.tier, u.tg_user_id,
               COUNT(s.id) FILTER (WHERE s.is_active) AS slot_used
        FROM users u
        LEFT JOIN subscriptions s ON s.user_id = u.id
        WHERE u.id = $1
        GROUP BY u.tier, u.tg_user_id
        """,
        user_id,
    )
    if row is None:
        return SlotStats(max=1, used=0)
    used = int(row["slot_used"] or 0)
    if row["tg_user_id"] in settings.admin_id_set:
        return SlotStats(max=_ADMIN_SLOT_MAX, used=used)
    return SlotStats(max=slot_max_for_tier(row["tier"]), used=used)


async def update_lang(pool: asyncpg.Pool, user_id: int, lang: str) -> None:
    if lang not in ("uz", "ru", "en"):
        raise ValueError(f"Invalid lang: {lang}")
    await pool.execute("UPDATE users SET lang = $1 WHERE id = $2", lang, user_id)


def _row_to_user(row: asyncpg.Record) -> UserRow:
    return UserRow(
        id=row["id"],
        tg_user_id=row["tg_user_id"],
        lang=row["lang"],
        tier=row["tier"],
        premium_until=row["premium_until"],
        created_at=row["created_at"],
    )
