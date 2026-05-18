"""/premium command — show 5 tariffs as inline buttons."""

from __future__ import annotations

from aiogram import F, Router
from aiogram.filters import Command
from aiogram.types import (
    CallbackQuery,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    Message,
)

from app.bot.handlers._helpers import ensure_user
from app.services.plans import PREMIUM_PLANS
from app.services.payments import create_invoice_link

router = Router()


def _premium_keyboard() -> InlineKeyboardMarkup:
    rows = []
    for p in PREMIUM_PLANS.values():
        badge = f"{p.badge} " if p.badge else ""
        rows.append([InlineKeyboardButton(
            text=f"{badge}{p.days} kun · {p.stars} ⭐",
            callback_data=f"pay_premium:{p.id}",
        )])
    rows.append([InlineKeyboardButton(text="❌ Bekor qilish", callback_data="cancel")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


_PREMIUM_INTRO = (
    "⚡ <b>Premium obuna afzalliklari:</b>\n\n"
    "✅ Har 10 sekundda tekshirish (oddiy: 30 sekund)\n"
    "✅ 3 tagacha faol xabarnoma (oddiy: faqat 1 ta)\n"
    "✅ Yangi funksiyalarga dastlab kirish\n"
    "✅ Boshqalardan 3 baravar tezroq bilet topish\n\n"
    "<b>Premium obuna narxlari:</b>"
)


@router.message(Command("premium"))
async def cmd_premium(message: Message) -> None:
    await ensure_user(message.from_user)
    await message.answer(_PREMIUM_INTRO, reply_markup=_premium_keyboard())


# Reply-keyboard label routing (any language)
from app.bot.i18n import t


def _label_set(key: str) -> set[str]:
    return {t(key, lang) for lang in ("uz", "ru", "en")}


_LABELS_PREMIUM = _label_set("menu.premium")


@router.message(F.text.in_(_LABELS_PREMIUM))
async def on_premium_label(message: Message) -> None:
    await cmd_premium(message)


@router.callback_query(F.data.startswith("pay_premium:"))
async def on_buy_premium(cq: CallbackQuery) -> None:
    user = await ensure_user(cq.from_user)
    plan_id = cq.data.split(":", 1)[1]
    try:
        result = await create_invoice_link(user.id, plan_id)
    except Exception as e:
        await cq.answer(f"⚠️ {e}", show_alert=True)
        return
    await cq.answer()
    # Send invoice link as a button. Telegram opens Stars dialog on tap.
    kb = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(
            text=f"⭐ {result['stars_amount']} bilan to'lash",
            url=result["invoice_link"],
        ),
    ]])
    await cq.message.answer(
        f"💳 <b>{plan_id}</b> uchun to'lov:\n{result['stars_amount']} ⭐",
        reply_markup=kb,
    )
