"""Sync cached hamrohlar (companions) from eticket.railway.uz."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import date as date_t
from datetime import datetime, timezone
from typing import Any

import asyncpg

from app.core.config import settings
from app.core.errors import AppError
from app.core.logging import logger
from app.railway import user_auth
from app.railway._auth_common import decrypt, encrypt
from app.railway.user_client import FriendRecord, RailwayUserClient


class FriendSyncThrottled(AppError):
    code = "friend_sync_throttled"
    status_code = 429


@dataclass(slots=True)
class FriendDTO:
    id: int
    railway_friend_id: str
    firstname: str
    lastname: str
    midname: str | None
    sex: str | None
    birth_day: str          # ISO yyyy-mm-dd
    doc_type: str | None
    doc_masked: str | None  # last 4 chars only, never plaintext
    citizenship: str | None
    region_id: str | None
    is_self: bool

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def _parse_birth_day(s: str) -> date_t:
    """eticket sends 'DD.MM.YYYY'; tolerate variants."""
    s = (s or "").strip()
    for fmt in ("%d.%m.%Y", "%Y-%m-%d", "%d/%m/%Y"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    raise ValueError(f"unparseable birth_day: {s!r}")


def _mask_doc(plain: str | None) -> str | None:
    if not plain:
        return None
    return ("•" * max(0, len(plain) - 4)) + plain[-4:]


async def list_for_user(pool: asyncpg.Pool, user_id: int) -> list[FriendDTO]:
    rows = await pool.fetch(
        """
        SELECT id, railway_friend_id, firstname, lastname, midname,
               sex, birth_day, doc_type, doc_enc, citizenship, region_id, is_self
        FROM railway_friends_cache
        WHERE user_id = $1
        ORDER BY is_self DESC, lastname, firstname
        """,
        user_id,
    )
    out: list[FriendDTO] = []
    for r in rows:
        doc_plain = None
        if r["doc_enc"]:
            try:
                doc_plain = decrypt(r["doc_enc"])
            except Exception:
                doc_plain = None
        out.append(FriendDTO(
            id=r["id"],
            railway_friend_id=r["railway_friend_id"],
            firstname=r["firstname"],
            lastname=r["lastname"],
            midname=r["midname"],
            sex=r["sex"],
            birth_day=r["birth_day"].isoformat() if r["birth_day"] else "",
            doc_type=r["doc_type"],
            doc_masked=_mask_doc(doc_plain),
            citizenship=r["citizenship"],
            region_id=r["region_id"],
            is_self=r["is_self"],
        ))
    return out


async def sync_friends(
    pool: asyncpg.Pool, user_id: int, force: bool = False,
) -> list[FriendDTO]:
    """Re-pull friend list from eticket and reconcile the cache.

    Throttled to `FRIEND_SYNC_MIN_INTERVAL_S` (default 30s) unless force=True.
    """
    account = await user_auth.get_account(pool, user_id)
    if account is None or account.link_status != "active":
        raise user_auth.RailwayAccountRequired("Link your eticket.railway.uz account first")

    if not force and account.last_sync_at is not None:
        elapsed = (datetime.now(timezone.utc) - account.last_sync_at).total_seconds()
        if elapsed < settings.friend_sync_min_interval_s:
            raise FriendSyncThrottled(
                "Try again shortly",
                {"retry_after_s": int(settings.friend_sync_min_interval_s - elapsed)},
            )

    railway_user_id = account.railway_user_id
    client = RailwayUserClient(pool, user_id)
    if not railway_user_id:
        profile = await client.get_user_profile()
        railway_user_id = profile.identifier
        if not railway_user_id:
            raise user_auth.RailwayLoginFailed("Could not resolve eticket userId")
        await user_auth.store_railway_user_id(pool, user_id, railway_user_id)

    friends: list[FriendRecord] = await client.list_friends(railway_user_id)

    seen_ids: list[str] = []
    async with pool.acquire() as conn, conn.transaction():
        for f in friends:
            try:
                bday = _parse_birth_day(f.birth_day)
            except ValueError:
                logger.warning("friend_sync_skip_bad_birthday",
                               user_id=user_id, friend_id=f.friend_id, raw=f.birth_day)
                continue
            doc_enc = encrypt(f.doc) if f.doc else None
            await conn.execute(
                """
                INSERT INTO railway_friends_cache
                  (user_id, railway_friend_id, firstname, lastname, midname,
                   sex, birth_day, doc_type, doc_enc, citizenship, region_id,
                   is_self, synced_at)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, now())
                ON CONFLICT (user_id, railway_friend_id) DO UPDATE SET
                  firstname   = EXCLUDED.firstname,
                  lastname    = EXCLUDED.lastname,
                  midname     = EXCLUDED.midname,
                  sex         = EXCLUDED.sex,
                  birth_day   = EXCLUDED.birth_day,
                  doc_type    = EXCLUDED.doc_type,
                  doc_enc     = EXCLUDED.doc_enc,
                  citizenship = EXCLUDED.citizenship,
                  region_id   = EXCLUDED.region_id,
                  is_self     = EXCLUDED.is_self,
                  synced_at   = now()
                """,
                user_id, f.friend_id, f.firstname, f.lastname, f.midname,
                f.sex, bday, f.doc_type, doc_enc, f.citizenship, f.region_id,
                f.your_self,
            )
            seen_ids.append(f.friend_id)

        # Reconcile: drop cached friends that disappeared from eticket.
        if seen_ids:
            await conn.execute(
                """
                DELETE FROM railway_friends_cache
                WHERE user_id = $1 AND NOT (railway_friend_id = ANY($2::text[]))
                """,
                user_id, seen_ids,
            )
        else:
            await conn.execute(
                "DELETE FROM railway_friends_cache WHERE user_id = $1",
                user_id,
            )

    await user_auth.mark_sync(pool, user_id)
    logger.info("friend_sync_ok", user_id=user_id, count=len(seen_ids))
    return await list_for_user(pool, user_id)


async def get_friend_for_user(
    pool: asyncpg.Pool, user_id: int, friend_id: int,
) -> asyncpg.Record | None:
    return await pool.fetchrow(
        """
        SELECT id, user_id, railway_friend_id, firstname, lastname
        FROM railway_friends_cache
        WHERE id = $1 AND user_id = $2
        """,
        friend_id, user_id,
    )
