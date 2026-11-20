"""Auto-buy seats for a group: together means one compartment, never the aisle.

Before this, the worker took the lowest free numbers in the car, so two people
could be seated at 3 and 17. "Together" is what a family means by it: 1-3, 5-7,
2-4 — the berths of one compartment. The side berths (37-54 in a плацкарт) are
across the aisle and do not count.
"""

from __future__ import annotations

from app.worker.seats import pick_partial, pick_seats, pick_together

PLATS = "плацкарта"
KUPE = "купе"
SV = "св"
SEATED = "сидячий"


# ---- together ---------------------------------------------------------------

def test_two_lower_berths_of_one_compartment_win():
    assert pick_together(PLATS, [1, 2, 3, 17], 2) == [1, 3]


def test_compartment_of_upper_berths_when_that_is_all_there_is():
    assert pick_together(PLATS, [2, 4, 9, 20], 2) == [2, 4]


def test_seats_in_different_compartments_are_not_together():
    # 3 and 5 are neighbours by number but a wall apart.
    assert pick_together(PLATS, [3, 5], 2) is None


def test_side_berths_never_count():
    assert pick_together(PLATS, [53, 54], 2) is None
    assert pick_together(PLATS, [36, 37], 2) is None


def test_lower_berths_preferred_over_an_earlier_compartment():
    # Compartment 1 offers lower+upper, compartment 2 two lowers.
    assert pick_together(PLATS, [1, 2, 5, 7], 2) == [5, 7]


def test_front_of_car_breaks_ties():
    assert pick_together(PLATS, [9, 11, 1, 3], 2) == [1, 3]


def test_kupe_compartments_of_four():
    assert pick_together(KUPE, [4, 5], 2) is None
    assert pick_together(KUPE, [5, 6, 7, 8], 3) == [5, 6, 7]


def test_sv_compartments_of_two():
    assert pick_together(SV, [2, 3], 2) is None
    assert pick_together(SV, [3, 4], 2) == [3, 4]


def test_group_larger_than_a_compartment_spreads_to_the_next_one():
    free = [1, 2, 3, 4, 5, 7]
    assert pick_together(PLATS, free, 5) == [1, 2, 3, 5, 7]   # lowers first
    assert pick_together(PLATS, free, 6) == [1, 2, 3, 4, 5, 7]


def test_spread_needs_neighbouring_compartments():
    # Compartments 1 and 3 with an empty one between them.
    assert pick_together(PLATS, [1, 2, 3, 9, 11], 5) is None


def test_fewer_compartments_win_over_lower_berths():
    # 4 people: one full compartment beats two half-empty ones.
    assert pick_together(PLATS, [1, 3, 5, 7, 9, 10, 11, 12], 4) == [9, 10, 11, 12]


def test_seated_cars_use_consecutive_numbers():
    assert pick_together(SEATED, [4, 7, 8, 12], 2) == [7, 8]
    assert pick_together(SEATED, [4, 6, 8], 2) is None


def test_single_passenger_is_always_together_outside_side_berths():
    assert pick_together(PLATS, [40, 17], 1) == [17]
    assert pick_together(PLATS, [40], 1) is None


# ---- pick_seats: the subscription's choice ----------------------------------

def test_together_refuses_scattered_seats():
    assert pick_seats(PLATS, [3, 17], 2, "together") is None


def test_any_takes_scattered_seats_when_nothing_better():
    assert pick_seats(PLATS, [3, 17], 2, "any") == ([3, 17], False)


def test_any_still_prefers_a_compartment():
    # The old rule took the lowest numbers, 1 and 5 — two compartments. A
    # shared compartment at 9-11 wins.
    assert pick_seats(PLATS, [1, 5, 9, 11], 2, "any") == ([9, 11], True)


def test_any_may_use_side_berths():
    assert pick_seats(PLATS, [53, 54], 2, "any") == ([53, 54], False)


def test_not_enough_seats():
    assert pick_seats(PLATS, [1], 2, "any") is None


# ---- partial ----------------------------------------------------------------

def test_partial_takes_the_largest_group_that_sits_together():
    # 3 wanted; compartment 1 has two lowers free, the rest is scattered.
    assert pick_partial(PLATS, [1, 3, 10, 17], 3, "together") == ([1, 3], True)


def test_partial_together_ignores_side_berths():
    assert pick_partial(PLATS, [53, 54], 2, "together") is None


def test_partial_any_takes_what_is_there():
    assert pick_partial(PLATS, [53], 2, "any") == ([53], False)
