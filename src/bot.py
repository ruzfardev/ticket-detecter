"""
Telegram bot command handler — runs in a background thread alongside the scheduler.

Commands:
  /routes              — show current routes and dates
  /interval <minutes>  — change check interval
  /setdates <n> <from> <to>  — set date range for route #n (1-indexed)
  /checknow            — trigger immediate check
"""

import json
import threading
import requests
from pathlib import Path

ROOT = Path(__file__).parent.parent
CONFIG_FILE = ROOT / "config.json"

_on_checknow = None  # callback set by main.py


def set_checknow_callback(fn):
    global _on_checknow
    _on_checknow = fn


def _load_config() -> dict:
    return json.loads(CONFIG_FILE.read_text(encoding="utf-8"))


def _save_config(config: dict):
    CONFIG_FILE.write_text(json.dumps(config, ensure_ascii=False, indent=2), encoding="utf-8")


def _send(token: str, chat_id: str, text: str):
    try:
        requests.post(
            f"https://api.telegram.org/bot{token}/sendMessage",
            json={"chat_id": chat_id, "text": text, "parse_mode": "HTML", "disable_web_page_preview": True},
            timeout=10,
        )
    except Exception as e:
        print(f"[bot] Send error: {e}")


def _handle(token: str, chat_id: str, text: str):
    text = text.strip()

    # /routes
    if text == "/routes":
        config = _load_config()
        lines = [f"📋 <b>Marshrutlar:</b>\n"]
        for i, r in enumerate(config["routes"], 1):
            d_from = r.get("date_from") or r.get("dates", ["?"])[0]
            d_to = r.get("date_to") or r.get("dates", ["?"])[-1]
            lines.append(
                f"{i}. <b>{r['name']}</b>\n"
                f"   📅 {d_from} → {d_to}\n"
                f"   🚗 Vagon: {', '.join(r['car_types']) or 'barchasi'}"
            )
        lines.append(f"\n⏱ Interval: {config.get('check_interval_minutes', 15)} daqiqa")
        _send(token, chat_id, "\n".join(lines))

    # /interval <n>
    elif text.startswith("/interval"):
        parts = text.split()
        if len(parts) != 2 or not parts[1].isdigit():
            _send(token, chat_id, "❌ Ishlatish: /interval 10")
            return
        minutes = int(parts[1])
        if minutes < 1 or minutes > 120:
            _send(token, chat_id, "❌ Interval 1–120 daqiqa orasida bo'lishi kerak.")
            return
        config = _load_config()
        config["check_interval_minutes"] = minutes
        _save_config(config)
        _send(token, chat_id, f"✅ Interval <b>{minutes} daqiqa</b> ga o'zgartirildi.\n⚠️ Botni qayta ishga tushiring.")

    # /setdates <n> <from> <to>
    elif text.startswith("/setdates"):
        parts = text.split()
        if len(parts) != 4:
            _send(token, chat_id, "❌ Ishlatish: /setdates 1 2026-04-01 2026-04-10")
            return
        try:
            idx = int(parts[1]) - 1
            d_from, d_to = parts[2], parts[3]
            # Validate date format
            from datetime import date as _date
            _date.fromisoformat(d_from)
            _date.fromisoformat(d_to)
        except (ValueError, IndexError):
            _send(token, chat_id, "❌ Noto'g'ri format. Misol: /setdates 1 2026-04-01 2026-04-10")
            return

        config = _load_config()
        if idx < 0 or idx >= len(config["routes"]):
            _send(token, chat_id, f"❌ Marshrut #{idx+1} mavjud emas. /routes bilan ko'ring.")
            return

        route = config["routes"][idx]
        route.pop("dates", None)
        route["date_from"] = d_from
        route["date_to"] = d_to
        _save_config(config)
        _send(
            token, chat_id,
            f"✅ <b>{route['name']}</b> sanalari yangilandi:\n"
            f"📅 {d_from} → {d_to}"
        )

    # /checknow
    elif text == "/checknow":
        _send(token, chat_id, "🔍 Tekshirilmoqda...")
        if _on_checknow:
            threading.Thread(target=_on_checknow, daemon=True).start()
        else:
            _send(token, chat_id, "❌ Checker hali tayyor emas.")

    elif text.startswith("/"):
        _send(
            token, chat_id,
            "❓ <b>Mavjud commandlar:</b>\n"
            "/routes — marshrutlarni ko'rish\n"
            "/interval 15 — tekshirish intervalini o'zgartirish\n"
            "/setdates 1 2026-04-01 2026-04-10 — marshrut sanalarini o'zgartirish\n"
            "/checknow — hozir tekshirish"
        )


def start_polling(bot_token: str, allowed_chat_id: str):
    """Start long-polling in a daemon thread. Only processes messages from allowed_chat_id."""

    def _poll():
        offset = 0
        print(f"[bot] Polling started.")
        while True:
            try:
                resp = requests.get(
                    f"https://api.telegram.org/bot{bot_token}/getUpdates",
                    params={"timeout": 30, "offset": offset},
                    timeout=40,
                )
                updates = resp.json().get("result", [])
                for update in updates:
                    offset = update["update_id"] + 1
                    msg = update.get("message") or update.get("edited_message")
                    if not msg:
                        continue
                    chat_id = str(msg.get("chat", {}).get("id", ""))
                    text = msg.get("text", "")
                    if chat_id != allowed_chat_id:
                        continue
                    if text:
                        print(f"[bot] Command: {text}")
                        _handle(bot_token, chat_id, text)
            except Exception as e:
                print(f"[bot] Polling error: {e}")
                import time; time.sleep(5)

    t = threading.Thread(target=_poll, daemon=True)
    t.start()
