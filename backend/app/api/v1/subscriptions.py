"""Subscriptions CRUD — Mini App ownership."""

from __future__ import annotations

from datetime import date as date_t

import asyncpg
from fastapi import APIRouter, Body, Depends
from pydantic import BaseModel, Field

from app.api.deps import current_user, db_pool
from app.services import subscription_service, user_service
from app.services.user_service import UserRow

router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])


class CreateSub(BaseModel):
    dep_code: str = Field(pattern=r"^\d{7}$")
    arr_code: str = Field(pattern=r"^\d{7}$")
    travel_date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    train_number: str | None = Field(default=None, max_length=20)
    car_types: list[str] = Field(default_factory=list)
    berth: str = Field(default="any", pattern="^(lower|upper|any)$")


class PatchSub(BaseModel):
    is_active: bool | None = None


@router.get("")
async def list_subs(
    user: UserRow = Depends(current_user),
    pool: asyncpg.Pool = Depends(db_pool),
) -> dict:
    subs = await subscription_service.list_for_user(pool, user.id, include_inactive=False)
    slot = await user_service.get_slot_stats(pool, user.id)
    return {
        "subscriptions": [s.to_dict() for s in subs],
        "slot": {"max": slot.max, "used": slot.used},
    }


@router.post("", status_code=201)
async def create_sub(
    body: CreateSub = Body(...),
    user: UserRow = Depends(current_user),
    pool: asyncpg.Pool = Depends(db_pool),
) -> dict:
    subscription_service.validate_payload(
        body.dep_code, body.arr_code, body.car_types, body.berth,
    )
    sub = await subscription_service.create(
        pool=pool,
        user_id=user.id,
        dep_code=body.dep_code,
        arr_code=body.arr_code,
        travel_date=date_t.fromisoformat(body.travel_date),
        train_number=body.train_number,
        car_types=body.car_types,
        berth=body.berth,
    )
    slot = await user_service.get_slot_stats(pool, user.id)
    return {
        "subscription": sub.to_dict(),
        "slot": {"max": slot.max, "used": slot.used},
    }


@router.patch("/{sub_id}")
async def patch_sub(
    sub_id: int,
    body: PatchSub = Body(...),
    user: UserRow = Depends(current_user),
    pool: asyncpg.Pool = Depends(db_pool),
) -> dict:
    if body.is_active is None:
        sub = await subscription_service.get_by_id(pool, sub_id, user.id)
    else:
        sub = await subscription_service.update_active(pool, sub_id, user.id, body.is_active)
    return {"subscription": sub.to_dict()}


@router.delete("/{sub_id}", status_code=204)
async def delete_sub(
    sub_id: int,
    user: UserRow = Depends(current_user),
    pool: asyncpg.Pool = Depends(db_pool),
) -> None:
    await subscription_service.delete(pool, sub_id, user.id)
