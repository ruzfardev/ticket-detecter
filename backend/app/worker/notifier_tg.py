"""
Telegram sender for the watcher.

Worker calls Telegram Bot API directly (no bot dispatcher needed).
Returns message_id on success, None on failure.
"""

from __future__ import annotations

import httpx

from app.core.config import settings
from app.core.logging import logger

TG_SEND_URL = "https://api.telegram.org/bot{token}/sendMessage"


async def send_alert(tg_user_id: int, html: str, *, sub_id: int) -> int | None:
    if not settings.bot_token:
        logger.warning("send_alert_skipped_no_bot_token")
        return None

    payload = {
        "chat_id": tg_user_id,
        "text": html,
        "parse_mode": "HTML",
        "disable_web_page_preview": True,
        "reply_markup": {
            "inline_keyboard": [[
                {"text": "🔇 10 daq",  "callback_data": f"mute_sub:{sub_id}:600"},
                {"text": "🔇 1 soat",  "callback_data": f"mute_sub:{sub_id}:3600"},
                {"text": "🗑",         "callback_data": f"del_sub:{sub_id}"},
            ]]
        },
    }
    return await _send(payload)


async def send_autobuy_otp_needed(
    tg_user_id: int, *, order_id: int, route_name: str,
    travel_date: str, train_number: str, car_number: str, seat_number: int,
    amount_uzs: int | None,
) -> int | None:
    """When an autobuy order reaches `awaiting_otp`, ping the user with a
    WebApp button that opens the OTP-entry screen in the mini-app."""
    if not settings.bot_token:
        return None
    miniapp = settings.miniapp_url.rstrip("/")
    amount_line = (f"\n💰 <b>{amount_uzs:,}</b> so'm".replace(",", " ")
                   if amount_uzs else "")
    text = (
        "🎫 <b>Chipta topildi va bron qilindi!</b>\n\n"
        f"📍 {route_name} · {travel_date}\n"
        f"🚂 {train_number} · Vagon {car_number} · Joy {seat_number}"
        f"{amount_line}\n\n"
        "💳 To'lov SMS kodi telefoningizga keldi.\n"
        "Quyidagi tugmani bosib OTP'ni kiriting."
    )
    payload = {
        "chat_id": tg_user_id,
        "text": text,
        "parse_mode": "HTML",
        "disable_web_page_preview": True,
        "reply_markup": {
            "inline_keyboard": [[
                {"text": "💳 OTP kiriting",
                 "web_app": {"url": f"{miniapp}/order/{order_id}"}},
            ]]
        },
    }
    return await _send(payload)


async def send_autobuy_terminal(
    tg_user_id: int, *, order_id: int, status: str, route_name: str,
    train_number: str, seat_number: int, failure_reason: str | None = None,
) -> int | None:
    """Notify when an autobuy order reaches a terminal state."""
    if not settings.bot_token:
        return None
    icon = {"paid": "✅", "failed": "❌", "expired": "⌛", "cancelled": "🚫"}.get(status, "ℹ️")
    title = {
        "paid":     "Chipta sotib olindi",
        "failed":   "Sotib olishda xato",
        "expired":  "Bron muddati o'tdi",
        "cancelled":"Buyurtma bekor qilindi",
    }.get(status, status)
    extra = f"\n<i>{failure_reason}</i>" if failure_reason and status == "failed" else ""
    text = (
        f"{icon} <b>{title}</b>\n\n"
        f"📍 {route_name}\n"
        f"🚂 {train_number} · Joy {seat_number}{extra}"
    )
    payload = {
        "chat_id": tg_user_id,
        "text": text,
        "parse_mode": "HTML",
        "disable_web_page_preview": True,
    }
    return await _send(payload)


async def _send(payload: dict) -> int | None:
    url = TG_SEND_URL.format(token=settings.bot_token)
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(url, json=payload)
        data = r.json()
        if not data.get("ok"):
            logger.warning("send_alert_failed", error=data.get("description"))
            return None
        return data["result"].get("message_id")
    except Exception as e:
        logger.warning("send_alert_exception", error=str(e))
        return None
