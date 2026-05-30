"""Stored payment cards (one per user) for auto-buy."""

from __future__ import annotations

import asyncpg
from fastapi import APIRouter, Body, Depends
from pydantic import BaseModel, Field

from app.api.deps import current_user, db_pool
from app.services import card_service
from app.services.user_service import UserRow

router = APIRouter(prefix="/cards", tags=["cards"])


class SaveCardBody(BaseModel):
    pan: str = Field(..., min_length=12, max_length=24)
    exp_mmyy: str = Field(..., min_length=4, max_length=5)
    holder_name: str | None = Field(default=None, max_length=64)


@router.get("")
async def get_card(
    user: UserRow = Depends(current_user),
    pool: asyncpg.Pool = Depends(db_pool),
) -> dict:
    card = await card_service.get_card(pool, user.id)
    return {"card": card.to_dict() if card else None}


@router.post("")
async def save_card(
    body: SaveCardBody = Body(...),
    user: UserRow = Depends(current_user),
    pool: asyncpg.Pool = Depends(db_pool),
) -> dict:
    card = await card_service.save_card(
        pool, user.id, body.pan, body.exp_mmyy, body.holder_name,
    )
    return {"card": card.to_dict()}


@router.delete("", status_code=204)
async def delete_card(
    user: UserRow = Depends(current_user),
    pool: asyncpg.Pool = Depends(db_pool),
) -> None:
    await card_service.delete_card(pool, user.id)
