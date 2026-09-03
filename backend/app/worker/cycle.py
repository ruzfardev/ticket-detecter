"""
Watcher cycle — runs every WATCHER_TICK_SECONDS.

  1. Refresh watch_groups (every WATCH_GROUPS_REFRESH_SECONDS)
  2. Pick groups where next_poll_at <= now()
  3. Per group: railway.list_trains -> railway.get_train_detail for
     trains with at least one subscriber filter that may match
  4. For each (sub, train) match -> dedup by snapshot_hash -> send TG
  5. Update next_poll_at = now() + (10s if has_premium else 30s)
"""

from __future__ import annotations

import asyncio
import random
import time
from datetime import datetime, timedelta, timezone

import asyncpg
import httpx

from app.core.config import settings
from app.core.errors import RailwayUnavailable, RateLimited
from app.core.logging import logger
from app.db import get_pool
from app.railway import get_client
from app.services import seat_stats
from app.worker import matcher
from app.worker.formatter import format_alert
from app.worker.notifier_tg import send_alert


_last_refresh: float = 0.0


async def run_cycle() -> None:
    """Single tick: refresh groups (maybe), poll due ones."""
    pool = get_pool()
    await _maybe_refresh_groups(pool)
    groups = await _due_groups(pool)
    if not groups:
        return
    logger.debug("worker_due_groups", count=len(groups))
    for g in groups:
        try:
            await _process_group(pool, g)
        except RateLimited:
            logger.warning("worker_rate_limited_break")
            return  # whole tick aborts; cooldown set by client
        except Exception as e:
            logger.exception("worker_group_error", group=dict(g), error=str(e))
            await _mark_polled(pool, g["id"], g["has_premium"])


async def _maybe_refresh_groups(pool: asyncpg.Pool) -> None:
    global _last_refresh
    now = time.monotonic()
    if now - _last_refresh < settings.watch_groups_refresh_seconds:
        return
    _last_refresh = now
    await pool.execute(
        """
        INSERT INTO watch_groups (dep_code, arr_code, travel_date, has_premium, subscriber_count)
        SELECT s.dep_code, s.arr_code, s.travel_date,
               bool_or(u.tier = 'premium'),
               COUNT(*)
        FROM subscriptions s
        JOIN users u ON u.id = s.user_id
        WHERE s.is_active AND s.travel_date >= CURRENT_DATE
        GROUP BY s.dep_code, s.arr_code, s.travel_date
        ON CONFLICT (dep_code, arr_code, travel_date) DO UPDATE
        SET has_premium = EXCLUDED.has_premium,
            subscriber_count = EXCLUDED.subscriber_count,
            updated_at = now();
        DELETE FROM watch_groups
        WHERE NOT EXISTS (
            SELECT 1 FROM subscriptions s
            WHERE s.is_active AND s.travel_date >= CURRENT_DATE
              AND s.dep_code = watch_groups.dep_code
              AND s.arr_code = watch_groups.arr_code
              AND s.travel_date = watch_groups.travel_date
        );
        """
    )


async def _due_groups(pool: asyncpg.Pool) -> list[asyncpg.Record]:
    return await pool.fetch(
        """
        SELECT id, dep_code, arr_code, travel_date, has_premium, subscriber_count
        FROM watch_groups
        WHERE travel_date >= CURRENT_DATE
          AND (next_poll_at IS NULL OR next_poll_at <= now())
          AND (cooldown_until IS NULL OR cooldown_until <= now())
        ORDER BY has_premium DESC, subscriber_count DESC
        LIMIT 50
        """
    )


