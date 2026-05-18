"""Internal payment endpoints — called by the bot during Stars flow."""

from __future__ import annotations

import asyncpg
from fastapi import APIRouter, Body, Depends
from pydantic import BaseModel

from app.api.deps import db_pool, require_internal_jwt
from app.services import payments

router = APIRouter(prefix="/payments", tags=["internal-payments"])


class PrecheckReq(BaseModel):
    tg_user_id: int
    invoice_payload: str
    stars_amount: int


class SuccessReq(BaseModel):
    tg_user_id: int
    tg_payment_charge_id: str
    provider_charge_id: str | None = None
    invoice_payload: str
    stars_amount: int
    raw: dict = {}


@router.post("/precheck", dependencies=[Depends(require_internal_jwt)])
async def precheck(
    body: PrecheckReq = Body(...),
    pool: asyncpg.Pool = Depends(db_pool),
) -> dict:
    return await payments.precheck(pool, body.tg_user_id, body.invoice_payload, body.stars_amount)


@router.post("/successful", dependencies=[Depends(require_internal_jwt)])
async def successful(
    body: SuccessReq = Body(...),
    pool: asyncpg.Pool = Depends(db_pool),
) -> dict:
    return await payments.record_success(
        pool=pool,
        tg_user_id=body.tg_user_id,
        tg_payment_charge_id=body.tg_payment_charge_id,
        provider_charge_id=body.provider_charge_id,
        invoice_payload=body.invoice_payload,
        stars_amount=body.stars_amount,
        raw=body.raw,
    )
