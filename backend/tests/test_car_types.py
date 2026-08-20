"""Every car-type spelling railway.uz actually returns must normalise.

An unmapped spelling is not a cosmetic problem: `matcher` compares the
normalised value against the canonical type the subscriber stored, so a
mismatch means that train can never trigger a notification — silently, forever.

That is exactly what happened to seated cars. The map carried "sidyachiy", a
transliteration railway.uz has never once sent, while the value it really sends
— "O'rindiqli" — was absent. Seated cars were 57% of all car rows in a 12-route
sample, and none of them could match a "сидячий" subscription.

The values below were collected live from both endpoints, not invented.
"""

from __future__ import annotations

import pytest

from app.railway.models import (
    BERTH_TYPES,
    CAR_TYPE_MAP,
    VALID_CAR_TYPES,
    normalize_car_type,
)

# detail endpoint `type` — the stable Cyrillic code we match on
DETAIL_TYPES = ["Сидячий", "Купе", "Плацкартный"]

# detail `typeShow` + list `type` — localised display labels
DISPLAY_TYPES = [
    "Plaskartli", "Kupe", "O'rindiqli", "SV", "Umumiy",
    "Coupe", "Sitting", "Sleeper", "Biznes", "Ekonom", "VIP",
]


@pytest.mark.parametrize("raw", DETAIL_TYPES + DISPLAY_TYPES)
def test_every_observed_spelling_maps_to_a_canonical_type(raw):
    got = normalize_car_type(raw)
    assert got in VALID_CAR_TYPES, (
        f"{raw!r} normalised to {got!r}, which is not canonical — a "
        f"subscription on this type could never be matched."
    )


@pytest.mark.parametrize("raw,expected", [
    ("Сидячий", "сидячий"),
    ("O'rindiqli", "сидячий"),      # the regression that broke seated trains
    ("Sitting", "сидячий"),
    ("Плацкартный", "плацкарта"),
    ("Plaskartli", "плацкарта"),
    ("Купе", "купе"),
    ("Kupe", "купе"),
    ("Coupe", "купе"),
    ("SV", "св"),
    ("Umumiy", "общий"),
    ("Ekonom", "эконом"),
    ("Biznes", "бизнес"),
])
def test_specific_mappings(raw, expected):
    assert normalize_car_type(raw) == expected


def test_apostrophe_variants_all_land_on_seated():
    """Uzbek "oʻ" appears with three different apostrophe characters."""
    for variant in ["o'rindiqli", "oʻrindiqli", "o‘rindiqli", "orindiqli"]:
        assert normalize_car_type(variant) == "сидячий", variant


def test_case_and_padding_are_ignored():
    assert normalize_car_type("  PLASKARTLI  ") == "плацкарта"
    assert normalize_car_type("kUpE") == "купе"


def test_canonical_types_are_stable_under_normalisation():
    """Normalising an already-canonical value must be a no-op, since stored
    subscriptions hold canonical values and get re-normalised on comparison."""
    for t in VALID_CAR_TYPES:
        assert normalize_car_type(t) == t


def test_every_map_value_is_canonical():
    unknown = sorted({v for v in CAR_TYPE_MAP.values()} - set(VALID_CAR_TYPES))
    assert not unknown, f"map points at non-canonical values: {unknown}"


def test_berth_types_are_a_subset_of_canonical():
    assert BERTH_TYPES <= set(VALID_CAR_TYPES)


@pytest.mark.parametrize("raw", ["", None, "   "])
def test_empty_input_is_empty(raw):
    assert normalize_car_type(raw) == ""
