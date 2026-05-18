"""GET /api/v1/stations — autocomplete for Mini App station picker."""

from __future__ import annotations

import asyncpg
from fastapi import APIRouter, Depends, Query

from app.api.deps import current_user, db_pool
from app.services.user_service import UserRow

router = APIRouter(prefix="/stations", tags=["stations"])


@router.get("")
async def list_stations(
    q: str = Query("", max_length=64),
    lang: str = Query("uz", pattern="^(uz|ru|en)$"),
    user: UserRow = Depends(current_user),
    pool: asyncpg.Pool = Depends(db_pool),
) -> dict:
    name_col = {"uz": "name_uz", "ru": "name_ru", "en": "COALESCE(name_en, name_uz)"}[lang]
    if q:
        rows = await pool.fetch(
            f"""
            SELECT code, name_uz, name_ru, name_en, city,
                   similarity({name_col}, $1) AS score
            FROM stations
            WHERE is_active AND ({name_col} ILIKE '%' || $1 || '%')
            ORDER BY score DESC, name_uz
            LIMIT 30
            """,
            q,
        )
    else:
        rows = await pool.fetch(
            """
            SELECT code, name_uz, name_ru, name_en, city
            FROM stations WHERE is_active
            ORDER BY name_uz LIMIT 100
            """
        )
    return {
        "stations": [
            {
                "code": r["code"],
                "name": r[f"name_{lang}"] if lang != "en" else (r["name_en"] or r["name_uz"]),
                "name_uz": r["name_uz"],
                "name_ru": r["name_ru"],
                "city": r["city"],
            }
            for r in rows
        ]
    }
