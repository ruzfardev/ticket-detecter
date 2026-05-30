# Auto-Buy design (Phase C — confirmed)

## Decision: hybrid auto-card + user-OTP

The user wants **auto-buy to auto-fill the saved card** and require the user
only to enter the SMS-OTP within the order's hold window
(`endLifeTime ≈ now + 10 min`). This is faster than pure interactive (no
clicking "Pay" in the mini-app) but still keeps an out-of-band 2FA step,
which mitigates the worst stored-card abuse cases.

The mini-app must clearly **warn the user** that their card details are
stored encrypted and will be auto-submitted to eticket.railway.uz when a
matching seat is found.

## Watcher → auto-buy flow

```
watcher finds free seat matching an autobuy_enabled subscription
  ↓
1. RailwayUserClient.create_order(...)
     POST /api/v2/universal-orders/create
     ← orderId (bare JSON string, e.g. "UX77Z6KT67ETKL")
  ↓
2. paymentId = "PaymentId-" + uuid4()
   RailwayUserClient.list_payment_types(paymentId)
     POST /api/v3/payment-type/list  {paymentId}
     ← [{cardType,showType,paymentTypes:[...]}, ...]
  ↓
3. Pick a NATIONAL_CURRENCY type. Order is route/train-dependent:
   - Afrosiyob (Сидячий 2Е) → ["HamkorbankHold"]
   - Tezyurar (Плацкартный 3П) → ["Payme"]
   - …others (not captured)
   Strategy: take the first item of the NATIONAL_CURRENCY group.
  ↓
4. RailwayUserClient.select_payment_type(orderId, paymentId, type)
     POST /api/v1/payment/select-payment-type
     {id: orderId, paymentId, type, withLoyaltyProgram: null}
     ← {data: {paymentId}}
  ↓
5. RailwayUserClient.do_payment(type, orderId)
     For type="HamkorbankHold":
       POST /api/v1/hamkorbank-hold/do-payment {orderId}
       ← {id, orderId, totalCost, ticketTotalCost, ...}
     For type="Payme":
       POST /api/v1/payme/do-payment {orderId}
       ← {paymeId, orderId, dataAmount, percent}
     For others: TBD.
  ↓
6. RailwayUserClient.submit_card(type, payment_id_or_payme_id, card_decrypted)
     For HamkorbankHold:
       POST /api/v1/hamkorbank-hold/prepare-payment
       {id, cardNumber, cardExpiry: "MMYY"}
       ← {data: {hamkorbankHoldId}, error: null}
     For Payme:
       endpoint TBD — captured the do-payment shape but not the
       card-submission step (would need the user to enter card+OTP again
       in a Payme order to confirm).
     SMS-OTP is dispatched to the user's phone (the cardholder's).
  ↓
7. Mark autobuy_orders.status = 'awaiting_otp'
   Send Telegram WebApp link to mini-app `/order/:id/otp`
   Mini-app polls /order/:id every 3-5s and displays countdown.
  ↓
8. User enters OTP in mini-app
   → backend forwards to OTP-confirm endpoint (TBD, requires real
     transaction to capture)
   → 200 on success → status='paid', send ticket PDF link
   → error → status='otp_failed', allow retry within hold window
  ↓
9. Cron job: if hold_until < now() and status in ('awaiting_otp','paying')
   → call /universal-orders/cancel/{orderId} to free the seat
   → notify user
```

## Storage (new tables for Phase C, not in Phase A migration)

### `user_railway_cards`

```sql
CREATE TABLE user_railway_cards (
    id            BIGSERIAL PRIMARY KEY,
    user_id       BIGINT UNIQUE NOT NULL
                  REFERENCES users(id) ON DELETE CASCADE,
    card_pan_enc  TEXT NOT NULL,       -- Fernet, RAILWAY_CRED_KEY
    card_exp_enc  TEXT NOT NULL,       -- Fernet "MMYY"
    last4         CHAR(4) NOT NULL,    -- plaintext for UI display
    holder_name   TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at  TIMESTAMPTZ
);
```

