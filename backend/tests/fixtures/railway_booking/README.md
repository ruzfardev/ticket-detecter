# eticket.railway.uz booking flow — captured fixtures

Captured 2026-05-30 from a real Tashkent → Samarkand booking on `eticket.railway.uz`,
train `778Ф` (Afrosiyob), seat 8 of car 03, departure `05.06.2026 06:10`.

All UUIDs / order IDs / paymentIds / personal data here are from a sandbox
booking that was **immediately cancelled** before any payment. The captured
shapes are stable across orders — only the identifier values vary.

## Flow

1. **Search trains** — already implemented in `app/railway/client.py`
   - `POST /api/v3/handbook/trains/list` (alias of `/api/v3/trains/availability/space/between/stations`)
   - `POST /api/v1/handbook/trains` (cars + seats detail)

2. **Create order** — NEW (Phase B/C)
   - `POST /api/v2/universal-orders/create` → returns order ID as a bare JSON string
   - `GET  /api/v1/universal-orders/get/{orderId}` → order detail with tickets[], tariff
   - `GET  /api/v1/universal-orders/process/end-time/{orderId}` → countdown timer

3. **Select payment** — NEW
   - Client generates `paymentId = "PaymentId-" + uuid4()` (correlation id)
   - `POST /api/v3/payment-type/list` body `{paymentId}` → available payment types
   - `POST /api/v1/payment/select-payment-type` body `{id: orderId, paymentId, type, withLoyaltyProgram: null}`

4. **Pay** — NEW
   - For HamkorbankHold: `POST /api/v1/hamkorbank-hold/do-payment {orderId}` returns
     `{id, orderId, totalCost, ticketTotalCost, ...}` then a **card-input form** is
     rendered on-page (no redirect URL). After the form, presumably another endpoint
     finalises the charge + 3D-Secure SMS-OTP step (not captured here — would need
     a real card to walk through).
   - For OctoBankFC / StripeIntegration / others: shapes not captured — assume
     gateway-redirect flow analogous to other Uzbek payment systems.

5. **Cancel** — NEW
   - `POST /api/v1/universal-orders/cancel/{orderId}` body `{orderId, userId}` → 200 empty body

## Files

- `01_universal_orders_create.req.json`         — create order body
- `01_universal_orders_create.resp.json`        — `"UX77Z6KOU4B1RY"` (string)
- `02_orders_get.resp.json`                     — full order detail
- `03_orders_end_time.resp.json`                — countdown shape
- `04_payment_type_list.req.json`               — paymentId in body
- `04_payment_type_list.resp.json`              — Afrosiyob → HamkorbankHold
- `04b_payment_type_list_payme.resp.json`       — Tezyurar Plaskart → Payme
- `05_payment_select_type.req.json`             — select payment type
- `05_payment_select_type.resp.json`            — confirms paymentId
- `06_hamkorbank_hold_do_payment.req.json`      — Hamkorbank flow body
- `06_hamkorbank_hold_do_payment.resp.json`     — totalCost in tiyins
- `06a_hamkorbank_prepare_payment.req.json`     — cardNumber + cardExpiry MMYY
- `06a_hamkorbank_prepare_payment.resp.json`    — hamkorbankHoldId
- `06b_payme_do_payment.req.json`               — Payme flow body
- `06b_payme_do_payment.resp.json`              — paymeId + dataAmount
- `07_universal_orders_cancel.req.json`         — cancel body
- `DESIGN.md`                                   — auto-buy Phase C design

## Key gotchas

- `depDate` in create-order body is **DD.MM.YYYY** (Russian/Uzbek format).
  The trains/list endpoint uses ISO `YYYY-MM-DD`. Don't mix them.
- `carType` is **Cyrillic** ("Сидячий", "Купе", "Плацкарта", "Люкс"). Read it
  back from the train detail response — do not invent it.
- `classService` (e.g. "2Е") and `requirements.seatsRange` (e.g. "8-8") come
  from the seat-detail response too.
- `gender` is `"Male"` / `"Female"` (English) in the order body, but the
  cached friend record uses `sex: "M"` / `"F"`. Map accordingly.
- `totalCost` is in tiyins (1 sum = 100 tiyins). 311 000 sum → 31100000.
- Response for `universal-orders/create` is a **bare JSON string**, not an
  object. Parse accordingly.
- HamkorbankHold is the only NATIONAL_CURRENCY type in the captured response.
  Click / Payme / Kapitalbank may or may not be available per account/region.
- `withLoyaltyProgram: null` means "no loyalty discount applied" — set to an
  object to use loyalty points.

## TODO (not captured)

- Card-tokenize + confirm flow for HamkorbankHold (requires entering a real card)
- 3D-Secure SMS-OTP step
- Alternative payment types (OctoBankFC / StripeIntegration response shape)
- `/api/v1/inventory/available-insurance` body / response (insurance addon)
- `/api/v1/orders/check-user-for-discount` (loyalty discount precheck)
