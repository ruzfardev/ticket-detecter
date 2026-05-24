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

    # Load all active subs for this group + their user info
    subs = await pool.fetch(
        """
        SELECT s.id, s.user_id, s.train_numbers, s.car_types, s.berth, s.muted_until,
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

            await _maybe_send(pool, sub, train, snapshot)

    await _mark_polled(pool, g["id"], g["has_premium"])


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
) -> None:
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
        return

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
    await pool.execute(
        """
        INSERT INTO notification_log
          (subscription_id, user_id, train_number,
           seats_snapshot, snapshot_hash, seats_count, tg_message_id)
        VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)
        """,
        sub["id"], sub["user_id"], train.number,
        _json(snapshot), snap_hash, seats, msg_id,
    )
    logger.info("worker_notification_sent",
                sub_id=sub["id"], train=train.number, seats=seats, hash=snap_hash)


def _json(obj) -> str:
    import json
    return json.dumps(obj, ensure_ascii=False)


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
