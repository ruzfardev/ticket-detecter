"""
Per-user HTTP client for eticket.railway.uz.

Phase A: friend/list.
Phase B/C: universal-orders + payment flow (Hamkorbank-Hold + Payme).

The eticket userId needed by `friend/list` is decoded locally from the
JWT 'id' claim (`/users/get` returns 404 for regular accounts).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import asyncpg
import httpx

from app.core.errors import AppError, RailwayUnavailable, RateLimited
from app.core.logging import logger
from app.railway._auth_common import BASE_URL
from app.railway.client import get_bucket  # shared TokenBucket (per IP, not per account)
from app.railway.user_auth import (
    RailwayAccountRequired,
    RailwayLoginFailed,
    get_or_refresh_for_user,
)


FRIEND_LIST_URL = f"{BASE_URL}/api/v1/users/friend/list"
ORDERS_CREATE_URL = f"{BASE_URL}/api/v2/universal-orders/create"
ORDERS_GET_URL = f"{BASE_URL}/api/v1/universal-orders/get"
ORDERS_END_TIME_URL = f"{BASE_URL}/api/v1/universal-orders/process/end-time"
ORDERS_CANCEL_URL = f"{BASE_URL}/api/v1/universal-orders/cancel"
PAYMENT_TYPE_LIST_URL = f"{BASE_URL}/api/v3/payment-type/list"
PAYMENT_TYPE_LIST_V1_URL = f"{BASE_URL}/api/v1/payment-type/list"
PAYMENT_SELECT_URL = f"{BASE_URL}/api/v1/payment/select-payment-type"
INVOICE_GENERATE_URL = f"{BASE_URL}/api/v1/universal-orders/invoice-generate"

# Gateway-specific. Phase C captures show these two are the live national-
# currency gateways (route-dependent — Afrosiyob → HamkorbankHold, Plaskart → Payme).
HAMKORBANK_HOLD_DO_URL = f"{BASE_URL}/api/v1/hamkorbank-hold/do-payment"
HAMKORBANK_HOLD_PREPARE_URL = f"{BASE_URL}/api/v1/hamkorbank-hold/prepare-payment"
HAMKORBANK_HOLD_PAY_URL = f"{BASE_URL}/api/v1/hamkorbank-hold/pay-receipt"
HAMKORBANK_HOLD_RESEND_URL = f"{BASE_URL}/api/v1/hamkorbank-hold/resend-code"

PAYME_DO_URL = f"{BASE_URL}/api/v1/payme/do-payment"
PAYME_CREATE_CARD_URL = f"{BASE_URL}/api/v1/payme/create-card"
PAYME_VERIFY_CARD_URL = f"{BASE_URL}/api/v1/payme/verify-card"
PAYME_PAY_URL = f"{BASE_URL}/api/v1/payme/pay-receipt"
PAYME_RESEND_URL = f"{BASE_URL}/api/v1/payme/resend-code"


# --- Exceptions ---

class OrderConflict(AppError):
    code = "order_conflict"
    status_code = 409


class PaymentFailed(AppError):
    code = "payment_failed"
    status_code = 400


# --- Payment-type vocabulary (eticket's strings) ---

PAYMENT_TYPE_HAMKORBANK_HOLD = "HamkorbankHold"
PAYMENT_TYPE_PAYME = "Payme"
SUPPORTED_PAYMENT_TYPES = {PAYMENT_TYPE_HAMKORBANK_HOLD, PAYMENT_TYPE_PAYME}


@dataclass(slots=True)
class PassengerArg:
    firstname: str
    lastname: str
    midname: str
    birth_day: str            # 'DD.MM.YYYY'
    gender: str               # 'Male' | 'Female'
    citizenship: str          # 'UZB'
    doc_type: str             # 'ПУ' | 'СР' | ...
    doc_id: str
    region_id: str


@dataclass(slots=True)
class CreateOrderArgs:
    railway_user_id: str
    railway_username: str
    # passengers (1..N, all in the same car — one order, one payment, one OTP)
    passengers: list[PassengerArg]
    # route
    dep_code: str
    arr_code: str
    dep_date_dot: str         # 'DD.MM.YYYY'
    dep_time: str             # 'HH:MM'
    train_number: str
    car_number: str
    car_type: str             # Cyrillic, e.g. 'Сидячий', 'Плацкартный'
    class_service: str        # e.g. '2Е', '3П'
    seat_numbers: list[int]   # one per passenger, same order


@dataclass(slots=True)
class CreatedOrder:
    order_id: str


@dataclass(slots=True)
class PaymentTypeGroup:
    card_type: str            # 'NATIONAL_CURRENCY' | 'FOREIGN_CURRENCY'
    show_type: str            # 'PRIORITIZED' | 'OPTIONAL'
    payment_types: list[str]


@dataclass(slots=True)
class DoPaymentResult:
    payment_subid: str        # hamkorbankHoldId / paymeId / ...
    amount_uzs: int           # in soums (not tiyins)
    raw: dict[str, Any]


@dataclass(slots=True)
class OrderState:
    order_id: str
    end_life_time: str | None         # ISO timestamp
    amount_uzs: int | None
    raw: dict[str, Any]


@dataclass(slots=True)
class FriendRecord:
    friend_id: str
    firstname: str
    lastname: str
    midname: str | None
    sex: str | None              # 'M' | 'F'
    birth_day: str               # 'DD.MM.YYYY' as returned by eticket
    doc_type: str | None
    doc: str | None
    citizenship: str | None
    region_id: str | None
    your_self: bool


class RailwayUserClient:
    """Per-call HTTP client. Cheap to instantiate; reuses global TokenBucket."""

    def __init__(self, pool: asyncpg.Pool, user_id: int):
        self._pool = pool
        self._user_id = user_id

    async def _post(self, url: str, payload: dict[str, Any]) -> dict[str, Any]:
        await get_bucket().acquire()
        headers = (await get_or_refresh_for_user(self._pool, self._user_id)).as_headers()
        async with httpx.AsyncClient(timeout=20) as http:
            try:
                r = await http.post(url, json=payload, headers=headers)
            except httpx.HTTPError as e:
                raise RailwayUnavailable(f"{url} network error: {e}")
        await self._handle_status(r, url)
        # 204 No Content / empty body — return empty dict to keep callers simple.
        body = (r.text or "").strip()
        if not body:
            return {}
        try:
            return r.json()
        except ValueError:
            raise RailwayUnavailable(f"{url} returned non-JSON body")

    async def _handle_status(self, r: httpx.Response, url: str = "") -> None:
        short_url = url.replace("https://eticket.railway.uz", "") if url else ""
        if r.status_code == 429:
            raise RateLimited("railway.uz returned 429")
        if r.status_code == 401:
            # Force a re-login on next call by clearing tokens.
            await self._pool.execute(
                """
                UPDATE user_railway_accounts
                SET access_token = NULL, csrf_token = NULL, cookie_str = NULL,
                    token_exp_at = NULL
                WHERE user_id = $1
                """,
                self._user_id,
            )
            raise RailwayLoginFailed("eticket session invalid; will retry")
        if r.status_code >= 500:
            raise RailwayUnavailable(f"railway.uz {r.status_code} {short_url}")
        # Accept any 2xx (200 OK, 204 No Content). Reject everything else.
        if not (200 <= r.status_code < 300):
            logger.warning(
                "railway_user_unexpected_status",
                user_id=self._user_id,
                url=short_url,
                status=r.status_code,
                body=r.text[:200],
            )
            raise RailwayUnavailable(f"railway.uz {r.status_code} {short_url}")

    async def _post_text(self, url: str, payload: dict[str, Any]) -> str:
        """Same as `_post` but used when eticket returns a bare JSON string."""
        await get_bucket().acquire()
        headers = (await get_or_refresh_for_user(self._pool, self._user_id)).as_headers()
        async with httpx.AsyncClient(timeout=20) as http:
            try:
                r = await http.post(url, json=payload, headers=headers)
            except httpx.HTTPError as e:
                raise RailwayUnavailable(f"{url} network error: {e}")
        await self._handle_status(r, url)
        return r.text

    async def _get(self, url: str) -> dict[str, Any]:
        await get_bucket().acquire()
        headers = (await get_or_refresh_for_user(self._pool, self._user_id)).as_headers()
        async with httpx.AsyncClient(timeout=20) as http:
            try:
                r = await http.get(url, headers=headers)
            except httpx.HTTPError as e:
                raise RailwayUnavailable(f"{url} network error: {e}")
        await self._handle_status(r, url)
        try:
            return r.json()
        except ValueError:
            raise RailwayUnavailable(f"{url} returned non-JSON body")

    # ---- universal-orders ----

    async def create_order(self, args: CreateOrderArgs) -> CreatedOrder:
        passengers_body = [{
            "birthDay": p.birth_day,
            "gender": p.gender,
            "children": [],
            "citizenship": p.citizenship,
            "docType": p.doc_type,
            "firstname": p.firstname,
            "lastname": p.lastname,
            "midname": p.midname,
            "regionId": p.region_id,
            "docId": p.doc_id,
            "discount": {
                "type": "REGULAR", "pinfl": "",
                "studentId": "", "tariff": "", "prefix": "",
            },
        } for p in args.passengers]
        seats = list(args.seat_numbers or [])
        seats_range = f"{min(seats)}-{max(seats)}" if seats else "0-0"
        body = {
            "userId": args.railway_user_id,
            "userName": args.railway_username,
            "hasAdditionalOrder": False,
            "orderItemRequest": [{
                "passengers": passengers_body,
                "directionSequence": 1,
                "itemType": "ExpressItem",
                "route": {
                    "stationFrom": args.dep_code,
                    "stationTo": args.arr_code,
                    "depDate": args.dep_date_dot,
                    "depTime": args.dep_time,
                    "trainNumber": args.train_number,
                    "carId": None,
                    "carNumber": args.car_number,
                    "carType": args.car_type,
                    "seatNumbers": seats,
                    "classService": args.class_service,
                    "requirements": {"seatsRange": seats_range},
                    "selfDepartureAgreed": False,
                },
            }],
        }
        raw = await self._post_text(ORDERS_CREATE_URL, body)
        # response is a bare JSON string, e.g. "UX77Z6KOU4B1RY"
        try:
            order_id = raw.strip().strip('"')
        except Exception:
            raise RailwayUnavailable(
                f"create_order: unexpected response: {raw[:200]}",
            )
        if not order_id:
            # Some failure modes return empty body or error object — surface as conflict.
            raise OrderConflict("eticket did not return an orderId")
        return CreatedOrder(order_id=order_id)

    async def get_order(self, order_id: str) -> OrderState:
        data = await self._get(f"{ORDERS_GET_URL}/{order_id}")
        body = data.get("response") or {}
        amount = None
        for item in (body.get("expressItemData") or []):
            for ticket in (item.get("tickets") or []):
                t = (ticket.get("tariff") or {}).get("amount")
                if isinstance(t, (int, float)):
                    amount = int(amount or 0) + int(t)
        return OrderState(
            order_id=order_id,
            end_life_time=None,
            amount_uzs=amount,
            raw=data,
        )

    async def get_end_time(self, order_id: str) -> str | None:
        data = await self._get(f"{ORDERS_END_TIME_URL}/{order_id}")
        return ((data.get("response") or {}).get("endLifeTime")) or None

    async def cancel_order(self, order_id: str, railway_user_id: str) -> None:
        await self._post(
            f"{ORDERS_CANCEL_URL}/{order_id}",
            {"orderId": order_id, "userId": railway_user_id},
        )

    # ---- payment selection ----

    async def list_payment_types(self, payment_id: str) -> list[PaymentTypeGroup]:
        """Try the v3 endpoint first (browser default), fall back to v1.

        A failing variant (404, 5xx, network) must not abort the purchase —
        callers poll this until eticket has the order ready, so any per-URL
        error just means "no data from this variant, try the next".
        """
        for url in (PAYMENT_TYPE_LIST_URL, PAYMENT_TYPE_LIST_V1_URL):
            try:
                out = await self._list_payment_types_one(url, payment_id)
            except (RailwayUnavailable, RateLimited) as exc:
                logger.warning("railway_payment_type_list_failed",
                               user_id=self._user_id,
                               url=url.split("/api/", 1)[-1],
                               error=str(exc)[:200])
                continue
            if out:
                return out
        return []

    async def _list_payment_types_one(
        self, url: str, payment_id: str,
    ) -> list[PaymentTypeGroup]:
        raw = await self._post_text(url, {"paymentId": payment_id})
        try:
            import json
            data: Any = json.loads(raw) if raw.strip() else []
        except ValueError:
            logger.warning("railway_payment_type_list_bad_json",
                           user_id=self._user_id, url=url.split("/api/", 1)[-1],
                           raw=raw[:300])
            return []
        arr = data if isinstance(data, list) else (
            data.get("data") if isinstance(data, dict) else None
        ) or []
        if not arr:
            logger.warning("railway_payment_type_list_empty",
                           user_id=self._user_id, url=url.split("/api/", 1)[-1],
                           raw=raw[:300])
        out: list[PaymentTypeGroup] = []
        for g in arr:
            if not isinstance(g, dict):
                continue
            out.append(PaymentTypeGroup(
                card_type=str(g.get("cardType") or ""),
                show_type=str(g.get("showType") or ""),
                payment_types=[str(x) for x in (g.get("paymentTypes") or [])],
            ))
        return out

    async def generate_invoice(self, order_id: str) -> None:
        """Best-effort precondition before payment-type/list — JS bundle places
        this call right before payment routing. Tolerant of 4xx/204."""
        try:
            await self._post(INVOICE_GENERATE_URL, {"orderId": order_id})
        except Exception as exc:
            logger.info("railway_invoice_generate_skipped",
                        user_id=self._user_id, error=str(exc)[:120])

    async def select_payment_type(
        self, order_id: str, payment_id: str, payment_type: str,
    ) -> None:
        await self._post(PAYMENT_SELECT_URL, {
            "id": order_id,
            "paymentId": payment_id,
            "type": payment_type,
            "withLoyaltyProgram": None,
        })

    # ---- gateway-specific do-payment ----

    async def do_payment(
        self, payment_type: str, order_id: str,
    ) -> DoPaymentResult:
        if payment_type == PAYMENT_TYPE_HAMKORBANK_HOLD:
            data = await self._post(HAMKORBANK_HOLD_DO_URL, {"orderId": order_id})
            sub_id = str(data.get("id") or "")
            tiyins = int(data.get("totalCost") or 0)
            return DoPaymentResult(
                payment_subid=sub_id,
                amount_uzs=tiyins // 100,
                raw=data,
            )
        if payment_type == PAYMENT_TYPE_PAYME:
            data = await self._post(PAYME_DO_URL, {"orderId": order_id})
            sub_id = str(data.get("paymeId") or "")
            tiyins = int(data.get("dataAmount") or 0)
            return DoPaymentResult(
                payment_subid=sub_id,
                amount_uzs=tiyins // 100,
                raw=data,
            )
        raise PaymentFailed(
            f"Unsupported payment type: {payment_type}",
            {"supported": sorted(SUPPORTED_PAYMENT_TYPES)},
        )

    async def submit_card(
        self,
        payment_type: str,
        payment_subid: str,
        card_number: str,
        card_expiry_mmyy: str,
    ) -> None:
        """Submit card details. eticket dispatches SMS-OTP after this call."""
        # Strip any spaces / dashes from PAN before sending.
        pan = "".join(ch for ch in card_number if ch.isdigit())
        exp = "".join(ch for ch in card_expiry_mmyy if ch.isdigit())[:4]
        if len(pan) < 12 or len(exp) != 4:
            raise PaymentFailed("Invalid card format")
        if payment_type == PAYMENT_TYPE_HAMKORBANK_HOLD:
            await self._post(HAMKORBANK_HOLD_PREPARE_URL, {
                "id": payment_subid,
                "cardNumber": pan,
                "cardExpiry": exp,
            })
            return
        if payment_type == PAYMENT_TYPE_PAYME:
            await self._post(PAYME_CREATE_CARD_URL, {
                "id": payment_subid,
                "cardNumber": pan,
                "cardExpiry": exp,
            })
            return
        raise PaymentFailed(f"Unsupported payment type: {payment_type}")

    async def confirm_otp(
        self, payment_type: str, payment_subid: str, otp: str,
    ) -> None:
        """Submit the SMS-OTP. On 200 the payment is captured by eticket."""
        otp = "".join(ch for ch in (otp or "") if ch.isdigit())
        if not otp:
            raise PaymentFailed("OTP is empty")
        if payment_type == PAYMENT_TYPE_HAMKORBANK_HOLD:
            await self._post(HAMKORBANK_HOLD_PAY_URL, {
                "id": payment_subid,
                "code": otp,
            })
            return
        if payment_type == PAYMENT_TYPE_PAYME:
            await self._post(PAYME_VERIFY_CARD_URL, {
                "id": payment_subid,
                "code": otp,
            })
            return
        raise PaymentFailed(f"Unsupported payment type: {payment_type}")

    async def resend_otp(self, payment_type: str, payment_subid: str) -> None:
        if payment_type == PAYMENT_TYPE_HAMKORBANK_HOLD:
            await self._post(HAMKORBANK_HOLD_RESEND_URL, {"id": payment_subid})
            return
        if payment_type == PAYMENT_TYPE_PAYME:
            await self._post(PAYME_RESEND_URL, {"id": payment_subid})
            return
        raise PaymentFailed(f"Unsupported payment type: {payment_type}")

    # ---- friends (Phase A) ----

    async def list_friends(self, railway_user_id: str) -> list[FriendRecord]:
        data = await self._post(FRIEND_LIST_URL, {"userId": railway_user_id})
        # Eticket returns either a bare array or `{"data": [...]}` depending on
        # version; accept both.
        arr = data if isinstance(data, list) else (data.get("data") or [])
        out: list[FriendRecord] = []
        for f in arr:
            try:
                out.append(FriendRecord(
                    friend_id=str(f["friendId"]),
                    firstname=str(f.get("firstname") or "").strip(),
                    lastname=str(f.get("lastname") or "").strip(),
                    midname=(str(f.get("midname") or "").strip() or None),
                    sex=(str(f.get("sex") or "").strip()[:1] or None),
                    birth_day=str(f.get("birthDay") or "").strip(),
                    doc_type=(str(f.get("docType") or "").strip() or None),
                    doc=(str(f.get("doc") or "").strip() or None),
                    citizenship=(str(f.get("citizenship") or "").strip() or None),
                    region_id=(str(f.get("regionId") or "").strip() or None),
                    your_self=bool(f.get("yourSelf")),
                ))
            except KeyError:
                logger.warning("railway_friend_skipped", reason="missing_id", row=f)
                continue
        return out
