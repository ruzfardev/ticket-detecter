"""Auto-buy orders (Phase B manual + Phase C automatic)."""

from __future__ import annotations

from datetime import date as date_t

import asyncpg
from fastapi import APIRouter, Body, Depends
from pydantic import BaseModel, Field

from app.api.deps import current_user, db_pool
from app.services import autobuy_service
from app.services.user_service import UserRow

router = APIRouter(prefix="/orders", tags=["orders"])


class StartManualBody(BaseModel):
    subscription_id: int
    train_number: str
    car_number: str
    seat_number: int = Field(..., ge=1)
    car_type: str
    class_service: str
    dep_code: str = Field(pattern=r"^\d{7}$")
    arr_code: str = Field(pattern=r"^\d{7}$")
    dep_date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    dep_time: str = Field(pattern=r"^\d{2}:\d{2}$")


class OtpBody(BaseModel):
    otp: str = Field(..., min_length=3, max_length=10)


@router.get("")
async def list_orders(
    user: UserRow = Depends(current_user),
    pool: asyncpg.Pool = Depends(db_pool),
) -> dict:
    orders = await autobuy_service.list_for_user(pool, user.id)
    return {"orders": [o.to_dict() for o in orders]}


@router.get("/{order_id}")
async def get_order(
    order_id: int,
    user: UserRow = Depends(current_user),
    pool: asyncpg.Pool = Depends(db_pool),
) -> dict:
    order = await autobuy_service.get_by_id(pool, order_id, user.id)
    return {"order": order.to_dict()}


@router.post("/manual", status_code=201)
async def start_manual(
    body: StartManualBody = Body(...),
    user: UserRow = Depends(current_user),
    pool: asyncpg.Pool = Depends(db_pool),
) -> dict:
    """Phase B "Hozir sotib ol" — user-triggered booking."""
    order = await autobuy_service.try_start_autobuy(
        pool,
        autobuy_service.StartArgs(
            user_id=user.id,
            subscription_id=body.subscription_id,
            train_number=body.train_number,
            car_number=body.car_number,
            seat_numbers=[body.seat_number],
            car_type=body.car_type,
            class_service=body.class_service,
            dep_code=body.dep_code,
            arr_code=body.arr_code,
            dep_date=date_t.fromisoformat(body.dep_date),
            dep_time=body.dep_time,
            trigger_source="manual",
        ),
    )
    if order is None:
        # Seat already in-flight for this subscription — return whichever row exists.
        existing = await autobuy_service.list_for_user(pool, user.id)
        match = next((o for o in existing
                      if o.subscription_id == body.subscription_id
                      and o.train_number == body.train_number
                      and o.car_number == body.car_number
                      and o.seat_number == body.seat_number
                      and o.status in ("reserving","awaiting_otp","paying","paid")), None)
        if match:
            return {"order": match.to_dict()}
        raise autobuy_service.AutobuyConflict("Seat is already claimed")
    return {"order": order.to_dict()}


@router.post("/{order_id}/otp")
async def submit_otp(
    order_id: int,
    body: OtpBody = Body(...),
    user: UserRow = Depends(current_user),
    pool: asyncpg.Pool = Depends(db_pool),
) -> dict:
    order = await autobuy_service.submit_otp(pool, user.id, order_id, body.otp)
    return {"order": order.to_dict()}


@router.post("/{order_id}/resend-otp", status_code=204)
async def resend_otp(
    order_id: int,
    user: UserRow = Depends(current_user),
    pool: asyncpg.Pool = Depends(db_pool),
) -> None:
    await autobuy_service.resend_otp(pool, user.id, order_id)


@router.post("/{order_id}/cancel")
async def cancel_order(
    order_id: int,
    user: UserRow = Depends(current_user),
    pool: asyncpg.Pool = Depends(db_pool),
) -> dict:
    order = await autobuy_service.cancel(pool, user.id, order_id)
    return {"order": order.to_dict()}
