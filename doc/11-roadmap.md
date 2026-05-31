# 11 — Implementatsiya Roadmap

> **Status:** Draft v1 · **Oxirgi tahrir:** 2026-05-18

Loyihani bosqichma-bosqich bajarish rejasi. Har bir milestone tugagandan keyin testlash va ko'rib chiqish. Birinchi 6 milestone — MVP; M7+ — post-MVP yaxshilashlar.

---

## Tezkor xulosa

| Milestone | Mazmun | Taxminiy davomiylik |
|-----------|--------|---------------------|
| **M0** | Eski kodni tozalash, repo struktura | 0.5 kun |
| **M1** | Backend skeleton + DB schema | 1.5 kun |
| **M2** | Bot (reply keyboard) + auth + user upsert | 1 kun |
| **M3** | Mini App MVP (shadcn/ui) | 3-4 kun |
| **M4** | Watcher (per-tier 10s/30s) + Notifier | 2 kun |
| **M5** | Stars: Premium (5 plan) + Donate | 1.5 kun |
| **M6** | Polish + soft launch | 1 kun |
| **M7+** | Post-MVP (kelajak) | iterativ |

> Davomiylik solo developer uchun (har kuni 6-8 soat). Jami: ~11-12 ish kuni.

---

## M0 — Eski kodni tozalash

**Maqsad:** `dev-tg` branch'ni yangi struktura uchun tayyorlash.

### Vazifalar
- [ ] `dev-tg` branch'da `src/` papkasi tarkibini ko'rib chiqish, salvage qilinadigan kodni belgilash
- [ ] Salvage list (yangi `backend/` ga ko'chiriladi keyinroq):
  - [ ] [src/auth.py](../src/auth.py) — login flow, JWT, CSRF
  - [ ] [src/checker.py](../src/checker.py) — 2 endpoint chaqirish + `CAR_TYPE_MAP`
  - [ ] [src/notifier.py](../src/notifier.py) `_split_berths()` va `_BERTH_TYPES`
  - [ ] [src/bot.py](../src/bot.py) `STATIONS` dict (DB seed) va `VALID_CAR_TYPES`
- [ ] `src/` ni `legacy/` ga ko'chirish (yoki butunlay o'chirish; salvage faylar `doc/` da reference qilingan)
- [ ] Repo papka strukturasi yaratish: `backend/`, `bot/`, `mini-app/`, `infra/`
- [ ] `.gitignore` yangilash (`data/`, `.venv/`, `node_modules/`, `dist/`)
- [ ] `README.md` (yangi yoshatdan) — yuqori darajadagi overview + `doc/` ga yo'naltirish
- [ ] Commit: "refactor: prep for multi-user rewrite, archive legacy single-user code"

**Definition of done:** repo da yangi papkalar bor, eski `src/` o'chirilgan (yoki `legacy/` ga ko'chirilgan), CI ishlamayotgan.

---

## M1 — Backend skeleton + DB schema

**Maqsad:** FastAPI app ishlaydi, DB migratsiya o'tadi, healthcheck yashil.

### Vazifalar
- [ ] `backend/pyproject.toml` (Poetry yoki uv) — fastapi, asyncpg, structlog, prometheus-client, httpx, alembic, pyjwt, cryptography
- [ ] `backend/app/main.py` — FastAPI app, `/health` endpoint
- [ ] `backend/app/core/config.py` — Pydantic Settings env var loader
- [ ] `backend/app/core/logging.py` — structlog setup
- [ ] `backend/app/db/` — asyncpg pool, dependency injection
- [ ] Alembic init + migrations:
  - [ ] `0001_initial` — users, stations, subscriptions
  - [ ] `0002_payments`
  - [ ] `0003_notification_log`
  - [ ] `0004_railway_credentials`
  - [ ] `0005_event_log`
  - [ ] `0006_watch_groups_view`
  - [ ] `0007_stations_seed` — data migration
- [ ] `backend/app/scripts/seed_credentials.py` — railway.uz hisobini DB ga shifrlangan saqlash
- [ ] `Dockerfile` + `infra/docker-compose.yml` (dev variant, faqat postgres)
- [ ] Smoke test: `curl localhost:8000/health` → `{"status":"ok","db":"ok"}`

**Definition of done:** `docker compose up -d postgres && uvicorn app.main:app --reload` ishlaydi, healthcheck yashil, migratsiyalar muvaffaqiyatli.

---

## M2 — Bot + auth + user upsert

**Maqsad:** Bot ishlaydi, user `/start` bossa DB da yaratiladi, Mini App tugmasi ko'rinadi.

