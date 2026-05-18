import requests

TELEGRAM_API_BASE = "https://api.telegram.org/bot{token}"


def send_message(
    bot_token: str,
    chat_id: str,
    text: str,
    reply_markup: dict | None = None,
    disable_notification: bool = False,
) -> bool:
    url = TELEGRAM_API_BASE.format(token=bot_token) + "/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "HTML",
        "disable_web_page_preview": True,
        "disable_notification": disable_notification,
    }
    if reply_markup is not None:
        payload["reply_markup"] = reply_markup
    try:
        resp = requests.post(url, json=payload, timeout=15)
        return resp.status_code == 200
    except Exception as e:
        print(f"[notifier] Telegram send error: {e}")
        return False


def edit_message(
    bot_token: str,
    chat_id: str,
    message_id: int,
    text: str,
    reply_markup: dict | None = None,
) -> bool:
    url = TELEGRAM_API_BASE.format(token=bot_token) + "/editMessageText"
    payload = {
        "chat_id": chat_id,
        "message_id": message_id,
        "text": text,
        "parse_mode": "HTML",
        "disable_web_page_preview": True,
    }
    if reply_markup is not None:
        payload["reply_markup"] = reply_markup
    try:
        resp = requests.post(url, json=payload, timeout=15)
        return resp.status_code == 200
    except Exception as e:
        print(f"[notifier] Telegram edit error: {e}")
        return False


def answer_callback(bot_token: str, callback_id: str, text: str = "", show_alert: bool = False) -> bool:
    url = TELEGRAM_API_BASE.format(token=bot_token) + "/answerCallbackQuery"
    payload = {"callback_query_id": callback_id, "text": text, "show_alert": show_alert}
    try:
        resp = requests.post(url, json=payload, timeout=10)
        return resp.status_code == 200
    except Exception as e:
        print(f"[notifier] Telegram callback-answer error: {e}")
        return False


def send_chat_action(bot_token: str, chat_id: str, action: str = "typing") -> bool:
    url = TELEGRAM_API_BASE.format(token=bot_token) + "/sendChatAction"
    try:
        resp = requests.post(url, json={"chat_id": chat_id, "action": action}, timeout=10)
        return resp.status_code == 200
    except Exception:
        return False


def set_bot_commands(bot_token: str, commands: list[dict]) -> bool:
    url = TELEGRAM_API_BASE.format(token=bot_token) + "/setMyCommands"
    try:
        resp = requests.post(url, json={"commands": commands}, timeout=10)
        return resp.status_code == 200
    except Exception as e:
        print(f"[notifier] setMyCommands error: {e}")
        return False


# Car types where odd seat numbers are lower berths and even are upper.
# Convention holds for плацкарта (side + main) and купе (4-berth compartments).
_BERTH_TYPES = {"плацкарта", "купе"}


def _split_berths(places: list[int]) -> tuple[list[int], list[int]]:
    lower = sorted(p for p in places if p % 2 == 1)
    upper = sorted(p for p in places if p % 2 == 0)
    return lower, upper


def format_ticket_alert(route_name: str, date: str, trains) -> str:
    lines = [
        "🚂 <b>Chipta topildi!</b>",
        f"📍 Marshrut: <b>{route_name}</b>",
        f"📅 Sana: <b>{date}</b>",
        "",
    ]

    for train in trains:
        lines.append(
            f"• <b>{train.number}</b> ({train.brand})\n"
            f"  🕐 {train.departure} → {train.arrival} ({train.time_on_way})\n"
            f"  💺 Jami: <b>{train.total_free} ta</b>"
        )

        if train.cars_detail:
            by_type: dict[str, list] = {}
            for car in train.cars_detail:
                if car.free_seats > 0:
                    by_type.setdefault(car.type, []).append(car)

            for car_type, cars in by_type.items():
                lines.append(f"  🪑 <b>{car_type}</b>:")
                use_berths = car_type in _BERTH_TYPES
                for car in cars:
                    if use_berths:
                        lower, upper = _split_berths(car.places)
                        lines.append(f"     Vagon {car.number} ({car.free_seats} ta):")
                        if lower:
                            preview = ", ".join(str(p) for p in lower[:12])
                            extra = " ..." if len(lower) > 12 else ""
                            lines.append(f"        ⬇️ pastki ({len(lower)}): {preview}{extra}")
                        if upper:
                            preview = ", ".join(str(p) for p in upper[:12])
                            extra = " ..." if len(upper) > 12 else ""
                            lines.append(f"        ⬆️ tepa   ({len(upper)}): {preview}{extra}")
                    else:
                        preview = ", ".join(str(p) for p in car.places[:12])
                        extra = " ..." if len(car.places) > 12 else ""
                        lines.append(f"     Vagon {car.number}: {car.free_seats} joy ({preview}{extra})")
        else:
            car_str = ", ".join(train.car_types) if train.car_types else "mavjud"
            lines.append(f"  🪑 {car_str}")

        lines.append("")

    lines.append('🔗 <a href="https://eticket.railway.uz/uz/home">Bilet olish</a>')
    return "\n".join(lines)


def format_error_alert(message: str) -> str:
    return f"⚠️ <b>Xatolik:</b>\n{message}"