async def _process_group(pool: asyncpg.Pool, g: asyncpg.Record) -> None:
    client = get_client(pool)
    date_iso = g["travel_date"].isoformat()

    try:
        trains = await client.list_trains(g["dep_code"], g["arr_code"], date_iso)
    except RailwayUnavailable as e:
        logger.warning("worker_list_unavailable",
                       group=g["id"], error=str(e))
        await _mark_polled(pool, g["id"], g["has_premium"])
        return

    if not trains:
        await _mark_polled(pool, g["id"], g["has_premium"])
        return

    # Keep what we just saw — every train and car type, before any subscriber
    # filter narrows it down. Never lets bookkeeping break the alerting.
    try:
        await seat_stats.record_samples(
            pool, g["dep_code"], g["arr_code"], g["travel_date"], trains,
        )
    except Exception as e:
        logger.warning("seat_samples_record_failed", group=g["id"], error=str(e)[:160])

    # Load all active subs for this group + their user info
    subs = await pool.fetch(
        """
        SELECT s.id, s.user_id, s.train_numbers, s.car_types, s.berth, s.muted_until,
               s.autobuy_enabled, s.autobuy_friend_id, s.autobuy_friend_ids,
               s.autobuy_payment_method, s.autobuy_seat_strategy,
               u.tg_user_id, u.lang
        FROM subscriptions s
        JOIN users u ON u.id = s.user_id
        WHERE s.is_active
          AND s.dep_code    = $1
          AND s.arr_code    = $2
          AND s.travel_date = $3
        """,
        g["dep_code"], g["arr_code"], g["travel_date"],
    )
    if not subs:
        await _mark_polled(pool, g["id"], g["has_premium"])
        return

    # A subscription with an auto-buy order still in flight already has seats
    # held; alerting again would just spam the user while they are entering the
    # SMS code. Once the order settles (cancelled/expired/failed) the sub drops
    # out of this set and alerting resumes on its own; a `paid` order instead
    # deactivates the subscription, so it never reaches here again.
    busy_sub_ids = await _subs_with_live_orders(pool, [s["id"] for s in subs])
    if busy_sub_ids:
        logger.info("worker_subs_muted_by_live_order",
                    count=len(busy_sub_ids), sub_ids=sorted(busy_sub_ids))
        subs = [s for s in subs if s["id"] not in busy_sub_ids]
    if not subs:
        await _mark_polled(pool, g["id"], g["has_premium"])
        return

    # For each train, only fetch detail if any sub is interested
    for idx, train in enumerate(trains):
        if not _any_sub_matches_train(subs, train.number):
            continue
        if idx > 0:
            await asyncio.sleep(settings.watcher_detail_jitter * random.uniform(0.7, 1.3))

        try:
            cars = await client.get_train_detail(
                g["dep_code"], g["arr_code"], date_iso,
                train.number, train.train_id,
            )
        except RailwayUnavailable as e:
            logger.warning("worker_detail_unavailable",
                           train=train.number, error=str(e))
            continue

        if not cars:
            continue

        for sub in subs:
            if sub["muted_until"] and sub["muted_until"] > datetime.now(timezone.utc):
                continue
            filt = matcher.SubFilter(
                train_numbers=list(sub["train_numbers"] or []),
                car_types=list(sub["car_types"] or []),
                berth=sub["berth"],
            )
            snapshot = matcher.match(filt, train.number, cars)
            if not snapshot:
                continue

            log_id = await _maybe_send(pool, sub, train, snapshot)
            has_passengers = bool(sub["autobuy_friend_ids"]) or bool(sub["autobuy_friend_id"])
            # NB: deliberately not gated on `log_id`. Alerts are deduplicated
            # for 30 minutes on an unchanged seat map, and auto-buy used to ride
            # on that same signal — so once the first alert went out, a seat
            # that stayed available was never bought until the map changed.
            # Buying is not notifying; an in-flight order is what stops a repeat
            # (see _subs_with_live_orders).
            if sub["autobuy_enabled"] and has_passengers:
                await _maybe_autobuy(pool, sub, train, cars, snapshot, log_id, g)

    await _mark_polled(pool, g["id"], g["has_premium"])


async def _subs_with_live_orders(
    pool: asyncpg.Pool, sub_ids: list[int],
) -> set[int]:
    """Subscription ids that currently have an unfinished auto-buy order."""
    if not sub_ids:
        return set()
    rows = await pool.fetch(
        """
        SELECT DISTINCT subscription_id
        FROM autobuy_orders
        WHERE subscription_id = ANY($1::bigint[])
          AND status IN ('reserving', 'awaiting_otp', 'paying')
        """,
        sub_ids,
    )
    return {r["subscription_id"] for r in rows}


def _any_sub_matches_train(subs: list[asyncpg.Record], train_number: str) -> bool:
    for s in subs:
        if not s["train_numbers"] or train_number in s["train_numbers"]:
            return True
    return False


async def _maybe_send(
    pool: asyncpg.Pool,
    sub: asyncpg.Record,
    train,
    snapshot: dict,
) -> int | None:
    snap_hash = matcher.snapshot_hash(snapshot)

    # Dedup: same (sub, train, hash) within last N minutes -> skip
    dup = await pool.fetchval(
        """
        SELECT 1 FROM notification_log
        WHERE subscription_id = $1
          AND train_number    = $2
          AND snapshot_hash   = $3
          AND sent_at > now() - $4::interval
        LIMIT 1
        """,
        sub["id"], train.number, snap_hash,
        timedelta(minutes=settings.watcher_dedup_minutes),
    )
    if dup:
        return None

    # Compose message
    route_name = await pool.fetchval(
        """
        SELECT sd.name_uz || ' → ' || sa.name_uz
        FROM subscriptions s
        JOIN stations sd ON sd.code = s.dep_code
        JOIN stations sa ON sa.code = s.arr_code
        WHERE s.id = $1
        """,
        sub["id"],
    )
    text = format_alert(
        route_name=route_name or f"{train.dep_station} → {train.arr_station}",
        travel_date=(await pool.fetchval(
            "SELECT travel_date::text FROM subscriptions WHERE id = $1", sub["id"]
        )),
        train_number=train.number,
        train_brand=train.brand,
        departure=train.departure,
        arrival=train.arrival,
        time_on_way=train.time_on_way,
        snapshot=snapshot,
        lang=sub["lang"],
    )

    # Send
    msg_id = await send_alert(sub["tg_user_id"], text, sub_id=sub["id"])

    seats = matcher.count_seats(snapshot)
    log_id = await pool.fetchval(
        """
        INSERT INTO notification_log
          (subscription_id, user_id, train_number,
           seats_snapshot, snapshot_hash, seats_count, tg_message_id)
        VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)
        RETURNING id
        """,
        sub["id"], sub["user_id"], train.number,
        _json(snapshot), snap_hash, seats, msg_id,
    )
    logger.info("worker_notification_sent",
                sub_id=sub["id"], train=train.number, seats=seats, hash=snap_hash)
    return log_id


