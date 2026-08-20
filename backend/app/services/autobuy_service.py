"""Auto-buy orchestrator: order creation → card submit → OTP → done.

State machine:
    reserving       (initial; row inserted, attempting universal-orders/create)
    awaiting_otp    (card submitted, SMS dispatched)
    paying          (OTP submitted, eticket processing)
    paid            (terminal — success)
    failed          (terminal — explicit error)
    expired         (terminal — hold_until passed)
    cancelled       (terminal — user/system cancelled)

`try_start_autobuy` is called both:
  - Automatically from the watcher when a matching seat is found
  - Manually via POST /api/v1/orders/manual (Phase B "Buy now" tugmasi)

`submit_otp` is called from the mini-app once the user enters the SMS code.
`expire_loop` is the background heartbeat that cancels stale orders.
"""

from __future__ import annotations

import asyncio
import json
from dataclasses import asdict, dataclass
from datetime import date as date_t
from datetime import datetime, timedelta, timezone
from typing import Any

import asyncpg

from app.core.errors import AppError, Forbidden, InvalidPayload, NotFound
from app.core.logging import logger
from app.railway import user_auth
from app.railway._auth_common import decrypt
from app.railway.user_client import (
    CreateOrderArgs,
    OrderConflict,
    PassengerArg,
    PAYMENT_TYPE_HAMKORBANK_HOLD,
    PAYMENT_TYPE_PAYME,
    PaymentFailed,
    RailwayUserClient,
)
from app.services import card_service


# --- exceptions ---

class AutobuyConflict(AppError):
    code = "autobuy_conflict"
    status_code = 409


class CardRequired(AppError):
    code = "card_required"
    status_code = 412


# --- domain ---

@dataclass(slots=True)
class AutobuyOrderDTO:
    id: int
    subscription_id: int
    user_id: int
    railway_friend_cache_id: int | None
    railway_order_id: str | None
    payment_type: str | None
    payment_subid: str | None
    train_number: str
    car_number: str
    seat_number: int
    dep_code: str
    arr_code: str
    travel_date: date_t
    amount_uzs: int | None
    status: str
    failure_reason: str | None
    hold_until: datetime | None
    trigger_source: str
    created_at: datetime
    updated_at: datetime
    friend_name: str | None = None
    last4: str | None = None
    seconds_until_expiry: int | None = None
    seat_numbers: list[int] | None = None
    passenger_names: list[str] | None = None

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d["travel_date"] = self.travel_date.isoformat()
        d["created_at"] = self.created_at.isoformat()
        d["updated_at"] = self.updated_at.isoformat()
        d["hold_until"] = self.hold_until.isoformat() if self.hold_until else None
        return d


_SELECT_ORDER = """
SELECT
  ao.id, ao.subscription_id, ao.user_id, ao.railway_friend_cache_id,
  ao.railway_order_id, ao.payment_type, ao.payment_subid, ao.train_number, ao.car_number,
  ao.seat_number, ao.seat_numbers, ao.dep_code, ao.arr_code, ao.travel_date, ao.amount_uzs,
  ao.status, ao.failure_reason, ao.hold_until, ao.trigger_source,
  ao.created_at, ao.updated_at,
  TRIM(BOTH ' ' FROM (fc.firstname || ' ' || fc.lastname)) AS friend_name,
  (SELECT array_agg(TRIM(BOTH ' ' FROM (fc2.firstname || ' ' || fc2.lastname)))
     FROM railway_friends_cache fc2 WHERE fc2.id = ANY(ao.passenger_cache_ids)) AS passenger_names,
  c.last4 AS card_last4
FROM autobuy_orders ao
LEFT JOIN railway_friends_cache fc ON fc.id = ao.railway_friend_cache_id
LEFT JOIN user_railway_cards c ON c.user_id = ao.user_id
"""


