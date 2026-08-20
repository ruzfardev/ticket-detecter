"""Deliver a ticket PDF to the user through the bot.

Telegram Mini Apps run in a WebView where downloads are commonly blocked, so
handing the file to the chat is the reliable route — it lands as a document the
user can open, save or forward.
"""

from __future__ import annotations

import re

import httpx

from app.core.config import settings
from app.core.logging import logger

TG_DOC_URL = "https://api.telegram.org/bot{token}/sendDocument"

# eticket returns passenger names in a mix of Latin and Cyrillic homoglyphs —
# "FАRRUХ RОZМЕТОV" looks Latin but the А, Х, О, М, Е and Т are Cyrillic. Left
# alone they produce a filename that reads fine yet sorts and searches badly, so
# fold everything to Latin. Uzbek Cyrillic letters are transliterated too, for
# accounts registered with Cyrillic names.
_TRANSLIT = {
    "А": "A", "Б": "B", "В": "V", "Г": "G", "Д": "D", "Е": "E", "Ё": "YO",
    "Ж": "J", "З": "Z", "И": "I", "Й": "Y", "К": "K", "Л": "L", "М": "M",
    "Н": "N", "О": "O", "П": "P", "Р": "R", "С": "S", "Т": "T", "У": "U",
    "Ф": "F", "Х": "X", "Ц": "S", "Ч": "CH", "Ш": "SH", "Щ": "SH", "Ъ": "",
    "Ы": "I", "Ь": "", "Э": "E", "Ю": "YU", "Я": "YA",
    "Ў": "O", "Қ": "Q", "Ғ": "G", "Ҳ": "H", "І": "I", "Ј": "J", "Ѕ": "S",
}
_TRANSLIT.update({k.lower(): v.lower() for k, v in _TRANSLIT.items() if k})

_UNSAFE = re.compile(r"[^A-Za-z0-9_'-]+")

CAPTION_BASE = (
    "🎫 <b>Chiptangiz</b>\n\n"
    "Faylni saqlab qo'ying yoki chop eting.\n"
    "<i>Nazorat paytida shu hujjatni ko'rsatasiz.</i>"
)


def _latinise(text: str) -> str:
    return "".join(_TRANSLIT.get(ch, ch) for ch in (text or ""))


def _slug(name: str) -> str:
    """`"FАRRUХ RОZМЕТОV"` -> `"Farrux_Rozmetov"`."""
    words = [w for w in _latinise(name).split() if w]
    parts = [_UNSAFE.sub("", w.capitalize()) for w in words]
    return "_".join(p for p in parts if p)


def ticket_filename(passenger_names: list[str], order_item_id: str) -> str:
    """Name the file after its passenger(s), falling back to the order id."""
    slugs = [s for s in (_slug(n) for n in passenger_names) if s]
    if not slugs:
        return f"chipta-{order_item_id[-8:]}.pdf"
    stem = "_".join(slugs[:2])
    if len(slugs) > 2:
        stem = f"{stem}_+{len(slugs) - 2}"
    return f"{stem[:80]}.pdf"


async def send_ticket_pdf(
    *, tg_user_id: int, pdf: bytes, filename: str,
    passenger_names: list[str] | None = None,
) -> bool:
    if not settings.bot_token:
        logger.warning("ticket_pdf_no_bot_token")
        return False
    caption = CAPTION_BASE
    if passenger_names:
        who = ", ".join(passenger_names[:3])
        if len(passenger_names) > 3:
            who += f" +{len(passenger_names) - 3}"
        caption = f"🎫 <b>Chipta — {who}</b>\n\n" + CAPTION_BASE.split("\n\n", 1)[1]

    url = TG_DOC_URL.format(token=settings.bot_token)
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.post(
                url,
                data={
                    "chat_id": str(tg_user_id),
                    "caption": caption,
                    "parse_mode": "HTML",
                },
                files={"document": (filename, pdf, "application/pdf")},
            )
        body = r.json()
        if not body.get("ok"):
            logger.warning("ticket_pdf_send_failed",
                           tg_user_id=tg_user_id,
                           error=str(body.get("description"))[:200])
            return False
        return True
    except Exception as exc:
        logger.warning("ticket_pdf_send_exception",
                       tg_user_id=tg_user_id, error=str(exc)[:200])
        return False
