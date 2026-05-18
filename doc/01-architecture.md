# 01 — Tizim Arxitekturasi

> **Status:** Draft v1 · **Oxirgi tahrir:** 2026-05-18

Ushbu hujjat tizimning yuqori darajadagi tuzilishini, komponentlar orasidagi aloqalarni va asosiy oqimlarni (sequence diagrams) tasvirlaydi.

---

## 1. Asosiy komponentlar

```
┌────────────────────────────────────────────────────────────────────┐
│                       TELEGRAM CLIENT                              │
│  ┌────────────────────────┐    ┌────────────────────────────────┐  │
│  │ Bot UI (xabar/tugma)   │    │ Mini App (WebView, React)      │  │
│  └────────────┬───────────┘    └─────────────────┬──────────────┘  │
└───────────────┼─────────────────────────────────-┼──────────────────┘
                │ Bot API                          │ HTTPS + initData
                ▼                                  ▼
┌──────────────────────┐               ┌────────────────────────────┐
│  aiogram Bot         │◄──────HTTP────│   FastAPI Backend          │
│  (bot/)              │   internal    │   (backend/)               │
│  • /start /help      │     JWT       │   • /api/v1/* (Mini App)   │
│  • /premium          │               │   • /internal/v1/* (bot)   │
│  • Stars handlers    │               │   • /webhooks/telegram     │
│  • Mini App button   │               └────────┬───────────────────┘
└──────────────────────┘                        │ asyncpg
                                                ▼
                                     ┌────────────────────────┐
                                     │   POSTGRES 15          │
                                     │   • users              │
                                     │   • subscriptions      │
                                     │   • payments           │
                                     │   • notification_log   │
                                     │   • watch_groups       │
                                     │   • stations           │
                                     │   • railway_credentials│
                                     └────────┬───────────────┘
                                              │
                                              │ READ active subs
                                              ▼
                                     ┌────────────────────────┐
                                     │   Watcher Worker       │
                                     │   (backend/worker/)    │
                                     │   • Cycle every 60s    │
                                     │   • Dedup queries      │
                                     │   • Rate limit         │
                                     └────────┬───────────────┘
                                              │
                                              │ HTTPS
                                              ▼
                                     ┌────────────────────────┐
                                     │  eticket.railway.uz    │
                                     │  • /api/v1/csrf-token  │
                                     │  • /api/v1/auth/login  │
                                     │  • /api/v3/.../list    │
                                     │  • /api/v1/.../trains  │
                                     └────────────────────────┘

                              ┌──────────────┐
                              │  Notifier    │  (worker ichida)
                              │  HTTP → Bot  │  match topilganda
                              │  API         │  bot.sendMessage
                              └──────────────┘
```

---

## 2. Komponentlar tavsifi

### 2.1 FastAPI Backend (`backend/`)

**Vazifasi:** yagona business logic manbai. Hamma CRUD va validatsiya shu yerda.

- Mini App requestlarini Telegram `initData` HMAC validatsiyasi orqali tekshiradi.
- Bot bilan ichki JWT (statik secret) orqali aloqa qiladi.
- DB ga `asyncpg` orqali yoziladi (sync ORM emas — async stack).
- Railway.uz proxy endpointi (`/api/v1/trains/search`) — Mini App'ga to'g'ridan-to'g'ri so'rov yubormaslik uchun.

**Asosiy modullar:**
```
backend/
├── app/
│   ├── main.py           # FastAPI app entry
│   ├── api/v1/           # public routes
│   ├── internal/v1/      # bot ↔ backend routes
│   ├── webhooks/         # /webhooks/telegram
│   ├── db/               # asyncpg pool, migrations
│   ├── railway/          # railway.uz client (port from src/auth.py + src/checker.py)
│   ├── auth/             # initData verify, internal JWT
│   ├── services/         # business logic (subscription, payment, notification)
│   └── core/             # config, logging, errors
```

### 2.2 aiogram Bot (`bot/`)

**Vazifasi:** Telegram bilan to'g'ridan-to'g'ri aloqa.

- Webhook rejimida (production) yoki polling (dev) ishlaydi.
- Business logic emas — barcha qarorlar backend API ga delegatsiya qilinadi.
- FSM faqat Stars to'lovi uchun ishlatiladi (notification yaratish — Mini App da).

**Asosiy modullar:**
```
bot/
├── main.py
├── handlers/
│   ├── start.py          # /start, salomlashish, Mini App tugmasi
│   ├── help.py
│   ├── premium.py        # /premium, Stars invoice
│   ├── my.py             # /my — foydalanuvchining notificationlari
│   └── payments.py       # pre_checkout_query, successful_payment
├── keyboards/
└── client.py             # backend API client
```