def _row_to_order(row: asyncpg.Record) -> AutobuyOrderDTO:
    secs = None
    if row["hold_until"]:
        delta = (row["hold_until"] - datetime.now(timezone.utc)).total_seconds()
        secs = max(0, int(delta))
    return AutobuyOrderDTO(
        id=row["id"],
        subscription_id=row["subscription_id"],
        user_id=row["user_id"],
        railway_friend_cache_id=row["railway_friend_cache_id"],
        railway_order_id=row["railway_order_id"],
        payment_type=row["payment_type"],
        payment_subid=row["payment_subid"],
        train_number=row["train_number"],
        car_number=row["car_number"],
        seat_number=row["seat_number"],
        dep_code=row["dep_code"],
        arr_code=row["arr_code"],
        travel_date=row["travel_date"],
        amount_uzs=row["amount_uzs"],
        status=row["status"],
        failure_reason=row["failure_reason"],
        hold_until=row["hold_until"],
        trigger_source=row["trigger_source"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
        friend_name=row.get("friend_name") or None,
        last4=row.get("card_last4"),
        seconds_until_expiry=secs,
        seat_numbers=list(row["seat_numbers"]) if row.get("seat_numbers") else None,
        passenger_names=list(row["passenger_names"]) if row.get("passenger_names") else None,
    )


# --- public API ---

async def list_for_user(pool: asyncpg.Pool, user_id: int) -> list[AutobuyOrderDTO]:
    rows = await pool.fetch(
        f"{_SELECT_ORDER} WHERE ao.user_id = $1 ORDER BY ao.created_at DESC LIMIT 50",
        user_id,
    )
    return [_row_to_order(r) for r in rows]


async def get_by_id(pool: asyncpg.Pool, order_id: int, user_id: int) -> AutobuyOrderDTO:
    row = await pool.fetchrow(f"{_SELECT_ORDER} WHERE ao.id = $1", order_id)
    if not row:
        raise NotFound(f"order {order_id} not found")
    if row["user_id"] != user_id:
        raise Forbidden("not your order")
    return _row_to_order(row)


@dataclass(slots=True)
class StartArgs:
    user_id: int
    subscription_id: int
    train_number: str
    car_number: str
    seat_numbers: list[int]   # one per passenger, all in this car
    car_type: str        # e.g. 'Сидячий'
    class_service: str   # e.g. '2Е'
    dep_code: str
    arr_code: str
    dep_date: date_t
    dep_time: str        # 'HH:MM'
    trigger_source: str = "auto"   # 'auto' | 'manual'
    notification_id: int | None = None


async def try_start_autobuy(
    pool: asyncpg.Pool, args: StartArgs,
) -> AutobuyOrderDTO | None:
    """Atomically claim a seat and kick off the booking + card-submit flow.

    Returns the order DTO on success, None if another worker won the race
    (same subscription + seat already in-flight).

    Raises:
        CardRequired       — user hasn't saved a card
        AutobuyConflict    — eticket refused the seat
        RailwayAccountRequired — eticket account not linked / revoked
    """
    sub = await pool.fetchrow(
        """
        SELECT s.id, s.user_id, s.dep_code, s.arr_code, s.travel_date,
               s.autobuy_enabled, s.autobuy_friend_id, s.autobuy_friend_ids,
               s.autobuy_payment_method
        FROM subscriptions s
        WHERE s.id = $1
        """,
        args.subscription_id,
    )
    if not sub or sub["user_id"] != args.user_id:
        raise NotFound("subscription not found")
    if args.trigger_source == "auto" and not sub["autobuy_enabled"]:
        return None
    friend_ids = [int(f) for f in (sub["autobuy_friend_ids"] or []) if f]
    if not friend_ids and sub["autobuy_friend_id"]:
        friend_ids = [int(sub["autobuy_friend_id"])]   # back-compat (pre-multi)
    if not friend_ids:
        raise InvalidPayload("subscription has no passengers selected")
    # Pair each passenger with one seat, 1:1 (all-or-nothing on availability).
    seat_numbers = [int(s) for s in (args.seat_numbers or [])]
    if len(seat_numbers) < len(friend_ids):
        # Not enough seats for every passenger yet — watcher retries next tick.
        return None
    seat_numbers = seat_numbers[:len(friend_ids)]

    card = await card_service.get_card(pool, args.user_id)
    if card is None:
        raise CardRequired("Save a card first (/cards/add)")

    account = await user_auth.get_account(pool, args.user_id)
    if account is None or account.link_status != "active":
        raise user_auth.RailwayAccountRequired("eticket account not linked")

    # Atomic seat claim: the partial unique index rejects a duplicate
    # in-flight row for the same (subscription, train, car, seat).
    try:
        row = await pool.fetchrow(
            """
            INSERT INTO autobuy_orders
              (subscription_id, user_id, railway_friend_cache_id, passenger_cache_ids,
               train_number, car_number, seat_number, seat_numbers,
               dep_code, arr_code, travel_date,
               status, trigger_source, notification_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
                    'reserving', $12, $13)
            RETURNING id
            """,
            args.subscription_id, args.user_id, friend_ids[0], friend_ids,
            args.train_number, args.car_number, seat_numbers[0], seat_numbers,
            args.dep_code, args.arr_code, args.dep_date,
            args.trigger_source, args.notification_id,
        )
    except asyncpg.UniqueViolationError:
        logger.info("autobuy_seat_race",
                    sub_id=args.subscription_id, seat=seat_numbers[0])
        return None

    autobuy_id = row["id"]
    logger.info("autobuy_started", id=autobuy_id, user_id=args.user_id,
                source=args.trigger_source, sub_id=args.subscription_id,
                train=args.train_number, seats=seat_numbers)

    try:
        await _execute_pipeline(pool, autobuy_id, args, sub, friend_ids, seat_numbers, card)
    except Exception as exc:
        await _mark_failed(pool, autobuy_id, str(exc)[:200])
        raise
    return await get_by_id(pool, autobuy_id, args.user_id)


async def _execute_pipeline(
    pool: asyncpg.Pool,
    autobuy_id: int,
    args: StartArgs,
    sub: asyncpg.Record,
    friend_ids: list[int],
    seat_numbers: list[int],
    card: card_service.CardDTO,
) -> None:
    """Drives create_order → list_payment_types → select → do_payment → submit_card.

    Books all `friend_ids` passengers on `seat_numbers` (paired 1:1) in one
    eticket order — a single payment + single OTP covers the whole group.
    """
    # Load every passenger (with decrypted doc, in-memory only), preserving order.
    rows = await pool.fetch(
        """
        SELECT id, firstname, lastname, midname, sex, birth_day,
               doc_type, doc_enc, citizenship, region_id
        FROM railway_friends_cache
        WHERE id = ANY($1::bigint[]) AND user_id = $2
        """,
        friend_ids, args.user_id,
    )
    by_id = {r["id"]: r for r in rows}
    passengers: list[PassengerArg] = []
    for fid in friend_ids:
        fr = by_id.get(fid)
        if not fr:
            raise InvalidPayload("passenger not found", {"code": "friend_not_owned"})
        if not fr["doc_enc"]:
            raise InvalidPayload(
                "passenger has no document; refresh /friends/sync",
                {"code": "friend_doc_missing"},
            )
        bd = fr["birth_day"]
        passengers.append(PassengerArg(
            firstname=fr["firstname"] or "",
            lastname=fr["lastname"] or "",
            midname=fr["midname"] or "",
            birth_day=f"{bd.day:02d}.{bd.month:02d}.{bd.year:04d}",
            gender="Male" if (fr["sex"] or "M").upper() == "M" else "Female",
            citizenship=fr["citizenship"] or "UZB",
            doc_type=fr["doc_type"] or "ПУ",
            doc_id=decrypt(fr["doc_enc"]),
            region_id=fr["region_id"] or "",
        ))

    account = await user_auth.get_account(pool, args.user_id)
    railway_user_id = account.railway_user_id if account else None
    if not railway_user_id:
        railway_user_id = await user_auth.resolve_railway_user_id(pool, args.user_id)
    if not railway_user_id:
        raise user_auth.RailwayLoginFailed("Cannot resolve eticket userId; please re-link")

    client = RailwayUserClient(pool, args.user_id)

    dep_dot = f"{args.dep_date.day:02d}.{args.dep_date.month:02d}.{args.dep_date.year:04d}"
    create_args = CreateOrderArgs(
        railway_user_id=railway_user_id,
        railway_username=account.username if account else "",
        passengers=passengers,
        dep_code=args.dep_code,
        arr_code=args.arr_code,
        dep_date_dot=dep_dot,
        dep_time=args.dep_time,
        train_number=args.train_number,
        car_number=args.car_number,
        car_type=args.car_type,
        class_service=args.class_service,
        seat_numbers=seat_numbers,
    )
    try:
        created = await client.create_order(create_args)
    except OrderConflict:
        raise AutobuyConflict("Seat taken before our reservation completed")

    await pool.execute(
        """
        UPDATE autobuy_orders SET
          railway_order_id = $1, updated_at = now(),
          raw_create_resp = $2::jsonb
        WHERE id = $3
        """,
        created.order_id,
        _jsonb({"order_id": created.order_id}),
        autobuy_id,
    )

    # Capture hold_until as soon as available.
    end_iso = await client.get_end_time(created.order_id)
    if end_iso:
        try:
            ts = datetime.fromisoformat(end_iso.replace("Z", "+00:00"))
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)
            await pool.execute(
                "UPDATE autobuy_orders SET hold_until = $1 WHERE id = $2",
                ts, autobuy_id,
            )
        except ValueError:
            pass

    # Optional preferred payment method from the subscription.
    preferred = sub["autobuy_payment_method"] or None

    # The paymentId is assigned BY eticket, not by us: it appears on
    # GET /universal-orders/get/{id} under response.orderPaymentData.paymentId
    # once the order settles. payment-type/list is keyed on that id, so an
    # invented one always comes back empty (confirmed against a browser capture
    # of a real purchase: create -> get -> payment-type/list{paymentId}).
    payment_id: str | None = None
    groups: list = []
    started = asyncio.get_event_loop().time()
    DEADLINE = 30.0
    attempt = 0
    while asyncio.get_event_loop().time() - started < DEADLINE:
        attempt += 1
        if payment_id is None:
            try:
                state = await client.get_order(created.order_id)
                payment_id = state.payment_id
                if payment_id:
                    logger.info("autobuy_payment_id_ready",
                                id=autobuy_id, attempt=attempt,
                                order_state=state.order_state)
            except Exception as exc:
                logger.warning("autobuy_get_order_poll_error",
                               id=autobuy_id, attempt=attempt,
                               error=str(exc)[:200])
        if payment_id:
            # Transient failures (429, 5xx, blips) must not kill the pipeline —
            # keep polling to the deadline.
            try:
                groups = await client.list_payment_types(payment_id)
            except Exception as exc:
                logger.warning("autobuy_payment_types_poll_error",
                               id=autobuy_id, attempt=attempt,
                               error=str(exc)[:200])
                groups = []
            if groups:
                logger.info("autobuy_payment_types_ready",
                            id=autobuy_id, attempt=attempt,
                            elapsed=round(asyncio.get_event_loop().time() - started, 1))
                break
        await asyncio.sleep(2.0)
    if payment_id is None:
        raise PaymentFailed(
            "Eticket did not assign a paymentId to the order in time",
            {"order_id": created.order_id},
        )
    if not groups:
        # One more try after the deadline (in case the last sleep skipped it).
        try:
            groups = await client.list_payment_types(payment_id)
        except Exception as exc:
            logger.warning("autobuy_payment_types_final_error",
                           id=autobuy_id, error=str(exc)[:200])
            groups = []

    available = {g.card_type: g.payment_types for g in groups}
    logger.info("autobuy_payment_types", id=autobuy_id, available=available,
                preferred=preferred)
    chosen = _pick_payment_type(groups, preferred)
    if chosen is None:
        available_str = ", ".join(
            f"{ct}:[{','.join(pts)}]" for ct, pts in available.items()
        ) or "(none)"
        raise PaymentFailed(
            f"No supported NATIONAL_CURRENCY type. Eticket returned: {available_str}",
            {"available": available},
        )

    await client.select_payment_type(created.order_id, payment_id, chosen)
    pay = await client.do_payment(chosen, created.order_id)

    # Submit the stored card. Card is decrypted ONLY here, in-memory.
    decrypted = await card_service.get_decrypted(pool, args.user_id)
    await client.submit_card(chosen, pay.payment_subid,
                             decrypted.pan, decrypted.exp_mmyy)
    await card_service.mark_used(pool, args.user_id)

    await pool.execute(
        """
        UPDATE autobuy_orders SET
          payment_type = $1,
          payment_subid = $2,
          amount_uzs = $3,
          status = 'awaiting_otp',
          raw_payment_resp = $4::jsonb,
          updated_at = now()
        WHERE id = $5
        """,
        chosen, pay.payment_subid, pay.amount_uzs,
        _jsonb(pay.raw), autobuy_id,
    )
    logger.info("autobuy_awaiting_otp", id=autobuy_id, payment_type=chosen,
                amount=pay.amount_uzs)
    await _notify_awaiting_otp(pool, autobuy_id)


