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
from app.bot.keyboards import main_menu
from app.db import get_pool
from app.services import user_service

router = Router()


# Build "label-to-action" lookup once at import time, covering all 3 languages.
def _label_set(key: str) -> set[str]:
    return {t(key, lang) for lang in ("uz", "ru", "en")}


_LABELS_NOTIFS  = _label_set("menu.notifs")
_LABELS_PREMIUM = _label_set("menu.premium")
_LABELS_DONATE  = _label_set("menu.donate")
_LABELS_HELP    = _label_set("menu.help")
_LABELS_CONTACT = _label_set("menu.contact")


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


@router.message(F.text.in_(_LABELS_CONTACT))
async def on_contact(message: Message) -> None:
    user = await ensure_user(message.from_user)
    text = f"{t('contact.title', user.lang)}\n\n{t('contact.body', user.lang)}"
    await message.answer(text, reply_markup=main_menu(user.lang))


# Premium/Donate handlers live in app.bot.handlers.payments (M5).
# They register stub handlers here when M5 hasn't been built; main wires it.
