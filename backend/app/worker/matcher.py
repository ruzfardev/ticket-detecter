"""
Match a subscription against a list of CarDetail.

Returns a snapshot dict suitable for notification_log.seats_snapshot:
  { car_number: {"lower": [seat#], "upper": [seat#]} }     # for плацкарта/купе
  { car_number: {"places": [seat#]} }                       # other types

Returns None if nothing matches (so worker skips notification).
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass

from app.railway.models import BERTH_TYPES, CarDetail


@dataclass(slots=True)
class SubFilter:
    train_numbers: list[str]       # empty = any
    car_types: list[str]           # empty = any
    berth: str                     # 'lower' | 'upper' | 'any'


def match(filt: SubFilter, train_number: str, cars: list[CarDetail]) -> dict | None:
    """Return snapshot dict, or None if no seats match."""
    if filt.train_numbers and train_number not in filt.train_numbers:
        return None

    car_type_set = set(filt.car_types) if filt.car_types else None
    snapshot: dict[str, dict] = {}

    for car in cars:
        if car_type_set is not None and car.type not in car_type_set:
            continue
        if not car.places:
            continue

        if car.type in BERTH_TYPES:
            lower = sorted(p for p in car.places if p % 2 == 1)
            upper = sorted(p for p in car.places if p % 2 == 0)

            if filt.berth == "lower":
                if not lower:
                    continue
                snapshot[car.number] = {"lower": lower, "upper": []}
            elif filt.berth == "upper":
                if not upper:
                    continue
                snapshot[car.number] = {"lower": [], "upper": upper}
            else:  # any
                snapshot[car.number] = {"lower": lower, "upper": upper}
        else:
            # Other car types — berth has no meaning
            snapshot[car.number] = {"places": sorted(car.places)}

    return snapshot or None


def snapshot_hash(snapshot: dict) -> str:
    canonical = json.dumps(snapshot, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode()).hexdigest()[:16]


def count_seats(snapshot: dict) -> int:
    total = 0
    for car in snapshot.values():
        total += len(car.get("lower", []))
        total += len(car.get("upper", []))
        total += len(car.get("places", []))
    return total
