"""Ticket PDFs are named after their passenger.

eticket returns names in a mix of Latin and Cyrillic homoglyphs — the live value
for the admin account is "FАRRUХ RОZМЕТОV", where А, Х, О, М, Е and Т are
Cyrillic despite looking Latin. Left as-is the filename renders fine but is not
ASCII, which makes it awkward to search, sort or type on another device.
"""

from __future__ import annotations

import pytest

from app.services.ticket_delivery import _slug, ticket_filename

# Verbatim from eticket (order ItemId-1393888a…), homoglyphs intact.
REAL_NAME = "FАRRUХ RОZМЕТОV"
ITEM_ID = "ItemId-1393888a-b10c-49d7-9fd3-7931c4fbb0dc"


def test_the_real_name_is_not_ascii_to_begin_with():
    assert not REAL_NAME.isascii()


@pytest.mark.parametrize("raw,expected", [
    (REAL_NAME, "Farrux_Rozmetov"),
    ("Yasmina Quvondiqova", "Yasmina_Quvondiqova"),
    ("ЎКТАМ ҒАФУРОВ", "Oktam_Gafurov"),
    ("  spaced   out  ", "Spaced_Out"),
    ("", ""),
])
def test_slug(raw, expected):
    assert _slug(raw) == expected


def test_single_passenger():
    assert ticket_filename([REAL_NAME], ITEM_ID) == "Farrux_Rozmetov.pdf"


def test_two_passengers_are_both_named():
    got = ticket_filename([REAL_NAME, "Yasmina Quvondiqova"], ITEM_ID)
    assert got == "Farrux_Rozmetov_Yasmina_Quvondiqova.pdf"


def test_many_passengers_are_summarised():
    got = ticket_filename([REAL_NAME, "A B", "C D", "E F"], ITEM_ID)
    assert got == "Farrux_Rozmetov_A_B_+2.pdf"


@pytest.mark.parametrize("names", [[], ["   "], ["!!!"]])
def test_falls_back_to_the_order_id(names):
    assert ticket_filename(names, ITEM_ID) == "chipta-c4fbb0dc.pdf"


@pytest.mark.parametrize("names", [
    [REAL_NAME], ["ЎКТАМ ҒАФУРОВ"], ["Ünïcödé Nàme"], [],
])
def test_filenames_are_always_ascii_and_pdf(names):
    got = ticket_filename(names, ITEM_ID)
    assert got.isascii(), got
    assert got.endswith(".pdf")
    assert "/" not in got and "\\" not in got


def test_length_is_bounded():
    got = ticket_filename(["Averyverylongname " * 20], ITEM_ID)
    assert len(got) <= 84
