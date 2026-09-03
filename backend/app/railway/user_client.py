"""
Per-user HTTP client for eticket.railway.uz.

Phase A: friend/list.
Phase B/C: universal-orders + payment flow (Hamkorbank-Hold + Payme).

The eticket userId needed by `friend/list` is decoded locally from the
JWT 'id' claim (`/users/get` returns 404 for regular accounts).
"""

from __future__ import annotations

from dataclasses import dataclass, field
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

# Purchased tickets (the user's eticket cabinet).
QUERY_ORDERS_LIST_URL = f"{BASE_URL}/api/v2/query/orders/list"
QUERY_ORDERS_ARCHIVE_URL = f"{BASE_URL}/api/v2/query/orders/archive/list"
QUERY_ORDERS_COUNT_URL = f"{BASE_URL}/api/v2/query/orders/count"
QUERY_ORDERS_TICKETS_URL = f"{BASE_URL}/api/v2/query/orders/tickets"
QUERY_ORDERS_ARCHIVE_TICKETS_URL = f"{BASE_URL}/api/v2/query/orders/archive/tickets"
QUERY_ORDERS_PDF_URL = f"{BASE_URL}/api/v2/query/orders/pdf"

# Gateway-specific. Phase C captures show these two are the live national-
# currency gateways (route-dependent — Afrosiyob → HamkorbankHold, Plaskart → Payme).
HAMKORBANK_HOLD_DO_URL = f"{BASE_URL}/api/v1/hamkorbank-hold/do-payment"
HAMKORBANK_HOLD_PREPARE_URL = f"{BASE_URL}/api/v1/hamkorbank-hold/prepare-payment"
# The Angular method is called `payReceiptHamkorHold` but it posts to
# `confirm-payment`, NOT `pay-receipt` (which exists only for the non-hold
# `/api/v1/hamkorbank/` gateway). Posting to pay-receipt returns a bare 404.
HAMKORBANK_HOLD_CONFIRM_URL = f"{BASE_URL}/api/v1/hamkorbank-hold/confirm-payment"
HAMKORBANK_HOLD_RESEND_URL = f"{BASE_URL}/api/v1/hamkorbank-hold/resend-code"

PAYME_DO_URL = f"{BASE_URL}/api/v1/payme/do-payment"
PAYME_CREATE_CARD_URL = f"{BASE_URL}/api/v1/payme/create-card"
PAYME_VERIFY_CARD_URL = f"{BASE_URL}/api/v1/payme/verify-card"
PAYME_PAY_URL = f"{BASE_URL}/api/v1/payme/pay-receipt"
# Payme's resend goes through the generic paysys-sum endpoint, not
# /api/v1/payme/resend-code (which only appears in a loader-config list).
PAYSYS_SUM_RESEND_URL = f"{BASE_URL}/api/v1/paysys-sum/resend-code"


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


# Discount types eticket's own booking form sends. A child under 5 rides on an
# adult's lap without a seat and is filed inside that adult's `children`;
# every other passenger, child or not, is REGULAR — the age tariff (5-10 at
# half fare) is eticket's own decision from the birth date.
DISCOUNT_REGULAR = "REGULAR"
DISCOUNT_CHILD_UNDER_5 = "CHILD_UNDER_5"


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
    discount_type: str = DISCOUNT_REGULAR
    # Passengers filed under this one: lap children (no seat) and, as eticket's
    # form does it, anyone under 16 travelling on their own seat.
    children: list["PassengerArg"] = field(default_factory=list)


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
    payment_id: str | None            # response.orderPaymentData.paymentId
    order_state: str | None           # e.g. 'ORDER_IN_PROCESS'
    raw: dict[str, Any]


