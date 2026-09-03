"""Purchased tickets from the user's eticket cabinet.

Distinct from `/orders`, which tracks OUR auto-buy attempts. This is what the
user actually owns on eticket — including tickets bought outside this bot.

The PDF is delivered through the Telegram bot as a document rather than as an
HTTP download: a Mini App runs inside a WebView where file downloads are
routinely blocked, whereas a document lands in the chat and can be saved or
forwarded like any other file.
"""

from __future__ import annotations

import asyncio
import re
import time

import asyncpg
from fastapi import APIRouter, Body, Depends, Query
from pydantic import BaseModel

from app.api.deps import current_user, db_pool
from app.core.errors import AppError, InvalidPayload, NotFound
from app.core.logging import logger
from app.railway import user_auth
from app.railway.user_client import PurchasedTicket, RailwayUserClient
from app.services.ticket_status import (  # noqa: F401 — re-exported for tests
    RETURNED, TERMINAL, is_returned, summarize_tickets,
)
from app.services.user_service import UserRow

router = APIRouter(prefix="/tickets", tags=["tickets"])

# eticket keys its archive by calendar month — the month the ticket was
# bought, not travelled: a 1 September trip ordered on 20 August sits in
# 2026-08, and 2026-09 comes back empty.
MONTH_RE = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")

# Per-ticket status exists only on the detail endpoint, so listing N legs costs
# N+1 eticket calls. Terminal answers are kept for a day; live ones only
# briefly, so a return made on eticket shows up here within a minute or two.
_TERMINAL_TTL = 24 * 3600
_LIVE_TTL = 90
_CACHE_MAX = 5000
_status_cache: dict[str, tuple[float, list[dict]]] = {}
_DETAIL_CONCURRENCY = 4


class SendPdfBody(BaseModel):
    order_item_id: str
    created_at: str          # exactly as returned by the list endpoint
    archived: bool = False   # as returned by the list endpoint, too


async def _require_linked(pool: asyncpg.Pool, user_id: int) -> None:
    account = await user_auth.get_account(pool, user_id)
    if account is None or account.link_status != "active":
        raise user_auth.RailwayAccountRequired("eticket account not linked")


@router.get("")
async def list_tickets(
    user: UserRow = Depends(current_user),
    pool: asyncpg.Pool = Depends(db_pool),
) -> dict:
    """Upcoming trips — eticket's active list holds nothing else. Returned
    tickets stay in it until the travel date, flagged per leg here."""
    await _require_linked(pool, user.id)
    client = RailwayUserClient(pool, user.id)
    tickets = await client.list_purchased()
    return {"tickets": await _with_tickets(client, tickets)}


@router.get("/archive")
async def list_archived_tickets(
    month: str = Query(..., description="Calendar month, YYYY-MM"),
    user: UserRow = Depends(current_user),
    pool: asyncpg.Pool = Depends(db_pool),
) -> dict:
    """Past trips for one month. eticket archives a trip once it is over and
    serves the archive only month by month, hence the required filter."""
    if not MONTH_RE.match(month):
        raise InvalidPayload("month must be YYYY-MM")
    await _require_linked(pool, user.id)
    client = RailwayUserClient(pool, user.id)
    tickets = await client.list_archived(month)
    return {"month": month, "tickets": await _with_tickets(client, tickets)}


async def _tickets_of(
    client: RailwayUserClient, leg: PurchasedTicket, sem: asyncio.Semaphore,
) -> list[dict]:
    now = time.monotonic()
    hit = _status_cache.get(leg.order_item_id)
    if hit and hit[0] > now:
        return hit[1]
    async with sem:
        raw = await client.get_purchased_detail(
            leg.order_item_id, leg.created_at, archived=leg.archived,
        )
    tickets = summarize_tickets(raw)
    settled = bool(tickets) and all(t["status"] in TERMINAL for t in tickets)
    if len(_status_cache) >= _CACHE_MAX:
        for k in [k for k, (exp, _) in _status_cache.items() if exp <= now]:
            _status_cache.pop(k, None)
    _status_cache[leg.order_item_id] = (
        now + (_TERMINAL_TTL if settled else _LIVE_TTL), tickets,
    )
    return tickets


async def _with_tickets(
    client: RailwayUserClient, legs: list[PurchasedTicket],
) -> list[dict]:
    """Serialize legs with their per-ticket status attached.

    A failed lookup is reported as `status_known: false` rather than failing
    the whole list — the trip itself is still worth showing.
    """
    sem = asyncio.Semaphore(_DETAIL_CONCURRENCY)

    async def one(leg: PurchasedTicket) -> dict:
        d = _leg(leg)
        try:
            tickets = await _tickets_of(client, leg, sem)
            d.update(tickets=tickets, returned=is_returned(tickets),
                     status_known=True)
        except Exception as exc:
            logger.info("ticket_status_lookup_failed",
                        order_item_id=leg.order_item_id, error=str(exc)[:120])
            d.update(tickets=[], returned=False, status_known=False)
        return d

    return list(await asyncio.gather(*(one(leg) for leg in legs)))


def _leg(t: PurchasedTicket) -> dict:
    return {
        "archived": t.archived,
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


@router.post("/detail")
async def ticket_detail(
    body: SendPdfBody = Body(...),
    user: UserRow = Depends(current_user),
    pool: asyncpg.Pool = Depends(db_pool),
) -> dict:
    """Passengers and per-ticket status for one leg."""
    await _require_linked(pool, user.id)
    client = RailwayUserClient(pool, user.id)
    raw = await client.get_purchased_detail(
        body.order_item_id, body.created_at, archived=body.archived,
    )
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
    """Fetch the ticket PDF and deliver it via the bot as a document.

    The passenger name only exists on the detail endpoint, so that is fetched
    too — a file called "Farrux_Rozmetov.pdf" is worth one extra request when
    someone is holding several tickets in one chat.
    """
    await _require_linked(pool, user.id)
    client = RailwayUserClient(pool, user.id)

    names: list[str] = []
    try:
        detail = await client.get_purchased_detail(
            body.order_item_id, body.created_at, archived=body.archived,
        )
        for t in (detail.get("tickets") or []):
            p = t.get("passenger") or {}
            full = " ".join(
                str(x) for x in (p.get("firstname"), p.get("lastname")) if x
            ).strip()
            if full:
                names.append(full)
    except Exception as exc:
        # Naming is a nicety; never fail the download over it.
        logger.info("ticket_pdf_name_lookup_skipped",
                    order_item_id=body.order_item_id, error=str(exc)[:120])

    blob = await client.get_purchased_pdf(body.order_item_id, body.created_at)

    from app.services.ticket_delivery import send_ticket_pdf, ticket_filename
    ok = await send_ticket_pdf(
        tg_user_id=user.tg_user_id,
        pdf=blob,
        filename=ticket_filename(names, body.order_item_id),
        passenger_names=names,
    )
    if not ok:
        raise AppError("Could not deliver the ticket to Telegram")
    logger.info("ticket_pdf_sent", user_id=user.id,
                order_item_id=body.order_item_id, bytes=len(blob),
                passengers=len(names))
    return {"sent": True}
