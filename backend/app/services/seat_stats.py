"""What the watcher sees, kept: seat availability over time.

`record_samples` is called from the watcher for every train list it fetches
and stores one row per car type per 10-minute bucket (the poll runs every
10-30 s, so the bucket absorbs the repeats). `aggregate` turns finished
departures into per-route, per-train, per-car-type sell-out statistics.
`insights_for` answers the picker: how this departure is moving right now,
and what usually happens on this route.
"""

from __future__ import annotations

from datetime import date

import asyncpg

from app.core.logging import logger

RETENTION_DAYS = 180
# A departure needs a few samples before it says anything about the route.
MIN_SAMPLES_PER_INSTANCE = 3
# A route needs a few finished departures before "usually" means something.
MIN_INSTANCES = 3


async def record_samples(
    pool: asyncpg.Pool, dep_code: str, arr_code: str, travel_date: date, trains,
) -> int:
    """Store free seats + cheapest price per (train, car type) for one poll."""
    seen: dict[tuple[str, str], tuple[int, int | None]] = {}
    for t in trains:
        for c in (t.cars or []):
            if not c.type:
                continue
            seen[(t.number, c.type)] = (int(c.free_seats or 0), c.price_uzs)
    if not seen:
        return 0
    keys = list(seen)
    await pool.execute(
        """
        INSERT INTO seat_samples
            (dep_code, arr_code, travel_date, train_number, car_type,
             free_seats, min_price_uzs, days_before, bucket)
        SELECT $1, $2, $3::date, s.train_number, s.car_type, s.free_seats, s.price,
               ($3::date - (now() AT TIME ZONE 'Asia/Tashkent')::date),
               date_trunc('hour', now())
                 + make_interval(mins => (EXTRACT(minute FROM now())::int / 10) * 10)
        FROM unnest($4::text[], $5::text[], $6::int[], $7::int[])
             AS s(train_number, car_type, free_seats, price)
        ON CONFLICT (dep_code, arr_code, travel_date, train_number, car_type, bucket)
        DO UPDATE SET free_seats    = EXCLUDED.free_seats,
                      min_price_uzs = EXCLUDED.min_price_uzs,
                      observed_at   = now()
        """,
        dep_code, arr_code, travel_date,
        [k[0] for k in keys], [k[1] for k in keys],
        [seen[k][0] for k in keys], [seen[k][1] for k in keys],
    )
    return len(keys)


async def aggregate(pool: asyncpg.Pool) -> int:
    """Roll finished departures up into route_car_stats; prune old samples.

    Per departure instance the statistic is the last `days_before` at which
    seats were still on sale; an instance counts as sold out when its final
    sample showed zero. The route figure is the median over sold-out instances.
    """
    n = await pool.fetchval(
        """
        WITH inst AS (
            SELECT dep_code, arr_code, travel_date, train_number, car_type,
                   MIN(days_before) FILTER (WHERE free_seats > 0)        AS last_seen_days,
                   (array_agg(free_seats ORDER BY observed_at DESC))[1]  AS last_free
            FROM seat_samples
            WHERE travel_date < (now() AT TIME ZONE 'Asia/Tashkent')::date
            GROUP BY 1, 2, 3, 4, 5
            HAVING COUNT(*) >= $1
        ),
        agg AS (
            SELECT dep_code, arr_code, train_number, car_type,
                   COUNT(*)::int                                  AS instances_n,
                   COUNT(*) FILTER (WHERE last_free = 0)::int     AS sold_out_n,
                   percentile_cont(0.5) WITHIN GROUP (ORDER BY last_seen_days)
                       FILTER (WHERE last_free = 0 AND last_seen_days IS NOT NULL)
                                                                  AS sellout_days_p50
            FROM inst
            GROUP BY 1, 2, 3, 4
        ),
        up AS (
            INSERT INTO route_car_stats
                (dep_code, arr_code, train_number, car_type,
                 instances_n, sold_out_n, sellout_days_p50, updated_at)
            SELECT dep_code, arr_code, train_number, car_type,
                   instances_n, sold_out_n, sellout_days_p50, now()
            FROM agg
            ON CONFLICT (dep_code, arr_code, train_number, car_type) DO UPDATE
            SET instances_n = EXCLUDED.instances_n,
                sold_out_n = EXCLUDED.sold_out_n,
                sellout_days_p50 = EXCLUDED.sellout_days_p50,
                updated_at = now()
            RETURNING 1
        )
        SELECT COUNT(*) FROM up
        """,
        MIN_SAMPLES_PER_INSTANCE,
    )
    pruned = await pool.execute(
        "DELETE FROM seat_samples WHERE observed_at < now() - ($1 || ' days')::interval",
        str(RETENTION_DAYS),
    )
    logger.info("seat_stats_aggregated", routes=int(n or 0), pruned=pruned)
    return int(n or 0)


async def insights_for(
    pool: asyncpg.Pool, dep_code: str, arr_code: str, travel_date: date,
) -> dict[tuple[str, str], dict]:
    """(train_number, car_type) -> insight for the picker.

        trend_delta       change in free seats over the last day on THIS
                          departure (negative = selling), None if we have
                          less than an hour of history
        trend_span_h      how many hours that change spans
        sellout_days_p50  on this route, how many days before departure the
                          car type usually sells out (None = usually doesn't)
        sold_out_n / instances_n   the evidence behind it
    """
    out: dict[tuple[str, str], dict] = {}
    trend = await pool.fetch(
        """
        SELECT train_number, car_type,
               (array_agg(free_seats ORDER BY observed_at DESC))[1] AS latest_free,
               (array_agg(free_seats ORDER BY observed_at ASC))[1]  AS first_free,
               EXTRACT(EPOCH FROM (MAX(observed_at) - MIN(observed_at))) / 3600.0 AS span_h
        FROM seat_samples
        WHERE dep_code = $1 AND arr_code = $2 AND travel_date = $3
          AND observed_at > now() - interval '24 hours'
        GROUP BY train_number, car_type
        """,
        dep_code, arr_code, travel_date,
    )
    for r in trend:
        span = float(r["span_h"] or 0)
        d = out.setdefault((r["train_number"], r["car_type"]), _empty())
        if span >= 1:
            d["trend_delta"] = int(r["latest_free"]) - int(r["first_free"])
            d["trend_span_h"] = int(round(span))
    stats = await pool.fetch(
        """
        SELECT train_number, car_type, instances_n, sold_out_n, sellout_days_p50
        FROM route_car_stats
        WHERE dep_code = $1 AND arr_code = $2 AND instances_n >= $3
        """,
        dep_code, arr_code, MIN_INSTANCES,
    )
    for r in stats:
        d = out.setdefault((r["train_number"], r["car_type"]), _empty())
        d["instances_n"] = int(r["instances_n"])
        d["sold_out_n"] = int(r["sold_out_n"])
        p50 = r["sellout_days_p50"]
        d["sellout_days_p50"] = None if p50 is None else round(float(p50), 1)
    return out


def _empty() -> dict:
    return {"trend_delta": None, "trend_span_h": None,
            "sellout_days_p50": None, "sold_out_n": 0, "instances_n": 0}
