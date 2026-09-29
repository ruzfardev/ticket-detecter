"""The tickets routes end to end, with eticket's HTTP layer replaced.

The cabinet host answers from a table keyed by URL, shaped like its live
replies (September 2026): one old v2 order whose only ticket was returned,
one v3 order bought since the cutover. What the mini-app gets back has to
list both, with status, and a PDF request for the v3 leg has to reach the
v3 printing path.
"""

from __future__ import annotations

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api import deps
from app.api.v1 import tickets as tickets_api
from app.railway import user_client as uc
from app.services import ticket_delivery
from app.services.user_service import UserRow

from test_tickets_archive import DETAIL_RETURNED, _order
from test_tickets_v3 import PDF_JSON, V3_DETAIL, V3_ORDER

V2_ORDER = _order("UX780BGW7B851Q", ["001"])
V2_ITEM = V2_ORDER["items"][0]["orderItemId"]
V3_ITEM = V3_ORDER["items"][0]["orderItemId"]


@pytest.fixture
def eticket(monkeypatch):
    """Serve the cabinet from fixtures; record every call."""
    calls: list[tuple[str, str, dict | None]] = []
    routes = {
        uc.QUERY_ORDERS_LIST_URL: {"data": [V2_ORDER], "totalElements": 1},
        uc.V3_ORDERS_LIST_URL: {"data": [V3_ORDER], "totalElements": 1},
        uc.QUERY_ORDERS_TICKETS_URL: DETAIL_RETURNED,
        uc.V3_ORDERS_TICKETS_URL: V3_DETAIL,
        uc.DOCUMENT_PDF_URL.format(order_id=V3_ORDER["orderId"]): PDF_JSON,
        uc.QUERY_ORDERS_PDF_URL: PDF_JSON,
    }

    async def fake_request(self, method, url, payload=None, *, extra_headers=None):
        calls.append((method, url, payload))
        return routes[url]

    monkeypatch.setattr(uc.RailwayUserClient, "_cabinet_request", fake_request)

    async def linked(pool, user_id):
        return None

    monkeypatch.setattr(tickets_api, "_require_linked", linked)
    tickets_api._status_cache.clear()
    return calls


@pytest.fixture
def client(eticket):
    app = FastAPI()
    app.include_router(tickets_api.router, prefix="/api/v1")
    user = UserRow.__new__(UserRow)
    for k, v in {"id": 1, "tg_user_id": 970956519}.items():
        object.__setattr__(user, k, v)
    app.dependency_overrides[deps.current_user] = lambda: user
    app.dependency_overrides[deps.db_pool] = lambda: None
    return TestClient(app)


def test_list_shows_old_and_new_orders_with_status(client):
    r = client.get("/api/v1/tickets")
    assert r.status_code == 200
    legs = {t["order_id"]: t for t in r.json()["tickets"]}
    assert set(legs) == {"UX780BGW7B851Q", "UO780VFFBIVI68"}

    old, new = legs["UX780BGW7B851Q"], legs["UO780VFFBIVI68"]
    assert (old["source"], old["returned"], old["status_known"]) == ("v2", True, True)
    assert (new["source"], new["returned"], new["status_known"]) == ("v3", False, True)
    assert new["created_at"] == "2026-09-29 06:26:26"
    assert new["dep_at"] == "2026-10-08 21:45:00"
    assert new["tickets"] == [{"ticket_id": "77015208506833", "seat": "017",
                               "status": "CONFIRMED", "passenger_name": "Vali Aliyev"}]


def test_detail_reads_v3(client):
    r = client.post("/api/v1/tickets/detail", json={
        "order_item_id": V3_ITEM, "created_at": "2026-09-29 06:26:26", "source": "v3",
    })
    assert r.status_code == 200
    assert r.json()["tickets"] == [{"ticket_id": "77015208506833", "status": "CONFIRMED",
                                    "seat_number": "017", "amount_uzs": 245140,
                                    "passenger_name": "Vali Aliyev"}]


def test_v3_pdf_is_printed_from_the_order_document(client, eticket, monkeypatch):
    sent: list[dict] = []

    async def fake_send(**kw):
        sent.append(kw)
        return True

    monkeypatch.setattr(ticket_delivery, "send_ticket_pdf", fake_send)
    r = client.post("/api/v1/tickets/pdf/send", json={
        "order_item_id": V3_ITEM, "created_at": "2026-09-29 06:26:26",
        "source": "v3", "order_id": "UO780VFFBIVI68",
    })
    assert r.status_code == 200, r.text
    assert ("GET", uc.DOCUMENT_PDF_URL.format(order_id="UO780VFFBIVI68"), None) in eticket
    [s] = sent
    assert s["tg_user_id"] == 970956519
    assert s["pdf"].startswith(b"%PDF")
    assert s["passenger_names"] == ["Vali Aliyev"]


def test_old_clients_without_source_still_get_v2(client, eticket, monkeypatch):
    async def fake_send(**kw):
        return True

    monkeypatch.setattr(ticket_delivery, "send_ticket_pdf", fake_send)
    r = client.post("/api/v1/tickets/pdf/send", json={
        "order_item_id": V2_ITEM, "created_at": "2026-08-18 16:37:45",
    })
    assert r.status_code == 200, r.text
    assert eticket[-1][:2] == ("POST", uc.QUERY_ORDERS_PDF_URL)