@dataclass(slots=True)
class PurchasedTicket:
    """One leg of a purchased order, as shown in the eticket cabinet."""
    order_id: str
    order_item_id: str
    created_at: str            # "2026-08-20 11:47:55" — feed back via _api_created_date
    final_status: str          # order-level, e.g. ORDER_COMPLETED_SUCCESSFULLY
    amount_uzs: int
    train_number: str
    train_type: str
    car_number: str
    car_type: str
    dep_station: str
    arr_station: str
    dep_at: str                # "2026-10-15 17:20:00" (Tashkent wall clock)
    arr_at: str
    seats: list[str]
    qr_url: str | None
    raw: dict[str, Any]
    # From the month archive rather than the active list. The detail endpoint
    # differs (the active one answers 204 for an archived leg), so this has
    # to travel with the leg.
    archived: bool = False


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


def _payment_error_message(r: httpx.Response) -> str:
    """Pull a human-readable reason out of an eticket payment rejection.

    Shapes seen in the wild: `{"message": "..."}`, `{"error": "..."}`, and the
    Spring default `{"status":404,"error":"Not Found","message":null}`.
    """
    try:
        body = r.json()
    except ValueError:
        body = None
    if isinstance(body, dict):
        for key in ("message", "error", "detail"):
            val = body.get(key)
            if isinstance(val, str) and val.strip():
                return val.strip()[:200]
    return f"Payment rejected by eticket (HTTP {r.status_code})"


# eticket serves its archive month by month; a month of travel fits in a page
# or two, and the cap keeps a runaway total from turning into a request storm.
ARCHIVE_PAGE_LENGTH = 20
ARCHIVE_MAX_PAGES = 5


def parse_purchased_orders(
    data: dict[str, Any], *, archived: bool = False,
) -> list[PurchasedTicket]:
    """Flatten eticket's order list into one PurchasedTicket per leg (item).

    Shared by the active list and the month archive: both return
    `data[].items[]` in the same shape, the archive merely adds
    `currentPage` / `totalElements` alongside.
    """
    out: list[PurchasedTicket] = []
    for order in (data.get("data") or []):
        created = str(order.get("createDateTime") or "")
        for item in (order.get("items") or []):
            dep = item.get("departure") or {}
            arr = item.get("arrival") or {}
            train = item.get("train") or {}
            car = item.get("car") or {}
            out.append(PurchasedTicket(
                order_id=str(order.get("orderId") or ""),
                order_item_id=str(item.get("orderItemId") or ""),
                created_at=created,
                final_status=str(order.get("finalStatus") or ""),
                amount_uzs=int(float(item.get("totalCost") or 0)),
                train_number=str(train.get("number") or ""),
                train_type=str(train.get("type") or ""),
                car_number=str(car.get("number") or ""),
                car_type=str(car.get("type") or ""),
                dep_station=str(dep.get("stationName") or ""),
                arr_station=str(arr.get("stationName") or ""),
                dep_at=str(dep.get("dateTime") or ""),
                arr_at=str(arr.get("dateTime") or ""),
                seats=[str(t.get("seat") or "") for t in (item.get("tickets") or [])],
                qr_url=item.get("qrCode") or None,
                raw=item,
                archived=archived,
            ))
    return out


def passenger_body(p: PassengerArg, *, nested: bool = False) -> dict[str, Any]:
    """One passenger as eticket's create-order payload wants it.

    Mirrors the site's own form: a top-level passenger carries a `children`
    list (possibly empty); a passenger filed under another one carries
    `children: null`.
    """
    return {
        "birthDay": p.birth_day,
        "gender": p.gender,
        "children": None if nested else [passenger_body(c, nested=True) for c in p.children],
        "citizenship": p.citizenship,
        "docType": p.doc_type,
        "firstname": p.firstname,
        "lastname": p.lastname,
        "midname": p.midname,
        "regionId": p.region_id,
        "docId": p.doc_id,
        "discount": {
            "type": p.discount_type, "pinfl": "",
            "studentId": "", "tariff": "", "prefix": "",
        },
    }


