import os
import sys
import json
import time
import schedule
import requests
from datetime import date, datetime, timedelta
from pathlib import Path
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).parent))

import auth
import checker
import notifier
import state
import bot
import eventlog
import runtime

ROOT = Path(__file__).parent.parent
load_dotenv(ROOT / ".env")

# Track the scheduled check-job so we can reschedule on interval change.
_check_job = None


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


def _is_connection_error(e: Exception) -> bool:
    return isinstance(e, (requests.exceptions.ConnectionError, requests.exceptions.Timeout))


def run_checks(manual=False):
    # Respect the pause flag unless the user explicitly asked via /checknow
    if runtime.is_paused() and not manual:
        print("[main] Paused — skipping scheduled check.")
        return

    started = time.monotonic()
    config = load_config()
    bot_token = os.environ["TELEGRAM_BOT_TOKEN"]
    chat_id = os.environ["TELEGRAM_CHAT_ID"]

    all_dates = set()
    for route in config["routes"]:
        all_dates.update(expand_dates(route))
    state.cleanup_past_dates(all_dates)

    site_was_down = state.is_error_active("site_down")
    site_is_down = False
    any_tickets_found = False
    dates_checked = 0
    tickets_this_run = 0
    last_error: str | None = None

    for route in config["routes"]:
        if site_is_down:
            break

        name = route["name"]
        dep = route["dep_station_code"]
        arr = route["arr_station_code"]
        car_types = route.get("car_types") or None
        dates = expand_dates(route)

        today = date.today().isoformat()
        for check_date in dates:
            if check_date < today:
                continue
            try:
                print(f"[check] {name} | {check_date} ...", end=" ", flush=True)
                trains = checker.check_tickets(dep, arr, check_date, car_types)
                dates_checked += 1

                for train in trains:
                    any_tickets_found = True
                    tickets_this_run += 1
                    eventlog.log("ticket_found", route=name, date=check_date,
                                 train=train.number, seats=train.total_free)
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
                last_error = f"auth: {e}"
                if not state.is_error_active("auth_failed"):
                    notifier.send_message(bot_token, chat_id,
                                          notifier.format_error_alert(f"Login xatoligi:\n{e}"))
                    state.set_error_active("auth_failed", True)
                _finish_run(started, dates_checked, tickets_this_run, last_error)
                return

            except Exception as e:
                if _is_connection_error(e):
                    print(f"\n[main] Site unreachable: {e}")
                    site_is_down = True
                    last_error = "site unreachable"
                    break
                last_error = str(e)
                print(f"\n[main] Error checking {name} {check_date}: {e}")

    eventlog.log("check_done", routes=len(config["routes"]), dates=dates_checked, found=tickets_this_run)

    if site_is_down:
        eventlog.log("site_down")
        print("[main] Site unreachable — sending notification.")
        notifier.send_message(
            bot_token, chat_id,
            notifier.format_error_alert("eticket.railway.uz mavjud emas.\nKeyingi tekshirishda qayta uriniladi."),
        )
        state.set_error_active("site_down", True)
    else:
        if site_was_down:
            eventlog.log("site_up")
            print("[main] Site is back — sending recovery notification.")
            notifier.send_message(bot_token, chat_id, "✅ <b>eticket.railway.uz yana ishlayapti!</b>")
            state.set_error_active("site_down", False)
        elif manual and not any_tickets_found:
            notifier.send_message(bot_token, chat_id, "✅ Tekshirildi — hozircha bo'sh joy topilmadi.")
        elif manual and any_tickets_found:
            notifier.send_message(
                bot_token, chat_id,
                f"✅ Tekshirildi — {tickets_this_run} ta chipta topildi.",
            )

    if not site_is_down and state.is_error_active("auth_failed"):
        state.set_error_active("auth_failed", False)

    _finish_run(started, dates_checked, tickets_this_run, last_error)


def _finish_run(started: float, dates_checked: int, tickets: int, last_error: str | None):
    duration = time.monotonic() - started
    runtime.mark_check_end(duration, dates_checked, tickets, last_error)
    _update_next_check_time()


