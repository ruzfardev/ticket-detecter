"""
Seen trains state — prevents duplicate Telegram notifications.

State file: data/seen_trains.json
Format:
  {
    "trains": { "RouteKey|date|trainNumber": free_seats_count },
    "active_errors": { "site_down": true, ... }
  }

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
            data = json.loads(STATE_FILE.read_text(encoding="utf-8"))
            # migrate old flat format → new nested format
            if data and "trains" not in data and "active_errors" not in data:
                return {"trains": data, "active_errors": {}}
            data.setdefault("trains", {})
            data.setdefault("active_errors", {})
            return data
        except Exception:
            pass
    return {"trains": {}, "active_errors": {}}


def _save(state: dict):
    STATE_FILE.parent.mkdir(exist_ok=True)
    STATE_FILE.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")


def is_error_active(error_key: str) -> bool:
    """Returns True if this error was already reported and not yet resolved."""
    state = _load()
    return state.get("active_errors", {}).get(error_key, False)


def set_error_active(error_key: str, active: bool):
    """Mark an error as active (True) or resolved (False)."""
    state = _load()
    if "active_errors" not in state:
        state["active_errors"] = {}
    state["active_errors"][error_key] = active
    _save(state)


def _key(route_name: str, date: str, train_number: str) -> str:
    return f"{route_name}|{date}|{train_number}"


def should_notify(route_name: str, date: str, train_number: str, free_seats: int) -> bool:
    """Returns True if we should send a Telegram notification for this train."""
    state = _load()
    k = _key(route_name, date, train_number)
    prev = state.get("trains", {}).get(k)
    # Notify if: never seen before, OR previously had 0 seats and now has seats
    return prev is None or prev == 0


def update(route_name: str, date: str, train_number: str, free_seats: int):
    """Update state with current seat count."""
    state = _load()
    if "trains" not in state:
        state["trains"] = {}
    state["trains"][_key(route_name, date, train_number)] = free_seats
    _save(state)


def mark_gone(route_name: str, date: str, train_number: str):
    """Mark a previously seen train as having 0 seats (so we can re-notify if it comes back)."""
    update(route_name, date, train_number, 0)


def cleanup_past_dates(current_dates: set[str]):
    """Remove entries for dates no longer being monitored."""
    state = _load()
    trains = state.get("trains", {})
    keys_to_remove = [k for k in trains if k.split("|")[1] not in current_dates]
    for k in keys_to_remove:
        del trains[k]
    if keys_to_remove:
        state["trains"] = trains
        _save(state)