### 2.3 Watcher Worker (`backend/worker/`)

**Vazifasi:** railway.uz ni davriy tekshirish.

- Asosiy backend dan **alohida process** sifatida ishlaydi (asyncio loop).
- DB dan aktiv `watch_groups` ni o'qiydi.
- Har bir group uchun railway.uz ga so'rov yuboradi (dedup qilingan).
- Match topilganda `notification_log` ga yozadi va Notifier orqali xabar yuboradi.
- Faqat birinchi versiyada bitta worker; keyinroq advisory lock bilan horizontal scale.

**Asosiy modullar:**
```
backend/worker/
├── main.py               # entry, cycle loop
├── cycle.py              # poll → match → notify
├── matcher.py            # filter matching logic (train#, car_types, berth)
├── notifier.py           # bot API sender
└── ratelimit.py          # token bucket, backoff
```

### 2.4 Postgres DB

**Vazifasi:** durable state.

- Eski `data/seen_trains.json` va `data/events.jsonl` o'rnini bosadi.
- JSONB ustunlar (`seats_snapshot`, `payments.raw`) joriy versiyaga moslashuvchanlik beradi.
- Schema [03-database-schema.md](03-database-schema.md) da batafsil.

### 2.5 Mini App (`mini-app/`)

**Vazifasi:** notification konfiguratsiyasi UI.

- React + Vite + TypeScript.
- Telegram WebApp SDK orqali initData va theme oladi.
- Backend `/api/v1/*` ga AJAX so'rovlar yuboradi.
- Build artifact CDN yoki nginx static folder dan beriladi.

**Asosiy modullar:**
```
mini-app/
├── src/
│   ├── App.tsx
│   ├── screens/
│   │   ├── Welcome.tsx
│   │   ├── RoutePicker.tsx
│   │   ├── DatePicker.tsx
│   │   ├── TrainPicker.tsx
│   │   ├── CarTypePicker.tsx
│   │   ├── BerthPicker.tsx
│   │   ├── Confirm.tsx
│   │   └── MyNotifications.tsx
│   ├── api/                 # backend client
│   ├── hooks/useTelegram.ts # WebApp SDK wrapper
│   └── store/               # Zustand yoki React Query
```

---

## 3. Asosiy oqimlar (Sequence diagrams)

### 3.1 Yangi foydalanuvchi ro'yxatdan o'tishi

```
User      Bot         Backend      DB
 │  /start │            │            │
 │────────►│            │            │
 │         │ POST /internal/v1/users/upsert
 │         │───────────►│            │
 │         │            │ INSERT users (tier='free')
 │         │            │───────────►│
 │         │            │◄───────────│
 │         │◄───────────│            │
 │ Salomlashish + Mini App tugma     │
 │◄────────│            │            │
```

### 3.2 Notification yaratish (Mini App)

```
User  Mini App     Backend          railway.uz       DB
 │   Mini App ochish (initData header bilan)
 │◄──│              │                  │             │
 │   │ POST /api/v1/auth/tg            │             │
 │   │─────────────►│                  │             │
 │   │              │ verify HMAC      │             │
 │   │              │ UPSERT user      │             │
 │   │              │─────────────────────────────►│
 │   │◄─────────────│  {tier, slot_used, slot_max}  │
 │   │              │                  │             │
 │   Station, sana tanlash (autocomplete)
 │   │ GET /api/v1/stations?q=tosh     │             │
 │   │─────────────►│ SELECT stations              │
 │   │◄─────────────│                  │             │
 │   │ POST /api/v1/trains/search      │             │
 │   │─────────────►│                  │             │
 │   │              │ POST /api/v3/.../list (cache 30s)
 │   │              │─────────────────►│             │
 │   │              │◄─────────────────│             │
 │   │◄─────────────│ [trains]         │             │
 │   │              │                  │             │
 │   Poyezd + vagon turi + berth tanlash
 │   │ POST /api/v1/subscriptions      │             │
 │   │─────────────►│                  │             │
 │   │              │ CHECK slot_used < slot_max     │
 │   │              │ INSERT subscriptions           │
 │   │              │─────────────────────────────►│
 │   │◄─────────────│ {id, ...}        │             │
 │   "✅ Yaratildi"  │                  │             │
```

### 3.3 Watcher cycle (har 60s)

