"""POST /api/v1/trains/search — proxy to railway.uz list_trains with cache."""

from __future__ import annotations

from datetime import date as date_t
from datetime import datetime, timezone

import asyncpg
from fastapi import APIRouter, Body, Depends
from pydantic import BaseModel, Field

from app.api.deps import current_user, db_pool
from app.core.errors import InvalidPayload
from app.railway import get_client
from app.railway.models import BERTH_TYPES
from app.services.user_service import UserRow

router = APIRouter(prefix="/trains", tags=["trains"])


class TrainSearchReq(BaseModel):
    dep_code: str = Field(pattern=r"^\d{7}$")
    arr_code: str = Field(pattern=r"^\d{7}$")
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")


@router.post("/search")
async def search_trains(
    req: TrainSearchReq = Body(...),
    user: UserRow = Depends(current_user),
    pool: asyncpg.Pool = Depends(db_pool),
) -> dict:
    if req.dep_code == req.arr_code:
        raise InvalidPayload("dep_code and arr_code must differ")
    try:
        d = date_t.fromisoformat(req.date)
    except ValueError:
        raise InvalidPayload("date must be YYYY-MM-DD")
    if d < date_t.today():
        raise InvalidPayload("date must be today or later")

    client = get_client(pool)
    trains = await client.list_trains(req.dep_code, req.arr_code, req.date)

    out = []
    for t in trains:
        car_types = []
        for c in t.cars:
            car_types.append({
                "type": c.type,
                "free_seats": c.free_seats,
                "supports_berth": c.type in BERTH_TYPES,
            })
        out.append({
            "number": t.number,
            "brand": t.brand,
            "departure": t.departure,
            "arrival": t.arrival,
            "time_on_way": t.time_on_way,
            "dep_station": t.dep_station,
            "arr_station": t.arr_station,
            "car_types": car_types,
            "train_id": t.train_id,
        })

    return {
        "trains": out,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }
