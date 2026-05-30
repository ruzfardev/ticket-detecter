"""Per-user eticket.railway.uz account link/unlink/status endpoints."""

from __future__ import annotations

import asyncpg
from fastapi import APIRouter, Body, Depends
from pydantic import BaseModel, Field

from app.api.deps import current_user, db_pool
from app.services import railway_account_service
from app.services.user_service import UserRow

router = APIRouter(prefix="/railway-account", tags=["railway-account"])


class LinkBody(BaseModel):
    username: str = Field(..., min_length=3, max_length=128)
    password: str = Field(..., min_length=4, max_length=200)


@router.post("/link")
async def link(
    body: LinkBody = Body(...),
    user: UserRow = Depends(current_user),
    pool: asyncpg.Pool = Depends(db_pool),
) -> dict:
    status = await railway_account_service.link(pool, user.id, body.username, body.password)
    return {"account": status.to_dict()}


@router.post("/unlink")
async def unlink(
    user: UserRow = Depends(current_user),
    pool: asyncpg.Pool = Depends(db_pool),
) -> dict:
    status = await railway_account_service.unlink(pool, user.id)
    return {"account": status.to_dict()}


@router.get("/status")
async def get_status(
    user: UserRow = Depends(current_user),
    pool: asyncpg.Pool = Depends(db_pool),
) -> dict:
    status = await railway_account_service.get_status(pool, user.id)
    return {"account": status.to_dict()}
