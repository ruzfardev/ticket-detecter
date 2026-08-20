"""Subscription CRUD with slot enforcement."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import date, datetime

import asyncpg

from app.core.errors import Forbidden, InvalidPayload, NotFound, SlotLimitReached
from app.core.logging import logger
from app.railway import user_auth
from app.railway.models import BERTH_TYPES, VALID_CAR_TYPES
from app.services import user_service

ALLOWED_PAYMENT_METHODS = {"payme", "click", "hamkorbank", "kapitalbank"}


@dataclass(slots=True)
class SubscriptionRow:
    id: int
    user_id: int
    dep_code: str
    arr_code: str
    dep_name: str
    arr_name: str
    travel_date: date
    train_numbers: list[str]
    car_types: list[str]
    berth: str
    is_active: bool
    muted_until: datetime | None
    created_at: datetime
    last_notified_at: datetime | None
    notif_count: int
    autobuy_enabled: bool = False
    autobuy_friend_id: int | None = None
    autobuy_friend_name: str | None = None
    autobuy_friend_ids: list[int] | None = None
    autobuy_friend_names: list[str] | None = None
    autobuy_payment_method: str | None = None

    def to_dict(self) -> dict:
        d = asdict(self)
        d["travel_date"] = self.travel_date.isoformat()
        d["created_at"]  = self.created_at.isoformat()
        d["muted_until"] = self.muted_until.isoformat() if self.muted_until else None
        d["last_notified_at"] = self.last_notified_at.isoformat() if self.last_notified_at else None
        return d


_SELECT = """
SELECT s.id, s.user_id, s.dep_code, s.arr_code, s.travel_date,
       s.train_numbers, s.car_types, s.berth, s.is_active,
       s.muted_until, s.created_at,
       s.autobuy_enabled, s.autobuy_friend_id, s.autobuy_friend_ids, s.autobuy_payment_method,
       sd.name_uz AS dep_name, sa.name_uz AS arr_name,
       fc.firstname AS autobuy_friend_firstname,
       fc.lastname  AS autobuy_friend_lastname,
       (SELECT array_agg(TRIM(BOTH ' ' FROM (fc2.firstname || ' ' || fc2.lastname)))
          FROM railway_friends_cache fc2 WHERE fc2.id = ANY(s.autobuy_friend_ids)) AS autobuy_friend_names,
       (SELECT MAX(sent_at) FROM notification_log WHERE subscription_id = s.id) AS last_notified_at,
       (SELECT COUNT(*) FROM notification_log WHERE subscription_id = s.id) AS notif_count