def _pick_payment_type(groups, preferred: str | None) -> str | None:
    """Pick a national-currency payment type, honouring the user's preference."""
    SUPPORTED = {PAYMENT_TYPE_HAMKORBANK_HOLD, PAYMENT_TYPE_PAYME}
    pref_map = {
        "hamkorbank": PAYMENT_TYPE_HAMKORBANK_HOLD,
        "payme": PAYMENT_TYPE_PAYME,
    }
    preferred_eticket = pref_map.get((preferred or "").lower())
    national: list[str] = []
    for g in groups:
        if g.card_type == "NATIONAL_CURRENCY":
            national.extend(g.payment_types)
    if preferred_eticket and preferred_eticket in national:
        return preferred_eticket
    for t in national:
        if t in SUPPORTED:
            return t
    return None


def _jsonb(obj: Any) -> str:
    """Serialize a Python object for asyncpg JSONB columns."""
    return json.dumps(obj, ensure_ascii=False, default=str)


# --- OTP / cancel / expiry ---

async def submit_otp(
    pool: asyncpg.Pool, user_id: int, autobuy_id: int, otp: str,
) -> AutobuyOrderDTO:
    order = await get_by_id(pool, autobuy_id, user_id)
    if order.status != "awaiting_otp":
        raise InvalidPayload(
            f"Order is in state {order.status!r}; cannot submit OTP",
            {"status": order.status},
        )
    if not order.payment_type or not order.railway_order_id or not order.payment_subid:
        raise InvalidPayload("Order is missing payment state")

    await pool.execute(
        "UPDATE autobuy_orders SET status='paying', updated_at=now() WHERE id=$1",
        autobuy_id,
    )
    client = RailwayUserClient(pool, user_id)
    try:
        await client.confirm_otp(order.payment_type, order.payment_subid, otp)
    except PaymentFailed as exc:
        await pool.execute(
            """
            UPDATE autobuy_orders SET status='awaiting_otp',
              failure_reason=$1, updated_at=now()
            WHERE id=$2
            """,
            str(exc)[:200], autobuy_id,
        )
        raise
    await pool.execute(
        """
        UPDATE autobuy_orders SET status='paid', failure_reason=NULL,
          updated_at=now()
        WHERE id=$1
        """,
        autobuy_id,
    )
    logger.info("autobuy_paid", id=autobuy_id)
    await _notify_terminal(pool, autobuy_id, "paid")
    return await get_by_id(pool, autobuy_id, user_id)


