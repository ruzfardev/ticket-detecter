"""Trip reminders: the two windows, the message, and the Tashkent clock."""

from __future__ import annotations

from datetime import datetime, timedelta

import pytest

from app.railway.user_client import PurchasedTicket
from app.tasks.trip_reminders import TASHKENT, _msg, due_kind, parse_dep_at

DEP = datetime(2026, 10, 15, 17, 20, tzinfo=TASHKENT)


@pytest.mark.parametrize("before,expected", [
    (timedelta(hours=25),               None),     # too early
    (timedelta(hours=24),               "t24"),    # window edge, inclusive
    (timedelta(hours=22),               "t24"),
    (timedelta(hours=20),               None),     # (20h, 24h] — 20h itself is out
    (timedelta(hours=3),                None),     # between the two windows
    (timedelta(hours=2),                "t2"),
    (timedelta(hours=1),                "t2"),
    (timedelta(minutes=30),             None),     # too late to be useful
    (timedelta(minutes=-5),             None),     # already left
])
def test_due_kind_windows(before, expected):
    assert due_kind(DEP, DEP - before) == expected


def test_dep_at_is_read_as_tashkent_wall_clock():
    dt = parse_dep_at("2026-10-15 17:20:00")
    assert dt == DEP
    assert dt.utcoffset() == timedelta(hours=5)
    assert parse_dep_at("garbage") is None
    assert parse_dep_at("") is None


def _leg() -> PurchasedTicket:
    return PurchasedTicket(
        order_id="UX1", order_item_id="ItemId-1", created_at="2026-08-20 11:47:55",
        final_status="ORDER_COMPLETED_SUCCESSFULLY", amount_uzs=150090,
        train_number="095ФА", train_type="", car_number="07", car_type="ПЛАЦ",
        dep_station="АНДИЖОН <1>", arr_station="ТОШКЕНТ & CO",
        dep_at="2026-10-15 17:20:00", arr_at="2026-10-16 00:27:00",
        seats=["001"], qr_url=None, raw={},
    )


def test_message_escapes_html_and_names_the_trip():
    text = _msg("uz", "t24", _leg(), ["Farrux Rozmetov"])
    assert text.startswith("🚂 <b>Ertaga safar</b>")
    assert "АНДИЖОН &lt;1&gt; → ТОШКЕНТ &amp; CO" in text
    assert "15.10.2026 · 17:20" in text
    assert "vagon 07 · joy 001" in text
    assert "Farrux Rozmetov" in text


def test_message_speaks_the_users_language():
    assert "Завтра поездка" in _msg("ru", "t24", _leg(), [])
    assert "Отправление через 2 часа" in _msg("ru", "t2", _leg(), [])
    assert "Departure in 2 hours" in _msg("en", "t2", _leg(), [])
    assert "2 soatdan keyin jo'nash" in _msg("uz", "t2", _leg(), [])
