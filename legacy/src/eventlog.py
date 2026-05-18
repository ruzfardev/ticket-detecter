"""
Event log — append-only structured log of check events.

File: data/events.jsonl (one JSON object per line)

Event types:
  ticket_found  — route, date, train, seats
  site_down     —
  site_up       —
  check_done    — routes, dates, found
"""

import json
from datetime import datetime
from pathlib import Path

LOG_FILE = Path(__file__).parent.parent / "data" / "events.jsonl"


def log(type: str, **kwargs):
    """Append one event with current timestamp."""
    entry = {"ts": datetime.now().isoformat(timespec="seconds"), "type": type}
    entry.update(kwargs)
    LOG_FILE.parent.mkdir(exist_ok=True)
    with LOG_FILE.open("a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")


def read_since(since: datetime) -> list[dict]:
    """Return all events with ts >= since."""
    if not LOG_FILE.exists():
        return []
    events = []
    with LOG_FILE.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                entry = json.loads(line)
                if datetime.fromisoformat(entry["ts"]) >= since:
                    events.append(entry)
            except Exception:
                continue
    return events
