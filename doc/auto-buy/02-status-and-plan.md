# Auto-buy — implementation status, morning test, and next-wave plan

_Last updated 2026-08-19 (overnight session)._

## TL;DR
The eticket **card-payment flow was already implemented correctly** in the backend
(`app/railway/user_client.py` + `app/services/autobuy_service.py`) — the old "payment is
bound to the browser" conclusion was wrong. A **live capture** of a real purchase
(2026-08-18) confirmed every request/response matches our client exactly. The only real
defect was a runtime bug (missing `payment_subid` on the order DTO) which is now fixed.
Backend + mini-app are **deployed to production** and the (previously dead) public tunnel
is restored. **One step remains for full sign-off: a real end-to-end run with a live bank
OTP**, which needs you present (real card + the SMS on your phone).

## What shipped tonight (branch `feat/auto-buy`, merged to `main`, deployed)
- **Backend** `b1bfd4f`: add `payment_subid` to `AutobuyOrderDTO`, `_SELECT_ORDER`,
  `_row_to_order`. Without it, `POST /orders/:id/otp` and `/resend-otp` would 500.
  → live on the server (`ticketbot-backend` + `ticketbot-worker` restarted, `/health` ok).
- **Mini-app** `d7dee5e`: un-hide auto-buy — restore the config row in `SubDetails`, the
  card + Buyurtmalar group in `Settings`, trim `AutobuyConfig` payment methods to the two
  supported (Humo/Uzcard→HamkorbankHold, Payme). Fix `tsconfig` `ignoreDeprecations`
  `6.0`→`5.0` (was breaking every build on this branch). → deployed to
  `ticket-detector-mini.vercel.app`.
- **Prod connectivity fix (was fully broken):** the cloudflared quick tunnel had died
  (DNS NXDOMAIN), so the mini-app couldn't reach the backend at all. Restarted it, wired
  the new URL into Vercel `VITE_API_URL`, redeployed, synced `.tunnel-url`. Verified:
  tunnel `/health`=200, CORS ok for the vercel origin, prod bundle baked with the URL.
  ⚠️ **This tunnel is a Cloudflare _quick_ tunnel — ephemeral.** If it dies again the app
  breaks; recovery steps are in the `prod-tunnel-connectivity` memory. **Recommend a
  stable backend URL** (named cloudflare tunnel on a subdomain, or an nginx vhost).
- **Docs:** `doc/auto-buy/01-eticket-payment-flow.md` (the captured API),
  `doc/research/uzticket-teardown.md` (+ artifact).

## The verified payment flow (see `01-eticket-payment-flow.md` for full bodies)
`create (v2) → payment-type/list {PaymentId-uuid} → select-payment-type →
hamkorbank-hold/do-payment {orderId}→holdId → hamkorbank-hold/prepare-payment
{holdId, card, MMYY} [BANK SENDS OTP] → hamkorbank-hold/pay-receipt {holdId, code}`.
Headers: `device-type: BROWSER`, `Authorization: Bearer <user eticket JWT>`, `X-XSRF-TOKEN`.
Our worker reserves the seat and drives steps up to `prepare-payment` using the user's
**saved card**, then parks the order at `awaiting_otp` and pings the user; the user enters
the SMS code in the mini-app → we call `pay-receipt` → `paid`.

## ⚠️ The one unverified detail
The final **OTP-confirm** call was NOT executed live (we stopped before spending money).
The client uses `POST /api/v1/hamkorbank-hold/pay-receipt {id, code}` (matches eticket's
intercepted-URL list); resend uses `resend-code {id}`. eticket's Angular service method
`payReceiptHamkorHold` *may* instead post to `.../confirm-payment` — **capture the real
call on the first live run and adjust `HAMKORBANK_HOLD_PAY_URL` if needed.**

## Morning test procedure (≈10 min, with you present)
1. Open the bot → mini-app. Confirm it loads data (proves the tunnel/API is alive). If it
   doesn't load, the tunnel likely died overnight — recover per the memory note.
2. **Settings → Kartalarim →** save a Humo/Uzcard card (you enter it; it's encrypted
   server-side, we never see it).
3. **Settings → eticket** — confirm it shows linked/active (it is:
   farrukhruzmetov2002@gmail.com).
4. Create or open a subscription on a route/date/train that currently has a free seat →
   **Avto sotib olish → enable**, pick a passenger + the card → Saqlash.
5. Trigger a buy: the **worker** fires on the next tick when it detects a matching free
   seat (watch the bot for the "OTP kiriting" message), or we trigger `POST /orders/manual`
   with a known seat. Order goes to `awaiting_otp`; Home shows the OTP banner.
6. Enter the **SMS OTP** from your phone in the mini-app. Watch the server log
   (`journalctl -u ticketbot-backend -f`) for the `pay-receipt` request + response.
   - Success → `paid`, ticket in your eticket cabinet. 🎉 Feature confirmed.
   - If `pay-receipt` errors on the endpoint/field, switch to `confirm-payment` /
     adjust the code field (`code`→`otp`) and retry — a 5-minute fix.

## Next wave (the "full UI refresh" — deferred for your review, NOT done tonight)
Deferred deliberately: these need DB migrations and/or replace working screens, so they
shouldn't ship unattended on live prod. Each is scoped and ready to build on your go-ahead.
Prioritized (see `doc/research/uzticket-teardown.md` + the artifact for the designs):
1. **Manual "Hozir sotib ol"** on a train/seat — makes testing one-tap and gives users a
   buy-now. Backend `/orders/manual` exists; needs a seat-picker UI + seat-list from
   trains/search.
2. **Multi-card + default** — migration (drop `UNIQUE(user_id)`, add `id`/`is_default`),
   rewrite `card_service` + `cards.py` + the order↔card join, `card_id` on auto-buy.
3. **Multi-passenger + fallback strategy** (`all_or_nothing` / `partial`) + lap children +
   group orders — the biggest item; adds columns + a group-order concept + a hub screen.
4. **Passenger CRUD** (own table, not just eticket `friends` sync) with PINFL/default.
5. **Home hub + onboarding checklist** (add `onboarding` to `GET /me`) + **4-tab bar**
   (surface Buyurtmalar/Orders as a tab).
6. **Alert options**: car-type priority order, "no side seats", Afrosiyob class, train
   priority — columns `avoid_lateral_seats`, `preferred_classes` + form UI.
7. Later: eticket-tickets proxy in Orders, pensioner discount verification, referral,
   public `/stats`.

Keep our coral/cream + lucide brand (a quality edge over the competitor's Telegram-themed
emoji UI).
