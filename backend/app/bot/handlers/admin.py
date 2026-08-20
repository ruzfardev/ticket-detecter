"""
Admin-only commands: /stats, /refund, /broadcast.

Gated by ADMIN_IDS (see app.bot.filters). Callback handlers re-check
`is_admin` since inline buttons can be forwarded.
"""

from __future__ import annotations

import asyncio

from aiogram import F, Router
from aiogram.filters import Command, CommandObject
from aiogram.types import (
    CallbackQuery,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    Message,
)

from app.bot.dispatcher import get_bot
from app.bot.filters import IsAdmin, is_admin
from app.core.logging import logger
from app.db import get_pool
from app.services import admin_service

router = Router()

# Pending broadcasts awaiting confirmation, keyed by admin TG id.
_pending_broadcast: dict[int, str] = {}


# ---- /stats -----------------------------------------------------------------

@router.message(Command("stats"), IsAdmin())
async def cmd_stats(msg: Message) -> None:
    s = await admin_service.get_stats(get_pool())
    text = (
        "📊 <b>Statistika</b>\n\n"
        f"👤 Foydalanuvchilar: <b>{s['total_users']}</b> "
        f"(24s: +{s['new_users_24h']})\n"
        f"⭐ Premium (aktiv): <b>{s['premium_active']}</b>\n"
        f"🔔 Aktiv kuzatuvlar: <b>{s['active_subs']}</b>\n\n"
        f"💝 Donatlar: <b>{s['donate_stars']}</b> ⭐\n"
        f"💎 Premium tushum: <b>{s['premium_stars']}</b> ⭐\n"
        f"🧾 To'lovlar (refundsiz): <b>{s['payments_count']}</b>\n\n"
        f"📨 24s ichida yuborilgan xabarlar: <b>{s['notif_24h']}</b>"
    )
    await msg.answer(text)


# ---- /refund <payment_id> ---------------------------------------------------

@router.message(Command("refund"), IsAdmin())
async def cmd_refund(msg: Message, command: CommandObject) -> None:
    arg = (command.args or "").strip()
    if not arg.isdigit():
        await msg.answer("Foydalanish: <code>/refund &lt;payment_id&gt;</code>")
        return
    result = await admin_service.refund_payment(get_pool(), int(arg))
    await msg.answer(_refund_reply(int(arg), result))


@router.callback_query(F.data.startswith("adm_refund:"))
async def on_refund_button(cq: CallbackQuery) -> None:
    if not is_admin(cq.from_user.id):
        await cq.answer("✗ Ruxsat yo'q", show_alert=True)
        return
    try:
        payment_id = int(cq.data.split(":", 1)[1])
    except (ValueError, IndexError):
        await cq.answer("✗")
        return

    result = await admin_service.refund_payment(get_pool(), payment_id)
    await cq.answer("✅ Refund qilindi" if result["status"] == "ok" else "✗ Xato")
    if cq.message:
        try:
            await cq.message.edit_text(
                (cq.message.html_text or "") + "\n\n" + _refund_reply(payment_id, result),
                reply_markup=None,
            )
        except Exception as e:
            logger.warning("refund_edit_failed", error=str(e))


def _refund_reply(payment_id: int, result: dict) -> str:
    status = result.get("status")
    if status == "ok":
        return f"↩️ <b>Refund qilindi</b> — #{payment_id}, {result['stars']} ⭐ qaytarildi."
    if status == "already_refunded":
        return f"ℹ️ #{payment_id} allaqachon refund qilingan."
    if status == "not_found":
        return f"✗ #{payment_id} topilmadi."
    if status == "telegram_error":
        return f"✗ Telegram refund xatosi: {result.get('error')}"
    return f"✗ Noma'lum holat: {status}"


# ---- /broadcast <text> ------------------------------------------------------

@router.message(Command("broadcast"), IsAdmin())
async def cmd_broadcast(msg: Message, command: CommandObject) -> None:
    text = (command.args or "").strip()
    if not text:
        await msg.answer("Foydalanish: <code>/broadcast &lt;xabar&gt;</code>")
        return
    _pending_broadcast[msg.from_user.id] = text
    kb = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="✅ Yuborish", callback_data="adm_bcast:go"),
        InlineKeyboardButton(text="✖️ Bekor", callback_data="adm_bcast:no"),
    ]])
    await msg.answer(
        "📣 <b>Broadcast oldindan ko'rish</b>\n\n" + text + "\n\n"
        "Barcha foydalanuvchilarga yuborilsinmi?",
        reply_markup=kb,
    )


@router.callback_query(F.data == "adm_bcast:no")
async def on_broadcast_cancel(cq: CallbackQuery) -> None:
    if not is_admin(cq.from_user.id):
        await cq.answer("✗ Ruxsat yo'q", show_alert=True)
        return
    _pending_broadcast.pop(cq.from_user.id, None)
    await cq.answer("Bekor qilindi")
    if cq.message:
        try:
            await cq.message.edit_text("📣 Broadcast bekor qilindi.", reply_markup=None)
        except Exception:
            pass