async def resend_otp(
    pool: asyncpg.Pool, user_id: int, autobuy_id: int,
) -> None:
    order = await get_by_id(pool, autobuy_id, user_id)
    if order.status not in ("awaiting_otp", "paying"):
        raise InvalidPayload(f"Cannot resend OTP in state {order.status!r}")
    if not order.payment_type or not order.payment_subid:
        raise InvalidPayload("Order missing payment state")
    client = RailwayUserClient(pool, user_id)
    await client.resend_otp(order.payment_type, order.payment_subid)


async def cancel(
    pool: asyncpg.Pool, user_id: int, autobuy_id: int,
) -> AutobuyOrderDTO:
    order = await get_by_id(pool, autobuy_id, user_id)
    if order.status in ("paid", "cancelled", "expired", "failed"):
        return order
    if order.railway_order_id:
        try:
            account = await user_auth.get_account(pool, user_id)
            railway_user_id = (account.railway_user_id if account else None) \
                or await user_auth.resolve_railway_user_id(pool, user_id) \
                or ""
            client = RailwayUserClient(pool, user_id)
            await client.cancel_order(order.railway_order_id, railway_user_id)
        except Exception as exc:
            logger.warning("autobuy_cancel_remote_failed",
                           id=autobuy_id, error=str(exc)[:200])
    await pool.execute(
        "UPDATE autobuy_orders SET status='cancelled', updated_at=now() WHERE id=$1",
        autobuy_id,
    )
    logger.info("autobuy_cancelled", id=autobuy_id)
    return await get_by_id(pool, autobuy_id, user_id)


