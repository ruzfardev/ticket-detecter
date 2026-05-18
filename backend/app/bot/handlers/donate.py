"""/donate — show 4 donation options + 'Custom amount' (opens Mini App)."""

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
from app.bot.i18n import t
from app.services.payments import create_invoice_link
from app.services.plans import DONATE_OPTIONS

router = Router()


def _donate_keyboard() -> InlineKeyboardMarkup:
    rows = []
    for d in DONATE_OPTIONS.values():
        rows.append([InlineKeyboardButton(
            text=f"{d.emoji} {d.label_uz} · {d.stars} ⭐",
            callback_data=f"pay_donate:{d.id}",
        )])
    rows.append([InlineKeyboardButton(text="❌ Bekor qilish", callback_data="cancel")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


_DONATE_INTRO = (
    "💝 <b>Botni qo'llab-quvvatlash</b>\n\n"
    "Sizning yordamingiz botning rivojlanishi va serverlar uchun "
    "ishlatiladi. Premium status bermaydi, lekin sizdan minnatdorman 🙏"
)


@router.message(Command("donate"))
async def cmd_donate(message: Message) -> None:
    await ensure_user(message.from_user)
    await message.answer(_DONATE_INTRO, reply_markup=_donate_keyboard())


def _label_set(key: str) -> set[str]:
    return {t(key, lang) for lang in ("uz", "ru", "en")}


_LABELS_DONATE = _label_set("menu.donate")


@router.message(F.text.in_(_LABELS_DONATE))
async def on_donate_label(message: Message) -> None:
    await cmd_donate(message)


@router.callback_query(F.data.startswith("pay_donate:"))
async def on_buy_donate(cq: CallbackQuery) -> None:
    user = await ensure_user(cq.from_user)
    plan_id = cq.data.split(":", 1)[1]
    try:
        result = await create_invoice_link(user.id, plan_id)
    except Exception as e:
        await cq.answer(f"⚠️ {e}", show_alert=True)
        return
    await cq.answer()
    kb = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(
            text=f"⭐ {result['stars_amount']} bilan rahmat aytish",
            url=result["invoice_link"],
        ),
    ]])
    await cq.message.answer(
        f"💝 Sizdan minnatdorman!\nMiqdor: {result['stars_amount']} ⭐",
        reply_markup=kb,
    )
