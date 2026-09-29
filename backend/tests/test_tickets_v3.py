"""Since late September 2026 eticket files new orders in a second order
system, v3 (ids UO…), next to the old v2 one (ids UX…). The site lists both;
so must we. v3 answers in its own shape, which is read into the same
PurchasedTicket and the same per-ticket summary as v2.

Fixtures are trimmed from live v3 replies (September 2026), names and
documents replaced.
"""

from __future__ import annotations

import asyncio

import pytest

from app.core.errors import RailwayUnavailable
from app.railway.user_client import (
    DOCUMENT_PDF_URL,
    QUERY_ORDERS_LIST_URL,
    V3_ORDERS_LIST_URL,
    V3_ORDERS_PDF_URL,
    RailwayUserClient,
    parse_v3_orders,
)
from app.services.ticket_status import (
    is_confirmed, is_returned, summarize_tickets, ticket_amount,
)

V3_ORDER = {
    "orderId": "UO780VFFBIVI68",
    "totalCost": 245140.0,
    "createDateTime": "2026-09-29T01:26:26.689804Z",
    "invoiceGeneratedOrder": False,
    "finalStatus": "ORDER_COMPLETED_SUCCESSFULLY",
    "items": [{
        "orderItemId": "UO780VFFBIVI68_EXPRESS_0",
        "systemId": "77015208506833", "expressId": "77015208506833",
        "directionSequence": 1, "totalCost": 245140.0,
        "departure": {"code": "2900002", "name": "ТОШКЕНТ ЖАНУБИЙ",
                      "date": "2026-10-08", "time": "21:45:00"},
        "arrival": {"code": "2900790", "name": "УРГАНЧ",
                    "date": "2026-10-09", "time": "11:29:00"},
        "trainInfo": {"trainNumber": "058ЗА", "carNumber": "13", "carType": "ПЛАЦ",
                      "serviceClass": "3П", "directionSequence": 1,
                      "brand": "Yo'lovchi"},
        "type": "TICKET", "returns": [],
        "qrCode": "https://eticket.uzrailpass.uz/pages/check-ticket?expressId=UO780VFFBIVI68",
        "tickets": [{"passengerInfo": {"fullName": "Aliyev=Vali=Karimovich"},
                     "seatNumber": "017"}],
        "greenTickets": [], "insurances": [],
    }],
}

V3_DETAIL = {
    "tickets": [{
        "passengerInfo": {"fullName": "Aliyev=Vali=Karimovich", "documentId": "AA0000000",
                          "documentType": "ПУ", "gender": "MALE", "citizenship": "UZB",
                          "birthday": "1977-02-15", "child": None},
        "pricingMode": "FULL", "id": "77015208506833", "seatNumber": "017", "seatType": "Н",
        "tariff": {"@type": "EXPRESS", "type": "FULL", "amount": 245140},
        "mask": 1,
    }],
    "insurances": [], "caterings": [], "systemId": "77015208506833",
    "departureDateTime": "2026-10-08T16:45:00Z",
    "onlineReturnAvailabilityTime": "2026-10-08T15:45:00Z",
    "type": "TICKET", "status": "CONFIRMED", "mask": 1,
    "returns": [], "greenTickets": [], "itemReturns": [],
}


def test_v3_order_reads_like_a_v2_leg():
    [t] = parse_v3_orders({"data": [V3_ORDER], "currentPage": 0, "totalElements": 1})
    assert t.source == "v3" and t.archived is False
    assert (t.order_id, t.order_item_id) == ("UO780VFFBIVI68", "UO780VFFBIVI68_EXPRESS_0")
    # UTC 01:26 is 06:26 in Tashkent — stored in v2's wall-clock format.
    assert t.created_at == "2026-09-29 06:26:26"
    assert (t.dep_at, t.arr_at) == ("2026-10-08 21:45:00", "2026-10-09 11:29:00")
    assert (t.train_number, t.car_number, t.car_type) == ("058ЗА", "13", "ПЛАЦ")
    assert (t.dep_station, t.arr_station) == ("ТОШКЕНТ ЖАНУБИЙ", "УРГАНЧ")
    assert t.amount_uzs == 245140
    assert t.seats == ["017"]


def test_v3_created_date_goes_back_with_the_tashkent_offset():
    [t] = parse_v3_orders({"data": [V3_ORDER]})
    assert RailwayUserClient._api_created_date(t.created_at) == "2026-09-29T06:26:26+05:00"


def test_v3_detail_takes_the_item_status_and_reorders_the_name():
    [t] = summarize_tickets(V3_DETAIL)
    assert t == {"ticket_id": "77015208506833", "seat": "017",
                 "status": "CONFIRMED", "passenger_name": "Vali Aliyev"}
    assert ticket_amount(V3_DETAIL["tickets"][0]) == 245140
    assert is_confirmed([t]) is True
    assert is_returned([t]) is False


