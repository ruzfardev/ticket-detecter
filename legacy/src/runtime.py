"""
Shared runtime state between the scheduler (main.py) and the Telegram bot (bot.py).

Kept as module-level primitives — single-process, single-threaded scheduler,
bot polling runs in a daemon thread. Mutations from the bot thread are limited
to simple flags; the scheduler reads them on each tick.
"""

from datetime import datetime
from threading import Lock
from typing import Callable, Optional

_lock = Lock()

started_at: datetime = datetime.now()
paused: bool = False

last_check_at: Optional[datetime] = None
last_check_duration_s: float = 0.0
last_check_dates: int = 0
last_check_tickets: int = 0
last_check_error: Optional[str] = None

next_check_at: Optional[datetime] = None

total_checks_run: int = 0
total_tickets_found: int = 0

# Callbacks wired up by main.py
_reschedule_cb: Optional[Callable[[int], None]] = None
_run_checks_cb: Optional[Callable[..., None]] = None
_send_summary_cb: Optional[Callable[[], None]] = None
_send_heartbeat_cb: Optional[Callable[[], None]] = None


def set_callbacks(
    reschedule: Callable[[int], None],
    run_checks: Callable[..., None],
    send_summary: Callable[[], None],
    send_heartbeat: Callable[[], None],
):
    global _reschedule_cb, _run_checks_cb, _send_summary_cb, _send_heartbeat_cb
    _reschedule_cb = reschedule
    _run_checks_cb = run_checks
    _send_summary_cb = send_summary
    _send_heartbeat_cb = send_heartbeat


def reschedule(interval_minutes: int):
    if _reschedule_cb:
        _reschedule_cb(interval_minutes)


def run_checks_now(manual: bool = True):
    if _run_checks_cb:
        _run_checks_cb(manual=manual)


def send_summary_now():
    if _send_summary_cb:
        _send_summary_cb()


def send_heartbeat_now():
    if _send_heartbeat_cb:
        _send_heartbeat_cb()


def set_pause(value: bool):
    global paused
    with _lock:
        paused = value


def is_paused() -> bool:
    return paused


def mark_check_start():
    pass


def mark_check_end(duration_s: float, dates: int, tickets: int, error: Optional[str] = None):
    global last_check_at, last_check_duration_s, last_check_dates, last_check_tickets
    global last_check_error, total_checks_run, total_tickets_found
    with _lock:
        last_check_at = datetime.now()
        last_check_duration_s = duration_s
        last_check_dates = dates
        last_check_tickets = tickets
        last_check_error = error
        total_checks_run += 1
        total_tickets_found += tickets


def set_next_check(when: Optional[datetime]):
    global next_check_at
    with _lock:
        next_check_at = when


def uptime_str() -> str:
    delta = datetime.now() - started_at
    total = int(delta.total_seconds())
    days, rem = divmod(total, 86400)
    hours, rem = divmod(rem, 3600)
    minutes, _ = divmod(rem, 60)
    if days:
        return f"{days}k {hours}s {minutes}d"
    if hours:
        return f"{hours}s {minutes}d"
    return f"{minutes}d"