async def _mark_failed(pool: asyncpg.Pool, autobuy_id: int, reason: str) -> None:
    # Free the eticket reservation if we created one but couldn't finish.
    row = await pool.fetchrow(
        "SELECT user_id, railway_order_id FROM autobuy_orders WHERE id=$1",
        autobuy_id,
    )
    if row and row["railway_order_id"]:
        try:
            account = await user_auth.get_account(pool, row["user_id"])
            railway_user_id = (account.railway_user_id if account else None) \
                or await user_auth.resolve_railway_user_id(pool, row["user_id"]) \
                or ""
            client = RailwayUserClient(pool, row["user_id"])
            await client.cancel_order(row["railway_order_id"], railway_user_id)
            logger.info("autobuy_remote_cancelled_on_failure",
                        id=autobuy_id, railway_order_id=row["railway_order_id"])
        except Exception as exc:
            logger.warning("autobuy_remote_cancel_on_failure_error",
                           id=autobuy_id, error=str(exc)[:200])
    await pool.execute(
        """
        UPDATE autobuy_orders
        SET status='failed', failure_reason=$1, updated_at=now()
        WHERE id=$2 AND status IN ('reserving','awaiting_otp','paying')
        """,
        reason, autobuy_id,
    )
    logger.warning("autobuy_failed", id=autobuy_id, reason=reason)
    await _notify_terminal(pool, autobuy_id, "failed", reason)


