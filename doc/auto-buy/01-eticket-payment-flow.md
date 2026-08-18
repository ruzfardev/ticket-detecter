# eticket.railway.uz — Auto-buy card payment flow (LIVE-CAPTURED)

**Status:** Verified by live network capture on 2026-08-18/19 against the real
eticket.railway.uz production site (Angular 11.1.2 SPA), using the account owner's
own session. This **resolves the blocker** documented previously (the "204 / paymentId
binding" dead-end): a fresh `v2` order + `device-type: BROWSER` header + a valid Bearer
token makes the whole Hamkorbank-Hold chain succeed. Card number / CVV / OTP were
redacted at capture time and never stored.

> The only step not executed end-to-end (to avoid a real charge) is the final
> **OTP-confirm** call. Its endpoint + body are inferred from eticket's own Angular
> service methods and must be confirmed on the first real run (see step 6).

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

### 2. List payment types — `POST /api/v3/payment-type/list`
```jsonc
{ "paymentId": "PaymentId-<uuid4>" }   // client-generated; MUST be reused in step 3
```
**→** `[ {cardType:"FOREIGN_CURRENCY", showType:"OPTIONAL", paymentTypes:["StripeIntegration"]},
{cardType:"NATIONAL_CURRENCY", showType:"PRIORITIZED", paymentTypes:["HamkorbankHold"]} ]`

> The `paymentId` is a fresh `"PaymentId-" + uuid4()`. It works when the order was just
> created via `v2` create with `device-type: BROWSER`. (Previously believed to require a
> browser-only binding — it does not; a fresh valid order + correct headers is enough.)

### 3. Select payment type — `POST /api/v1/payment/select-payment-type`
```jsonc
{ "id": "<orderId>", "paymentId": "PaymentId-<uuid4>", "type": "HamkorbankHold", "withLoyaltyProgram": null }
```
**→** `{ "data": { "paymentId": "PaymentId-<uuid4>" } }`

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

### 6. Confirm OTP — `POST /api/v1/hamkorbank-hold/confirm-payment`  ⚠️ verify on first run
```jsonc
{ "id": "<holdId>", "code": "<otp>" }
```
Inferred from eticket's Angular service `payReceiptHamkorHold(e, t="hold")`. The bundle
also references `hamkorbank-hold/pay-receipt`; on the first live run, capture the exact
path (`confirm-payment` vs `pay-receipt`) and the code field name (`code` vs `otp` vs
`smsCode`). **→** success = ticket issued to the user's eticket cabinet.

**Resend OTP — `POST /api/v1/hamkorbank-hold/resend-code`**  body `{ "id": "<holdId>" }`
(service `resendSmsHamkorbankHold`).

---

## eticket Angular service ↔ endpoint map (from `main.*.js`)

| Service method | Endpoint (`t="hold"`) | Our step |
|---|---|---|
| `doPaymentHamkorHold(e, t)` | `POST /api/v1/hamkorbank-{t}/do-payment` | 4 (initiate, `{orderId}`) |
| `createReceiptHamkorHold(e, t)` | `POST /api/v1/hamkorbank-{t}/prepare-payment` | 5 (card, `{id,cardNumber,cardExpiry}`) |
| `payReceiptHamkorHold(e, t)` | `POST /api/v1/hamkorbank-{t}/confirm-payment` | 6 (OTP, `{id,code}`) |
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