Card data is only decrypted in-memory during one auto-buy attempt; never
logged. The DB record is wiped when the user unlinks their railway
account (cascading from `users`).

### `autobuy_orders`

```sql
CREATE TABLE autobuy_orders (
    id                    BIGSERIAL PRIMARY KEY,
    subscription_id       BIGINT NOT NULL
                          REFERENCES subscriptions(id) ON DELETE CASCADE,
    user_id               BIGINT NOT NULL
                          REFERENCES users(id) ON DELETE CASCADE,
    railway_friend_cache_id BIGINT
                          REFERENCES railway_friends_cache(id) ON DELETE SET NULL,
    railway_order_id      TEXT,                -- "UX77Z6K..."
    payment_type          TEXT,                -- "HamkorbankHold" | "Payme" | ...
    payment_subid         TEXT,                -- hamkorbankHoldId / paymeId
    train_number          TEXT NOT NULL,
    car_number            TEXT NOT NULL,
    seat_number           INT NOT NULL,
    dep_code              TEXT NOT NULL,
    arr_code              TEXT NOT NULL,
    travel_date           DATE NOT NULL,
    amount_uzs            INT,                 -- in soums, not tiyins
    status                TEXT NOT NULL DEFAULT 'reserving'
                          CHECK (status IN ('reserving','awaiting_otp',
                                            'paying','paid','failed',
                                            'expired','cancelled')),
    failure_reason        TEXT,
    hold_until            TIMESTAMPTZ,
    raw_create_resp       JSONB,
    raw_payment_resp      JSONB,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (subscription_id, train_number, car_number, seat_number)
        DEFERRABLE INITIALLY DEFERRED  -- only enforce on commit
);

CREATE INDEX idx_autobuy_orders_active
    ON autobuy_orders (status) WHERE status IN ('reserving','awaiting_otp','paying');
CREATE INDEX idx_autobuy_orders_expirer
    ON autobuy_orders (hold_until) WHERE status IN ('awaiting_otp','paying');
```

## Open spike items (Phase D / future)

These were NOT captured because they require completing real transactions:

1. **HamkorbankHold OTP-confirm endpoint** — likely
   `POST /api/v1/hamkorbank-hold/confirm-payment {hamkorbankHoldId, otp}`
   or similar. Need a real card + OTP run to confirm.
2. **Payme card-submit + OTP endpoints** — captured `do-payment` only.
   Probably `POST /api/v1/payme/create-card` and
   `POST /api/v1/payme/verify-card` based on JS bundle string list.
3. **Final "order paid" status fetch** — `/universal-orders/get/{id}`
   should reflect a paid state after success. Need to observe.
4. **Insurance addon** — `/api/v1/inventory/available-insurance` returned
   `{available:true,price:10000,liability:100000000}`. We may want to
   default off (mini-app radio).
5. **Loyalty / discount** — `withLoyaltyProgram` field on select-payment-type
   is `null` for our case. If user has loyalty points, the value is an
   object.

## Mini-app screens to add (Phase C)

- `/cards/add` — one-time card entry (PAN + expiry). Stores encrypted.
  Big warning: "These details will be auto-submitted to eticket.railway.uz
  when a matching ticket is found. Only the SMS code stays with you."
- `/order/:id` — countdown + status + retry. Three states:
  - `reserving`/`paying`: spinner + countdown
  - `awaiting_otp`: 5-digit input + "Send" + "Resend SMS" + countdown
  - `paid`/`failed`/`expired`: terminal state with appropriate copy
- Home banner — when an `autobuy_orders` row is `awaiting_otp`, big red
  banner: "Buyurtma 7:42 — OTP kiriting" linking to `/order/:id`.

## Telegram bot UX

When an order enters `awaiting_otp`, send:

```
🎫 Chipta topildi va bron qilindi!
📍 Toshkent → Samarqand · 06.06.2026
🚂 054Ф · Vagon 11 · Joy 22
💳 To'lov uchun SMS kodi kelishi kerak

[💳 OTP kiriting (8:00)]   ← WebApp button to /order/:id
```

Countdown in button label is approximate; the mini-app shows the precise
remaining time.
