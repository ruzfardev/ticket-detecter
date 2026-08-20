# eticket.railway.uz — Auto-buy card payment flow (LIVE-CAPTURED)

**Status:** Verified by live network capture on 2026-08-18/19 and re-confirmed
end-to-end on **2026-08-20** against the real eticket.railway.uz production site
(Angular 11.1.2 SPA), using the account owner's own session. Card number / CVV / OTP
were redacted at capture time and never stored.

The long-standing blocker (`payment-type/list` returning an empty list →
`No supported NATIONAL_CURRENCY type`) is **resolved**: the `paymentId` is assigned by
eticket and must be read back from the order (step 1b), not generated client-side.

> Step 6 (OTP-confirm) was resolved on 2026-08-20 after the first live run failed:
> the endpoint is **`confirm-payment`** with **`confirmationCode`** (see step 6 for the
> exact bundle source and the `pay-receipt` trap).

### Timezone gotcha

`GET /universal-orders/process/end-time/{id}` returns `endLifeTime` **without an offset,
in Tashkent wall-clock time** (UTC+5) — e.g. an order created at `07:19:56+05:00` gets
`"2026-08-20T07:31:57.219690193"`, a 12-minute hold. Parsing it as UTC pushes every
countdown 5 hours out (the mini-app showed `310:50` instead of `~10:50`).

---

## Transport & headers

- **Host:** `https://eticket.railway.uz`
- **Auth model:** the user logs into eticket (email/password or Google-linked); the SPA
  holds a **Bearer JWT** (~373 chars). Our backend already stores Fernet-encrypted
  eticket credentials and logs in to obtain this token.
- **Headers on every payment/order call:**

  | Header | Value | Notes |
  |---|---|---|
  | `Content-Type` | `application/json` | |
  | `Accept` | `application/json` | |
  | `device-type` | `BROWSER` | **REQUIRED** — the historical 204s came from an order/flow that did not present as a genuine browser purchase |
  | `Accept-Language` | `uz` | |
  | `Authorization` | `Bearer <JWT>` | from the user's eticket login |
  | `X-XSRF-TOKEN` | `<guid>` | Angular double-submit CSRF; value mirrors the `XSRF-TOKEN` cookie. Fetch any page first to obtain the cookie, then echo it in this header. Server may not enforce it for non-browser clients — send it anyway. |

