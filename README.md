# Ticket Detector — Multi-user Telegram Bot + Mini App

O'zbekiston temir yo'l (eticket.railway.uz) chiptalarini avtomatik kuzatib, bo'sh joy paydo bo'lganda Telegram orqali real-time xabar beruvchi servis.

**Status:** 🚧 Active development (multi-user rewrite). Eski single-user kod [legacy/](legacy/) ichida.

---

## Arxitektura (qisqacha)

```
[TG Client] ─┬─► Bot UI       ─► [FastAPI Backend] ─► [Postgres]
             └─► Mini App      ─► [FastAPI Backend] ─► [Postgres]
                                          │
                                  [Watcher Worker] ─► eticket.railway.uz
                                          │
                                  [Notifier] ─► [TG Bot API → user]
```

Tafsilot: [doc/01-architecture.md](doc/01-architecture.md)

---

## Loyiha tuzilmasi

```
ticket-detecter/
├── backend/         # FastAPI + aiogram bot + worker (Python 3.11+)
│   ├── app/
│   │   ├── api/         # public REST endpoints
│   │   ├── internal/    # bot ↔ backend
│   │   ├── bot/         # aiogram handlers
│   │   ├── worker/      # railway.uz watcher
│   │   ├── railway/     # railway.uz API client
│   │   ├── db/          # asyncpg pool
│   │   ├── core/        # config, logging
│   │   ├── services/    # business logic
│   │   ├── scripts/     # CLI utilities
│   │   └── tasks/       # cron jobs (expire premium, gc)
│   └── migrations/      # Alembic
│
├── mini-app/        # React + Vite + @telegram-apps/telegram-ui
│
├── infra/           # Docker Compose, Caddy, backup
│
├── doc/             # Design docs (12 ta MD fayl)
│
└── legacy/          # Eski single-user kod (reference uchun)
```

---

## Tezkor boshlash (dev)

```bash
# 1. Postgres ko'tarish
cd infra
docker compose up -d postgres

# 2. Backend
cd ../backend
python -m venv .venv
.venv\Scripts\Activate.ps1     # PowerShell
# yoki: source .venv/bin/activate  # Linux/Mac
pip install -e .

# 3. .env
cp ../.env.example ../.env
# .env ni to'ldiring

# 4. Migration
alembic upgrade head

# 5. Backend ishga tushirish
uvicorn app.main:app --reload --port 8000

# 6. Healthcheck
curl http://localhost:8000/health
```

Mini App va bot uchun batafsil instruksiyalar:
- [doc/09-deployment.md](doc/09-deployment.md) — to'liq deploy
- [doc/11-roadmap.md](doc/11-roadmap.md) — implementatsiya bosqichlari

---

## Hujjatlar

| # | Hujjat | Mavzu |
|---|--------|-------|
| 00 | [overview](doc/00-overview.md) | Mahsulot vizyoni, foydalanuvchi turlari |
| 01 | [architecture](doc/01-architecture.md) | Komponentlar va oqim diagramlari |
| 02 | [railway-api](doc/02-railway-api.md) | eticket.railway.uz API kontrakti |
| 03 | [database-schema](doc/03-database-schema.md) | Postgres jadvallar |
| 04 | [backend-api](doc/04-backend-api.md) | FastAPI REST endpointlari |
| 05 | [bot-spec](doc/05-bot-spec.md) | aiogram bot dizayni |
| 06 | [mini-app-spec](doc/06-mini-app-spec.md) | Telegram Mini App (TelegramUI) |
| 07 | [payments](doc/07-payments.md) | Telegram Stars to'lov tizimi |
| 08 | [worker-notifier](doc/08-worker-notifier.md) | Watcher cycle va notification |
| 09 | [deployment](doc/09-deployment.md) | Docker Compose, deploy |
| 10 | [observability](doc/10-observability.md) | Loglar, metriklar, alertlar |
| 11 | [roadmap](doc/11-roadmap.md) | Implementatsiya milestone'lari |

---

## Litsenziya

MIT — [LICENSE](LICENSE)
