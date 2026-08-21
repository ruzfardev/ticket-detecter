"""Lock the eticket confirm-payment response shapes we have actually observed.

These are copied from production logs (orders 43, 62, 63 on 2026-08-21), not
invented. The rule under test is deliberately narrow: only the literal
CONFIRMATION_PROCESSED string proves a code was already accepted; the
"accepted" envelope is NOT treated as a verdict because we still have no
wrong-code sample to contrast it against.
"""
from app.services.autobuy_service import is_confirmation_processed

# Seen on the first confirm of orders 43, 62 and 63 — 43 and 63 went on to be
# paid; 62 never settled. Same shape either way, so it decides nothing.
ACCEPTED_ENVELOPE = {
    "data": None,
    "error": {"hamkorbankHoldId": "UXe4b7b5bb-6114-4f0c-92bb-9081d113c96d"},
}
# Seen on every retype after a good code (order 62, twice).
ALREADY_PROCESSED = {"data": None, "error": "CONFIRMATION_PROCESSED"}


def test_already_processed_is_recognised():
    assert is_confirmation_processed(ALREADY_PROCESSED) is True


def test_accepted_envelope_is_not_a_verdict():
    assert is_confirmation_processed(ACCEPTED_ENVELOPE) is False


def test_unrelated_shapes_are_ignored():
    assert is_confirmation_processed({}) is False
    assert is_confirmation_processed({"data": {"ok": True}, "error": None}) is False
    assert is_confirmation_processed(None) is False
    assert is_confirmation_processed("CONFIRMATION_PROCESSED") is False
