"""
Seen trains state — prevents duplicate Telegram notifications.

State file: data/seen_trains.json
Format: { "RouteKey|date|trainNumber": free_seats_count }

Logic:
- Notify when train appears for the first time (not in state)
- Notify when seats were 0 and come back (state[key] == 0 and now > 0)
- Don't notify if train was already seen and still has seats
- Update state with current free_seats after each check
"""

import json
from pathlib import Path

STATE_FILE = Path(__file__).parent.parent / "data" / "seen_trains.json"


def _load() -> dict:
    if STATE_FILE.exists():
        try:
            return json.loads(STATE_FILE.read_text(encoding="utf-8"))
        except Exception:
            return {}
    return {}


def _save(state: dict):
    STATE_FILE.parent.mkdir(exist_ok=True)
    STATE_FILE.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")


def _key(route_name: str, date: str, train_number: str) -> str:
    return f"{route_name}|{date}|{train_number}"


def should_notify(route_name: str, date: str, train_number: str, free_seats: int) -> bool:
    """Returns True if we should send a Telegram notification for this train."""
    state = _load()
    k = _key(route_name, date, train_number)
    prev = state.get(k)
    # Notify if: never seen before, OR previously had 0 seats and now has seats
    return prev is None or prev == 0


def update(route_name: str, date: str, train_number: str, free_seats: int):
    """Update state with current seat count."""
    state = _load()
    state[_key(route_name, date, train_number)] = free_seats
    _save(state)


def mark_gone(route_name: str, date: str, train_number: str):
    """Mark a previously seen train as having 0 seats (so we can re-notify if it comes back)."""
    update(route_name, date, train_number, 0)


def cleanup_past_dates(current_dates: set[str]):
    """Remove entries for dates no longer being monitored."""
    state = _load()
    keys_to_remove = [k for k in state if k.split("|")[1] not in current_dates]
    for k in keys_to_remove:
        del state[k]
    if keys_to_remove:
        _save(state)
