"""The exact request bodies eticket's own frontend sends for each gateway.

Every one of these shapes has been wrong in production at least once, each time
costing a real booking:

  * `pay-receipt` instead of `confirm-payment`      -> bare 404
  * `code` instead of `confirmationCode`            -> rejected
  * Hamkorbank's `{id, ...}` sent to Payme          -> bare 400 on create-card
  * `smsCode` vs `confirmationCode` mixed up        -> rejected

They are transcribed from the site's Angular bundle (`main.*.js` api service plus
the payment components in the lazy chunks), so treat this file as the contract:
if a body here changes, it must be because the bundle changed.
"""

from __future__ import annotations

import pytest

from app.railway import user_client as uc
from app.railway.user_client import PaymentFailed, RailwayUserClient

ORDER_ID = "UX780BE53LUTSJ"
PAN = "8600123456789012"
EXP = "10/27"
OTP = "123456"


@pytest.fixture
def client(monkeypatch):
    """A client whose HTTP layer records calls instead of making them."""
    calls: list[tuple[str, dict]] = []

    async def fake_post(self, url, payload, *, payment_errors=False):
        calls.append((url.replace(uc.BASE_URL, ""), payload))
        if url == uc.HAMKORBANK_HOLD_DO_URL:
            return {"id": "HOLD-1", "totalCost": 24_514_000}
        if url == uc.PAYME_DO_URL:
            return {"paymeId": "PAYME-1", "dataAmount": 24_514_000, "percent": 1.0}
        return {"data": {"ok": True}, "error": None}

    monkeypatch.setattr(RailwayUserClient, "_post", fake_post)
    c = RailwayUserClient.__new__(RailwayUserClient)
    c._user_id = 1
    c.calls = calls
    return c


async def test_hamkorbank_hold_bodies(client):
    pay = await client.do_payment(uc.PAYMENT_TYPE_HAMKORBANK_HOLD, ORDER_ID)
    await client.submit_card(uc.PAYMENT_TYPE_HAMKORBANK_HOLD, pay.payment_subid,
                             PAN, EXP, order_id=ORDER_ID)
    await client.confirm_otp(uc.PAYMENT_TYPE_HAMKORBANK_HOLD, pay.payment_subid,
                             OTP, order_id=ORDER_ID)
    await client.resend_otp(uc.PAYMENT_TYPE_HAMKORBANK_HOLD, pay.payment_subid)

    assert client.calls == [
        ("/api/v1/hamkorbank-hold/do-payment", {"orderId": ORDER_ID}),
        ("/api/v1/hamkorbank-hold/prepare-payment",
         {"id": "HOLD-1", "cardNumber": PAN, "cardExpiry": "1027"}),
        # NOT pay-receipt, and NOT `code`.
        ("/api/v1/hamkorbank-hold/confirm-payment",
         {"id": "HOLD-1", "confirmationCode": OTP}),
        ("/api/v1/hamkorbank-hold/resend-code", {"id": "HOLD-1"}),
    ]
    assert pay.amount_uzs == 245_140   # totalCost is in tiyin


async def test_payme_bodies(client):
    """Payme carries the orderId and uses `paymeId`/`smsCode` — not Hamkorbank's shape."""
    pay = await client.do_payment(uc.PAYMENT_TYPE_PAYME, ORDER_ID)
    await client.submit_card(uc.PAYMENT_TYPE_PAYME, pay.payment_subid,
                             PAN, EXP, order_id=ORDER_ID)
    await client.confirm_otp(uc.PAYMENT_TYPE_PAYME, pay.payment_subid,
                             OTP, order_id=ORDER_ID)
    await client.resend_otp(uc.PAYMENT_TYPE_PAYME, pay.payment_subid)

    assert client.calls == [
        ("/api/v1/payme/do-payment", {"orderId": ORDER_ID}),
        ("/api/v1/payme/create-card",
         {"orderId": ORDER_ID, "paymeId": "PAYME-1",
          "cardNumber": PAN, "cardExpiry": "1027"}),
        ("/api/v1/payme/verify-card",
         {"orderId": ORDER_ID, "paymeId": "PAYME-1", "smsCode": OTP}),
        # The component calls the generic paysys-sum endpoint, not payme/resend-code.
        ("/api/v1/paysys-sum/resend-code", {"paySysSumId": "PAYME-1"}),
    ]
    assert pay.amount_uzs == 245_140


async def test_card_expiry_and_pan_are_normalised(client):
    pay = await client.do_payment(uc.PAYMENT_TYPE_HAMKORBANK_HOLD, ORDER_ID)
    await client.submit_card(uc.PAYMENT_TYPE_HAMKORBANK_HOLD, pay.payment_subid,
                             "8600 1234 5678 9012", "10/27", order_id=ORDER_ID)
    body = client.calls[-1][1]
    assert body["cardNumber"] == PAN
    assert body["cardExpiry"] == "1027"


async def test_empty_otp_is_rejected_without_a_request(client):
    pay = await client.do_payment(uc.PAYMENT_TYPE_HAMKORBANK_HOLD, ORDER_ID)
    before = len(client.calls)
    with pytest.raises(PaymentFailed):
        await client.confirm_otp(uc.PAYMENT_TYPE_HAMKORBANK_HOLD,
                                 pay.payment_subid, "   ", order_id=ORDER_ID)
    assert len(client.calls) == before
