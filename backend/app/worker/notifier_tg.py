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


def _money(amount: int | None) -> str | None:
    """`245140` -> `245 140 so'm` (thin space grouping reads best in TG)."""
    if not amount:
        return None
    return f"{amount:,}".replace(",", " ") + " so'm"


def _seats(seat_numbers: list[int]) -> str:
    return ", ".join(str(s) for s in seat_numbers) if seat_numbers else "—"


def _rule() -> str:
    return "━━━━━━━━━━━━━━━"


async def send_autobuy_otp_needed(
    tg_user_id: int, *, order_id: int, route_name: str,
    travel_date: str, train_number: str, car_number: str,
    seat_numbers: list[int], passenger_names: list[str],
    amount_uzs: int | None, hold_until=None,
) -> int | None:
    """When an autobuy order reaches `awaiting_otp`, ping the user with a
    WebApp button that opens the OTP-entry screen in the mini-app.

    This is the one message the user must act on quickly — the seats are held
    for ~10 minutes — so it leads with the deadline and keeps everything else
    scannable.
    """
    if not settings.bot_token:
        return None
    miniapp = settings.miniapp_url.rstrip("/")
    count = len(seat_numbers) or 1
    # Uzbek keeps the noun singular after a numeral ("2 joy"), but the standalone
    # label is plural when there is more than one.
    seat_word = "Joy" if count == 1 else "Joylar"

    lines = [
        f"🎫 <b>Chipta bron qilindi — {count} joy</b>",
        "<i>To'lovni yakunlash uchun SMS kod kerak</i>",
        _rule(),
        f"📍 <b>{_esc(route_name)}</b>",
        f"📅 {travel_date}",
        f"🚂 {_esc(train_number)} · 🚃 vagon {_esc(car_number)}",
        f"💺 {seat_word}: <b>{_seats(seat_numbers)}</b>",
    ]
    if passenger_names:
        lines.append(f"👤 {_esc(', '.join(passenger_names))}")
    money = _money(amount_uzs)
    if money:
        lines.append(f"💰 <b>{money}</b>")

    mins = _minutes_left(hold_until)
    lines += [
        _rule(),
        f"⏳ Bron <b>{mins} daqiqa</b> saqlanadi"
        if mins else "⏳ Bron cheklangan vaqt saqlanadi",
        "",
        "💳 Bankdan kelgan SMS kodni pastdagi tugma orqali kiriting.",
        "<i>Kod kiritilmasa, bron avtomatik bekor bo'ladi.</i>",
    ]

    payload = {
        "chat_id": tg_user_id,
        "text": "\n".join(lines),
        "parse_mode": "HTML",
        "disable_web_page_preview": True,
        "reply_markup": {
            "inline_keyboard": [[
                {"text": "💳 SMS kodni kiritish",
                 "web_app": {"url": f"{miniapp}/order/{order_id}"}},
            ]]
        },
    }
    return await _send(payload)


async def send_autobuy_terminal(
    tg_user_id: int, *, order_id: int, status: str, route_name: str,
    train_number: str, seat_numbers: list[int],
    travel_date: str | None = None, car_number: str | None = None,
    amount_uzs: int | None = None, failure_reason: str | None = None,
) -> int | None:
    """Notify when an autobuy order reaches a terminal state."""
    if not settings.bot_token:
        return None
    miniapp = settings.miniapp_url.rstrip("/")
    head = {
        "paid":      ("✅", "Chipta sotib olindi!", "Yaxshi yo'l tilaymiz 🎉"),
        "failed":    ("❌", "Sotib olib bo'lmadi", "Joylar qayta bo'shatildi"),
        "expired":   ("⌛", "Bron muddati tugadi", "Kod vaqtida kiritilmadi"),
        "cancelled": ("🚫", "Buyurtma bekor qilindi", "Joylar bo'shatildi"),
    }.get(status, ("ℹ️", status, ""))
    icon, title, tagline = head

    lines = [f"{icon} <b>{title}</b>"]
    if tagline:
        lines.append(f"<i>{tagline}</i>")
    lines += [_rule(), f"📍 <b>{_esc(route_name)}</b>"]
    if travel_date:
        lines.append(f"📅 {travel_date}")
    train_line = f"🚂 {_esc(train_number)}"
    if car_number:
        train_line += f" · 🚃 vagon {_esc(car_number)}"
    lines.append(train_line)
    lines.append(f"💺 Joylar: <b>{_seats(seat_numbers)}</b>")
    money = _money(amount_uzs)
    if money and status == "paid":
        lines.append(f"💰 To'landi: <b>{money}</b>")

    if status == "paid":
        lines += [
            _rule(),
            "🎟 Chipta <b>eticket.railway.uz</b> akkountingizda —",
            "«Mening yangi buyurtmalarim» bo'limida.",
            "",
            "🔕 Bu yo'nalish bo'yicha kuzatuv to'xtatildi.",
        ]
    elif failure_reason and status == "failed":
        lines += [_rule(), f"⚠️ <i>{_esc(failure_reason)}</i>",
                  "", "🔔 Kuzatuv davom etmoqda — yangi joy topilsa xabar beramiz."]
    elif status in ("expired", "cancelled"):
        lines += ["", "🔔 Kuzatuv davom etmoqda — yangi joy topilsa xabar beramiz."]

    payload = {
        "chat_id": tg_user_id,
        "text": "\n".join(lines),
        "parse_mode": "HTML",
        "disable_web_page_preview": True,
        "reply_markup": {
            "inline_keyboard": [[
                {"text": "🧾 Buyurtmani ko'rish",
                 "web_app": {"url": f"{miniapp}/order/{order_id}"}},
            ]]
        },
    }
    return await _send(payload)


def _minutes_left(hold_until) -> int | None:
    if not hold_until:
        return None
    from datetime import datetime, timezone
    try:
        secs = (hold_until - datetime.now(timezone.utc)).total_seconds()
    except TypeError:
        return None
    return max(1, round(secs / 60)) if secs > 0 else None


def _esc(text: str) -> str:
    return (str(text).replace("&", "&amp;")
                     .replace("<", "&lt;")
                     .replace(">", "&gt;"))


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


async def send_autobuy_disarmed(
    tg_user_id: int, *, subscription_id: int, route_name: str,
    travel_date: str, failures: int,
) -> int | None:
    """Auto-buy switched itself off after repeated failures.

    Says plainly that watching continues, so the user does not think the whole
    subscription died.
    """
    if not settings.bot_token:
        return None
    miniapp = settings.miniapp_url.rstrip("/")
    text = "\n".join([
        "⚠️ <b>Avto sotib olish o'chirildi</b>",
        f"<i>Ketma-ket {failures} marta muvaffaqiyatsiz urinish</i>",
        _rule(),
        f"📍 <b>{_esc(route_name)}</b>",
        f"📅 {travel_date}",
        _rule(),
        "🔔 <b>Kuzatuv davom etmoqda</b> — joy topilsa xabar beramiz,",
        "faqat avtomatik bron qilinmaydi.",
        "",
        "Sababi odatda: karta, eticket akkount yoki",
        "SMS kod vaqtida kiritilmagani.",
        "",
        "Tekshirib, qaytadan yoqishingiz mumkin 👇",
    ])
    payload = {
        "chat_id": tg_user_id,
        "text": text,
        "parse_mode": "HTML",
        "disable_web_page_preview": True,
        "reply_markup": {
            "inline_keyboard": [[
                {"text": "⚡️ Qayta yoqish",
                 "web_app": {"url": f"{miniapp}/sub/{subscription_id}/autobuy"}},
            ]]
        },
    }
    return await _send(payload)
