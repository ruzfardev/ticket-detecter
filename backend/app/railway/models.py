"""Domain models for railway.uz data + car-type normalization."""

from __future__ import annotations

from dataclasses import dataclass, field

# Raw API spellings -> canonical (cyrillic, lowercase).
#
# railway.uz uses TWO different vocabularies and they are not interchangeable:
#   * the detail endpoint's `type` is a stable Cyrillic code — Сидячий, Купе,
#     Плацкартный. This is what we normalise and match on.
#   * `typeShow` (detail) and `type` (list) are localised display labels that
#     vary by brand and language: "O'rindiqli", "Kupe", "Sitting", "Coupe".
#
# Every spelling below was observed live across 12 routes and 5 dates, not
# guessed. The old map contained "sidyachiy", a transliteration railway.uz has
# never once returned, while the value it actually sends for seated cars —
# "O'rindiqli" — was missing. Seated cars are 57% of all car rows, and none of
# them could ever match a "сидячий" subscription.
CAR_TYPE_MAP: dict[str, str] = {
    # плацкарта
    "плацкартный": "плацкарта",
    "плацкарта": "плацкарта",
    "plaskartli": "плацкарта",
    "plackartli": "плацкарта",
    # купе
    "купе": "купе",
    "kupe": "купе",
    "coupe": "купе",
    # сидячий — the one that was broken
    "сидячий": "сидячий",
    "o'rindiqli": "сидячий",
    "oʻrindiqli": "сидячий",     # U+02BB, the typographic apostrophe
    "o‘rindiqli": "сидячий",     # U+2018, another variant seen in the wild
    "orindiqli": "сидячий",
    "sitting": "сидячий",
    "sidyachiy": "сидячий",      # kept: harmless, and was the historical key
    # люкс
    "люкс": "люкс",
    "lyuks": "люкс",
    "lux": "люкс",
    "vip": "люкс",
    # св
    "св": "св",
    "sv": "св",
    "sleeper": "св",
    # общий
    "общий": "общий",
    "umumiy": "общий",
    "general": "общий",
    # Afrosiyob seat classes — distinct products, not a flavour of сидячий.
    "эконом": "эконом",
    "ekonom": "эконом",
    "economy": "эконом",
    "бизнес": "бизнес",
    "biznes": "бизнес",
    "business": "бизнес",
}

VALID_CAR_TYPES = [
    "плацкарта", "купе", "люкс", "св", "сидячий", "общий", "эконом", "бизнес",
]

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
    # Cheapest tariff for this car type, in so'm. None when the API omits it.
    price_uzs: int | None = None
    raw_type: str = ""          # the API's own spelling, e.g. "Plaskartli"


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
