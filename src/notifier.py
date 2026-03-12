import requests

TELEGRAM_API = "https://api.telegram.org/bot{token}/sendMessage"


def send_message(bot_token: str, chat_id: str, text: str) -> bool:
    url = TELEGRAM_API.format(token=bot_token)
    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "HTML",
        "disable_web_page_preview": True,
    }
    try:
        resp = requests.post(url, json=payload, timeout=15)
        return resp.status_code == 200
    except Exception as e:
        print(f"[notifier] Telegram send error: {e}")
        return False


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
            f"  💺 Jami bo'sh: <b>{train.total_free} ta</b>"
        )

        if train.cars_detail:
            # Group by car type
            by_type: dict[str, list] = {}
            for car in train.cars_detail:
                if car.free_seats > 0:
                    by_type.setdefault(car.type, []).append(car)

            for car_type, cars in by_type.items():
                lines.append(f"  🪑 <b>{car_type}</b>:")
                for car in cars:
                    places_str = ", ".join(str(p) for p in car.places[:10])
                    extra = f" ..." if len(car.places) > 10 else ""
                    lines.append(f"     Vagon {car.number}: {car.free_seats} joy ({places_str}{extra})")
        else:
            # Fallback to summary from list endpoint
            car_str = ", ".join(train.car_types) if train.car_types else "mavjud"
            lines.append(f"  🪑 {car_str}")

        lines.append("")

    lines.append(f'🔗 <a href="https://eticket.railway.uz/uz/home">Bilet olish</a>')
    return "\n".join(lines)


def format_error_alert(message: str) -> str:
    return f"⚠️ <b>Xatolik:</b>\n{message}"
