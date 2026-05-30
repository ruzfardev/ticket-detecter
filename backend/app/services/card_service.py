"""Per-user payment card storage (encrypted PAN + expiry)."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime
from typing import Any

import asyncpg

from app.core.errors import InvalidPayload, NotFound
from app.core.logging import logger
from app.railway._auth_common import decrypt, encrypt


@dataclass(slots=True)
class CardDTO:
    id: int
    last4: str
    holder_name: str | None
    created_at: datetime
    last_used_at: datetime | None

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d["created_at"] = self.created_at.isoformat()
        d["last_used_at"] = self.last_used_at.isoformat() if self.last_used_at else None
        return d


@dataclass(slots=True)
class DecryptedCard:
    pan: str
    exp_mmyy: str       # 'MMYY'
    last4: str


def _normalize_pan(raw: str) -> str:
    pan = "".join(ch for ch in (raw or "") if ch.isdigit())
    if not (12 <= len(pan) <= 19):
        raise InvalidPayload("Card number must be 12–19 digits")
    return pan


def _normalize_exp(raw: str) -> str:
    digits = "".join(ch for ch in (raw or "") if ch.isdigit())[:4]
    if len(digits) != 4:
        raise InvalidPayload("Expiry must be MMYY (4 digits)")
    mm, yy = int(digits[:2]), int(digits[2:])
    if not (1 <= mm <= 12):
        raise InvalidPayload("Invalid expiry month")
    if yy < 24:
        raise InvalidPayload("Card already expired")
    return digits


async def get_card(pool: asyncpg.Pool, user_id: int) -> CardDTO | None:
    row = await pool.fetchrow(
        """
        SELECT id, last4, holder_name, created_at, last_used_at
        FROM user_railway_cards
        WHERE user_id = $1
        """,
        user_id,
    )
    if not row:
        return None
    return CardDTO(
        id=row["id"],
        last4=row["last4"],
        holder_name=row["holder_name"],
        created_at=row["created_at"],
        last_used_at=row["last_used_at"],
    )


async def save_card(
    pool: asyncpg.Pool,
    user_id: int,
    pan: str,
    exp_mmyy: str,
    holder_name: str | None = None,
) -> CardDTO:
    """Encrypt and upsert. Replaces any prior card for the same user."""
    pan = _normalize_pan(pan)
    exp = _normalize_exp(exp_mmyy)
    pan_enc = encrypt(pan)
    exp_enc = encrypt(exp)
    last4 = pan[-4:]
    holder_name = (holder_name or "").strip() or None
    await pool.execute(
        """
        INSERT INTO user_railway_cards
          (user_id, card_pan_enc, card_exp_enc, last4, holder_name)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (user_id) DO UPDATE SET
          card_pan_enc = EXCLUDED.card_pan_enc,
          card_exp_enc = EXCLUDED.card_exp_enc,
          last4        = EXCLUDED.last4,
          holder_name  = EXCLUDED.holder_name,
          last_used_at = NULL
        """,
        user_id, pan_enc, exp_enc, last4, holder_name,
    )
    logger.info("card_saved", user_id=user_id, last4=last4)
    card = await get_card(pool, user_id)
    assert card is not None
    return card


async def delete_card(pool: asyncpg.Pool, user_id: int) -> None:
    await pool.execute(
        "DELETE FROM user_railway_cards WHERE user_id = $1",
        user_id,
    )
    logger.info("card_deleted", user_id=user_id)


async def get_decrypted(pool: asyncpg.Pool, user_id: int) -> DecryptedCard:
    """In-memory decryption for one auto-buy attempt. Never log the result."""
    row = await pool.fetchrow(
        """
        SELECT card_pan_enc, card_exp_enc, last4
        FROM user_railway_cards
        WHERE user_id = $1
        """,
        user_id,
    )
    if not row:
        raise NotFound("No card saved")
    return DecryptedCard(
        pan=decrypt(row["card_pan_enc"]),
        exp_mmyy=decrypt(row["card_exp_enc"]),
        last4=row["last4"],
    )


async def mark_used(pool: asyncpg.Pool, user_id: int) -> None:
    await pool.execute(
        "UPDATE user_railway_cards SET last_used_at = now() WHERE user_id = $1",
        user_id,
    )
