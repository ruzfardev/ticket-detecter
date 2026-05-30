"""Domain models for railway.uz data + car-type normalization."""

from __future__ import annotations

from dataclasses import dataclass, field

# Raw API spellings -> canonical (cyrillic, lowercase).
CAR_TYPE_MAP: dict[str, str] = {
    "plaskartli": "плацкарта",
    "плацкартный": "плацкарта",
    "плацкарта": "плацкарта",
    "kupe": "купе",
    "купе": "купе",
    "lyuks": "люкс",
    "люкс": "люкс",
    "sv": "св",
    "св": "св",
    "sidyachiy": "сидячий",
    "сидячий": "сидячий",
}

VALID_CAR_TYPES = ["плацкарта", "купе", "люкс", "св", "сидячий"]

# Only these have meaningful odd=lower / even=upper berth semantics.
BERTH_TYPES = {"плацкарта", "купе"}


def normalize_car_type(raw: str | None) -> str:
    if not raw:
        return ""
    key = raw.strip().lower()
    return CAR_TYPE_MAP.get(key, key)


@dataclass(slots=True)
class CarSummary:
    """One car-type aggregate inside a TrainSummary."""
    type: str
    free_seats: int


@dataclass(slots=True)
class TrainSummary:
    """Output of `list_trains` — one row per train."""
    number: str
    brand: str
    departure: str        # ISO datetime string from API
    arrival: str
    time_on_way: str
    dep_station: str
    arr_station: str
    cars: list[CarSummary]
    train_id: str | None

    @property
    def total_free(self) -> int:
        return sum(c.free_seats for c in self.cars)


@dataclass(slots=True)
class CarDetail:
    """One physical car inside a TrainDetail."""
    number: str
    type: str
    places: list[int]
    class_service: str = ""        # e.g. '2Е', '3П' — needed by universal-orders/create
    raw_car_type: str = ""         # original Cyrillic, e.g. 'Сидячий', 'Плацкартный'

    @property
    def free_seats(self) -> int:
        return len(self.places)


# Alias for compat with legacy code expecting AvailableTrain
AvailableTrain = TrainSummary
