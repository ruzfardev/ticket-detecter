"""
Async HTTP client for railway.uz.

Exposes:
  - list_trains(dep, arr, date) -> list[TrainSummary]
  - get_train_detail(...)       -> list[CarDetail]
  - global TokenBucket for rate limiting
"""

from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass

import asyncpg
import httpx

from app.core.config import settings
from app.core.errors import RailwayUnavailable, RateLimited
from app.core.logging import logger
from app.railway.auth import BASE_URL, get_or_refresh_auth, set_cooldown
from app.railway.models import (
    CarDetail,
    CarSummary,
    TrainSummary,
    normalize_car_type,
)

TRAINS_LIST_URL = f"{BASE_URL}/api/v3/handbook/trains/list"
TRAIN_DETAIL_URL = f"{BASE_URL}/api/v1/handbook/trains"


# ---- Token bucket -----------------------------------------------------------

class TokenBucket:
    """Per-process leaky bucket. Worker shares one instance globally."""

    def __init__(self, rate: float, capacity: int):
        self._rate = rate
        self._capacity = capacity
        self._tokens = float(capacity)
        self._last = time.monotonic()
        self._lock = asyncio.Lock()

    async def acquire(self) -> None:
        while True:
            async with self._lock:
                now = time.monotonic()
                elapsed = now - self._last
                self._tokens = min(self._capacity, self._tokens + elapsed * self._rate)
                self._last = now
                if self._tokens >= 1:
                    self._tokens -= 1
                    return
                wait = (1 - self._tokens) / self._rate
            await asyncio.sleep(wait)


_bucket: TokenBucket | None = None


def get_bucket() -> TokenBucket:
    global _bucket
    if _bucket is None:
        _bucket = TokenBucket(
            rate=settings.watcher_rate_per_second,
            capacity=int(settings.watcher_rate_per_second * 5) or 10,
        )
    return _bucket


# ---- Client -----------------------------------------------------------------

@dataclass(slots=True)
class _CacheEntry:
    data: list[TrainSummary]
    fetched_at: float


class RailwayClient:
    def __init__(self, pool: asyncpg.Pool):
        self._pool = pool
        self._http = httpx.AsyncClient(timeout=20)
        self._list_cache: dict[tuple[str, str, str], _CacheEntry] = {}

    async def aclose(self) -> None:
        await self._http.aclose()

    async def list_trains(
        self,
        dep_code: str,
        arr_code: str,
        date: str,
        cache_ttl: int | None = None,
    ) -> list[TrainSummary]:
        ttl = settings.watcher_list_cache_ttl if cache_ttl is None else cache_ttl
        key = (dep_code, arr_code, date)
        now = time.monotonic()
        cached = self._list_cache.get(key)
        if cached and (now - cached.fetched_at) < ttl:
            return cached.data

        await get_bucket().acquire()
        headers = (await get_or_refresh_auth(self._pool)).as_headers()
        payload = {
            "directions": {
                "forward": {
                    "date": date,
                    "depStationCode": dep_code,
                    "arvStationCode": arr_code,
                }
            }
        }
        try:
            r = await self._http.post(TRAINS_LIST_URL, json=payload, headers=headers)
        except httpx.HTTPError as e:
            raise RailwayUnavailable(f"list_trains network error: {e}")

        await self._maybe_handle_status(r)

        data = r.json().get("data", {})
        trains_raw = data.get("directions", {}).get("forward", {}).get("trains", []) or []

        result: list[TrainSummary] = []
        for t in trains_raw:
            cars = []
            for c in t.get("cars", []) or []:
                raw_type = str(c.get("type") or "")
                ctype = normalize_car_type(raw_type)
                if not ctype:
                    continue
                # Cheapest class within this car type — the "from" price.
                prices = [
                    int(tf.get("tariff"))
                    for tf in (c.get("tariffs") or [])
                    if isinstance(tf, dict) and tf.get("tariff")
                ]
                cars.append(CarSummary(
                    type=ctype,
                    free_seats=int(c.get("freeSeats") or 0),
                    price_uzs=min(prices) if prices else None,
                    raw_type=raw_type,
                ))
            sub = t.get("subRoute") or {}
            result.append(TrainSummary(
                number=str(t.get("number") or ""),
                brand=str(t.get("brand") or ""),
                departure=str(t.get("departureDate") or ""),
                arrival=str(t.get("arrivalDate") or ""),
                time_on_way=str(t.get("timeOnWay") or ""),
                dep_station=str(sub.get("depStationName") or ""),
                arr_station=str(sub.get("arvStationName") or ""),
                cars=cars,
                train_id=t.get("trainId"),
            ))

        self._list_cache[key] = _CacheEntry(data=result, fetched_at=now)
        return result

    async def get_train_detail(
        self,
        dep_code: str,
        arr_code: str,
        date: str,
        train_number: str,
        train_id: str | None,
    ) -> list[CarDetail]:
        await get_bucket().acquire()
        headers = (await get_or_refresh_auth(self._pool)).as_headers()
        payload = {
            "depDate": date,
            "depStationCode": dep_code,
            "arvStationCode": arr_code,
            "trainNumber": train_number,
            "trainId": train_id,
        }
        try:
            r = await self._http.post(TRAIN_DETAIL_URL, json=payload, headers=headers)
        except httpx.HTTPError as e:
            raise RailwayUnavailable(f"train_detail network error: {e}")

        await self._maybe_handle_status(r)

        cars_out: list[CarDetail] = []
        car_groups = (r.json().get("data", {}).get("train") or {}).get("carGroup") or []
        for g in car_groups:
            raw_ctype = str(g.get("type") or "")
            ctype = normalize_car_type(g.get("typeShow") or g.get("type") or "")
            class_service = str((g.get("services") or {}).get("type") or "")
            for car in g.get("cars") or []:
                places = car.get("places") or []
                cars_out.append(CarDetail(
                    number=str(car.get("number") or ""),
                    type=ctype,
                    places=[int(p) for p in places if isinstance(p, int)],
                    class_service=class_service,
                    raw_car_type=raw_ctype,
                ))
        return cars_out

    async def _maybe_handle_status(self, r: httpx.Response) -> None:
        if r.status_code == 429:
            await set_cooldown(self._pool, settings.railway_cooldown_429)
            raise RateLimited("railway.uz returned 429")
        if r.status_code >= 500:
            raise RailwayUnavailable(f"railway.uz {r.status_code}")
        if r.status_code == 401:
            # Force re-auth on next call by clearing cached creds
            await self._pool.execute(
                "UPDATE railway_credentials SET access_token = NULL WHERE is_active"
            )
            raise RailwayUnavailable("railway auth invalidated (401)")
        if r.status_code != 200:
            logger.warning("railway_unexpected_status",
                           status=r.status_code, body=r.text[:200])
            raise RailwayUnavailable(f"railway.uz {r.status_code}")


# ---- Global singleton client ------------------------------------------------

_client: RailwayClient | None = None


def get_client(pool: asyncpg.Pool | None = None) -> RailwayClient:
    global _client
    if _client is None:
        from app.db import get_pool
        _client = RailwayClient(pool or get_pool())
    return _client


async def close_client() -> None:
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None