def _update_next_check_time():
    if _check_job is None or runtime.is_paused():
        runtime.set_next_check(None)
        return
    # schedule stores next_run as a datetime
    runtime.set_next_check(_check_job.next_run)


def send_daily_summary():
    bot_token = os.environ["TELEGRAM_BOT_TOKEN"]
    chat_id = os.environ["TELEGRAM_CHAT_ID"]

    since = datetime.now() - timedelta(hours=24)
    events = eventlog.read_since(since)

    checks = [e for e in events if e["type"] == "check_done"]
    tickets = [e for e in events if e["type"] == "ticket_found"]
    downs = [e for e in events if e["type"] == "site_down"]
    ups = [e for e in events if e["type"] == "site_up"]

    total_checks = len(checks)
    total_dates = sum(e.get("dates", 0) for e in checks)
    today_str = datetime.now().strftime("%-d-%B").replace("January", "yanvar").replace("February", "fevral") \
        .replace("March", "mart").replace("April", "aprel").replace("May", "may").replace("June", "iyun") \
        .replace("July", "iyul").replace("August", "avgust").replace("September", "sentabr") \
        .replace("October", "oktabr").replace("November", "noyabr").replace("December", "dekabr")

    if not tickets and not downs:
        msg = (
            f"📊 <b>Kunlik hisobot</b> — {today_str}\n"
            f"✅ {total_checks} tekshirish, chipta yoki uzilish yo'q."
        )
    else:
        lines = [f"📊 <b>Kunlik hisobot</b>\n🗓 {today_str} 23:59\n"]
        lines.append(f"✅ Tekshirishlar: {total_checks} marta")
        lines.append(f"🔍 Tekshirilgan sanalar: {total_dates} ta\n")

        if tickets:
            lines.append(f"🎫 <b>Topilgan chiptalar: {len(tickets)} ta</b>")
            for t in tickets:
                ts = datetime.fromisoformat(t["ts"]).strftime("%H:%M")
                lines.append(f"  • {t['route']} | {t['date']} | {t['train']} | {t['seats']} joy — {ts}")
            lines.append("")

        if downs:
            down_periods = []
            up_times = [datetime.fromisoformat(u["ts"]) for u in ups]
            total_minutes = 0
            for d in downs:
                d_ts = datetime.fromisoformat(d["ts"])
                recovery = next((u for u in up_times if u > d_ts), None)
                if recovery:
                    mins = int((recovery - d_ts).total_seconds() / 60)
                    total_minutes += mins
                    down_periods.append(f"  • {d_ts.strftime('%H:%M')} – {recovery.strftime('%H:%M')} ({mins} daq)")
                else:
                    down_periods.append(f"  • {d_ts.strftime('%H:%M')} – hali tiklanmagan")

            lines.append(f"🔴 <b>Sayt uzilishi: {len(downs)} marta (jami {total_minutes} daqiqa)</b>")
            lines.extend(down_periods)

        msg = "\n".join(lines)

    notifier.send_message(bot_token, chat_id, msg)


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


def reschedule(interval_minutes: int):
    """Cancel the current check job and install a new one at `interval_minutes`."""
    global _check_job
    if _check_job is not None:
        schedule.cancel_job(_check_job)
    _check_job = schedule.every(interval_minutes).minutes.do(run_checks)
    _update_next_check_time()
    print(f"[main] Rescheduled checks to every {interval_minutes} min.")


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

    runtime.set_callbacks(
        reschedule=reschedule,
        run_checks=run_checks,
        send_summary=send_daily_summary,
        send_heartbeat=send_heartbeat,
    )

    bot.start_polling(
        bot_token=os.environ["TELEGRAM_BOT_TOKEN"],
        allowed_chat_id=os.environ["TELEGRAM_CHAT_ID"],
    )

    run_checks()

    reschedule(interval)
    schedule.every().day.at(heartbeat_time).do(send_heartbeat)
    schedule.every().day.at("23:59").do(send_daily_summary)

    while True:
        schedule.run_pending()
        _update_next_check_time()
        time.sleep(5)


if __name__ == "__main__":
    main()