### Vazifalar
- [ ] `backend/` ichida aiogram qo'shish (alohida `bot/` container shart emas MVP da)
- [ ] `backend/app/bot/` papka:
  - [ ] `main.py` — Dispatcher, polling/webhook tanlovi
  - [ ] `handlers/start.py` — `/start`, salomlashish, Mini App tugmasi
  - [ ] `handlers/help.py`, `handlers/menu.py`, `handlers/language.py`
  - [ ] `handlers/my.py` — sub'lar ro'yxati
  - [ ] `i18n/` — uz/ru/en toml fayllar
- [ ] `backend/app/api/v1/auth.py` — `POST /api/v1/auth/tg` (initData verify + upsert)
- [ ] `backend/app/auth/init_data.py` — HMAC verifier
- [ ] `backend/app/services/user_service.py` — `upsert_from_tg(tg_user)`
- [ ] `POST /internal/v1/users/upsert` — bot'dan chaqiriladigan
- [ ] Test: bot polling rejimida ishga tushadi, `/start` → DB da user yaratiladi
- [ ] Test: Mini App URL ochilganda (Postman'dan har xil initData bilan) — `users.tg_user_id` yangilanadi

**Definition of done:** Real Telegram bot orqali `/start` bosish — DB da yangi user paydo bo'ladi. Bir xil tg_user_id qayta `/start` bosishida `created_at` o'zgarmasligi.

---

## M3 — Mini App MVP (TelegramUI)

**Maqsad:** Foydalanuvchi Mini App orqali oxirgacha notification yaratishi. UI **@telegram-apps/telegram-ui** orqali iOS/Android Telegram nativeligidek ko'rinadi.

### Vazifalar
- [ ] `mini-app/` — Vite + React + TS scaffold
- [ ] **TelegramUI o'rnatish:**
  ```bash
  npm install @telegram-apps/telegram-ui @telegram-apps/sdk-react
  ```
- [ ] Boshqa deps: react-router, zustand, @tanstack/react-query, react-hook-form, zod, axios, react-day-picker (date picker), date-fns, react-i18next, lucide-react, sonner, clsx
- [ ] `src/main.tsx` — `AppRoot` bilan o'rab olish: `<AppRoot appearance={colorScheme} platform={platform}>`
- [ ] `src/hooks/useTelegram.ts` — WebApp SDK wrapper (initData, platform, colorScheme, MainButton, BackButton, haptic, openInvoice)
- [ ] `src/api/client.ts` — axios + `X-Tg-Init-Data` header
- [ ] Backend endpointlar (har screen uchun):
  - [ ] `GET /api/v1/me` (slot stats bilan)
  - [ ] `GET /api/v1/stations?q=`
  - [ ] `POST /api/v1/trains/search`
  - [ ] `GET|POST|PATCH|DELETE /api/v1/subscriptions`
  - [ ] `GET /api/v1/payments/plans`
- [ ] Mini App screens (TelegramUI komponentlari bilan):
  - [ ] Welcome — `Placeholder` + `Spinner`
  - [ ] Home — `Section` + `Cell` + `Avatar` + `Badge` + `Banner` (Premium CTA)
  - [ ] Wizard:
    - route → `Section`/`Cell` + `Input` (search)
    - date → `react-day-picker` TG variables'ga styled
    - train → `Cell` list + `Skeleton` loading
    - car-type → `Cell` + `Checkbox`
    - berth → `Cell` + `Radio` (shartli)
    - confirm → `Section`/`Cell` + native MainButton
  - [ ] Sub details — `Section`/`Cell` + `Button` (Pauza/O'chirish)
  - [ ] Premium — `Section`/`Cell` + `Badge` (💎 30 kun)
  - [ ] Donate — `Cell` + `Modal` (custom amount)
  - [ ] Settings — `Cell` (til, support, terms)
- [ ] OpenAPI'dan TS tip generatsiya: `npm run gen:api`
- [ ] Build: `npm run build` → `dist/`
- [ ] Caddy + nginx static rejim test

**Definition of done:**
- Real Telegram'da Mini App ochiladi, iOS'da iOS look, Android'da Material
- Dark/light theme Telegram settings'dan avto kelishi
- Wizard'ni oxirigacha o'tadi → `subscriptions` jadvalida yangi yozuv
- Berth picker faqat плацкарта/купе tanlanganda ko'rinadi
- MainButton/BackButton native Telegram tugmalari sifatida ishlaydi

---

## M4 — Watcher + Notifier

**Maqsad:** Yaratilgan sub'lar avtomatik tekshiriladi va bo'sh joy paydo bo'lganda xabar yetadi.

### Vazifalar
- [ ] `backend/app/railway/client.py` — async port [src/auth.py](../src/auth.py) + [src/checker.py](../src/checker.py)
- [ ] DB-backed auth state (`railway_credentials` jadval bilan ishlash)
- [ ] `backend/app/railway/ratelimit.py` — token bucket
- [ ] `backend/app/worker/main.py` — asyncio loop, 60s cycle
- [ ] `backend/app/worker/cycle.py`:
  - [ ] Watch groups olish
  - [ ] trains/list (cache 10s)
  - [ ] Relevant train filtering
  - [ ] Detail fetch (jitter)
- [ ] `backend/app/worker/matcher.py` — filter matching (train#, car_types, berth)
- [ ] `backend/app/worker/notifier.py`:
  - [ ] Snapshot hash
  - [ ] Dedup query
  - [ ] HTML format ([src/notifier.py](../src/notifier.py) `_split_berths` port qilinadi)
  - [ ] Bot API sendMessage
  - [ ] Insert notification_log
- [ ] Mute callback handler: `mute_sub:{id}:{sec}`
- [ ] Delete callback handler: `del_sub:{id}`
- [ ] Docker compose'ga `worker` service qo'shish
- [ ] Cron: kunlik 03:00 cleanup (past dates, eski notif_log)

**Definition of done:** Real sub yaratish + railway.uz da haqiqatan bo'sh joy bo'lgan poyezd uchun — 60-90s ichida Telegram'ga rich notification keladi. 5 daqiqa kutilganda dedup ishlaydi (qayta xabar yo'q).

---

## M5 — Stars to'lov: Premium + Donate

**Maqsad:** Foydalanuvchi 5 ta Premium tariflardan birini yoki Donate'ni sotib olishi.

### Vazifalar
- [ ] `backend/app/services/plans.py` — `PLANS` (5 ta premium) + `DONATE_OPTIONS` (4 ta + custom)
- [ ] `backend/app/api/v1/payments.py`:
  - [ ] `GET /api/v1/payments/plans` (frontend hardcode'siz)
  - [ ] `GET /api/v1/payments/invoice?plan=` (premium yoki donate, donate_custom uchun `amount` qabul qiladi)
  - [ ] `GET /api/v1/payments/history`
- [ ] `backend/app/api/internal/payments.py`:
  - [ ] `POST /internal/v1/payments/precheck` (premium + donate ikkalasini ham tekshiradi)
  - [ ] `POST /internal/v1/payments/successful` (premium → tier yangilanadi, donate → faqat payments yoziladi)
- [ ] Bot handlerlar:
  - [ ] `/premium` command + "⭐ Premium" reply tugma → 5 ta inline tugma
  - [ ] `/donate` command + "❤️ Donate" reply tugma → 4 ta + "Boshqa miqdor" (Mini App ochadi)
  - [ ] `pre_checkout_query` → backend precheck → answer
  - [ ] `successful_payment` → backend success → tabrik xabari
- [ ] Mini App `/premium` screen — 5 ta plan tugmasi, 30 kun planda 💎 badge
- [ ] Mini App `/donate` screen — 4 ta variant + Drawer bilan custom amount slider
- [ ] DB transaction with `tg_payment_charge_id` UNIQUE idempotency
- [ ] Premium expire kunlik cron (`tasks/expire_premium.py`) + tekshirish 30s→10s cadence yangilanishini
- [ ] `watch_groups` refresh trigger (yoki cron har 60s) — `has_premium` to'g'ri bo'lishi uchun
- [ ] Test: real Stars to'lov (1 kun 15⭐ — minimal)
- [ ] Test: Donate 25⭐ — tier o'zgarmasligi
- [ ] Test: Refund flow admin scripti

**Definition of done:**
- 5 ta premium tarifdan birortasi sotib olinishi mumkin
- 1 kun + 1 kun stack: granted_until = +2 kun
- Premium bo'lgan user'ning watch_group'i `has_premium=true`, cadence 10s ga o'tadi
- Donate ishlaydi, `payments.type='donate'`, tier o'zgarmaydi
- Mini App'da to'lov tarixida ikkala turini ko'rinadi

---

## M6 — Polish + soft launch

**Maqsad:** MVP'ni tashqi foydalanuvchilarga ko'rsatish mumkin.

### Vazifalar
- [ ] **Error handling polish:**
  - [ ] Backend: barcha endpointlarda RFC 7807 error format
  - [ ] Mini App: error states, retry tugmalar
  - [ ] Bot: friendly xato xabarlari
- [ ] **i18n to'liq:** uz, ru, en hamma matnlar tarjima qilingan
- [ ] **Observability:**
  - [ ] `/metrics` ishlaydi
  - [ ] Critical eventlar adminga Telegram alert
  - [ ] Worker lag healthcheck
- [ ] **Deploy:**
  - [ ] Caddy reverse proxy + TLS
  - [ ] `docker-compose.prod.yml` to'liq
  - [ ] Backup cron
  - [ ] Webhook setup
- [ ] **Documentation update:**
  - [ ] `doc/07-payments.md` da real narxlar
  - [ ] `README.md` da setup tutorial
- [ ] **Manual QA pass:**
  - [ ] Yangi user: /start → notification yaratish → notif keladi
  - [ ] Slot limit: 2-chi sub yaratishda "Premium" tugma
  - [ ] Premium sotib olish → 3 ta sub
  - [ ] Premium expire: 1 daqiqa keyinga `premium_until` qo'yib cron'ni manual ishga tushirish
  - [ ] Delete sub
  - [ ] Mute callback
  - [ ] /support, /help, /language
- [ ] **Beta testers:** 5-10 ishonchli odam, feedback yig'ish
- [ ] Bot Father'da bot tasvir/avatarni rasmiylashtirish

**Definition of done:** Bot @TicketDetectorBot'ga 10 ta odam yozadi, 5 tasi notification yaratadi, 2 tasi premium oladi, 1 ta real chipta paydo bo'lib notification keladi.

---

## M7+ — Post-MVP (kelajak yo'nalishlari)

Tartibsiz priority bo'yicha:

### UX yaxshilashlari
- [ ] Sub edit (faqat delete+create emas)
- [ ] Bulk sub yaratish (3 sana bir vaqtda)
- [ ] Statistika: "Sizning sub'lar 12 ta notif yubordi"
- [ ] Marshrut tarixi (oldin nimani qidirgan)
- [ ] "Tezroq sub" tugmasi (eng mashhur marshrutlar)

### Premium yaxshilashlari
- [ ] Subscription auto-renew (kelajakda Telegram Stars subscriptions kelganda)
- [ ] Premium-only feature: per-sub re-notification timeout
- [ ] Premium-only: SMS notification (Twilio bilan)
- [ ] Premium-only: "Tezroq tekshirish" (30s cycle)

### Texnik yaxshilashlar
- [ ] Redis cache (railway.uz response, rate-limiter)
- [ ] Horizontal worker (advisory lock per group)
- [ ] OpenTelemetry tracing
- [ ] Sentry error tracking
- [ ] Grafana dashboardlar to'plami
- [ ] CI/CD (GitHub Actions)
- [ ] Automated tests (pytest backend, vitest mini-app)

### Yangi xizmatlar
- [ ] Boshqa transport (avtobus, samolyot — yangi API source)
- [ ] Aksiya/discount kuzatuvchi
- [ ] Group sub'lar (oila a'zolarini bir vaqtda kuzatish)
- [ ] Public API (3rd party bot'lar uchun)

### Marketing
- [ ] Referral dasturi (bir uzaytirilgan premium = +X ⭐ bonus)
- [ ] O'zbek tilidagi landing sayt
- [ ] Telegram kanal: "@TicketTips" — chipta xaridlari maslahatlar

---

## Qaror nuqtalari (yo'lda)

Quyidagi savollarga kerakli paytda qaror qabul qilinadi:

1. ~~**Premium narxi**~~ ✅ **Tasdiqlandi**: 1d=15⭐, 3d=40⭐, 5d=65⭐, 10d=120⭐, 30d=300⭐
2. **Hosting** — M6 boshlanishi oldidan VPS provayder + region tanlanadi.
3. **Domen** — `tdbot.example` o'rniga real domen.
4. **Brending** — bot nomi, logosi.
5. **Foydalanuvchi shartnomasi va maxfiylik** — yurisdiktsiyaga moslab yozish.
6. **Donate custom range** — joriy 10-5000 ⭐. Yetarli yoki kengaytirish?

---

## Bog'liq hujjatlar

- Loyihaning umumiy vizyoni: [00-overview.md](00-overview.md)
- Eski kod salvage manbai: [src/](../src/) (M0 tugagach `legacy/` ga ko'chiriladi)
- Har bir milestone ichida detail: tegishli numbered .md fayl
