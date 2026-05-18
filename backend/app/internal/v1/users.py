"""POST /internal/v1/users/upsert — called by bot on /start."""

from __future__ import annotations

import asyncpg
from fastapi import APIRouter, Body, Depends
from pydantic import BaseModel

from app.api.deps import db_pool, require_internal_jwt
from app.auth.init_data import TgUser
from app.services import user_service

router = APIRouter(prefix="/users", tags=["internal-users"])


class UpsertBody(BaseModel):
    tg_user_id: int
    tg_username: str = ""
    first_name: str = ""
    last_name: str = ""
    language_code: str = "uz"


@router.post("/upsert", dependencies=[Depends(require_internal_jwt)])
async def upsert(
    body: UpsertBody = Body(...),
    pool: asyncpg.Pool = Depends(db_pool),
) -> dict:
    fake_tg = TgUser(
        id=body.tg_user_id,
        first_name=body.first_name,
        last_name=body.last_name,
        username=body.tg_username,
        language_code=body.language_code,
    )
    user, is_new = await user_service.upsert_from_tg(pool, fake_tg)
    return {
        "user": {
            "id": user.id,
            "tg_user_id": user.tg_user_id,
            "lang": user.lang,
            "tier": user.tier,
        },
        "is_new": is_new,
    }
