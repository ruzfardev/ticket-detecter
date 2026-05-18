"""
Telegram bot command handler — runs in a background thread alongside the scheduler.

Design goals:
  * Every message from the allowed user gets a reply — never silent.
  * Rich command set for day-to-day control (pause, resume, status, stats).
  * Inline keyboards for one-tap actions on the main menu.
  * Multi-step wizards (add/remove route) with /cancel to back out.
  * Live interval updates without requiring a restart.
"""

from __future__ import annotations

import json
import re
import threading
import time
from datetime import date as _date, datetime, timedelta
from pathlib import Path
from typing import Optional

import requests

import notifier
import runtime
import eventlog

ROOT = Path(__file__).parent.parent
CONFIG_FILE = ROOT / "config.json"

# ---- station catalog (extend as needed) ----------------------------------
STATIONS = {
    "2900000": "Toshkent",
    "2900001": "Toshkent-Pass.",
    "2900680": "Samarqand",
    "2900700": "Buxoro",
    "2900790": "Urganch",
    "2900800": "Xiva",
    "2900720": "Navoiy",
    "2900750": "Qarshi",
    "2900760": "Termiz",
    "2900770": "Qo'qon",
    "2900780": "Andijon",
    "2900730": "Nukus",
    "2900740": "Farg'ona",
}

VALID_CAR_TYPES = ["плацкарта", "купе", "люкс", "св", "сидячий"]

BOT_COMMANDS = [
    {"command": "start", "description": "Botni ishga tushirish va menyu"},
    {"command": "menu", "description": "Asosiy menyu"},
    {"command": "help", "description": "Buyruqlar ro'yxati"},
    {"command": "status", "description": "Bot holati va oxirgi tekshiruv"},
    {"command": "stats", "description": "Bugungi statistika"},
    {"command": "routes", "description": "Marshrutlar ro'yxati"},
    {"command": "checknow", "description": "Darhol tekshirish"},
    {"command": "pause", "description": "Tekshiruvni pauza qilish"},
    {"command": "resume", "description": "Tekshiruvni davom ettirish"},
    {"command": "interval", "description": "Tekshirish intervalini o'zgartirish"},
    {"command": "setdates", "description": "Marshrut sanalarini sozlash"},
    {"command": "setcars", "description": "Marshrut vagon turlarini sozlash"},
    {"command": "addroute", "description": "Yangi marshrut qo'shish"},
    {"command": "delroute", "description": "Marshrutni o'chirish"},
    {"command": "heartbeat", "description": "Kunlik xabar vaqtini sozlash"},
    {"command": "summary", "description": "Kunlik hisobotni darhol yuborish"},
    {"command": "stations", "description": "Stantsiya kodlari ro'yxati"},
    {"command": "cancel", "description": "Joriy jarayonni bekor qilish"},
]

# ---- per-user wizard state (add-route multi-step flow) --------------------
# structure: {"step": str, "data": dict}
_wizards: dict[str, dict] = {}


# ---- config helpers -------------------------------------------------------
def _load_config() -> dict:
    return json.loads(CONFIG_FILE.read_text(encoding="utf-8"))


def _save_config(config: dict):
    CONFIG_FILE.write_text(json.dumps(config, ensure_ascii=False, indent=2), encoding="utf-8")


def _station_label(code: str) -> str:
    name = STATIONS.get(code)
    return f"{name} ({code})" if name else code


# ---- keyboards ------------------------------------------------------------
def _main_menu_keyboard() -> dict:
    paused = runtime.is_paused()
    return {
        "inline_keyboard": [
            [
                {"text": "📋 Marshrutlar", "callback_data": "routes"},
                {"text": "🔍 Hozir tekshirish", "callback_data": "checknow"},
            ],
            [
                {"text": "📊 Holat", "callback_data": "status"},
                {"text": "📈 Statistika", "callback_data": "stats"},
            ],
            [
                {"text": "▶️ Davom ettirish" if paused else "⏸ Pauza",
                 "callback_data": "resume" if paused else "pause"},
                {"text": "⏱ Interval", "callback_data": "interval_menu"},
            ],
            [
                {"text": "➕ Marshrut qo'shish", "callback_data": "addroute"},
                {"text": "❓ Yordam", "callback_data": "help"},
            ],
        ]
    }


