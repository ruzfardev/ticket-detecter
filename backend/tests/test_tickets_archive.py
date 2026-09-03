"""eticket keeps past trips in a month-keyed archive, separate from the active
list. The archive answers in the same shape as the active list, so one parser
serves both, and the client walks `totalElements` so a busy month is complete.

The fixture is trimmed from a live archive reply (August 2026).
"""

from __future__ import annotations

import asyncio

import pytest

from app.api.v1.tickets import MONTH_RE, is_returned, summarize_tickets
from app.services.ticket_status import is_confirmed
from app.railway.user_client import (
    ARCHIVE_MAX_PAGES,
    QUERY_ORDERS_ARCHIVE_TICKETS_URL,
    QUERY_ORDERS_TICKETS_URL,
    RailwayUserClient,
    parse_purchased_orders,
)


def _order(order_id: str, seats: list[str]) -> dict:
    return {
        "orderId": order_id,
        "totalCost": 245140.00,
        "createDateTime": "2026-08-18 16:37:45",
        "invoiceGeneratedOrder": False,
        "finalStatus": "ORDER_COMPLETED_SUCCESSFULLY",
        "items": [{
            "orderItemId": f"ItemId-{order_id}",
            "systemId": "18887647",
            "expressId": "76015197834283",
            "directionSequence": 1,
            "totalCost": 245140.00,
            "departure": {"dateTime": "2026-08-28 21:45:00",
                          "stationName": "ТОШКЕНТ ЖАНУБИЙ", "stationCode": "2900002"},
            "arrival": {"dateTime": "2026-08-29 11:24:00",
                        "stationName": "УРГАНЧ", "stationCode": "2900790"},
            "train": {"number": "056ЧА", "type": "ПЛАЦ"},
            "car": {"number": "11", "type": "ПЛАЦ"},
            "type": "ExpressItem",
            "qrCode": "https://eticket.railway.uz/pages/check-ticket?expressId=x",
            "tickets": [{"seat": s} for s in seats],
        }],
    }


def test_archive_page_parses_like_the_active_list():
    page = {"data": [_order("UX1", ["043"])], "currentPage": 0, "totalElements": 5}
    [t] = parse_purchased_orders(page)
    assert t.order_id == "UX1"
    assert t.order_item_id == "ItemId-UX1"
    assert t.created_at == "2026-08-18 16:37:45"
    assert t.amount_uzs == 245140
    assert (t.train_number, t.car_number, t.car_type) == ("056ЧА", "11", "ПЛАЦ")
    assert (t.dep_at, t.arr_at) == ("2026-08-28 21:45:00", "2026-08-29 11:24:00")
    assert t.seats == ["043"]
    assert t.qr_url.startswith("https://eticket.railway.uz/")


def test_empty_archive_month_is_an_empty_list():
    assert parse_purchased_orders({"data": [], "currentPage": 0, "totalElements": 0}) == []


@pytest.mark.parametrize("month,ok", [
    ("2026-08", True), ("2026-12", True), ("2010-01", True),
    ("2026-8", False), ("2026-13", False), ("2026-00", False),
    ("08-2026", False), ("2026-08-01", False), ("", False),
])
def test_month_filter_is_year_dash_month(month, ok):
    assert bool(MONTH_RE.match(month)) is ok


def _client_with_pages(pages: list[dict]) -> tuple[RailwayUserClient, list[dict]]:
    """A client whose `_post` replays canned archive pages, recording bodies."""
    client = RailwayUserClient.__new__(RailwayUserClient)
    sent: list[dict] = []

    async def fake_post(url, payload, **kw):
        sent.append(payload)
        return pages[min(len(sent) - 1, len(pages) - 1)]

    client._post = fake_post  # type: ignore[method-assign]
    return client, sent


def test_archive_follows_total_elements_across_pages():
    first = {"data": [_order(f"A{i}", ["001"]) for i in range(20)],
             "currentPage": 0, "totalElements": 23}
    second = {"data": [_order(f"B{i}", ["001"]) for i in range(3)],
              "currentPage": 1, "totalElements": 23}
    client, sent = _client_with_pages([first, second])

    got = asyncio.run(client.list_archived("2026-08"))

    assert len(got) == 23
    assert [b["page"] for b in sent] == [0, 1]
    assert all(b["filterData"] == {"yearMonth": "2026-08"} for b in sent)