```
Worker    DB            railway.uz       Bot API
  │ SELECT watch_groups WHERE active   │
  │────►│              │                │
  │◄────│ [groups]     │                │
  │     │              │                │
  │ for each group (jitter delay):     │
  │     POST /api/v3/.../list (auth)   │
  │────────────────────►│              │
  │◄────────────────────│              │
  │ for each train with potential match:
  │     POST /api/v1/handbook/trains  │
  │────────────────────►│              │
  │◄────────────────────│              │
  │     │              │                │
  │ SELECT subs WHERE group=X          │
  │────►│              │                │
  │◄────│              │                │
  │ for each sub: match filter         │
  │ if match:                          │
  │     SELECT notification_log dedup  │
  │     ────►│                         │
  │     if new snapshot:               │
  │         INSERT notification_log    │
  │         ────►│                     │
  │         POST sendMessage           │
  │         ─────────────────────────►│
  │         ◄─────────────────────────│
  │ sleep until next cycle             │
```

### 3.4 Premium sotib olish (Telegram Stars)

```
User      Bot         Backend         TG Stars
 │ /premium │           │               │
 │─────────►│           │               │
 │          │ GET /api/v1/payments/invoice?plan=premium_30d
 │          │──────────►│               │
 │          │◄──────────│ {invoice_link}│
 │ "Premium 300⭐" tugmasi              │
 │◄─────────│           │               │
 │ Tap tugma │           │               │
 │ Stars to'lov UI                      │
 │◄──────────TG Stars dialog            │
 │ Confirm   │          │                │
 │           │ pre_checkout_query       │
 │           │◄─────────────────────────│
 │           │ POST /internal/v1/payments/precheck
 │           │──────────►│               │
 │           │◄──────────│ {ok: true}    │
 │           │ answerPreCheckoutQuery(ok=true)
 │           │──────────────────────────►│
 │           │ successful_payment       │
 │           │◄─────────────────────────│
 │           │ POST /internal/v1/payments/successful
 │           │──────────►│               │
 │           │           │ UPDATE users SET tier='premium',
 │           │           │   premium_until=now()+30d
 │           │           │ INSERT payments
 │           │◄──────────│               │
 │ "✅ Premium aktivlashtirildi"        │
 │◄─────────│            │               │
```

---

## 4. Deploy topologiyasi

**Production (bitta VPS):**

```
                    ┌──────────────────────┐
                    │  Caddy / Nginx       │
                    │  TLS, reverse proxy  │
                    └────┬─────────────┬───┘
                         │             │
              :443 /webhooks/telegram  │ :443 / (static)
                         ▼             ▼
              ┌──────────────────┐  ┌────────────────┐
              │  Backend (8000)  │  │ Mini App build │
              │  uvicorn         │  │ (static files) │
              └──────┬───────────┘  └────────────────┘
                     │
              ┌──────┴────────┬───────────────┐
              ▼               ▼               ▼
        Postgres        Bot (polling     Worker (asyncio)
        :5432           or webhook
                        forwarded by
                        backend)
```

Hamma container Docker Compose orqali boshqariladi. Tafsilot [09-deployment.md](09-deployment.md) da.

---

## 5. Aloqa protokollari

| Yo'l | Protokol | Auth | Format |
|------|----------|------|--------|
| Telegram → Bot | Telegram Bot API (HTTPS) | bot token | JSON |
| Mini App → Backend | HTTPS | `X-Tg-Init-Data` header | JSON |
| Bot → Backend | HTTPS (internal) | Internal JWT | JSON |
| Backend → DB | TCP (asyncpg) | Postgres auth | binary |
| Worker → DB | TCP (asyncpg) | Postgres auth | binary |
| Worker → railway.uz | HTTPS | shared JWT + CSRF | JSON |
| Worker → Bot API | HTTPS | bot token | JSON |

---

## 6. Asosiy dizayn xususiyatlari

- **Stateless backend** — barcha holat DB da. Backend container restart bo'lsa, hech narsa yo'qolmaydi.
- **Idempotent watcher** — har bir cycle mustaqil; backoff/retry xavfsiz.
- **Notification dedup** — bir xil snapshot uchun ikki marta xabar yuborilmaydi.
- **Shared railway.uz hisobi** — foydalanuvchilar railway.uz ga kirmaydi; bizning bitta hisobimiz orqali so'rov yuboriladi.
- **Multi-language ready** — DB da `lang` ustuni, hamma user-facing matn `i18n` lug'atdan.

---

## 7. Bog'liq hujjatlar

- DB tafsiloti: [03-database-schema.md](03-database-schema.md)
- API endpointlar: [04-backend-api.md](04-backend-api.md)
- Watcher logikasi: [08-worker-notifier.md](08-worker-notifier.md)
- Deploy: [09-deployment.md](09-deployment.md)