def _json(obj) -> str:
    import json
    return json.dumps(obj, ensure_ascii=False)


async def _maybe_autobuy(
    pool: asyncpg.Pool,
    sub: asyncpg.Record,
    train,
    cars: list,
    snapshot: dict,
    notification_id: int | None,
    g: asyncpg.Record,
) -> None:
    """Pick seats in one car and fire autobuy.

    A single eticket order covers one car, so all seats must come from the same
    one. What to do when no car fits everyone is the subscription's choice
    (`autobuy_seat_strategy`):

      'all'     buy only if one car seats every passenger (default)
      'partial' take as many as the best car offers, at least one

    A car that seats everyone always wins, whatever the strategy.
    """
    friend_ids = list(sub["autobuy_friend_ids"] or [])
    if not friend_ids and sub["autobuy_friend_id"]:
        friend_ids = [sub["autobuy_friend_id"]]
    n = max(1, len(friend_ids))
    strategy = sub["autobuy_seat_strategy"] or "all"

    car_lookup = {c.number: c for c in cars}
    full: tuple[str, list[int], object] | None = None      # seats everyone
    partial: tuple[str, list[int], object] | None = None   # best short option
    for car_number, payload in snapshot.items():
        car = car_lookup.get(car_number)
        if not car:
            continue
        seats_in_car: list[int] = []
        seats_in_car.extend(payload.get("lower") or [])
        seats_in_car.extend(payload.get("upper") or [])
        seats_in_car.extend(payload.get("places") or [])
        if not seats_in_car:
            continue
        chosen = sorted(seats_in_car)[:n]
        if len(chosen) >= n:
            if full is None or chosen[0] < full[1][0]:
                full = (car_number, chosen, car)
        elif partial is None or len(chosen) > len(partial[1]):
            partial = (car_number, chosen, car)

    candidate = full or (partial if strategy == "partial" else None)
    if candidate is None:
        # Used to return in silence, which looks identical to "never checked"
        # from the outside — it is the single most confusing state this feature
        # has, so say why.
        logger.info("autobuy_not_enough_seats",
                    sub_id=sub["id"], train=train.number, needed=n,
                    best_car_seats=len(partial[1]) if partial else 0,
                    strategy=strategy)
        return
    if candidate is partial:
        logger.info("autobuy_partial_seats", sub_id=sub["id"],
                    train=train.number, needed=n, taking=len(candidate[1]))

    car_number, seats, car = candidate
    dep_time = _extract_hhmm(train.departure)
    from app.services import autobuy_service
    try:
        await autobuy_service.try_start_autobuy(
            pool,
            autobuy_service.StartArgs(
                user_id=sub["user_id"],
                subscription_id=sub["id"],
                train_number=train.number,
                car_number=car_number,
                seat_numbers=seats,
                car_type=car.raw_car_type or car.type,
                class_service=car.class_service,
                dep_code=g["dep_code"],
                arr_code=g["arr_code"],
                dep_date=g["travel_date"],
                dep_time=dep_time,
                trigger_source="auto",
                notification_id=notification_id,
            ),
        )
    except Exception as exc:
        logger.warning(
            "autobuy_trigger_failed",
            sub_id=sub["id"], train=train.number, seats=seats,
            error=str(exc)[:200],
        )


def _extract_hhmm(departure: str) -> str:
    """Parse '06.06.2026 16:00' or ISO into 'HH:MM'."""
    if not departure:
        return "00:00"
    s = departure.strip()
    # 'DD.MM.YYYY HH:MM' or 'YYYY-MM-DDTHH:MM[:SS]'
    if " " in s and ":" in s:
        return s.split(" ")[1][:5]
    if "T" in s:
        return s.split("T", 1)[1][:5]
    return "00:00"


async def _mark_polled(pool: asyncpg.Pool, group_id: int, has_premium: bool) -> None:
    interval = (
        settings.watcher_premium_interval_s if has_premium
        else settings.watcher_free_interval_s
    )
    await pool.execute(
        """
        UPDATE watch_groups
        SET last_polled_at = now(),
            next_poll_at   = now() + ($1 || ' seconds')::interval
        WHERE id = $2
        """,
        str(interval), group_id,
    )