def _interval_keyboard() -> dict:
    # callback_data format: "setinterval:<seconds>"
    return {
        "inline_keyboard": [
            [{"text": f"{s} soniya", "callback_data": f"setinterval:{s}"} for s in (30, 45)],
            [{"text": f"{s} soniya", "callback_data": f"setinterval:{s}"} for s in (60, 90, 120)],
            [{"text": f"{m} daq", "callback_data": f"setinterval:{m * 60}"} for m in (5, 10, 15)],
            [{"text": f"{m} daq", "callback_data": f"setinterval:{m * 60}"} for m in (20, 30, 60)],
            [{"text": "⬅️ Orqaga", "callback_data": "menu"}],
        ]
    }


def _routes_keyboard(routes: list[dict], action: str) -> dict:
    """action is the callback prefix, e.g. 'delroute' or 'editdates'."""
    rows = []
    for i, r in enumerate(routes, 1):
        rows.append([{"text": f"{i}. {r['name']}", "callback_data": f"{action}:{i}"}])
    rows.append([{"text": "⬅️ Orqaga", "callback_data": "menu"}])
    return {"inline_keyboard": rows}


def _cars_keyboard(route_idx: int, selected: list[str]) -> dict:
    rows = []
    for t in VALID_CAR_TYPES:
        mark = "✅" if t in selected else "⬜️"
        rows.append([{"text": f"{mark} {t}", "callback_data": f"togglecar:{route_idx}:{t}"}])
    rows.append([
        {"text": "🟦 Hammasi", "callback_data": f"clearcars:{route_idx}"},
        {"text": "💾 Saqlash", "callback_data": f"savecars:{route_idx}"},
    ])
    rows.append([{"text": "⬅️ Orqaga", "callback_data": "menu"}])
    return {"inline_keyboard": rows}


def _confirm_keyboard(yes: str, no: str = "menu") -> dict:
    return {
        "inline_keyboard": [[
            {"text": "✅ Ha", "callback_data": yes},
            {"text": "❌ Yo'q", "callback_data": no},
        ]]
    }


# ---- text helpers ---------------------------------------------------------
def _fmt_routes(routes: list[dict]) -> str:
    if not routes:
        return "📭 Marshrutlar yo'q. <code>/addroute</code> orqali qo'shing."
    lines = ["📋 <b>Marshrutlar:</b>\n"]
    for i, r in enumerate(routes, 1):
        d_from = r.get("date_from") or (r.get("dates") or ["?"])[0]
        d_to = r.get("date_to") or (r.get("dates") or ["?"])[-1]
        cars = ", ".join(r.get("car_types") or []) or "barchasi"
        lines.append(
            f"{i}. <b>{r['name']}</b>\n"
            f"   {_station_label(r['dep_station_code'])} → {_station_label(r['arr_station_code'])}\n"
            f"   📅 {d_from} → {d_to}\n"
            f"   🚃 {cars}"
        )
    return "\n".join(lines)


