"""
Stars payment flow handlers.

Telegram calls our bot with two updates during a Stars purchase:
  1. pre_checkout_query — we must reply within 10s with ok or error
  2. successful_payment  — payment cleared, user got Premium / donated
"""

from __future__ import annotations

from aiogram import F, Router
from aiogram.types import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    Message,
    PreCheckoutQuery,
)

from app.bot.admin_notify import notify_admins
from app.bot.backend_client import precheck_payment, record_payment_success
from app.core.logging import logger

router = Router()


@router.pre_checkout_query()
async def on_pre_checkout(q: PreCheckoutQuery) -> None:
    try:
        result = await precheck_payment(
            tg_user_id=q.from_user.id,
            invoice_payload=q.invoice_payload,
            stars_amount=q.total_amount,
        )
    except Exception as e:
        logger.exception("precheck_call_failed", error=str(e))
        await q.answer(ok=False, error_message="Service unavailable")
        return

    ok = bool(result.get("ok"))
    err = result.get("error_message") or "Validation failed"
    if ok:
        await q.answer(ok=True)
    else:
        await q.answer(ok=False, error_message=err)
        logger.warning("precheck_rejected", payload=q.invoice_payload, reason=err)


@router.message(F.successful_payment)
async def on_successful_payment(msg: Message) -> None:
    sp = msg.successful_payment
    try:
        result = await record_payment_success(
            tg_user_id=msg.from_user.id,
            tg_payment_charge_id=sp.telegram_payment_charge_id,
            provider_charge_id=sp.provider_payment_charge_id or None,
            invoice_payload=sp.invoice_payload,
            stars_amount=sp.total_amount,
            raw=sp.model_dump(),
        )
    except Exception as e:
        # The Stars are already taken at this point — Telegram has cleared the
        # charge. If we cannot record it, the user has paid and received
        # nothing, so this must reach an admin rather than only the log.
        logger.exception("payment_record_failed", error=str(e),
                         charge=sp.telegram_payment_charge_id,
                         payload=sp.invoice_payload, stars=sp.total_amount)
        await _alert_admins_payment_lost(msg, sp, e)
        await msg.answer(
            "⚠️ To'lovingiz qabul qilindi, lekin uni tizimda saqlashda xato "
            "yuz berdi. Admin xabardor qilindi — tez orada hal qilamiz. "
            "To'lov kodi:\n"
            f"<code>{sp.telegram_payment_charge_id}</code>"
        )
        return

    if result.get("type") == "premium":
        until = result.get("granted_until", "")[:10]
        await msg.answer(
            f"🎉 <b>Premium aktivlashtirildi!</b>\n\n"
            f"• Slot: 3 ta xabarnoma\n"
            f"• Cadence: har 10 sekundda\n"
            f"• Tugash: {until}\n\n"
            f"Endi 3 ta poyezdni bir vaqtda kuzata olasiz."
        )
    elif result.get("type") == "donate":
        await msg.answer(
            f"💝 <b>Katta rahmat!</b>\n\n"
            f"Sizning {result.get('stars')} ⭐ qo'llab-quvvatlovingiz "
            f"botning rivojlanishi uchun ishlatiladi."
        )
    else:
        await msg.answer("✅ To'lov qabul qilindi.")

    await _notify_admins_payment(msg, result)


async def _alert_admins_payment_lost(msg: Message, sp, exc: Exception) -> None:
    """A cleared payment we failed to record — needs manual intervention."""
    try:
        u = msg.from_user
        who = f"@{u.username}" if u and u.username else (u.first_name if u else "—")
        await notify_admins("\n".join([
            "🚨 <b>TO'LOV YO'QOLDI — qo'lda hal qilish kerak</b>",
            f"Kim: {who} (<code>{u.id if u else '?'}</code>)",
            f"Miqdor: {sp.total_amount} ⭐",
            f"Payload: <code>{sp.invoice_payload}</code>",
            f"Charge: <code>{sp.telegram_payment_charge_id}</code>",
            f"Xato: <code>{str(exc)[:300]}</code>",
            "",
            "Foydalanuvchi pul to'ladi, lekin hech narsa olmadi.",
        ]))
    except Exception as e:
        logger.warning("admin_payment_lost_notify_failed", error=str(e))


async def _notify_admins_payment(msg: Message, result: dict) -> None:
    """Best-effort admin alert with a one-tap refund button."""
    payment_id = result.get("payment_id")
    ptype = result.get("type")
    if not payment_id or ptype not in ("premium", "donate"):
        return  # nothing fresh to report (e.g. idempotent replay)
    try:
        u = msg.from_user
        who = f"@{u.username}" if u and u.username else (u.first_name if u else "—")
        lines = [
            "💰 <b>Yangi to'lov</b>",
            f"Kim: {who} (<code>{u.id if u else '?'}</code>)",
            f"Tur: {ptype} · {result.get('plan')}",
            f"Miqdor: {result.get('stars')} ⭐",
        ]
        if ptype == "premium":
            lines.append(f"Tugash: {result.get('granted_until', '')[:10]}")
        kb = InlineKeyboardMarkup(inline_keyboard=[[
            InlineKeyboardButton(
                text="↩️ Refund qilish",
                callback_data=f"adm_refund:{payment_id}",
            ),
        ]])
        await notify_admins("\n".join(lines), reply_markup=kb)
    except Exception as e:
        logger.warning("admin_payment_notify_failed", error=str(e))