@router.callback_query(F.data == "adm_bcast:go")
async def on_broadcast_go(cq: CallbackQuery) -> None:
    if not is_admin(cq.from_user.id):
        await cq.answer("✗ Ruxsat yo'q", show_alert=True)
        return
    text = _pending_broadcast.pop(cq.from_user.id, None)
    if not text:
        await cq.answer("✗ Eskirgan, qayta /broadcast yuboring", show_alert=True)
        return
    await cq.answer("Yuborilmoqda...")
    if cq.message:
        try:
            await cq.message.edit_text("📣 Broadcast boshlandi…", reply_markup=None)
        except Exception:
            pass
    asyncio.create_task(_run_broadcast(cq.from_user.id, text))


async def _run_broadcast(admin_id: int, text: str) -> None:
    """Fan out to all users with light rate-limiting; report counts to admin."""
    bot = get_bot()
    ids = await admin_service.list_user_tg_ids(get_pool())
    sent = failed = 0
    for uid in ids:
        try:
            await bot.send_message(uid, text)
            sent += 1
        except Exception:
            failed += 1  # user blocked the bot / deactivated
        await asyncio.sleep(0.05)  # ~20 msg/s, under Telegram's limit
    logger.info("broadcast_done", sent=sent, failed=failed, total=len(ids))
    try:
        await bot.send_message(
            admin_id,
            f"📣 <b>Broadcast tugadi</b>\n\n"
            f"Yuborildi: <b>{sent}</b>\nXato: <b>{failed}</b>\nJami: {len(ids)}",
        )
    except Exception:
        pass


# ---- /user <tg_id> ----------------------------------------------------------

@router.message(Command("user"), IsAdmin())
async def cmd_user(msg: Message, command: CommandObject) -> None:
    arg = (command.args or "").strip()
    if not arg.lstrip("-").isdigit():
        await msg.answer(
            "Foydalanish: <code>/user &lt;tg_user_id&gt;</code>\n"
            "Masalan: <code>/user 970956519</code>"
        )
        return
    info = await admin_service.find_user(get_pool(), int(arg))
    if info is None:
        await msg.answer(f"❌ Foydalanuvchi topilmadi: <code>{arg}</code>")
        return
    until = info["premium_until"]
    await msg.answer("\n".join([
        "👤 <b>Foydalanuvchi</b>",
        f"ID: <code>{info['tg_user_id']}</code> (ichki: {info['id']})",
        f"Tarif: <b>{info['tier']}</b>",
        f"Amal qiladi: {until.strftime('%Y-%m-%d %H:%M') if until else '—'}",
        f"Sinov berilgan: {'ha' if info['trial_granted_at'] else 'yo‘q'}",
        f"Til: {info['lang']}",
        "",
        f"Faol xabarnomalar: <b>{info['active_subs']}</b>",
        f"Sotib olingan chiptalar: <b>{info['paid_orders']}</b>",
        f"eticket ulangan: {'✅' if info['eticket_linked'] else '❌'}",
        f"Ro‘yxatdan o‘tgan: {info['created_at'].strftime('%Y-%m-%d')}",
    ]))


# ---- /grant <tg_id> <days> --------------------------------------------------

@router.message(Command("grant"), IsAdmin())
async def cmd_grant(msg: Message, command: CommandObject) -> None:
    parts = (command.args or "").split()
    if len(parts) != 2 or not parts[0].isdigit() or not parts[1].lstrip("-").isdigit():
        await msg.answer(
            "Foydalanish: <code>/grant &lt;tg_user_id&gt; &lt;kun&gt;</code>\n"
            "Masalan: <code>/grant 970956519 30</code>"
        )
        return
    tg_id, days = int(parts[0]), int(parts[1])
    if not (1 <= days <= 3650):
        await msg.answer("❌ Kun 1 dan 3650 gacha bo‘lishi kerak.")
        return
    res = await admin_service.grant_premium(get_pool(), tg_id, days)
    if res is None:
        await msg.answer(f"❌ Foydalanuvchi topilmadi: <code>{tg_id}</code>")
        return
    until = res["premium_until"].strftime("%Y-%m-%d")
    await msg.answer(
        f"✅ <code>{tg_id}</code> ga <b>{days} kun</b> premium berildi.\n"
        f"Amal qiladi: <b>{until}</b>"
    )
    try:
        await get_bot().send_message(
            tg_id,
            f"🎁 <b>Sizga {days} kunlik Premium berildi!</b>\n\n"
            f"• 3 ta xabarnoma slot\n• Har 10 soniyada tekshiruv\n"
            f"• Amal qiladi: <b>{until}</b>",
        )
    except Exception as e:
        logger.warning("grant_notify_failed", tg_user_id=tg_id, error=str(e))