- **Money:** all `*Cost` fields are in **tiyin** (÷100 = so'm). `24514000` = `245 140 so'm`.
- **Card brand by BIN:** `8600`=UzCard, `9860`=Humo, `4…`=Visa, `51–55`=Mastercard.

---

## The chain (HamkorbankHold = national-currency card path)

`HamkorbankHold` is the `PRIORITIZED` type for `NATIONAL_CURRENCY` (Humo/UzCard).
Alternatives exist (`Payme`, `StripeIntegration`, `click`, `octobank`, …) with parallel
`/api/v1/<provider>/{do-payment,prepare-payment,resend-code,pay-receipt}` shapes.

### 1. Create order — `POST /api/v2/universal-orders/create`
```jsonc
{
  "userId": "<eticket user uuid>",
  "userName": "<eticket userName>",
  "hasAdditionalOrder": false,
  "orderItemRequest": [{
    "passengers": [{
      "birthDay": "22.06.2002",           // DD.MM.YYYY
      "gender": "Male",                    // Male | Female
      "children": [],                       // lap children (<5) go here
      "citizenship": "UZB",
      "docType": "ПУ",                     // ПУ passport · СР birth cert · ЗП foreign
      "firstname": "Farrux",
      "lastname": "Rozmetov",
      "midname": "Quvondiq ugli",
      "regionId": "",
      "docId": "AC1510313",
      "discount": { "type": "REGULAR", "pinfl": "", "studentId": "", "tariff": "", "prefix": "" }
    }],
    "directionSequence": 1,
    "itemType": "ExpressItem",
    "route": {
      "stationFrom": "2900000",            // station codes
      "stationTo": "2900790",
      "depDate": "30.09.2026",             // DD.MM.YYYY
      "depTime": "22:35",
      "trainNumber": "125Ч",
      /* + wagon/seat selection fields from the seat-pick step */
    }
  }]
}
```
**→ Response:** the **orderId** string, e.g. `"UX780AQKET8C9A"`.

Side/aux calls seen around create (not required for the core buy): `POST /api/v1/users/friend/list`,
`POST /api/v1/users/friend/create` (saves passenger to eticket friend list), `POST /api/v2/discounts/available`,
`GET /api/v1/insurance/check`, `POST /api/v1/handbook/catering/product-templates`.

Seat-hold helpers:
- `GET /api/v1/universal-orders/get/{orderId}` — order detail
- `GET /api/v1/universal-orders/process/end-time/{orderId}` — hold expiry countdown

### 1b. Read the order's paymentId — `GET /api/v1/universal-orders/get/{orderId}`

**eticket assigns the `paymentId`; the client never invents it.** It appears on the
order detail once the order settles (a second or two after create):

```jsonc
{ "response": {
    "expressItemData": [ /* … tickets … */ ],
    "orderState": "ORDER_IN_PROCESS",
    "orderPaymentData": {
      "paymentId": "PaymentId-ce8b1c3b-569a-439e-a2cb-021eefb50075",
      "paymentType": "None"
    } } }
```

Poll `get` until `response.orderPaymentData.paymentId` is non-null, then use that
exact string for steps 2 and 3.

### 2. List payment types — `POST /api/v3/payment-type/list`
```jsonc
{ "paymentId": "PaymentId-ce8b1c3b-…" }   // from step 1b — MUST be reused in step 3
```
**→** `[ {cardType:"FOREIGN_CURRENCY", showType:"OPTIONAL", paymentTypes:["StripeIntegration"]},
{cardType:"NATIONAL_CURRENCY", showType:"PRIORITIZED", paymentTypes:["HamkorbankHold"]} ]`

> ⚠️ A **client-generated** `"PaymentId-" + uuid4()` always returns an empty list — eticket
> looks the id up against the order and finds nothing. That was the root cause of the
> long-running `No supported NATIONAL_CURRENCY type. Eticket returned: (none)` failure.
> Confirmed 2026-08-20 by capturing a real browser purchase (Toshkent→Samarqand, 127Ф,
> wagon 23, seat 20) end to end.

### 3. Select payment type — `POST /api/v1/payment/select-payment-type`
```jsonc
{ "id": "<orderId>", "paymentId": "PaymentId-ce8b1c3b-…", "type": "HamkorbankHold", "withLoyaltyProgram": null }
```
**→** `{ "data": { "paymentId": "PaymentId-ce8b1c3b-…" } }`

### 4. Initiate hold — `POST /api/v1/hamkorbank-hold/do-payment`
```jsonc
{ "orderId": "<orderId>" }
```
**→**
```jsonc
{ "id": "UX<guid>",          // <-- holdId; carry into steps 5 & 6
  "orderId": "<orderId>",
  "totalCost": 24514000,      // tiyin
  "percent": 1,
  "ticketTotalCost": 24514000, "insuranceTotalCost": 0, "mealTotalCost": 0, "ecoTicketTotalCost": 0 }
```

### 5. Submit card → **sends OTP** — `POST /api/v1/hamkorbank-hold/prepare-payment`
```jsonc
{ "id": "<holdId>", "cardNumber": "<16 digits>", "cardExpiry": "MMYY" }   // "1027" = 10/2027
```
**→** `{ "data": { "hamkorbankHoldId": "<holdId>" }, "error": null }`

⚡ At this point the **bank sends the SMS OTP** to the cardholder's phone.

### 6. Confirm OTP — `POST /api/v1/hamkorbank-hold/confirm-payment`  ✅ confirmed
```jsonc
{ "id": "<holdId>", "confirmationCode": "<otp>" }
```
Read verbatim from the payment component's `sendSMS()`:
`this.api.payReceiptHamkorHold({ id: this.paymentTypeSystem, confirmationCode: this.code })`,
and its service definition
``payReceiptHamkorHold(e, t="hold") { return this.http.post(host + `/api/v1/hamkorbank-${t}/confirm-payment`, e) }``.

> ⚠️ The method name says *pay-receipt* but the URL is **confirm-payment**. `pay-receipt`
> exists only on the non-hold gateway (`payReceiptHamkor` → `/api/v1/hamkorbank/pay-receipt`).
> Posting the hold flow to `/api/v1/hamkorbank-hold/pay-receipt` returns a bare
> `404 {"error":"Not Found","message":null}` — this cost us the first live run
> (2026-08-20, order 23). The literal string `"/api/v1/hamkorbank-hold/pay-receipt"` does
> appear in the bundle, but only inside a loader-suppression list, never as a call site.

### Reading the confirm-payment response

eticket replies in a `{"data": ..., "error": ...}` envelope. A **rejected code**
comes back as **HTTP 200** with:

```jsonc
{ "data": null, "error": { "hamkorbankHoldId": "UX8512c059-aa97-476f-9dbb-b493230300ed" } }
```

So `data == null && error` is the fast, reliable rejection signal — check it before
anything else. (Captured 2026-08-20 from order 32 / `UX780BF4BAAQKD`.)

> Don't skip this and poll the order instead: the settle poll takes ~27s, which is long
> enough for a phone on mobile data to drop the connection. The client then never sees
> the result and the screen sits on "processing" forever even though the server had
> already resolved it correctly.

### 🚨 A 2xx from confirm-payment does NOT mean the ticket was bought

Confirmed the hard way on 2026-08-20 (order 25 / `UX780BE53LUTSJ`): a **wrong** SMS code
still returned **HTTP 200**. We reported "Chipta sotib olindi!" for a purchase that had
not happened.

eticket settles the order **asynchronously**. Its own web UI never treats the HTTP
response as the verdict — `sendSMS()` calls `runWebsocket()` and `getReservationInfo()`
right after, and learns the real outcome over the `/ws` socket.

**The only trustworthy signal we have over plain HTTP is the order's state:**

`GET /api/v1/universal-orders/get/{orderId}` → `response.orderState`

| Value | Meaning |
|---|---|
| `ORDER_IN_PROCESS` | held, **not paid** (this is what an unpaid order shows) |
| `ORDER_COMPLETED_SUCCESSFULLY` | **paid** — ticket issued |
| `ORDER_FINISHED_WITH_CORPORATE_CONFIRMATION_SUCCEEDED` | paid (corporate card flow) |
| `ORDER_FINISHED_WITH_ORDER_LIFECYCLE_DEADLINE_TIME_EXPIRED` | hold expired, not paid |

(The orders list exposes the same idea as `finalStatus`, where `RESERVATION_SUCCEEDED`
means reserved-but-unpaid and `ORDER_COMPLETED_SUCCESSFULLY` means paid.)

So: after confirm-payment, **poll the order** and only report success once it reaches a
paid state. If it is still `ORDER_IN_PROCESS`, the code was not accepted — send the user
back to retype it. The hold survives, so retries work until `hold_until`.

A rejected code *may* also come back as a 4xx; treat 4xx on payment endpoints as a
user-fixable payment error rather than an outage.

**Resend OTP — `POST /api/v1/hamkorbank-hold/resend-code`**  body `{ "id": "<holdId>" }`
(service `resendSmsHamkorbankHold`).

---

## eticket Angular service ↔ endpoint map (from `main.*.js`)

| Service method | Endpoint (`t="hold"`) | Our step |
|---|---|---|
| `doPaymentHamkorHold(e, t)` | `POST /api/v1/hamkorbank-{t}/do-payment` | 4 (initiate, `{orderId}`) |
| `createReceiptHamkorHold(e, t)` | `POST /api/v1/hamkorbank-{t}/prepare-payment` | 5 (card, `{id,cardNumber,cardExpiry}`) |
| `payReceiptHamkorHold(e, t)` | `POST /api/v1/hamkorbank-{t}/confirm-payment` | 6 (OTP, `{id,confirmationCode}`) |
| `payReceiptHamkor(e)` | `POST /api/v1/hamkorbank/pay-receipt` | — (non-hold gateway, unused) |
| `resendSmsHamkorbankHold(e)` | `POST /api/v1/hamkorbank-hold/resend-code` | resend (`{id}`) |

Component wiring observed: `doPaymentHamkorHold(...).subscribe(e => { totalCostFromDoPayment = e.totalCost; paymentTypeSystem = e.id; })` — i.e. the `id` from step 4 is the hold id used everywhere after.

---

## Our server-side implementation contract

Replay steps 1–6 from the backend using the user's stored eticket Bearer token, driving
the OTP round-trip through the mini-app:

1. Worker reserves the seat → order created (`create`) → status `seat_held`.
2. Backend runs steps 2–5 (up to `prepare-payment`) using the user's **saved card**
   (decrypted server-side) → bank SMS lands on the user's phone → order status
   `awaiting_otp`, mini-app shows the OTP screen; bot pings the user.
3. User enters the 6-digit OTP in the mini-app → backend runs step 6
   (`confirm-payment {holdId, code}`) → `confirmed`; resend maps to `resend-code`.

Persist per order: `eticket_order_id`, `hold_id`, `payment_id`, `card_id`,
`total_uzs` (`totalCost/100`), `seat_expires_at`, `status`.

**Never log** raw PAN/CVV/OTP. Store card PAN + expiry Fernet-encrypted; decrypt only in
memory for the `prepare-payment` call.
