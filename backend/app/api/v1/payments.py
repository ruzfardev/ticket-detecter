"""Payment-related endpoints (Mini App)."""

from __future__ import annotations

import asyncpg
from fastapi import APIRouter, Depends, Query

from app.api.deps import current_user, db_pool
from app.services import payments
from app.services.plans import all_plans_payload
from app.services.user_service import UserRow

router = APIRouter(prefix="/payments", tags=["payments"])


@router.get("/plans")
async def list_plans(
    user: UserRow = Depends(current_user),
) -> dict:
    return all_plans_payload(lang=user.lang)


@router.get("/invoice")
async def get_invoice(
    plan: str = Query(..., min_length=3, max_length=64),
    amount: int | None = Query(default=None, ge=10, le=5000),
    user: UserRow = Depends(current_user),
) -> dict:
    return await payments.create_invoice_link(user.id, plan, amount_override=amount)


@router.get("/history")
async def get_history(
    limit: int = Query(default=20, ge=1, le=100),
    user: UserRow = Depends(current_user),
    pool: asyncpg.Pool = Depends(db_pool),
) -> dict:
    return {"payments": await payments.list_history(pool, user.id, limit)}
