"""Children in an auto-buy order, shaped the way eticket's own form does it.

From the site's bundle: a child under 5 is filed inside the accompanying
adult's `children` with discount type CHILD_UNDER_5 and no seat; anyone under
16 travelling on a seat is filed under the first adult too; adults stay
top-level. A nested passenger carries `children: null`, a top-level one a
list.
"""

from __future__ import annotations

import asyncio
import json
from datetime import date

import pytest

from app.core.errors import InvalidPayload
from app.railway.user_client import (
    DISCOUNT_CHILD_UNDER_5,
    DISCOUNT_REGULAR,
    CreateOrderArgs,
    PassengerArg,
    RailwayUserClient,
    passenger_body,
)
from app.services.autobuy_service import age_on, arrange_passengers


def _p(name: str) -> PassengerArg:
    return PassengerArg(firstname=name, lastname="X", midname="", birth_day="01.01.2000",
                        gender="Male", citizenship="UZB", doc_type="ПУ",
                        doc_id="AA1", region_id="")


@pytest.mark.parametrize("birth,on,age", [
    (date(2021, 9, 4), date(2026, 9, 3), 4),    # birthday tomorrow: still 4
    (date(2021, 9, 3), date(2026, 9, 3), 5),    # birthday today: 5
    (date(2010, 1, 1), date(2026, 9, 3), 16),
    (date(2000, 12, 31), date(2026, 1, 1), 25),
])
def test_age_on_counts_completed_years(birth, on, age):
    assert age_on(birth, on) == age


def test_lap_child_is_filed_under_the_adult_without_a_seat():
    adult, baby = _p("Adult"), _p("Baby")
    top = arrange_passengers([(adult, 30)], [(baby, 2)])
    assert top == [adult]
    assert adult.children == [baby]
    assert baby.discount_type == DISCOUNT_CHILD_UNDER_5
    assert adult.discount_type == DISCOUNT_REGULAR


def test_seated_minor_is_filed_under_the_first_adult_at_regular_tariff():
    a1, a2, kid = _p("A1"), _p("A2"), _p("Kid")
    top = arrange_passengers([(a1, 40), (kid, 8), (a2, 35)], [])
    assert top == [a1, a2]
    assert a1.children == [kid] and a2.children == []
    assert kid.discount_type == DISCOUNT_REGULAR


def test_lap_children_spread_one_per_adult():
    a1, a2, b1, b2 = _p("A1"), _p("A2"), _p("B1"), _p("B2")
    arrange_passengers([(a1, 40), (a2, 35)], [(b1, 1), (b2, 3)])
    assert a1.children == [b1] and a2.children == [b2]


def test_a_child_needs_an_adult():
    with pytest.raises(InvalidPayload) as e:
        arrange_passengers([(_p("Teen"), 15)], [])
    assert e.value.details["code"] == "adult_required"
    with pytest.raises(InvalidPayload):
        arrange_passengers([], [(_p("Baby"), 2)])


def test_a_lap_child_who_turned_five_needs_a_seat():
    with pytest.raises(InvalidPayload) as e:
        arrange_passengers([(_p("Adult"), 30)], [(_p("Kid"), 5)])
    assert e.value.details["code"] == "lap_child_too_old"


def test_payload_nests_children_the_way_the_site_does():
    adult, baby = _p("Adult"), _p("Baby")
    arrange_passengers([(adult, 30)], [(baby, 2)])
    body = passenger_body(adult)
    assert body["discount"]["type"] == "REGULAR"
    [child] = body["children"]
    assert child["firstname"] == "Baby"
    assert child["discount"]["type"] == "CHILD_UNDER_5"
    assert child["children"] is None          # nested: null, not []
    assert passenger_body(_p("Solo"))["children"] == []


def test_create_order_sends_only_adults_top_level_but_all_seats():
    adult, kid = _p("Adult"), _p("Kid")
    top = arrange_passengers([(adult, 30), (kid, 9)], [])
    client = RailwayUserClient.__new__(RailwayUserClient)
    sent: list[dict] = []

    async def fake_post_text(url, payload):
        sent.append(payload)
        return '"UX77TEST"'

    client._post_text = fake_post_text  # type: ignore[method-assign]
    args = CreateOrderArgs(
        railway_user_id="u1", railway_username="user", passengers=top,
        dep_code="2900000", arr_code="2900790", dep_date_dot="15.10.2026",
        dep_time="17:20", train_number="095ФА", car_number="07",
        car_type="Плацкартный", class_service="3П", seat_numbers=[1, 2],
    )
    created = asyncio.run(client.create_order(args))
    assert created.order_id == "UX77TEST"
    item = sent[0]["orderItemRequest"][0]
    assert [p["firstname"] for p in item["passengers"]] == ["Adult"]
    assert item["passengers"][0]["children"][0]["firstname"] == "Kid"
    assert item["route"]["seatNumbers"] == [1, 2]
    assert item["route"]["requirements"]["seatsRange"] == "1-2"
    json.dumps(sent[0])   # serialisable, no dataclasses leaked through
