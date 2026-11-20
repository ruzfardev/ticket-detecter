"""Choosing seats for an auto-buy group inside one car.

One eticket order covers one car, so every seat comes from the same one. The
subscription says whether the group must sit together
(`autobuy_seat_adjacency`):

  'any'       any free seats in the car. A shared compartment is still taken
              when the car has one; otherwise the lowest numbers, as before.
  'together'  only seats in one compartment. A group larger than a
              compartment may spread over neighbouring compartments.

"Together" means the berths of one compartment — 1-3, 5-7, 2-4 — never the
side berths across the aisle (37-54 in a плацкарт), which the user explicitly
does not count as sitting together.

Seat numbering comes from railway.uz's car layouts: compartment k holds seats
4k-3..4k in плацкарт and купе, 2k-1..2k in SV and lux cars; odd numbers are the
lower berths. Seated cars have no published layout, so there "together" is
the closest thing we can tell from numbers alone: consecutive seats.
"""

from __future__ import annotations

from collections.abc import Iterable

# car type -> (seats per compartment, last compartment seat). Seats above the
# last one are side berths (плацкарт) or service seats and never "together".
COMPARTMENTS: dict[str, tuple[int, int]] = {
    "плацкарта": (4, 36),
    "купе": (4, 36),
    "св": (2, 18),
    "люкс": (2, 18),
}

# Only these have the odd = lower / even = upper convention.
_BERTH_TYPES = {"плацкарта", "купе"}

ADJACENCY_ANY = "any"
ADJACENCY_TOGETHER = "together"


def _lower_first(car_type: str, seats: Iterable[int]) -> list[int]:
    """Lower berths before upper ones, then by number. A group asking for two
    seats in a compartment gets 1-3 (both lower) before 1-2."""
    if car_type in _BERTH_TYPES:
        return sorted(seats, key=lambda s: (s % 2 == 0, s))
    return sorted(seats)


def pick_together(car_type: str, free: Iterable[int], n: int) -> list[int] | None:
    """`n` seats that sit together, or None if the car has no such group."""
    seats = sorted(set(int(s) for s in free))
    if n <= 0 or len(seats) < n:
        return None

    layout = COMPARTMENTS.get(car_type)
    if layout is None:
        # No layout: the first run of `n` consecutive numbers.
        for i in range(len(seats) - n + 1):
            if seats[i + n - 1] - seats[i] == n - 1:
                return seats[i:i + n]
        return None

    size, last = layout
    # A group that fits in one compartment must sit in one: 3 and 5 are
    # neighbours by number but a wall apart. Only a larger group spreads, and
    # over no more compartments than it needs.
    max_span = -(-n // size)
    by_comp: dict[int, list[int]] = {}
    for s in seats:
        if 1 <= s <= last:
            by_comp.setdefault((s - 1) // size, []).append(s)

    # Fewest compartments first, then the most lower berths, then the front
    # of the car.
    best: tuple[tuple[int, int, int], list[int]] | None = None
    for start in sorted(by_comp):
        taken: list[int] = []
        k = start
        while k in by_comp and k - start < max_span:
            taken.extend(by_comp[k])
            if len(taken) >= n:
                break
            k += 1
        if len(taken) < n:
            continue
        chosen = sorted(_lower_first(car_type, taken)[:n])
        lowers = sum(1 for s in chosen if s % 2 == 1) if car_type in _BERTH_TYPES else 0
        score = (k - start + 1, -lowers, start)
        if best is None or score < best[0]:
            best = (score, chosen)
    return best[1] if best else None


def pick_seats(
    car_type: str, free: Iterable[int], n: int, adjacency: str,
) -> tuple[list[int], bool] | None:
    """`n` seats for the group and whether they sit together, or None.

    With 'together' only a group that sits together is returned; with 'any' a
    together group wins when there is one, and the lowest numbers otherwise.
    """
    seats = sorted(set(int(s) for s in free))
    together = pick_together(car_type, seats, n)
    if together:
        return together, True
    if adjacency == ADJACENCY_TOGETHER or len(seats) < n or n <= 0:
        return None
    return seats[:n], False


def pick_partial(
    car_type: str, free: Iterable[int], n: int, adjacency: str,
) -> tuple[list[int], bool] | None:
    """The largest group short of `n` the car can seat under the same rule —
    for the 'partial' strategy, when nobody's car fits the whole group."""
    seats = sorted(set(int(s) for s in free))
    for m in range(min(n - 1, len(seats)), 0, -1):
        got = pick_seats(car_type, seats, m, adjacency)
        if got:
            return got
    return None