class RailwayUserClient:
    """Per-user eticket client.

    Shares ONE cookie jar across every call of this instance so eticket's
    Set-Cookie responses persist between requests — critical for the payment
    flow: eticket binds the in-progress order to the session cookie
    (``X-VS-Id``) it (re)issues while the order is being formed. A fresh
    cookie set per call drops that binding, so ``payment-type/list`` can't
    find the order and returns 204 (the historical "no supported
    NATIONAL_CURRENCY" dead-end). The browser works precisely because it keeps
    the cookie. HTTP clients are still per-call (cheap, auto-closed); only the
    jar is shared.
    """

    def __init__(self, pool: asyncpg.Pool, user_id: int):
        self._pool = pool
        self._user_id = user_id
        self._jar: httpx.Cookies | None = None

    async def _prepare(self) -> tuple[httpx.Cookies, dict[str, str]]:
        """Return the shared cookie jar + fresh auth headers (Cookie stripped).

        The jar is seeded once from the stored cookie_str, then carried across
        the create -> payment-type/list -> do-payment -> pay-receipt sequence
        (updated from each response's Set-Cookie). Authorization / X-XSRF-TOKEN
        are refreshed on every call in case the token was renewed mid-flight.
        """
        headers = (await get_or_refresh_for_user(self._pool, self._user_id)).as_headers()
        cookie_hdr = headers.pop("Cookie", "") or ""
        if self._jar is None:
            self._jar = httpx.Cookies()
            for part in cookie_hdr.split(";"):
                part = part.strip()
                if "=" in part:
                    k, _, v = part.partition("=")
                    if k.strip():
                        self._jar.set(k.strip(), v.strip(), domain="eticket.railway.uz")
        return self._jar, headers

    async def _post(self, url: str, payload: dict[str, Any],
                    *, payment_errors: bool = False,
                    extra_headers: dict[str, str] | None = None) -> dict[str, Any]:
        await get_bucket().acquire()
        jar, headers = await self._prepare()
        if extra_headers:
            headers = {**headers, **extra_headers}
        try:
            async with httpx.AsyncClient(timeout=20, cookies=jar,
                                         follow_redirects=False) as http:
                r = await http.post(url, json=payload, headers=headers)
                jar.extract_cookies(r)   # persist Set-Cookie for the next call
        except httpx.HTTPError as e:
            raise RailwayUnavailable(f"{url} network error: {e}")
        await self._handle_status(r, url, payment_errors=payment_errors)
        # 204 No Content / empty body — return empty dict to keep callers simple.
        body = (r.text or "").strip()
        if not body:
            return {}
        try:
            return r.json()
        except ValueError:
            raise RailwayUnavailable(f"{url} returned non-JSON body")

    async def _handle_status(self, r: httpx.Response, url: str = "",
                             *, payment_errors: bool = False) -> None:
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
        # On payment endpoints a 4xx is eticket rejecting the input (bad OTP,
        # declined card) — a user-fixable payment error, not an outage. Surface
        # it as PaymentFailed so the caller can keep the order retryable.
        if payment_errors and 400 <= r.status_code < 500:
            logger.warning("railway_payment_rejected", user_id=self._user_id,
                           url=short_url, status=r.status_code,
                           body=r.text[:200])
            raise PaymentFailed(
                _payment_error_message(r),
                {"status": r.status_code, "url": short_url},
            )
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
        jar, headers = await self._prepare()
        try:
            async with httpx.AsyncClient(timeout=20, cookies=jar,
                                         follow_redirects=False) as http:
                r = await http.post(url, json=payload, headers=headers)
                jar.extract_cookies(r)
        except httpx.HTTPError as e:
            raise RailwayUnavailable(f"{url} network error: {e}")
        await self._handle_status(r, url)
        return r.text

    async def _get(self, url: str) -> dict[str, Any]:
        await get_bucket().acquire()
        jar, headers = await self._prepare()
        try:
            async with httpx.AsyncClient(timeout=20, cookies=jar,
                                         follow_redirects=False) as http:
                r = await http.get(url, headers=headers)
                jar.extract_cookies(r)
        except httpx.HTTPError as e:
            raise RailwayUnavailable(f"{url} network error: {e}")
        await self._handle_status(r, url)
        try:
            return r.json()
        except ValueError:
            raise RailwayUnavailable(f"{url} returned non-JSON body")

    # ---- universal-orders ----

    async def create_order(self, args: CreateOrderArgs) -> CreatedOrder:
        passengers_body = [passenger_body(p) for p in args.passengers]
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
        pay_data = body.get("orderPaymentData") or {}
        return OrderState(
            order_id=order_id,
            end_life_time=None,
            amount_uzs=amount,
            payment_id=(pay_data.get("paymentId") or None),
            order_state=(body.get("orderState") or None),
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
        *,
        order_id: str,
    ) -> None:
        """Submit card details. eticket dispatches SMS-OTP after this call.

        The two gateways take different bodies — Payme wants the orderId and its
        own `paymeId`, Hamkorbank-Hold only the hold `id`. Sending Hamkorbank's
        shape to Payme is a flat 400.
        """
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
            }, payment_errors=True)
            return
        if payment_type == PAYMENT_TYPE_PAYME:
            # Verbatim from the site's `pay()`:
            # createReceiptPayme({orderId, paymeId, cardNumber, cardExpiry})
            await self._post(PAYME_CREATE_CARD_URL, {
                "orderId": order_id,
                "paymeId": payment_subid,
                "cardNumber": pan,
                "cardExpiry": exp,
            }, payment_errors=True)
            return
        raise PaymentFailed(f"Unsupported payment type: {payment_type}")

    async def confirm_otp(
        self, payment_type: str, payment_subid: str, otp: str,
        *, order_id: str,
    ) -> dict[str, Any]:
        """Submit the SMS-OTP and return eticket's raw response.

        Body field is `confirmationCode` (not `code`) — taken verbatim from the
        site's own `sendSMS()`: `payReceiptHamkorHold({id, confirmationCode})`.

        ⚠️ A 2xx here does NOT mean the ticket was bought. eticket settles the
        order asynchronously (its web UI opens a websocket to learn the
        outcome), and a wrong code still came back 200. Callers MUST confirm the
        order reached a paid `orderState` before reporting success.
        """
        otp = "".join(ch for ch in (otp or "") if ch.isdigit())
        if not otp:
            raise PaymentFailed("OTP is empty")
        if payment_type == PAYMENT_TYPE_HAMKORBANK_HOLD:
            return await self._post(HAMKORBANK_HOLD_CONFIRM_URL, {
                "id": payment_subid,
                "confirmationCode": otp,
            }, payment_errors=True)
        if payment_type == PAYMENT_TYPE_PAYME:
            # Verbatim from the site's `sendSMS()`:
            # payReceiptPayme({orderId, paymeId, smsCode}) — note `smsCode`,
            # which differs from Hamkorbank's `confirmationCode`.
            return await self._post(PAYME_VERIFY_CARD_URL, {
                "orderId": order_id,
                "paymeId": payment_subid,
                "smsCode": otp,
            }, payment_errors=True)
        raise PaymentFailed(f"Unsupported payment type: {payment_type}")

    async def resend_otp(self, payment_type: str, payment_subid: str) -> None:
        if payment_type == PAYMENT_TYPE_HAMKORBANK_HOLD:
            await self._post(HAMKORBANK_HOLD_RESEND_URL, {"id": payment_subid})
            return
        if payment_type == PAYMENT_TYPE_PAYME:
            await self._post(PAYSYS_SUM_RESEND_URL, {"paySysSumId": payment_subid})
            return
        raise PaymentFailed(f"Unsupported payment type: {payment_type}")

    # ---- purchased tickets (eticket cabinet) ----

    @staticmethod
    def _api_created_date(created_at: str) -> str:
        """`"2026-08-20 11:47:55"` -> `"2026-08-20T11:47:55+05:00"`.

        The list endpoint returns a space-separated timestamp, but tickets/pdf
        demand ISO with the Tashkent offset — send it back as received and they
        answer a bare 400 with no message.
        """
        s = (created_at or "").strip().replace(" ", "T")
        if not s:
            return s
        return s if ("+" in s[10:] or s.endswith("Z")) else f"{s}+05:00"

    async def list_purchased(
        self, page: int = 0, length: int = 20,
    ) -> list[PurchasedTicket]:
        """Active orders from the user's eticket cabinet — the "Faol
        buyurtmalar" page. eticket moves a trip to the archive once it is
        over, so this is upcoming travel only; see `list_archived`.
        """
        data = await self._post(
            QUERY_ORDERS_LIST_URL,
            {"page": page, "length": length},
            extra_headers={"page": str(page), "limit": str(length)},
        )
        return parse_purchased_orders(data)

    async def list_archived(self, year_month: str) -> list[PurchasedTicket]:
        """Past orders for one calendar month ("2026-08") — the "Oldingi
        buyurtmalar" page. eticket keys its archive by month and answers a
        request without one with 400 "Date is null", so there is no way to
        ask for everything at once. Follows `totalElements` across pages.
        """
        out: list[PurchasedTicket] = []
        page, length = 0, ARCHIVE_PAGE_LENGTH
        while True:
            data = await self._post(
                QUERY_ORDERS_ARCHIVE_URL,
                {"page": page, "length": length,
                 "filterData": {"yearMonth": year_month}},
                extra_headers={"page": str(page), "limit": str(length)},
            )
            got = data.get("data") or []
            out.extend(parse_purchased_orders(data, archived=True))
            page += 1
            total = int(data.get("totalElements") or 0)
            if not got or page * length >= total or page >= ARCHIVE_MAX_PAGES:
                return out

    async def get_purchased_detail(
        self, order_item_id: str, created_at: str, *, archived: bool = False,
    ) -> dict[str, Any]:
        """Passengers, per-ticket status and return window for one order item.

        `ticket.status` is independent of the order's `finalStatus` — a returned
        ticket still sits under an ORDER_COMPLETED_SUCCESSFULLY order, and the
        list endpoints carry no ticket status at all, so this is the only place
        a return shows up.

        Archived legs have their own endpoint: asked about one, the active
        endpoint answers 204 with an empty body rather than an error. (The PDF
        endpoint, by contrast, serves both.)
        """
        url = QUERY_ORDERS_ARCHIVE_TICKETS_URL if archived else QUERY_ORDERS_TICKETS_URL
        return await self._post(url, {
            "orderItemId": order_item_id,
            "createdDate": self._api_created_date(created_at),
        })

    async def get_purchased_pdf(
        self, order_item_id: str, created_at: str,
    ) -> bytes:
        """The printable ticket. Returns decoded PDF bytes.

        Despite the endpoint name this is NOT a binary response: it answers
        `application/json` with `{"pdf": "<base64>"}`, so streaming the body
        straight through would hand the user a broken file.
        """
        data = await self._post(QUERY_ORDERS_PDF_URL, {
            "orderItemId": order_item_id,
            "createdDate": self._api_created_date(created_at),
        })
        b64 = (data or {}).get("pdf")
        if not b64:
            raise RailwayUnavailable("eticket returned no pdf payload")
        import base64
        try:
            blob = base64.b64decode(b64)
        except Exception as exc:
            raise RailwayUnavailable(f"pdf is not valid base64: {exc}")
        if not blob.startswith(b"%PDF"):
            raise RailwayUnavailable("decoded payload is not a PDF")
        return blob

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