@pytest.mark.parametrize("status", ["RETURNED", "RETURN_SUCCEEDED", "REFUNDED"])
def test_v3_returned_statuses(status):
    tickets = summarize_tickets({**V3_DETAIL, "status": status})
    assert is_returned(tickets) is True
    assert is_confirmed(tickets) is False


def _client(post=None, get=None) -> RailwayUserClient:
    client = RailwayUserClient.__new__(RailwayUserClient)
    client._user_id = 1
    if post:
        client._cabinet_post = post  # type: ignore[method-assign]
    if get:
        client._cabinet_get = get  # type: ignore[method-assign]
    return client


V2_ORDER = {
    "orderId": "UX1", "createDateTime": "2026-09-22 10:34:50",
    "finalStatus": "ORDER_COMPLETED_SUCCESSFULLY",
    "items": [{"orderItemId": "ItemId-1", "totalCost": 1.0,
               "departure": {"dateTime": "2026-11-15 16:23:00", "stationName": "A"},
               "arrival": {"dateTime": "2026-11-16 05:23:00", "stationName": "B"},
               "train": {"number": "126ФА"}, "car": {"number": "11"},
               "tickets": [{"seat": "009"}]}],
}


def test_active_list_merges_both_order_systems():
    async def post(url, payload, **kw):
        return {QUERY_ORDERS_LIST_URL: {"data": [V2_ORDER]},
                V3_ORDERS_LIST_URL: {"data": [V3_ORDER]}}[url]

    got = asyncio.run(_client(post).list_purchased())
    assert sorted((t.order_id, t.source) for t in got) == [("UO780VFFBIVI68", "v3"), ("UX1", "v2")]


def test_one_system_down_still_lists_the_other():
    async def post(url, payload, **kw):
        if url == V3_ORDERS_LIST_URL:
            raise RailwayUnavailable("eticket 500")
        return {"data": [V2_ORDER]}

    got = asyncio.run(_client(post).list_purchased())
    assert [t.order_id for t in got] == ["UX1"]


def test_both_systems_down_is_an_error():
    async def post(url, payload, **kw):
        raise RailwayUnavailable("eticket 500")

    with pytest.raises(RailwayUnavailable):
        asyncio.run(_client(post).list_purchased())


PDF_JSON = {"pdf": "JVBERi0xLjQK"}   # base64 of "%PDF-1.4\n"


def test_v3_pdf_prints_the_order_document():
    got: list[str] = []

    async def get(url):
        got.append(url)
        return PDF_JSON

    async def post(url, payload, **kw):
        raise AssertionError("query/pdf must not be needed")

    blob = asyncio.run(_client(post, get).get_purchased_pdf(
        "UO1_EXPRESS_0", "2026-09-29 06:26:26", source="v3", order_id="UO1"))
    assert blob.startswith(b"%PDF")
    assert got == [DOCUMENT_PDF_URL.format(order_id="UO1")]


def test_v3_pdf_falls_back_to_query_pdf():
    posted: list[str] = []

    async def get(url):
        raise RailwayUnavailable("eticket 400")

    async def post(url, payload, **kw):
        posted.append(url)
        assert payload == {"orderItemId": "UO1_EXPRESS_0",
                           "createdDate": "2026-09-29T06:26:26+05:00"}
        return PDF_JSON

    asyncio.run(_client(post, get).get_purchased_pdf(
        "UO1_EXPRESS_0", "2026-09-29 06:26:26", source="v3", order_id="UO1"))
    assert posted == [V3_ORDERS_PDF_URL]


def test_cabinet_session_relogs_once_on_401_and_reads_204_as_empty(monkeypatch):
    import httpx

    from app.railway import user_client as uc
    from app.railway._auth_common import AuthHeaders

    logins: list[int] = []
    dropped: list[int] = []

    async def auth(pool, user_id):
        logins.append(user_id)
        return AuthHeaders(access_token=f"tok{len(logins)}", csrf_token="x", cookie_str="")

    class Bucket:
        async def acquire(self):
            return None

    answers = iter([httpx.Response(401), httpx.Response(204)])
    seen: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request.headers["Authorization"])
        return next(answers)

    real = httpx.AsyncClient
    monkeypatch.setattr(uc, "get_cabinet_auth", auth)
    monkeypatch.setattr(uc, "drop_cabinet_session", dropped.append)
    monkeypatch.setattr(uc, "get_bucket", lambda: Bucket())
    monkeypatch.setattr(uc.httpx, "AsyncClient",
                        lambda **kw: real(transport=httpx.MockTransport(handler)))

    client = RailwayUserClient.__new__(RailwayUserClient)
    client._pool, client._user_id = None, 7
    assert asyncio.run(client._cabinet_post(uc.V3_ORDERS_LIST_URL, {})) == {}
    assert seen == ["Bearer tok1", "Bearer tok2"]
    assert dropped == [7]
