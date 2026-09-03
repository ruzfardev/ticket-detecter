"""Remind a traveller before departure, with the ticket attached.

The worker calls `run()` every `trip_reminder_sweep_s` seconds (see
app/worker/main.py). For every user with a linked eticket account it lists the
active tickets and sends two reminders per leg:

    t24   24 h before departure  — "tomorrow you travel", PDF attached
    t2     2 h before departure  — "leave for the station", PDF attached

Windows rather than instants, so a sweep that was late or a worker that was
restarted still catches up: t24 fires anywhere in (20 h, 24 h] before
departure, t2 in (30 min, 2 h]. `trip_reminders` (unique per user, leg and
kind) is claimed before anything is sent, which is what makes a double send
impossible; a returned ticket claims its slot too, as `skipped_returned`, so it
is not re-checked every ten minutes.

Still runnable by hand:
    python -m app.tasks.trip_reminders
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone

import asyncpg

from app.core.config import settings
from app.core.logging import configure_logging, logger
from app.db import close_pool, get_pool, init_pool
from app.railway.user_client import PurchasedTicket, RailwayUserClient
from app.services.ticket_delivery import send_ticket_pdf, ticket_filename
from app.services.ticket_status import is_returned, summarize_tickets
from app.worker.notifier_tg import _esc, _send

# eticket timestamps are Tashkent wall clock without an offset; Uzbekistan has
# no DST, so a fixed +5 is exact.
TASHKENT = timezone(timedelta(hours=5))

# kind -> (fires when time-to-departure is at most, and more than)
WINDOWS: dict[str, tuple[timedelta, timedelta]] = {
    "t2":  (timedelta(hours=2),  timedelta(minutes=30)),
    "t24": (timedelta(hours=24), timedelta(hours=20)),
}

# One list call per linked user per sweep; cap so a big user base is spread
# over several sweeps rather than hammered in one.
USERS_PER_SWEEP = 500


def parse_dep_at(raw: str) -> datetime | None:
    """`"2026-10-15 17:20:00"` (Tashkent wall clock) -> aware datetime."""
    try:
        return datetime.strptime((raw or "").strip(), "%Y-%m-%d %H:%M:%S").replace(tzinfo=TASHKENT)
    except ValueError:
        return None


def due_kind(dep_at: datetime, now: datetime) -> str | None:
    """Which reminder, if any, is due for a departure at `dep_at`.

    The nearer window wins when both would match, which cannot happen with the
    windows above but keeps the order explicit.
    """
    left = dep_at - now
    if left <= timedelta(0):
        return None
    for kind, (at_most, more_than) in WINDOWS.items():
        if more_than < left <= at_most:
            return kind
    return None


def _msg(lang: str, kind: str, leg: PurchasedTicket, names: list[str]) -> str:
    dep_date = leg.dep_at[:10]
    d = f"{dep_date[8:10]}.{dep_date[5:7]}.{dep_date[0:4]}" if len(dep_date) == 10 else dep_date
    when = f"{d} · {leg.dep_at[11:16]}"
    seats = ", ".join(s for s in leg.seats if s) or "—"
    route = f"{_esc(leg.dep_station)} → {_esc(leg.arr_station)}"
    who = ", ".join(_esc(n) for n in names if n)

    if lang == "ru":
        head = "🚂 <b>Завтра поездка</b>" if kind == "t24" else "⏰ <b>Отправление через 2 часа</b>"
        body = [f"📍 {route}", f"📅 {when}",
                f"🚆 Поезд {_esc(leg.train_number)} · вагон {_esc(leg.car_number)} · место {seats}"]
        if who:
            body.append(f"👤 {who}")
        tail = "<i>PDF билета ниже.</i>" if kind == "t24" else "Приезжайте на вокзал заранее. <i>PDF билета ниже.</i>"
    elif lang == "en":
        head = "🚂 <b>You travel tomorrow</b>" if kind == "t24" else "⏰ <b>Departure in 2 hours</b>"
        body = [f"📍 {route}", f"📅 {when}",
                f"🚆 Train {_esc(leg.train_number)} · car {_esc(leg.car_number)} · seat {seats}"]
        if who:
            body.append(f"👤 {who}")
        tail = "<i>Ticket PDF below.</i>" if kind == "t24" else "Get to the station early. <i>Ticket PDF below.</i>"
    else:
        head = "🚂 <b>Ertaga safar</b>" if kind == "t24" else "⏰ <b>2 soatdan keyin jo'nash</b>"
        body = [f"📍 {route}", f"📅 {when}",
                f"🚆 Poyezd {_esc(leg.train_number)} · vagon {_esc(leg.car_number)} · joy {seats}"]
        if who:
            body.append(f"👤 {who}")
        tail = "<i>Chipta PDF quyida.</i>" if kind == "t24" else "Vokzalga oldindan yeting. <i>Chipta PDF quyida.</i>"
    return "\n".join([head, "", *body, "", tail])


def _button(lang: str) -> dict:
    text = {"ru": "🎫 Мои билеты", "en": "🎫 My tickets"}.get(lang, "🎫 Chiptalarim")
    miniapp = settings.miniapp_url.rstrip("/")
    return {"inline_keyboard": [[{"text": text, "web_app": {"url": f"{miniapp}/tickets"}}]]}


async def _claim(pool: asyncpg.Pool, user_id: int, leg: PurchasedTicket,
                 kind: str, dep_at: datetime, status: str) -> bool:
    row = await pool.fetchrow(
        """
        INSERT INTO trip_reminders (user_id, order_item_id, kind, dep_at, status)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (user_id, order_item_id, kind) DO NOTHING
        RETURNING id
        """,
        user_id, leg.order_item_id, kind, dep_at, status,
    )
    return row is not None


async def _sweep_user(pool: asyncpg.Pool, user: asyncpg.Record) -> int:
    client = RailwayUserClient(pool, user["id"])
    legs = await client.list_purchased()
    now = datetime.now(TASHKENT)
    sent = 0
    for leg in legs:
        dep_at = parse_dep_at(leg.dep_at)
        if dep_at is None:
            continue
        kind = due_kind(dep_at, now)
        if kind is None:
            continue
        already = await pool.fetchval(
            "SELECT 1 FROM trip_reminders WHERE user_id = $1 AND order_item_id = $2 AND kind = $3",
            user["id"], leg.order_item_id, kind,
        )
        if already:
            continue

        # The list carries no status; only the detail says whether the ticket
        # was returned. It also hands us the passenger names for the message.
        raw = await client.get_purchased_detail(
            leg.order_item_id, leg.created_at, archived=leg.archived,
        )
        tickets = summarize_tickets(raw)
        if is_returned(tickets):
            await _claim(pool, user["id"], leg, kind, dep_at, "skipped_returned")
            continue
        if not await _claim(pool, user["id"], leg, kind, dep_at, "sent"):
            continue   # another sweep got there first

        names = [t["passenger_name"] for t in tickets if t["passenger_name"]]
        lang = user["lang"] or "uz"
        msg_id = await _send({
            "chat_id": user["tg_user_id"],
            "text": _msg(lang, kind, leg, names),
            "parse_mode": "HTML",
            "disable_web_page_preview": True,
            "reply_markup": _button(lang),
        })
        if msg_id is None:
            # Telegram refused (blocked bot, network); release the slot so the
            # next sweep retries while the window is still open.
            await pool.execute(
                "DELETE FROM trip_reminders WHERE user_id = $1 AND order_item_id = $2 AND kind = $3",
                user["id"], leg.order_item_id, kind,
            )
            continue
        sent += 1

        pdf_ok = False
        try:
            blob = await client.get_purchased_pdf(leg.order_item_id, leg.created_at)
            pdf_ok = await send_ticket_pdf(
                tg_user_id=user["tg_user_id"], pdf=blob,
                filename=ticket_filename(names, leg.order_item_id),
                passenger_names=names,
            )
        except Exception as exc:
            logger.info("trip_reminder_pdf_skipped", user_id=user["id"],
                        order_item_id=leg.order_item_id, error=str(exc)[:120])
        if pdf_ok:
            await pool.execute(
                "UPDATE trip_reminders SET pdf_sent = TRUE "
                "WHERE user_id = $1 AND order_item_id = $2 AND kind = $3",
                user["id"], leg.order_item_id, kind,
            )
        logger.info("trip_reminder_sent", user_id=user["id"], kind=kind,
                    order_item_id=leg.order_item_id, dep_at=leg.dep_at, pdf=pdf_ok)
    return sent


async def run(pool: asyncpg.Pool) -> int:
    """One sweep over linked users. Returns how many reminders went out."""
    if not settings.bot_token:
        return 0
    users = await pool.fetch(
        """
        SELECT u.id, u.tg_user_id, u.lang
        FROM user_railway_accounts a
        JOIN users u ON u.id = a.user_id
        WHERE a.link_status = 'active'
          AND (a.cooldown_until IS NULL OR a.cooldown_until < now())
        ORDER BY u.id
        LIMIT $1
        """,
        USERS_PER_SWEEP,
    )
    sent = 0
    for u in users:
        try:
            sent += await _sweep_user(pool, u)
        except Exception as exc:
            # One revoked or cooling-down account must not stop the others.
            logger.warning("trip_reminder_user_skipped", user_id=u["id"],
                           error=str(exc)[:160])
    return sent


async def amain() -> None:
    configure_logging()
    await init_pool(min_size=1, max_size=2)
    try:
        n = await run(get_pool())
        logger.info("trip_reminders_done", sent=n)
    finally:
        await close_pool()


if __name__ == "__main__":
    asyncio.run(amain())
