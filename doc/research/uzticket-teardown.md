# Competitor teardown — Railway Bot (app.uzticket.org)

**Captured:** 2026-08-19 (live session on the owner's account + beautified prod bundles).
**Interactive artifact (19 screens re-drawn in our theme + full API map):**
https://claude.ai/code/artifact/3b2a00db-1899-43e6-b327-1aec8b479213

## What it is
`Railway Bot` (bot `@railway_uzbot`, channel `@railway_tickets_uz`) — a Telegram mini-app,
**Vue 3 + Pinia + vue-router (history) + Tailwind + axios**. API base
`https://api.uzticket.org/api/v1/booking` (aviation `…/api/v1/aviation`, admin-only).
Auth header `Authorization: tma <Telegram initData>`. 22 routes, 28 endpoints, Uzbek-Latin
only, styled purely from Telegram `themeParams` (no brand palette), emoji icons.

## The headline finding
**Their auto-buy works** and it is the exact thing our "Tez kunda" placeholder promises.
Payment is **server-side via bank card + SMS OTP** (not a browser hand-off): user types
card number + expiry in the mini-app → their backend drives eticket's card-payment step →
bank OTP goes to the cardholder's phone → the code is relayed back. The owner's account
shows two `status: confirmed, trigger: auto` bookings paid this way (order `UX780ALE65Q3RW`,
245 140 so'm, Humo •• 7933). See `../auto-buy/01-eticket-payment-flow.md` for the exact
eticket endpoints we captured to replicate this.

## Booking lifecycle
`notification (is_active + auto_buy)` → worker spots seat → `draft` → `booking` (eticket
reserve) → `seat_held` (15 min, `is_payable`) → user pays → `payment_init` → `awaiting_sms`
→ `confirmed` (`paid_at`). Terminal: `failed | expired | cancelled` (seat released, alert
stays active). Multi-passenger buys are grouped (`GET /group/:id`) with a per-seat hub.
Fallback strategy: `all_or_nothing` ("Hammasi birdan") vs `partial` ("Necha bo'lsa
shuncha"). Children <5 = `lap_children` (free, no seat); 5–10 = −50%; age vs departure date.

## API surface (28 endpoints)
- **Session:** `GET /me` (user + `onboarding{has_eticket_account,eticket_valid,has_passenger,ready_for_auto_buy}`), `GET /stats` (`{premium_active, seats_found}`).
- **Notifications (alerts) + auto-buy:** `GET/POST /notifications`, `PATCH/DELETE /notifications/:id`, `POST/DELETE /notifications/:id/auto-buy`, `GET /notifications/:id/route-discounts`, `GET /stations?q=`, `POST /trains/search`.
- **Eticket account:** `GET/POST/DELETE /eticket-account`, `POST /eticket-account/verify`.
- **Passengers (own table, CRUD):** `GET/POST /passengers`, `PATCH/DELETE /passengers/:id`, `POST /passengers/:id/verify-privilege` (pensioner PINFL).
- **Cards (max 5):** `GET/POST /cards`, `DELETE /cards/:id`, `POST /cards/:id/default`.
- **Bookings:** `GET /bookings`, `GET /bookings/:id`, `POST /bookings/:id/{pay,sms,sms/resend,cancel}`, `GET /group/:id`, `GET /eticket/tickets?type=active|archive`.
- **Money:** `POST /premium/checkout {days,stars}`, `POST /donate/checkout {stars}`, `GET /referral`.

## Premium / growth
Plans 1/3/5/10/30 days = 20/50/80/150/350 ⭐ (ours are cheaper: 15/40/65/120/300 — keep as
a selling point). Referral: 3 friends = 1 day. Social proof `GET /stats`: 2 323 388 seats
found, 28 premium users.

## What to adopt (ranked) — full table in the artifact
1. **Server-side pay + bank SMS** (unblocks auto-buy) — see payment-flow doc.
2. Multi-passenger (1–4) + fallback strategy + lap children + group orders.
3. Home hub + onboarding checklist from `/me.onboarding`; 4-tab bar.
4. Passenger CRUD (own table, not just eticket sync) with PINFL/default.
5. Multiple cards + default + brand tile.
6. Alert options: car-type priority, "no side seats", Afrosiyob class, train priority.
7. Later: eticket-tickets proxy, pensioner verification, referral, `/stats`.
8. Skip: aviation (their admin-only beta).

Keep **our** brand (coral/cream, Inter, lucide) — it's a visible quality edge over their
Telegram-themed emoji UI.
