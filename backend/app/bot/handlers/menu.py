"""
Handle taps on the persistent reply keyboard.

Each menu label (in any of 3 languages) routes to its handler. We compare
against the i18n table so users can change language without breaking
button routing.
"""

from __future__ import annotations

from aiogram import F, Router
from aiogram.types import Message

from app.bot.handlers._helpers import ensure_user
from app.bot.i18n import t
from app.bot.keyboards import channel_link, main_menu
from app.db import get_pool
from app.services import user_service

router = Router()


# Build "label-to-action" lookup once at import time, covering all 3 languages.
def _label_set(key: str) -> set[str]:
    return {t(key, lang) for lang in ("uz", "ru", "en")}


_LABELS_NOTIFS  = _label_set("menu.notifs")
_LABELS_PREMIUM = _label_set("menu.premium")
_LABELS_DONATE  = _label_set("menu.donate")
_LABELS_CHANNEL = _label_set("menu.channel")
_LABELS_HELP    = _label_set("menu.help")
_LABELS_CONTACT = _label_set("menu.contact")
_LABELS_STATUS  = _label_set("menu.status")
_LABELS_ORDERS  = _label_set("menu.orders")


@router.message(F.text.in_(_LABELS_NOTIFS))
async def on_notifs(message: Message) -> None:
    user = await ensure_user(message.from_user)
    pool = get_pool()
    slot = await user_service.get_slot_stats(pool, user.id)

    rows = await pool.fetch(
        """
        SELECT s.id, s.dep_code, s.arr_code, s.travel_date, s.train_numbers,
               s.car_types, s.berth,
               sd.name_uz AS dep_name, sa.name_uz AS arr_name
        FROM subscriptions s
        JOIN stations sd ON sd.code = s.dep_code
        JOIN stations sa ON sa.code = s.arr_code
        WHERE s.user_id = $1 AND s.is_active
        ORDER BY s.travel_date, s.created_at
        """,
        user.id,
    )

    if not rows:
        await message.answer(t("my.empty", user.lang), reply_markup=main_menu(user.lang))
        return

    lines = [t("my.title", user.lang, used=slot.used, max=slot.max)]
    for i, r in enumerate(rows, 1):
        berth_label = {"lower": "⬇️ pastki", "upper": "⬆️ tepa", "any": "🟦 har qanday"}.get(r["berth"], r["berth"])
        car_types = ", ".join(r["car_types"]) or "barchasi"
        lines.append(t(
            "my.row", user.lang,
            idx=i,
            route=f"{r['dep_name']} → {r['arr_name']}",
            date=r["travel_date"].isoformat(),
            train=", ".join(r["train_numbers"]) or "har qanday",
            car_type=car_types,
            berth=berth_label,
        ))
    if slot.used >= slot.max and user.tier == "free":
        lines.append(t("my.full_premium_hint", user.lang))

    await message.answer("\n\n".join(lines), reply_markup=main_menu(user.lang))


@router.message(F.text.in_(_LABELS_HELP))
async def on_help(message: Message) -> None:
    user = await ensure_user(message.from_user)
    text = f"{t('help.title', user.lang)}\n\n{t('help.body', user.lang)}"
    await message.answer(text, reply_markup=main_menu(user.lang))


@router.message(F.text.in_(_LABELS_CHANNEL))
async def on_channel(message: Message) -> None:
    user = await ensure_user(message.from_user)
    text = f"{t('channel.title', user.lang)}\n\n{t('channel.body', user.lang)}"
    await message.answer(text, reply_markup=channel_link(user.lang))


@router.message(F.text.in_(_LABELS_CONTACT))
async def on_contact(message: Message) -> None:
    user = await ensure_user(message.from_user)
    text = f"{t('contact.title', user.lang)}\n\n{t('contact.body', user.lang)}"
    await message.answer(text, reply_markup=main_menu(user.lang))


@router.message(F.text.in_(_LABELS_STATUS))
async def on_status(message: Message) -> None:
    # Same view as /holat — the button is just a discoverable entry point.
    from app.bot.handlers.status import cmd_status
    await cmd_status(message)


@router.message(F.text.in_(_LABELS_ORDERS))
async def on_orders(message: Message) -> None:
    user = await ensure_user(message.from_user)
    rows = await get_pool().fetch(
        """
        SELECT o.id, o.status, o.train_number, o.car_number, o.seat_numbers,
               o.seat_number, o.travel_date, o.amount_uzs,
               sd.name_uz AS dep_name, sa.name_uz AS arr_name
        FROM autobuy_orders o
        JOIN stations sd ON sd.code = o.dep_code
        JOIN stations sa ON sa.code = o.arr_code
        WHERE o.user_id = $1
        ORDER BY o.id DESC
        LIMIT 10
        """,
        user.id,
    )
    if not rows:
        await message.answer(
            "🎫 <b>Buyurtmalar yo'q</b>\n\n"
            "Avto sotib olish yoqilganda, bron qilingan chiptalar shu yerda "
            "ko'rinadi.",
            reply_markup=main_menu(user.lang),
        )
        return

    icon = {
        "paid": "✅", "awaiting_otp": "⏳", "paying": "⏳", "reserving": "🔄",
        "failed": "❌", "expired": "⌛", "cancelled": "🚫",
    }
    label = {
        "paid": "To'landi", "awaiting_otp": "SMS kod kutilmoqda",
        "paying": "Tekshirilmoqda", "reserving": "Bron qilinmoqda",
        "failed": "Xato", "expired": "Muddati o'tdi", "cancelled": "Bekor qilindi",
    }
    lines = ["🎫 <b>Oxirgi buyurtmalar</b>", "━━━━━━━━━━━━━━━"]
    for r in rows:
        seats = list(r["seat_numbers"] or [r["seat_number"]])
        line = (
            f"{icon.get(r['status'], 'ℹ️')} <b>{label.get(r['status'], r['status'])}</b>\n"
            f"   📍 {r['dep_name']} → {r['arr_name']} · {r['travel_date'].isoformat()}\n"
            f"   🚂 {r['train_number']} · vagon {r['car_number']} · "
            f"joy {', '.join(str(s) for s in seats)}"
        )
        if r["amount_uzs"]:
            line += f"\n   💰 {r['amount_uzs']:,}".replace(",", " ") + " so'm"
        lines.append(line)
    await message.answer("\n\n".join(lines), reply_markup=main_menu(user.lang))


# Premium/Donate handlers live in app.bot.handlers.payments (M5).
# They register stub handlers here when M5 hasn't been built; main wires it.
