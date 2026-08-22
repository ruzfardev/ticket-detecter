"""GET /api/v1/me — profile + slot stats. PATCH /api/v1/me — update lang."""

from __future__ import annotations

import asyncpg
from fastapi import APIRouter, Body, Depends
from pydantic import BaseModel, Field

from app.core.config import settings
from app.api.deps import current_user, db_pool
from app.services import user_service
from app.services.user_service import UserRow

router = APIRouter(prefix="/me", tags=["me"])


def _watcher_interval(tier: str) -> int:
    return (settings.watcher_premium_interval_s if tier == "premium"
            else settings.watcher_free_interval_s)


class UpdateMe(BaseModel):
    lang: str = Field(pattern=r"^(uz|ru|en)$")


@router.get("")
async def get_me(
    user: UserRow = Depends(current_user),
    pool: asyncpg.Pool = Depends(db_pool),
) -> dict:
    slot = await user_service.get_slot_stats(pool, user.id)
    return {
        "user": {
            "id": user.id,
            "tg_user_id": user.tg_user_id,
            "lang": user.lang,
            "tier": user.tier,
            "premium_until": user.premium_until.isoformat() if user.premium_until else None,
        },
        "slot": {"max": slot.max, "used": slot.used},
        # Poll cadence for this tier — shown on Home so premium reads as speed.
        "watcher": {"interval_s": _watcher_interval(user.tier)},
    }


@router.patch("")
async def update_me(
    payload: UpdateMe = Body(...),
    user: UserRow = Depends(current_user),
    pool: asyncpg.Pool = Depends(db_pool),
) -> dict:
    await user_service.update_lang(pool, user.id, payload.lang)
    return {"ok": True, "lang": payload.lang}