async def expire_stale(pool: asyncpg.Pool) -> int:
    """Cancel orders whose hold_until has passed. Returns expired count."""
    now = datetime.now(timezone.utc)
    grace = now - timedelta(seconds=15)
    rows = await pool.fetch(
        """
        SELECT id, user_id, railway_order_id
        FROM autobuy_orders
        WHERE status IN ('reserving','awaiting_otp','paying')
          AND hold_until IS NOT NULL
          AND hold_until < $1
        LIMIT 50
        """,
        grace,
    )
    expired = 0
    for row in rows:
        if row["railway_order_id"]:
            try:
                account = await user_auth.get_account(pool, row["user_id"])
                railway_user_id = (account.railway_user_id if account else None) \
                    or await user_auth.resolve_railway_user_id(pool, row["user_id"]) \
                    or ""
                client = RailwayUserClient(pool, row["user_id"])
                await client.cancel_order(row["railway_order_id"], railway_user_id)
            except Exception as exc:
                logger.warning("autobuy_expire_remote_failed",
                               id=row["id"], error=str(exc)[:200])
        await pool.execute(
            "UPDATE autobuy_orders SET status='expired', updated_at=now() WHERE id=$1",
            row["id"],
        )
        expired += 1
        logger.info("autobuy_expired", id=row["id"])
        await _notify_terminal(pool, row["id"], "expired")
    return expired


async def _notify_awaiting_otp(pool: asyncpg.Pool, autobuy_id: int) -> None:
    info = await pool.fetchrow(
        """
        SELECT ao.id, ao.train_number, ao.car_number, ao.seat_number,
               ao.travel_date, ao.amount_uzs,
               u.tg_user_id,
               sd.name_uz AS dep_name, sa.name_uz AS arr_name
        FROM autobuy_orders ao
        JOIN users u ON u.id = ao.user_id
        JOIN stations sd ON sd.code = ao.dep_code
        JOIN stations sa ON sa.code = ao.arr_code
        WHERE ao.id = $1
        """,
        autobuy_id,
    )
    if not info:
        return
    from app.worker.notifier_tg import send_autobuy_otp_needed
    await send_autobuy_otp_needed(
        info["tg_user_id"],
        order_id=info["id"],
        route_name=f"{info['dep_name']} → {info['arr_name']}",
        travel_date=info["travel_date"].isoformat(),
        train_number=info["train_number"],
        car_number=info["car_number"],
        seat_number=info["seat_number"],
        amount_uzs=info["amount_uzs"],
    )


async def _notify_terminal(
    pool: asyncpg.Pool, autobuy_id: int, status: str,
    failure_reason: str | None = None,
) -> None:
    info = await pool.fetchrow(
        """
        SELECT ao.id, ao.train_number, ao.seat_number,
               u.tg_user_id,
               sd.name_uz AS dep_name, sa.name_uz AS arr_name
        FROM autobuy_orders ao
        JOIN users u ON u.id = ao.user_id
        JOIN stations sd ON sd.code = ao.dep_code
        JOIN stations sa ON sa.code = ao.arr_code
        WHERE ao.id = $1
        """,
        autobuy_id,
    )
    if not info:
        return
    from app.worker.notifier_tg import send_autobuy_terminal
    await send_autobuy_terminal(
        info["tg_user_id"],
        order_id=info["id"],
        status=status,
        route_name=f"{info['dep_name']} → {info['arr_name']}",
        train_number=info["train_number"],
        seat_number=info["seat_number"],
        failure_reason=failure_reason,
    )
