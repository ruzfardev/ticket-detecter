"""POST /api/v1/auth/tg — verify initData and upsert user."""

from __future__ import annotations

import asyncpg
from fastapi import APIRouter, Depends

from app.api.deps import current_tg_user, db_pool
from app.auth.init_data import TgUser
from app.services import user_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/tg")
async def auth_tg(
    tg_user: TgUser = Depends(current_tg_user),
    pool: asyncpg.Pool = Depends(db_pool),
) -> dict:
    user, is_new = await user_service.upsert_from_tg(pool, tg_user)
    slot = await user_service.get_slot_stats(pool, user.id)

    return {
        "user": {
            "id": user.id,
            "tg_user_id": user.tg_user_id,
            "first_name": tg_user.first_name,
            "lang": user.lang,
            "tier": user.tier,
            "premium_until": user.premium_until.isoformat() if user.premium_until else None,
        },
        "slot": {"max": slot.max, "used": slot.used},
        "is_new": is_new,
    }