def test_archive_stops_on_a_single_short_page():
    page = {"data": [_order("A", ["001"])], "currentPage": 0, "totalElements": 1}
    client, sent = _client_with_pages([page])
    assert len(asyncio.run(client.list_archived("2026-07"))) == 1
    assert len(sent) == 1


def test_archive_never_pages_forever_on_a_lying_total():
    page = {"data": [_order("A", ["001"])], "currentPage": 0, "totalElements": 10_000}
    client, sent = _client_with_pages([page])
    asyncio.run(client.list_archived("2026-07"))
    assert len(sent) == ARCHIVE_MAX_PAGES


def test_archive_legs_are_marked_as_such():
    page = {"data": [_order("UX1", ["043"])], "currentPage": 0, "totalElements": 1}
    assert parse_purchased_orders(page)[0].archived is False
    assert parse_purchased_orders(page, archived=True)[0].archived is True


# Trimmed from the live detail reply for a returned ticket (October 2026).
DETAIL_RETURNED = {
    "tickets": [{
        "ticketId": "77215198319906", "status": "ReturnedTicket",
        "seatNumber": "001", "tariffAmount": 150090.00,
        "passenger": {"docId": "AC0000000", "firstname": "FARRUX",
                      "lastname": "ROZMETOV", "midname": "QUVONDIQ UGLI",
                      "gender": "Male", "birthDay": "22.06.2002", "children": []},
        "mask": 1,
    }],
    "insurances": [], "caterings": [], "systemId": "18918938",
    "departureDateTime": "2026-10-15T12:20:00Z",
    "onlineReturnAvailabilityTime": "2026-10-15T11:20:00Z",
    "type": "ExpressItem",
}


def test_summarize_keeps_seat_status_and_name_only():
    [t] = summarize_tickets(DETAIL_RETURNED)
    assert t == {"ticket_id": "77215198319906", "seat": "001",
                 "status": "ReturnedTicket", "passenger_name": "FARRUX ROZMETOV"}


def test_a_leg_is_returned_only_when_every_ticket_is():
    assert is_returned(summarize_tickets(DETAIL_RETURNED)) is True
    assert is_returned([{"status": "ReturnTicket"}]) is True          # bundle spelling
    assert is_returned([{"status": "ReturnedTicket"}, {"status": "ConfirmedTicket"}]) is False
    assert is_returned([{"status": "ConfirmedTicket"}]) is False
    assert is_returned([]) is False                                    # 204 / unknown


def test_detail_endpoint_follows_the_archived_flag():
    client = RailwayUserClient.__new__(RailwayUserClient)
    urls: list[str] = []

    async def fake_post(url, payload, **kw):
        urls.append(url)
        assert payload == {"orderItemId": "ItemId-x",
                           "createdDate": "2026-08-18T16:37:45+05:00"}
        return {}

    client._post = fake_post  # type: ignore[method-assign]
    asyncio.run(client.get_purchased_detail("ItemId-x", "2026-08-18 16:37:45"))
    asyncio.run(client.get_purchased_detail("ItemId-x", "2026-08-18 16:37:45", archived=True))
    assert urls == [QUERY_ORDERS_TICKETS_URL, QUERY_ORDERS_ARCHIVE_TICKETS_URL]


def test_an_unpaid_reservation_is_neither_returned_nor_confirmed():
    # Live shape: order RESERVATION_SUCCEEDED, ticket status literally "None".
    reserved = summarize_tickets({"tickets": [{"ticketId": "1", "status": "None", "seatNumber": "012"}]})
    assert is_returned(reserved) is False
    assert is_confirmed(reserved) is False
    assert is_confirmed([{"status": "ConfirmedTicket"}]) is True
    assert is_confirmed([{"status": "ConfirmedTicket"}, {"status": "ReturnedTicket"}]) is False
    assert is_confirmed([]) is False
