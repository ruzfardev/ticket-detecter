"""Hamrohlar (companions) endpoints."""

from __future__ import annotations

import asyncpg
from fastapi import APIRouter, Depends

from app.api.deps import current_user, db_pool
from app.services import friend_sync_service
from app.services.user_service import UserRow

router = APIRouter(prefix="/friends", tags=["friends"])


@router.get("")
async def list_friends(
    user: UserRow = Depends(current_user),
    pool: asyncpg.Pool = Depends(db_pool),
) -> dict:
    friends = await friend_sync_service.list_for_user(pool, user.id)
    return {"friends": [f.to_dict() for f in friends]}


@router.post("/sync")
async def sync_friends(
    user: UserRow = Depends(current_user),
    pool: asyncpg.Pool = Depends(db_pool),
) -> dict:
    friends = await friend_sync_service.sync_friends(pool, user.id, force=False)
    return {"friends": [f.to_dict() for f in friends]}