def _fmt_status(config: dict) -> str:
    paused = runtime.is_paused()
    last = runtime.last_check_at
    nxt = runtime.next_check_at

    cfg_seconds = config.get("check_interval_seconds") or config.get("check_interval_minutes", 15) * 60
    lines = [
        "📊 <b>Bot holati</b>\n",
        f"• Rejim: {'⏸ Pauza' if paused else '▶️ Ishlamoqda'}",
        f"• Ish vaqti: {runtime.uptime_str()}",
        f"• Interval: {_fmt_interval(cfg_seconds)}",
        f"• Heartbeat: {config.get('heartbeat_time', '08:00')}",
        f"• Marshrutlar: {len(config['routes'])} ta",
        "",
        "<b>Oxirgi tekshiruv:</b>",
    ]
    if last:
        lines.append(f"• Vaqt: {last.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"• Davomiylik: {runtime.last_check_duration_s:.1f} s")
        lines.append(f"• Sanalar: {runtime.last_check_dates} ta")
        lines.append(f"• Topilgan: {runtime.last_check_tickets} ta")
        if runtime.last_check_error:
            lines.append(f"• ⚠️ Xato: {runtime.last_check_error}")
    else:
        lines.append("• (hali tekshirilmadi)")

    if nxt and not paused:
        remaining = int((nxt - datetime.now()).total_seconds())
        if remaining > 0:
            mins = remaining // 60
            secs = remaining % 60
            lines.append(f"\n⏭ Keyingi tekshiruv: ~{mins}:{secs:02d} dan keyin")

    return "\n".join(lines)


def _fmt_stats() -> str:
    since = datetime.now() - timedelta(hours=24)
    events = eventlog.read_since(since)
    checks = [e for e in events if e["type"] == "check_done"]
    tickets = [e for e in events if e["type"] == "ticket_found"]
    downs = [e for e in events if e["type"] == "site_down"]

    lines = [
        "📈 <b>24 soat statistika</b>\n",
        f"• Tekshirishlar: {len(checks)} marta",
        f"• Topilgan chiptalar: {len(tickets)} ta",
        f"• Sayt uzilishi: {len(downs)} marta",
        "",
        f"📦 <b>Jami (ish vaqtida)</b>",
        f"• Tekshirishlar: {runtime.total_checks_run}",
        f"• Topilgan chiptalar: {runtime.total_tickets_found}",
    ]
    if tickets:
        lines.append("\n🎫 <b>Oxirgi topilishlar:</b>")
        for t in tickets[-5:]:
            ts = datetime.fromisoformat(t["ts"]).strftime("%H:%M")
            lines.append(f"  • {ts} | {t['route']} | {t['date']} | {t['train']} — {t['seats']} joy")
    return "\n".join(lines)


def _fmt_help() -> str:
    return (
        "❓ <b>Buyruqlar</b>\n\n"
        "<b>Navigatsiya</b>\n"
        "/menu — asosiy menyu\n"
        "/status — bot holati\n"
        "/stats — 24 soatlik statistika\n"
        "/routes — marshrutlar\n"
        "/stations — stantsiya kodlari\n\n"
        "<b>Tekshirish</b>\n"
        "/checknow — hozir tekshirish\n"
        "/pause — pauza\n"
        "/resume — davom ettirish\n"
        "/summary — kunlik hisobot\n\n"
        "<b>Sozlash</b>\n"
        "/interval [daq] — interval (yoki menyu)\n"
        "/heartbeat HH:MM — heartbeat vaqti\n"
        "/setdates N YYYY-MM-DD YYYY-MM-DD — marshrut #N sanalari\n"
        "/setcars N — marshrut #N vagon turlari\n"
        "/addroute — yangi marshrut qo'shish (bosqichma-bosqich)\n"
        "/delroute N — marshrut #N ni o'chirish\n"
        "/cancel — joriy jarayonni bekor qilish"
    )


def _fmt_stations() -> str:
    lines = ["🚉 <b>Stantsiyalar</b>\n"]
    for code, name in STATIONS.items():
        lines.append(f"• <code>{code}</code> — {name}")
    lines.append("\nBoshqa kod kerak bo'lsa eticket.railway.uz da qidiring.")
    return "\n".join(lines)


# ---- send helper ----------------------------------------------------------
_bot_token: str = ""
_chat_id: str = ""


def _send(text: str, keyboard: dict | None = None, silent: bool = False):
    notifier.send_message(_bot_token, _chat_id, text, reply_markup=keyboard, disable_notification=silent)


def _typing():
    notifier.send_chat_action(_bot_token, _chat_id, "typing")


# ---- command handlers -----------------------------------------------------
def _cmd_start(arg: str):
    _send(
        "👋 <b>Assalomu alaykum!</b>\n\n"
        "Men eticket.railway.uz sayti orqali chipta kuzatib, sizga darhol xabar beraman.\n\n"
        "Quyidagi tugmalar orqali boshqarish mumkin, yoki /help buyrug'ini yuboring.",
        _main_menu_keyboard(),
    )


def _cmd_menu(arg: str):
    _send("🏠 <b>Asosiy menyu</b>", _main_menu_keyboard())


def _cmd_help(arg: str):
    _send(_fmt_help(), _main_menu_keyboard())


def _cmd_status(arg: str):
    _send(_fmt_status(_load_config()), _main_menu_keyboard())


def _cmd_stats(arg: str):
    _send(_fmt_stats(), _main_menu_keyboard())


def _cmd_routes(arg: str):
    _send(_fmt_routes(_load_config()["routes"]), _main_menu_keyboard())


def _cmd_stations(arg: str):
    _send(_fmt_stations())


def _cmd_checknow(arg: str):
    if runtime.is_paused():
        _send("⏸ Bot pauzada. Avval /resume yuboring.")
        return
    _typing()
    _send("🔍 Tekshirilmoqda... (natija tayyor bo'lishi bilan xabar beraman)")
    threading.Thread(target=lambda: runtime.run_checks_now(manual=True), daemon=True).start()


def _cmd_pause(arg: str):
    if runtime.is_paused():
        _send("ℹ️ Bot allaqachon pauzada.")
        return
    runtime.set_pause(True)
    _send("⏸ <b>Pauza qilindi.</b>\nRejalashtirilgan tekshiruvlar to'xtatildi.\n/resume bilan davom ettiring.",
          _main_menu_keyboard())


def _cmd_resume(arg: str):
    if not runtime.is_paused():
        _send("ℹ️ Bot allaqachon ishlayapti.")
        return
    runtime.set_pause(False)
    _send("▶️ <b>Davom etdi.</b>\nKeyingi tekshiruv rejaga muvofiq bajariladi.", _main_menu_keyboard())


_INTERVAL_RE = re.compile(r"^\s*(\d+)\s*([smd]?)\s*$", re.IGNORECASE)


def _parse_interval(arg: str) -> int | None:
    """Parse user input into seconds. Accepts '30s', '2m', '10' (minutes back-compat).
    Returns None on invalid input."""
    m = _INTERVAL_RE.match(arg)
    if not m:
        return None
    n = int(m.group(1))
    unit = m.group(2).lower()
    if unit == "s":
        return n
    if unit == "m" or unit == "":
        # Bare number = minutes (back-compat with earlier /interval 10)
        return n * 60
    if unit == "d":
        return n * 60
    return None


def _fmt_interval(seconds: int) -> str:
    if seconds < 60:
        return f"{seconds} soniya"
    if seconds % 60 == 0:
        return f"{seconds // 60} daqiqa"
    return f"{seconds // 60} daq {seconds % 60} son"


def _cmd_interval(arg: str):
    if not arg:
        _send("⏱ <b>Interval ni tanlang:</b>\n\nYoki qo'lda: <code>/interval 30s</code>, <code>/interval 2m</code>",
              _interval_keyboard())
        return
    seconds = _parse_interval(arg)
    if seconds is None:
        _send(
            "❌ Ishlatish:\n"
            "• <code>/interval 30s</code> — soniyada\n"
            "• <code>/interval 2m</code> — daqiqada\n"
            "• <code>/interval 10</code> — daqiqa (qisqartirilgan)\n\n"
            "Yoki tugmalar orqali tanlang:",
            _interval_keyboard(),
        )
        return
    _apply_interval(seconds)


def _apply_interval(seconds: int):
    if seconds < 10 or seconds > 7200:
        _send("❌ Interval 10 soniya – 2 soat orasida bo'lishi kerak.")
        return
    config = _load_config()
    config["check_interval_seconds"] = seconds
    # Keep legacy key in sync for full-minute values; drop it otherwise
    if seconds % 60 == 0:
        config["check_interval_minutes"] = seconds // 60
    else:
        config.pop("check_interval_minutes", None)
    _save_config(config)
    runtime.reschedule(seconds)
    _send(f"✅ Interval <b>{_fmt_interval(seconds)}</b> ga o'zgartirildi va darhol qo'llanildi.",
          _main_menu_keyboard())


def _cmd_heartbeat(arg: str):
    if not arg or not re.match(r"^\d{2}:\d{2}$", arg):
        _send("❌ Ishlatish: <code>/heartbeat 08:00</code>")
        return
    try:
        hh, mm = map(int, arg.split(":"))
        assert 0 <= hh < 24 and 0 <= mm < 60
    except Exception:
        _send("❌ Noto'g'ri vaqt. Namuna: <code>/heartbeat 08:00</code>")
        return
    config = _load_config()
    config["heartbeat_time"] = arg
    _save_config(config)
    _send(f"✅ Heartbeat vaqti <b>{arg}</b> ga o'zgartirildi.\n"
          f"⚠️ To'liq qo'llanish uchun botni qayta ishga tushiring.")


def _cmd_setdates(arg: str):
    parts = arg.split()
    if len(parts) != 3:
        _send("❌ Ishlatish: <code>/setdates 1 2026-04-01 2026-04-10</code>")
        return
    try:
        idx = int(parts[0]) - 1
        d_from, d_to = parts[1], parts[2]
        _date.fromisoformat(d_from)
        _date.fromisoformat(d_to)
    except (ValueError, IndexError):
        _send("❌ Noto'g'ri format.\nNamuna: <code>/setdates 1 2026-04-01 2026-04-10</code>")
        return
    if _date.fromisoformat(d_to) < _date.fromisoformat(d_from):
        _send("❌ Tugash sanasi boshlanish sanasidan oldin bo'lishi mumkin emas.")
        return

    config = _load_config()
    if idx < 0 or idx >= len(config["routes"]):
        _send(f"❌ Marshrut #{idx + 1} mavjud emas.", _routes_keyboard(config["routes"], "noop"))
        return

    route = config["routes"][idx]
    route.pop("dates", None)
    route["date_from"] = d_from
    route["date_to"] = d_to
    _save_config(config)
    _send(f"✅ <b>{route['name']}</b> sanalari yangilandi:\n📅 {d_from} → {d_to}",
          _main_menu_keyboard())


def _cmd_setcars(arg: str):
    config = _load_config()
    if not arg:
        if not config["routes"]:
            _send("📭 Marshrutlar yo'q.")
            return
        _send("🚃 <b>Qaysi marshrut uchun?</b>", _routes_keyboard(config["routes"], "setcars"))
        return
    if not arg.isdigit():
        _send("❌ Ishlatish: <code>/setcars 1</code>")
        return
    idx = int(arg) - 1
    if idx < 0 or idx >= len(config["routes"]):
        _send(f"❌ Marshrut #{idx + 1} mavjud emas.")
        return
    current = config["routes"][idx].get("car_types", [])
    _send(
        f"🚃 <b>{config['routes'][idx]['name']}</b> uchun vagon turlarini tanlang:\n"
        f"(bosh — filter yo'q, hammasi)",
        _cars_keyboard(idx, current),
    )


def _cmd_addroute(arg: str):
    _wizards[_chat_id] = {"step": "name", "data": {}}
    _send(
        "➕ <b>Yangi marshrut qo'shish</b>\n\n"
        "1/5 — Marshrut nomini yuboring.\nMasalan: <code>Toshkent → Samarqand</code>\n\n"
        "Bekor qilish: /cancel"
    )


def _cmd_delroute(arg: str):
    config = _load_config()
    if not config["routes"]:
        _send("📭 Marshrutlar yo'q.")
        return
    if not arg:
        _send("🗑 <b>Qaysi marshrutni o'chirmoqchisiz?</b>",
              _routes_keyboard(config["routes"], "delroute"))
        return
    if not arg.isdigit():
        _send("❌ Ishlatish: <code>/delroute 2</code>")
        return
    idx = int(arg) - 1
    if idx < 0 or idx >= len(config["routes"]):
        _send(f"❌ Marshrut #{idx + 1} mavjud emas.")
        return
    route = config["routes"][idx]
    _send(f"⚠️ <b>{route['name']}</b> ni o'chirishni tasdiqlaysizmi?",
          _confirm_keyboard(f"confirmdel:{idx}"))


def _cmd_summary(arg: str):
    _send("📊 Kunlik hisobot tayyorlanmoqda...")
    threading.Thread(target=runtime.send_summary_now, daemon=True).start()


def _cmd_cancel(arg: str):
    if _chat_id in _wizards:
        _wizards.pop(_chat_id, None)
        _send("🛑 Jarayon bekor qilindi.", _main_menu_keyboard())
    else:
        _send("ℹ️ Bekor qiladigan faol jarayon yo'q.", _main_menu_keyboard())


COMMANDS = {
    "start": _cmd_start,
    "menu": _cmd_menu,
    "help": _cmd_help,
    "status": _cmd_status,
    "stats": _cmd_stats,
    "routes": _cmd_routes,
    "stations": _cmd_stations,
    "checknow": _cmd_checknow,
    "pause": _cmd_pause,
    "resume": _cmd_resume,
    "interval": _cmd_interval,
    "heartbeat": _cmd_heartbeat,
    "setdates": _cmd_setdates,
    "setcars": _cmd_setcars,
    "addroute": _cmd_addroute,
    "delroute": _cmd_delroute,
    "summary": _cmd_summary,
    "cancel": _cmd_cancel,
}


# ---- addroute wizard ------------------------------------------------------
def _handle_wizard(text: str) -> bool:
    """Returns True if the message was consumed by a wizard."""
    w = _wizards.get(_chat_id)
    if not w:
        return False

    step = w["step"]
    data = w["data"]

    if text.lower() in {"/cancel", "bekor", "cancel"}:
        _wizards.pop(_chat_id, None)
        _send("🛑 Marshrut qo'shish bekor qilindi.", _main_menu_keyboard())
        return True

    if step == "name":
        if text.startswith("/"):
            _send("❌ Nom / bilan boshlanmasin. Qaytadan kiriting yoki /cancel.")
            return True
        data["name"] = text.strip()
        w["step"] = "dep"
        _send(
            "2/5 — Jo'nash stantsiyasi kodini yuboring.\n"
            "Namuna: <code>2900000</code> (Toshkent)\n\n"
            "/stations — ma'lum kodlar ro'yxati"
        )
        return True

    if step == "dep":
        code = text.strip()
        if not code.isdigit():
            _send("❌ Kod faqat raqamlardan iborat bo'lishi kerak. Qaytadan kiriting.")
            return True
        data["dep"] = code
        w["step"] = "arr"
        _send(f"✅ Jo'nash: {_station_label(code)}\n\n"
              "3/5 — Manzil stantsiyasi kodini yuboring.")
        return True

    if step == "arr":
        code = text.strip()
        if not code.isdigit():
            _send("❌ Kod faqat raqamlardan iborat bo'lishi kerak. Qaytadan kiriting.")
            return True
        if code == data["dep"]:
            _send("❌ Manzil jo'nash bilan bir xil bo'lishi mumkin emas.")
            return True
        data["arr"] = code
        w["step"] = "dates"
        _send(f"✅ Manzil: {_station_label(code)}\n\n"
              "4/5 — Sana oralig'ini yuboring.\n"
              "Namuna: <code>2026-04-20 2026-04-25</code>\n"
              "Yoki bitta sana: <code>2026-04-20</code>")
        return True

    if step == "dates":
        parts = text.strip().split()
        try:
            if len(parts) == 1:
                d_from = d_to = parts[0]
            elif len(parts) == 2:
                d_from, d_to = parts
            else:
                raise ValueError("count")
            _date.fromisoformat(d_from)
            _date.fromisoformat(d_to)
            if _date.fromisoformat(d_to) < _date.fromisoformat(d_from):
                _send("❌ Tugash sanasi boshlanishdan oldin. Qaytadan kiriting.")
                return True
        except Exception:
            _send("❌ Noto'g'ri sana. Namuna: <code>2026-04-20 2026-04-25</code>")
            return True
        data["date_from"] = d_from
        data["date_to"] = d_to
        w["step"] = "cars"
        _send(
            "5/5 — Vagon turlarini tanlang (<b>barchasi</b> — filtersiz):",
            {"inline_keyboard": [
                [{"text": "🟦 Hammasi", "callback_data": "wizcars:all"}],
                *[[{"text": t, "callback_data": f"wizcars:{t}"}] for t in VALID_CAR_TYPES],
            ]},
        )
        return True

    # cars handled via callback
    return True


def _wizard_finish(car_types: list[str]):
    w = _wizards.pop(_chat_id, None)
    if not w:
        return
    d = w["data"]
    config = _load_config()
    new_route = {
        "name": d["name"],
        "dep_station_code": d["dep"],
        "arr_station_code": d["arr"],
        "date_from": d["date_from"],
        "date_to": d["date_to"],
        "car_types": car_types,
    }
    config["routes"].append(new_route)
    _save_config(config)
    _send(
        "✅ <b>Yangi marshrut qo'shildi!</b>\n\n"
        f"• {new_route['name']}\n"
        f"• {_station_label(d['dep'])} → {_station_label(d['arr'])}\n"
        f"• 📅 {d['date_from']} → {d['date_to']}\n"
        f"• 🚃 {', '.join(car_types) or 'barchasi'}",
        _main_menu_keyboard(),
    )


# ---- dispatchers ----------------------------------------------------------
def _handle_text(text: str):
    """Handle a plain text / command message."""
    text = text.strip()

    # Wizard takes priority unless user types /cancel or another slash command
    if _chat_id in _wizards and not (text.startswith("/") and text.split()[0][1:] in COMMANDS):
        if _handle_wizard(text):
            return

    if text.startswith("/"):
        # Parse command (strip leading slash and optional @botname suffix)
        parts = text.split(maxsplit=1)
        cmd = parts[0][1:].split("@", 1)[0].lower()
        arg = parts[1].strip() if len(parts) > 1 else ""
        handler = COMMANDS.get(cmd)
        if handler:
            try:
                handler(arg)
            except Exception as e:
                print(f"[bot] Handler error for /{cmd}: {e}")
                _send(f"⚠️ Buyruqni bajarishda xatolik: <code>{e}</code>")
            return
        _send(
            f"❓ Noma'lum buyruq: <code>{text}</code>\n\n{_fmt_help()}",
            _main_menu_keyboard(),
        )
        return

    # Free text — respond with a friendly hint + menu so the user is never left hanging
    low = text.lower()
    if any(w in low for w in ("salom", "hi", "hello", "привет", "assalom")):
        _send("👋 Salom! Nima qilishni xohlaysiz?", _main_menu_keyboard())
        return
    if any(w in low for w in ("rahmat", "thanks", "спасибо")):
        _send("😊 Arzimaydi! Yana nimadir kerak bo'lsa — menyu ostida.", _main_menu_keyboard())
        return
    if any(w in low for w in ("pauza", "to'xtat", "stop")):
        _cmd_pause("")
        return
    if any(w in low for w in ("davom", "resume", "ishla")):
        _cmd_resume("")
        return
    if any(w in low for w in ("tekshir", "check")):
        _cmd_checknow("")
        return
    if any(w in low for w in ("holat", "status")):
        _cmd_status("")
        return

    _send(
        "🤔 Tushunmadim. Quyidagi tugmalardan foydalaning yoki /help yuboring.",
        _main_menu_keyboard(),
    )


def _handle_callback(data: str, callback_id: str, message_id: int):
    """Handle inline-keyboard button press."""
    # Always acknowledge the callback so the spinner stops
    notifier.answer_callback(_bot_token, callback_id)

    if data == "menu":
        notifier.edit_message(_bot_token, _chat_id, message_id, "🏠 <b>Asosiy menyu</b>", _main_menu_keyboard())
        return
    if data == "help":
        notifier.edit_message(_bot_token, _chat_id, message_id, _fmt_help(), _main_menu_keyboard())
        return
    if data == "routes":
        notifier.edit_message(_bot_token, _chat_id, message_id,
                              _fmt_routes(_load_config()["routes"]), _main_menu_keyboard())
        return
    if data == "status":
        notifier.edit_message(_bot_token, _chat_id, message_id,
                              _fmt_status(_load_config()), _main_menu_keyboard())
        return
    if data == "stats":
        notifier.edit_message(_bot_token, _chat_id, message_id, _fmt_stats(), _main_menu_keyboard())
        return
    if data == "checknow":
        _cmd_checknow("")
        return
    if data == "pause":
        _cmd_pause("")
        return
    if data == "resume":
        _cmd_resume("")
        return
    if data == "addroute":
        _cmd_addroute("")
        return
    if data == "interval_menu":
        notifier.edit_message(_bot_token, _chat_id, message_id,
                              "⏱ <b>Interval ni tanlang:</b>", _interval_keyboard())
        return
    if data.startswith("setinterval:"):
        mins = int(data.split(":", 1)[1])
        _apply_interval(mins)
        return
    if data.startswith("delroute:"):
        idx = int(data.split(":", 1)[1]) - 1
        config = _load_config()
        if 0 <= idx < len(config["routes"]):
            route = config["routes"][idx]
            _send(f"⚠️ <b>{route['name']}</b> ni o'chirishni tasdiqlaysizmi?",
                  _confirm_keyboard(f"confirmdel:{idx}"))
        return
    if data.startswith("confirmdel:"):
        idx = int(data.split(":", 1)[1])
        config = _load_config()
        if 0 <= idx < len(config["routes"]):
            removed = config["routes"].pop(idx)
            _save_config(config)
            _send(f"🗑 <b>{removed['name']}</b> o'chirildi.", _main_menu_keyboard())
        return
    if data.startswith("setcars:"):
        idx = int(data.split(":", 1)[1]) - 1
        config = _load_config()
        if 0 <= idx < len(config["routes"]):
            current = config["routes"][idx].get("car_types", [])
            notifier.edit_message(
                _bot_token, _chat_id, message_id,
                f"🚃 <b>{config['routes'][idx]['name']}</b> — vagon turlari:",
                _cars_keyboard(idx, current),
            )
        return
    if data.startswith("togglecar:"):
        _, idx_s, t = data.split(":", 2)
        idx = int(idx_s)
        config = _load_config()
        if 0 <= idx < len(config["routes"]):
            cars = config["routes"][idx].get("car_types", [])
            if t in cars:
                cars.remove(t)
            else:
                cars.append(t)
            config["routes"][idx]["car_types"] = cars
            _save_config(config)
            notifier.edit_message(
                _bot_token, _chat_id, message_id,
                f"🚃 <b>{config['routes'][idx]['name']}</b> — vagon turlari:",
                _cars_keyboard(idx, cars),
            )
        return
    if data.startswith("clearcars:"):
        idx = int(data.split(":", 1)[1])
        config = _load_config()
        if 0 <= idx < len(config["routes"]):
            config["routes"][idx]["car_types"] = []
            _save_config(config)
            notifier.edit_message(
                _bot_token, _chat_id, message_id,
                f"🚃 <b>{config['routes'][idx]['name']}</b> — vagon turlari:",
                _cars_keyboard(idx, []),
            )
        return
    if data.startswith("savecars:"):
        idx = int(data.split(":", 1)[1])
        config = _load_config()
        if 0 <= idx < len(config["routes"]):
            cars = config["routes"][idx].get("car_types", [])
            _send(
                f"✅ <b>{config['routes'][idx]['name']}</b> — saqlandi\n"
                f"🚃 {', '.join(cars) or 'barchasi'}",
                _main_menu_keyboard(),
            )
        return
    if data.startswith("wizcars:"):
        val = data.split(":", 1)[1]
        if val == "all":
            _wizard_finish([])
        else:
            _wizard_finish([val])
        return

    # Fallback
    _send("🤔 Bu tugma hozirda ishlamaydi.", _main_menu_keyboard())


# ---- polling --------------------------------------------------------------
def start_polling(bot_token: str, allowed_chat_id: str):
    """Long-polling in a daemon thread. Only processes messages from allowed_chat_id."""
    global _bot_token, _chat_id
    _bot_token = bot_token
    _chat_id = allowed_chat_id

    # Register commands with Telegram (menu button autocomplete)
    notifier.set_bot_commands(bot_token, BOT_COMMANDS)

    def _poll():
        offset = 0
        print("[bot] Polling started.")
        while True:
            try:
                resp = requests.get(
                    f"https://api.telegram.org/bot{bot_token}/getUpdates",
                    params={"timeout": 30, "offset": offset, "allowed_updates": '["message","callback_query","edited_message"]'},
                    timeout=40,
                )
                data = resp.json()
                if not data.get("ok"):
                    print(f"[bot] Telegram error: {data}")
                    time.sleep(5)
                    continue
                for update in data.get("result", []):
                    offset = update["update_id"] + 1
                    try:
                        _dispatch(update)
                    except Exception as e:
                        print(f"[bot] Dispatch error: {e}")
                        try:
                            _send(f"⚠️ Botda xatolik: <code>{e}</code>\nIltimos, qayta urinib ko'ring.")
                        except Exception:
                            pass
            except requests.exceptions.ReadTimeout:
                continue
            except Exception as e:
                print(f"[bot] Polling error: {e}")
                time.sleep(5)

    threading.Thread(target=_poll, daemon=True).start()


def _dispatch(update: dict):
    cb = update.get("callback_query")
    if cb:
        from_chat = str(cb.get("from", {}).get("id", ""))
        if from_chat != _chat_id:
            return
        data = cb.get("data", "")
        msg = cb.get("message", {})
        message_id = msg.get("message_id", 0)
        print(f"[bot] Callback: {data}")
        _handle_callback(data, cb.get("id", ""), message_id)
        return

    msg = update.get("message") or update.get("edited_message")
    if not msg:
        return
    chat_id = str(msg.get("chat", {}).get("id", ""))
    if chat_id != _chat_id:
        # Politely refuse strangers (once per message, still never silent to the owner)
        return
    text = msg.get("text", "")
    if not text:
        _send("📎 Matnli xabar yuboring. /help — buyruqlar ro'yxati.", _main_menu_keyboard())
        return
    print(f"[bot] Message: {text}")
    _handle_text(text)


# ---- legacy compat --------------------------------------------------------
def set_checknow_callback(fn):
    """Legacy shim — main.py now wires callbacks via runtime.set_callbacks()."""
    # Kept so older main.py invocations don't crash mid-upgrade; no-op.
    pass
