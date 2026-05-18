# Design Docs — Ticket Detector Bot

Ko'p foydalanuvchili Telegram bot + Mini App (railway.uz chiptasini kuzatuvchi) loyihasi uchun texnik dizayn hujjatlari.

---

## Qaerdan boshlash

📖 [00-overview.md](00-overview.md) — birinchi navbatda shuni o'qing. Loyihaning umumiy vizyoni, foydalanuvchi turlari, terminologiya, hujjat ro'yxati.

---

## Hujjat ro'yxati

| # | Fayl | Mavzu |
|---|------|-------|
| 00 | [overview.md](00-overview.md) | Mahsulot vizyoni, foydalanuvchi turlari, terminlar |
| 01 | [architecture.md](01-architecture.md) | Tizim arxitekturasi, komponentlar, sequence diagrams |
| 02 | [railway-api.md](02-railway-api.md) | eticket.railway.uz API kontrakti |
| 03 | [database-schema.md](03-database-schema.md) | Postgres jadvallar, indekslar, migratsiyalar |
| 04 | [backend-api.md](04-backend-api.md) | FastAPI REST endpointlari |
| 05 | [bot-spec.md](05-bot-spec.md) | aiogram bot konfiguratsiyasi va buyruqlari |
| 06 | [mini-app-spec.md](06-mini-app-spec.md) | React Mini App screenflow va komponentlar |
| 07 | [payments.md](07-payments.md) | Telegram Stars to'lov tizimi |
| 08 | [worker-notifier.md](08-worker-notifier.md) | Watcher cycle, dedup, notification yetkazib berish |
| 09 | [deployment.md](09-deployment.md) | Docker Compose, VPS deploy, backup |
| 10 | [observability.md](10-observability.md) | Loglar, metriklar, alertlar |
| 11 | [roadmap.md](11-roadmap.md) | Milestone'lar va implementatsiya rejasi |

---

## O'qish tartiblari (rolga qarab)

### 👨‍💻 Yangi backend developer
1. [00-overview.md](00-overview.md)
2. [01-architecture.md](01-architecture.md)
3. [03-database-schema.md](03-database-schema.md)
4. [04-backend-api.md](04-backend-api.md)
5. [02-railway-api.md](02-railway-api.md) va [08-worker-notifier.md](08-worker-notifier.md)
6. [11-roadmap.md](11-roadmap.md) — qaysi milestone ustida ishlash

### 🎨 Frontend developer (Mini App)
1. [00-overview.md](00-overview.md)
2. [06-mini-app-spec.md](06-mini-app-spec.md)
3. [04-backend-api.md](04-backend-api.md) — qaysi endpointlarni chaqirish

### 🤖 Bot developer
1. [00-overview.md](00-overview.md)
2. [05-bot-spec.md](05-bot-spec.md)
3. [07-payments.md](07-payments.md)
4. [04-backend-api.md](04-backend-api.md) — internal endpoints

### 🚀 DevOps / SRE
1. [01-architecture.md](01-architecture.md)
2. [09-deployment.md](09-deployment.md)
3. [10-observability.md](10-observability.md)

### 💼 Product / business
1. [00-overview.md](00-overview.md)
2. [07-payments.md](07-payments.md) — tarif va to'lov
3. [11-roadmap.md](11-roadmap.md) — taymlayn

---

## Status va versiya

Joriy: **Draft v1** (2026-05-18). Implementatsiya hali boshlanmagan.

**Yangilanish tartibi:**
- Texnik o'zgarish bo'lganda tegishli .md fayl yangilanadi
- Har bir fayl yuqorida `Status` va `Oxirgi tahrir` ko'rsatadi
- Asosiy o'zgarishlar shu README dagi changelog'da (kelajakda) qayd qilinadi

---

## Bog'liq fayllar (loyiha ichida)

- [../README.md](../README.md) — loyihaning umumiy README (eski, yangilanishi kerak)
- [../src/](../src/) — eski single-user kod (M0 da `legacy/` ga ko'chiriladi)
- [../config.json](../config.json) — eski konfiguratsiya (mavjud kod uchun)
