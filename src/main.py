import os
import sys
import json
import time
import schedule
from datetime import date, timedelta
from pathlib import Path
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).parent))

import auth
import checker
import notifier
import state
import bot

ROOT = Path(__file__).parent.parent
load_dotenv(ROOT / ".env")


def load_config() -> dict:
    with open(ROOT / "config.json", "r", encoding="utf-8") as f:
        return json.load(f)


def expand_dates(route: dict) -> list[str]:
    """Returns list of 'YYYY-MM-DD' strings from either 'dates' list or 'date_from'/'date_to' range."""
    if "dates" in route:
        return route["dates"]
    d_from = date.fromisoformat(route["date_from"])
    d_to = date.fromisoformat(route["date_to"])
    result = []
    current = d_from
    while current <= d_to:
        result.append(current.isoformat())
        current += timedelta(days=1)
    return result


def run_checks():
    config = load_config()
    bot_token = os.environ["TELEGRAM_BOT_TOKEN"]
    chat_id = os.environ["TELEGRAM_CHAT_ID"]

    # Collect all monitored dates for state cleanup
    all_dates = set()
    for route in config["routes"]:
        all_dates.update(expand_dates(route))
    state.cleanup_past_dates(all_dates)

    for route in config["routes"]:
        name = route["name"]
        dep = route["dep_station_code"]
        arr = route["arr_station_code"]
        car_types = route.get("car_types") or None
        dates = expand_dates(route)

        for check_date in dates:
            try:
                print(f"[check] {name} | {check_date} ...", end=" ", flush=True)
                trains = checker.check_tickets(dep, arr, check_date, car_types)

                seen_numbers = set()
                for train in trains:
                    seen_numbers.add(train.number)
                    if state.should_notify(name, check_date, train.number, train.total_free):
                        print(f"NOTIFY {train.number} ({train.total_free} seats)")
                        msg = notifier.format_ticket_alert(name, check_date, [train])
                        notifier.send_message(bot_token, chat_id, msg)
                    else:
                        print(f"skip {train.number} (already notified)", end=" ")
                    state.update(name, check_date, train.number, train.total_free)

                if not trains:
                    print("no tickets")

            except RuntimeError as e:
                print(f"\n[main] Auth error: {e}")
                notifier.send_message(bot_token, chat_id, notifier.format_error_alert(f"Login xatoligi:\n{e}"))
                return

            except Exception as e:
                print(f"\n[main] Error checking {name} {check_date}: {e}")
                notifier.send_message(bot_token, chat_id, notifier.format_error_alert(f"{name} | {check_date}\n{e}"))


def send_heartbeat():
    config = load_config()
    bot_token = os.environ["TELEGRAM_BOT_TOKEN"]
    chat_id = os.environ["TELEGRAM_CHAT_ID"]
    route_lines = "\n".join(
        f"  • {r['name']} ({r.get('date_from', '')} – {r.get('date_to', '')})"
        for r in config["routes"]
    )
    msg = (
        f"✅ <b>Bot ishlayapti</b>\n\n"
        f"Kuzatilayotgan marshrutlar:\n{route_lines}\n\n"
        f"Tekshirish intervali: {config.get('check_interval_minutes', 15)} daqiqa"
    )
    notifier.send_message(bot_token, chat_id, msg)


def main():
    auth.init(
        username=os.environ["RAILWAY_USERNAME"],
        password=os.environ["RAILWAY_PASSWORD"],
    )

    config = load_config()
    interval = config.get("check_interval_minutes", 15)
    heartbeat_time = config.get("heartbeat_time", "08:00")

    print(f"[main] Ticket checker started. Interval: {interval} min, Heartbeat: {heartbeat_time}")
    print(f"[main] Routes: {len(config['routes'])}")

    bot.set_checknow_callback(run_checks)
    bot.start_polling(
        bot_token=os.environ["TELEGRAM_BOT_TOKEN"],
        allowed_chat_id=os.environ["TELEGRAM_CHAT_ID"],
    )

    run_checks()

    schedule.every(interval).minutes.do(run_checks)
    schedule.every().day.at(heartbeat_time).do(send_heartbeat)

    while True:
        schedule.run_pending()
        time.sleep(30)


if __name__ == "__main__":
    main()