FROM subscriptions s
JOIN stations sd ON sd.code = s.dep_code
JOIN stations sa ON sa.code = s.arr_code
LEFT JOIN railway_friends_cache fc ON fc.id = s.autobuy_friend_id
"""


def _row_to_sub(row: asyncpg.Record) -> SubscriptionRow:
    friend_name = None
    if row.get("autobuy_friend_firstname") or row.get("autobuy_friend_lastname"):
        friend_name = " ".join(
            x for x in (row.get("autobuy_friend_firstname"), row.get("autobuy_friend_lastname")) if x
        ).strip() or None
    return SubscriptionRow(
        id=row["id"],
        user_id=row["user_id"],
        dep_code=row["dep_code"],
        arr_code=row["arr_code"],
        dep_name=row["dep_name"],
        arr_name=row["arr_name"],
        travel_date=row["travel_date"],
        train_numbers=list(row["train_numbers"] or []),
        car_types=list(row["car_types"] or []),
        berth=row["berth"],
        is_active=row["is_active"],
        muted_until=row["muted_until"],
        created_at=row["created_at"],
        last_notified_at=row["last_notified_at"],
        notif_count=int(row["notif_count"] or 0),
        autobuy_enabled=bool(row.get("autobuy_enabled")),
        autobuy_friend_id=row.get("autobuy_friend_id"),
        autobuy_friend_name=friend_name,
        autobuy_friend_ids=[int(x) for x in (row.get("autobuy_friend_ids") or [])] or None,
        autobuy_friend_names=list(row.get("autobuy_friend_names") or []) or None,
        autobuy_payment_method=row.get("autobuy_payment_method"),
    )


async def list_for_user(pool: asyncpg.Pool, user_id: int,
                        include_inactive: bool = False) -> list[SubscriptionRow]:
    where = "WHERE s.user_id = $1"
    if not include_inactive:
        where += " AND s.is_active"
    rows = await pool.fetch(
        f"{_SELECT} {where} ORDER BY s.travel_date, s.created_at",
        user_id,
    )
    return [_row_to_sub(r) for r in rows]


async def get_by_id(pool: asyncpg.Pool, sub_id: int, user_id: int) -> SubscriptionRow:
    row = await pool.fetchrow(f"{_SELECT} WHERE s.id = $1", sub_id)
    if not row:
        raise NotFound(f"subscription {sub_id} not found")
    if row["user_id"] != user_id:
        raise Forbidden("not your subscription")
    return _row_to_sub(row)


async def create(
    pool: asyncpg.Pool,
    user_id: int,
    dep_code: str,
    arr_code: str,
    travel_date: date,
    train_numbers: list[str],
    car_types: list[str],
    berth: str,
) -> SubscriptionRow:
    # Slot enforcement (app layer)
    slot = await user_service.get_slot_stats(pool, user_id)
    if slot.used >= slot.max:
        raise SlotLimitReached(
            f"Maximum {slot.max} active subscriptions reached",
            {"slot_used": slot.used, "slot_max": slot.max},
        )

    async with pool.acquire() as conn:
        sub_id = await conn.fetchval(
            """
            INSERT INTO subscriptions
              (user_id, dep_code, arr_code, travel_date,
               train_numbers, car_types, berth, is_active)
            VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
            RETURNING id
            """,
            user_id, dep_code, arr_code, travel_date,
            train_numbers, car_types, berth,
        )
        # Trigger watch_groups recompute (cheap upsert)
        await _refresh_watch_group(conn, dep_code, arr_code, travel_date)

    logger.info("subscription_created",
                sub_id=sub_id, user_id=user_id,
                route=f"{dep_code}-{arr_code}", date=travel_date.isoformat())
    return await get_by_id(pool, sub_id, user_id)


async def update_active(
    pool: asyncpg.Pool, sub_id: int, user_id: int, is_active: bool,
) -> SubscriptionRow:
    sub = await get_by_id(pool, sub_id, user_id)
    if is_active and not sub.is_active:
        # Re-activating; enforce slot
        slot = await user_service.get_slot_stats(pool, user_id)
        if slot.used >= slot.max:
            raise SlotLimitReached("Cannot reactivate — slot limit reached")
    async with pool.acquire() as conn:
        await conn.execute(
            "UPDATE subscriptions SET is_active = $1, updated_at = now() WHERE id = $2",
            is_active, sub_id,
        )
        await _refresh_watch_group(conn, sub.dep_code, sub.arr_code, sub.travel_date)
    return await get_by_id(pool, sub_id, user_id)


async def update_autobuy(
    pool: asyncpg.Pool,
    sub_id: int,
    user_id: int,
    enabled: bool,
    friend_ids: list[int] | None,
    payment_method: str | None,
) -> SubscriptionRow:
    """Toggle/configure auto-buy on a subscription (1-4 passengers).

    Enforces:
      - subscription ownership
      - every passenger belongs to this user
      - 1..4 passengers when enabling
      - active linked railway account when enabling
      - payment_method ∈ ALLOWED_PAYMENT_METHODS or None
    """
    await get_by_id(pool, sub_id, user_id)  # ownership check

    if payment_method is not None and payment_method not in ALLOWED_PAYMENT_METHODS:
        raise InvalidPayload(
            f"Invalid payment_method: {payment_method}",
            {"allowed": sorted(ALLOWED_PAYMENT_METHODS)},
        )

    ids: list[int] = []
    if enabled:
        ids = list(dict.fromkeys(int(f) for f in (friend_ids or [])))  # dedupe, keep order
        if not ids:
            raise InvalidPayload(
                "At least one passenger is required when enabling auto-buy",
                {"code": "no_passengers"},
            )
        if len(ids) > 4:
            raise InvalidPayload("At most 4 passengers per auto-buy",
                                 {"code": "too_many_passengers"})
        account = await user_auth.get_account(pool, user_id)
        if account is None or account.link_status != "active":
            raise user_auth.RailwayAccountRequired(
                "Link your eticket.railway.uz account before enabling auto-buy"
            )
        owned = await pool.fetch(
            "SELECT id FROM railway_friends_cache WHERE id = ANY($1::bigint[]) AND user_id = $2",
            ids, user_id,
        )
        owned_ids = {r["id"] for r in owned}
        missing = [i for i in ids if i not in owned_ids]
        if missing:
            raise InvalidPayload("passenger not found for this user",
                                 {"code": "friend_not_owned", "ids": missing})

    await pool.execute(
        """
        UPDATE subscriptions
        SET autobuy_enabled = $1,
            autobuy_friend_ids = $2::bigint[],
            autobuy_friend_id = $3,
            autobuy_payment_method = $4,
            updated_at = now()
        WHERE id = $5
        """,
        bool(enabled),
        ids if enabled else [],
        (ids[0] if ids else None),
        payment_method if enabled else None,
        sub_id,
    )
    logger.info(
        "autobuy_config_changed",
        sub_id=sub_id, user_id=user_id,
        enabled=bool(enabled),
        friend_ids=ids if enabled else [],
        payment_method=payment_method if enabled else None,
    )
    return await get_by_id(pool, sub_id, user_id)


async def delete(pool: asyncpg.Pool, sub_id: int, user_id: int) -> None:
    sub = await get_by_id(pool, sub_id, user_id)
    async with pool.acquire() as conn:
        await conn.execute("DELETE FROM subscriptions WHERE id = $1", sub_id)
        await _refresh_watch_group(conn, sub.dep_code, sub.arr_code, sub.travel_date)
    logger.info("subscription_deleted", sub_id=sub_id, user_id=user_id)


async def _refresh_watch_group(
    conn: asyncpg.Connection, dep_code: str, arr_code: str, travel_date: date,
) -> None:
    """Recompute one watch_group row (cheap targeted refresh).

    Two separate execute() calls: asyncpg uses prepared statements for any
    parameterized query and rejects multiple semicolon-separated commands in
    one string ("cannot insert multiple commands into a prepared statement").
    """
    await conn.execute(
        """
        INSERT INTO watch_groups (dep_code, arr_code, travel_date, has_premium, subscriber_count)
        SELECT $1, $2, $3,
               COALESCE(bool_or(u.tier = 'premium'), FALSE),
               COUNT(*)
        FROM subscriptions s
        JOIN users u ON u.id = s.user_id
        WHERE s.is_active
          AND s.dep_code = $1 AND s.arr_code = $2 AND s.travel_date = $3
        ON CONFLICT (dep_code, arr_code, travel_date) DO UPDATE
        SET has_premium = EXCLUDED.has_premium,
            subscriber_count = EXCLUDED.subscriber_count,
            updated_at = now()
        """,
        dep_code, arr_code, travel_date,
    )
    await conn.execute(
        """
        DELETE FROM watch_groups
        WHERE dep_code = $1 AND arr_code = $2 AND travel_date = $3
          AND subscriber_count = 0
        """,
        dep_code, arr_code, travel_date,
    )


def validate_payload(
    dep_code: str, arr_code: str, car_types: list[str], berth: str,
) -> None:
    if dep_code == arr_code:
        from app.core.errors import InvalidPayload
        raise InvalidPayload("dep_code and arr_code must differ")
    # Single source of truth — a duplicated literal here is how a car type can
    # be selectable in the UI yet rejected on save.
    bad = [t for t in car_types if t not in set(VALID_CAR_TYPES)]
    if bad:
        from app.core.errors import InvalidPayload
        raise InvalidPayload(f"Invalid car_types: {bad}")
    if berth not in ("lower", "upper", "any"):
        from app.core.errors import InvalidPayload
        raise InvalidPayload(f"Invalid berth: {berth}")
    if berth != "any" and car_types:
        # berth meaningful only for плацкарта/купе
        if not any(t in BERTH_TYPES for t in car_types):
            from app.core.errors import InvalidPayload
            raise InvalidPayload("berth applies only to плацкарта/купе")
