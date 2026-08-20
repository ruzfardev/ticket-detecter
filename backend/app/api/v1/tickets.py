"""Purchased tickets from the user's eticket cabinet.

Distinct from `/orders`, which tracks OUR auto-buy attempts. This is what the
user actually owns on eticket — including tickets bought outside this bot.

The PDF is delivered through the Telegram bot as a document rather than as an
HTTP download: a Mini App runs inside a WebView where file downloads are
routinely blocked, whereas a document lands in the chat and can be saved or
forwarded like any other file.
"""

from __future__ import annotations

import asyncpg
from fastapi import APIRouter, Body, Depends
from pydantic import BaseModel

from app.api.deps import current_user, db_pool
from app.core.errors import AppError, InvalidPayload, NotFound
from app.core.logging import logger
from app.railway import user_auth
from app.railway.user_client import RailwayUserClient
from app.services.user_service import UserRow

router = APIRouter(prefix="/tickets", tags=["tickets"])


class SendPdfBody(BaseModel):
    order_item_id: str
    created_at: str          # exactly as returned by the list endpoint


async def _require_linked(pool: asyncpg.Pool, user_id: int) -> None:
    account = await user_auth.get_account(pool, user_id)
    if account is None or account.link_status != "active":
        raise user_auth.RailwayAccountRequired("eticket account not linked")


@router.get("")
async def list_tickets(
    user: UserRow = Depends(current_user),
    pool: asyncpg.Pool = Depends(db_pool),
) -> dict:
    await _require_linked(pool, user.id)
    client = RailwayUserClient(pool, user.id)
    tickets = await client.list_purchased()
    return {
        "tickets": [
            {
                "order_id": t.order_id,
                "order_item_id": t.order_item_id,
                "created_at": t.created_at,
                "final_status": t.final_status,
                "amount_uzs": t.amount_uzs,
                "train_number": t.train_number,
                "car_number": t.car_number,
                "car_type": t.car_type,
                "dep_station": t.dep_station,
                "arr_station": t.arr_station,
                "dep_at": t.dep_at,
                "arr_at": t.arr_at,
                "seats": t.seats,
                "qr_url": t.qr_url,
            }
            for t in tickets
        ]
    }


@router.post("/detail")
async def ticket_detail(
    body: SendPdfBody = Body(...),
    user: UserRow = Depends(current_user),
    pool: asyncpg.Pool = Depends(db_pool),
) -> dict:
    """Passengers and per-ticket status for one leg."""
    await _require_linked(pool, user.id)
    client = RailwayUserClient(pool, user.id)
    raw = await client.get_purchased_detail(body.order_item_id, body.created_at)
    tickets = []
    for t in (raw.get("tickets") or []):
        p = t.get("passenger") or {}
        tickets.append({
            "ticket_id": str(t.get("ticketId") or ""),
            "status": str(t.get("status") or ""),
            "seat_number": str(t.get("seatNumber") or ""),
            "amount_uzs": int(float(t.get("tariffAmount") or 0)),
            "passenger_name": " ".join(
                x for x in (p.get("firstname"), p.get("lastname")) if x
            ).strip(),
        })
    return {
        "tickets": tickets,
        "return_available_until": raw.get("onlineReturnAvailabilityTime"),
    }


@router.post("/pdf/send")
async def send_pdf_to_chat(
    body: SendPdfBody = Body(...),
    user: UserRow = Depends(current_user),
    pool: asyncpg.Pool = Depends(db_pool),
) -> dict:
    """Fetch the ticket PDF and deliver it via the bot as a document."""
    await _require_linked(pool, user.id)
    client = RailwayUserClient(pool, user.id)
    blob = await client.get_purchased_pdf(body.order_item_id, body.created_at)

    from app.services.ticket_delivery import send_ticket_pdf
    ok = await send_ticket_pdf(
        tg_user_id=user.tg_user_id,
        pdf=blob,
        filename=f"chipta-{body.order_item_id[-8:]}.pdf",
    )
    if not ok:
        raise AppError("Could not deliver the ticket to Telegram")
    logger.info("ticket_pdf_sent", user_id=user.id,
                order_item_id=body.order_item_id, bytes=len(blob))
    return {"sent": True}
