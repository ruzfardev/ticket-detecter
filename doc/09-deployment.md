# 09 — Deployment

> **Status:** Draft v1 · **Oxirgi tahrir:** 2026-05-18
> **Hosting:** Shaxsiy VPS (Linux), Docker Compose

Production deployment va devops jarayoni. MVP uchun bitta VPS yetarli; scale qilinganda komponentlar bo'lib chiqariladi.

---

## 1. Infrastructure overview

```
                      ┌──────────────────────────────┐
                      │       VPS (Ubuntu 22.04)     │
                      │       4 vCPU / 8 GB RAM      │
                      └──────────┬───────────────────┘
                                 │
              ┌──────────────────┴────────────────────┐
              │                                       │
       :80 / :443                              docker-compose
              │                                       │
              ▼                                       ▼
        ┌─────────┐                  ┌────────────────────────────────┐
        │  Caddy  │                  │  Containers:                   │
        │  TLS    │  ─────────────►  │  • postgres:15                 │
        │  proxy  │                  │  • backend (FastAPI uvicorn)   │
        └─────────┘                  │  • bot (aiogram webhook)       │
                                     │  • worker (asyncio loop)       │
                                     │  • mini-app (nginx static)     │
                                     │  • backup (cron, optional)     │
                                     └────────────────────────────────┘
```

---

## 2. Repository tuzilmasi

```
ticket-detecter/
├── backend/
│   ├── Dockerfile
│   ├── pyproject.toml
│   └── app/
├── bot/
│   ├── Dockerfile
│   └── ...
├── mini-app/
│   ├── Dockerfile           # multi-stage: build + nginx
│   ├── package.json
│   └── src/
├── infra/
│   ├── docker-compose.yml
│   ├── docker-compose.prod.yml
│   ├── caddy/
│   │   └── Caddyfile
│   ├── backup/
│   │   └── backup.sh
│   └── migrations/          # Alembic
├── doc/                     # ushbu hujjatlar
├── .env.example
└── README.md
```

---

## 3. Docker images

### 3.1 Backend Dockerfile (`backend/Dockerfile`)

```dockerfile
FROM python:3.11-slim AS base
ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1

WORKDIR /app
COPY pyproject.toml poetry.lock ./
RUN pip install poetry && poetry config virtualenvs.create false \
    && poetry install --no-dev --no-root

COPY app ./app
COPY alembic.ini ./

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 3.2 Bot Dockerfile (`bot/Dockerfile`)

Webhook rejimida bot alohida container'da emas — `backend/` ichidagi `webhooks/telegram` orqali aiogram dispatcher chaqiriladi. Lekin dev/polling rejimi uchun:

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY . .
RUN pip install -r requirements.txt
CMD ["python", "main.py"]
```

> **MVP da:** Bot kodi `backend/` ichida bitta service sifatida ishlaydi. Alohida service kerak emas. Bu hujjat `bot/` papkasini logical separation deb tasvirlaydi, lekin runtime'da bitta backend container.

### 3.3 Worker Dockerfile (`backend/Dockerfile` bilan bir xil image, boshqa CMD)

```yaml
# docker-compose.yml ichida:
worker:
  image: ticketbot-backend:latest
  command: ["python", "-m", "app.worker.main"]
```

### 3.4 Mini App Dockerfile (`mini-app/Dockerfile`)

Multi-stage build:

```dockerfile
# Stage 1: build
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: nginx
FROM nginx:1.25-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
```

`nginx.conf`:
```nginx
server {
  listen 80;
  root /usr/share/nginx/html;
  index index.html;
  location / {
    try_files $uri $uri/ /index.html;
  }
  add_header Cache-Control "public, max-age=31536000, immutable";
  location = /index.html { add_header Cache-Control "no-cache"; }
}
```

---

## 4. Docker Compose (production)

`infra/docker-compose.prod.yml`:

```yaml
version: "3.9"

services:
  postgres:
    image: postgres:15-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks: [internal]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB"]
      interval: 10s

  backend:
    build: ../backend
    image: ticketbot-backend:latest
    restart: unless-stopped
    environment:
      DATABASE_URL: postgresql+asyncpg://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      BOT_TOKEN: ${BOT_TOKEN}
      WEBHOOK_SECRET: ${WEBHOOK_SECRET}
      INTERNAL_JWT_SECRET: ${INTERNAL_JWT_SECRET}
      RAILWAY_CRED_KEY: ${RAILWAY_CRED_KEY}
      MODE: prod
      LOG_LEVEL: INFO
    depends_on:
      postgres:
        condition: service_healthy
    networks: [internal, web]
    healthcheck:
      test: ["CMD", "curl", "-fs", "http://localhost:8000/health"]
      interval: 30s

  worker:
    image: ticketbot-backend:latest
    command: ["python", "-m", "app.worker.main"]
    restart: unless-stopped
    environment:
      DATABASE_URL: postgresql+asyncpg://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      BOT_TOKEN: ${BOT_TOKEN}
      RAILWAY_CRED_KEY: ${RAILWAY_CRED_KEY}
      LOG_LEVEL: INFO
    depends_on:
      postgres:
        condition: service_healthy
    networks: [internal]

  mini-app:
    build: ../mini-app
    image: ticketbot-mini-app:latest
    restart: unless-stopped
    networks: [web]

  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./caddy/Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
      - caddy_config:/config
    networks: [web]
    depends_on: [backend, mini-app]

networks:
  internal:
  web:

volumes:
  postgres_data:
  caddy_data:
  caddy_config:
```

---

## 5. Caddy konfiguratsiyasi

`infra/caddy/Caddyfile`:

```
api.tdbot.example {
    encode gzip
    reverse_proxy backend:8000

    @health path /health
    handle @health { reverse_proxy backend:8000 }

    log {
        output file /var/log/caddy/api.log
        format json
    }
}

app.tdbot.example {
    encode gzip
    reverse_proxy mini-app:80

    header {
        # Telegram WebApp uchun zarur
        X-Frame-Options "ALLOW-FROM https://web.telegram.org"
        Content-Security-Policy "frame-ancestors 'self' https://*.telegram.org;"
    }
}
```

Caddy avtomatik TLS sertifikat oladi (Let's Encrypt).

---

## 6. Environment variables (`.env`)

```bash
# Postgres
POSTGRES_DB=ticketbot
POSTGRES_USER=ticketbot
POSTGRES_PASSWORD=<random-strong>

# Telegram
BOT_TOKEN=1234567890:AAExxx...
WEBHOOK_SECRET=<random-32>
WEBHOOK_URL=https://api.tdbot.example/webhooks/telegram

# Internal auth (bot ↔ backend)
INTERNAL_JWT_SECRET=<random-strong>

# Encryption
RAILWAY_CRED_KEY=<Fernet base64 key>  # python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

# Railway.uz hisobi (initial seed)
RAILWAY_USERNAME=<email>
RAILWAY_PASSWORD=<password>

# Misc
LOG_LEVEL=INFO
MODE=prod
SENTRY_DSN=  # optional
```

> **Xavfsizlik:** `.env` git da bo'lmasligi kerak. Production'da `chmod 600 .env` va `chown root:root`.

---

## 7. Birinchi deployment qadamlari

```bash
# 1. VPS ga ulanish
ssh root@vps.example

# 2. Docker o'rnatish
curl -fsSL https://get.docker.com | sh
apt install docker-compose-plugin

# 3. Repo clone
git clone https://github.com/your-username/ticket-detecter.git
cd ticket-detecter

# 4. .env sozlash
cp .env.example .env
nano .env  # to'ldiring

# 5. DNS ko'rsatkichlari
# A record: api.tdbot.example  → VPS IP
# A record: app.tdbot.example  → VPS IP

# 6. Image build + DB schema
cd infra
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d postgres

# 7. Migration
docker compose -f docker-compose.prod.yml run --rm backend \
  alembic upgrade head

# 8. Railway.uz credentials seed
docker compose -f docker-compose.prod.yml run --rm backend \
  python -m app.scripts.seed_credentials \
    --username "$RAILWAY_USERNAME" \
    --password "$RAILWAY_PASSWORD"

# 9. Stations seed
docker compose -f docker-compose.prod.yml run --rm backend \
  python -m app.scripts.seed_stations

# 10. Hammasini ko'tarish
docker compose -f docker-compose.prod.yml up -d

# 11. Webhook setup
curl -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  -d "url=https://api.tdbot.example/webhooks/telegram" \
  -d "secret_token=${WEBHOOK_SECRET}" \
  -d "allowed_updates=[\"message\",\"callback_query\",\"pre_checkout_query\"]"

# 12. Bot Father'da Mini App URL'ni belgilash:
# https://t.me/BotFather → /mybots → @TicketDetectorBot
# → Bot Settings → Mini App → URL: https://app.tdbot.example/

# 13. Sanity check
curl https://api.tdbot.example/health
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f backend
```

---

## 8. Yangilanish (deploy v2)

```bash
cd ticket-detecter
git pull
cd infra

# Image qayta build
docker compose -f docker-compose.prod.yml build backend mini-app

# Migration (downtime'siz)
docker compose -f docker-compose.prod.yml run --rm backend alembic upgrade head

# Backend + worker'ni qayta start (rolling)
docker compose -f docker-compose.prod.yml up -d --no-deps backend worker mini-app

# Loglar
docker compose -f docker-compose.prod.yml logs -f --tail=100
```

> **Rollback:** `git checkout <previous-tag> && docker compose ... build && up -d`. Migration downgrade ehtiyot bilan.

---

## 9. Backup

`infra/backup/backup.sh` (cron har 03:30):

```bash
#!/usr/bin/env bash
set -euo pipefail
TS=$(date +%Y%m%d_%H%M%S)
DEST=/backups/ticketbot

mkdir -p "$DEST"
docker compose -f /root/ticket-detecter/infra/docker-compose.prod.yml \
  exec -T postgres pg_dump -U ticketbot ticketbot \
  | gzip > "$DEST/dump_${TS}.sql.gz"

# Retention: 14 kun
find "$DEST" -name "dump_*.sql.gz" -mtime +14 -delete

# Off-site rsync (optional)
rsync -az "$DEST/" backup-server:/srv/backup/ticketbot/
```

Cron:
```cron
30 3 * * * /root/ticket-detecter/infra/backup/backup.sh >> /var/log/ticketbot-backup.log 2>&1
```

**Restore:**
```bash
gunzip < dump_20260518_033000.sql.gz | \
  docker compose -f infra/docker-compose.prod.yml exec -T postgres \
    psql -U ticketbot -d ticketbot
```

---

## 10. Resource sizing

| Komponent | CPU | RAM | Disk |
|-----------|-----|-----|------|
| Postgres | 1 vCPU | 1 GB | 20 GB (1000 user x 1 yil) |
| Backend | 1 vCPU | 512 MB | — |
| Worker | 0.5 vCPU | 256 MB | — |
| Mini App (nginx) | 0.1 vCPU | 64 MB | — |
| Caddy | 0.1 vCPU | 64 MB | — |
| **Jami minimum** | **3 vCPU** | **2 GB** | **30 GB** |

**Tavsiya VPS:** 4 vCPU / 8 GB / 80 GB SSD — $20-30/oy (Hetzner, DigitalOcean).

---

## 11. Xavfsizlik checklist

- [ ] `.env` faylga `chmod 600`
- [ ] SSH'ga password login o'chirilgan (faqat key)
- [ ] `ufw` firewall: faqat 22, 80, 443 ochiq
- [ ] Postgres tashqi tarmoqdan yopiq (faqat docker network)
- [ ] Caddy TLS avto-sertifikat
- [ ] `WEBHOOK_SECRET` random 32 belgi
- [ ] `INTERNAL_JWT_SECRET` random
- [ ] `RAILWAY_CRED_KEY` random Fernet kalit, `.env` da
- [ ] Postgres `pg_hba.conf` faqat md5+local
- [ ] Bot token git'da hech qachon emas
- [ ] Caddy access log JSON, audit uchun
- [ ] Backup encrypted off-site (kelajakda)
- [ ] Sentry yoki similar error tracking (kelajakda)

---

## 12. Local dev environment

`infra/docker-compose.yml` (dev):

```yaml
version: "3.9"
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: ticketbot
      POSTGRES_USER: ticketbot
      POSTGRES_PASSWORD: dev
    ports: ["5432:5432"]
    volumes: [postgres_dev_data:/var/lib/postgresql/data]

volumes:
  postgres_dev_data:
```

Dev workflow:
```bash
docker compose up -d
cd backend && poetry shell && uvicorn app.main:app --reload
cd bot && poetry shell && python main.py  # polling
cd mini-app && npm run dev  # http://localhost:5173
```

Webhook'siz polling rejimida bot Telegram'dan to'g'ridan-to'g'ri update'larni oladi.

---

## 13. CI/CD (kelajak)

MVP da manual deploy yetarli. Keyinroq GitHub Actions:

```yaml
# .github/workflows/deploy.yml
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.VPS_HOST }}
          username: root
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            cd /root/ticket-detecter
            git pull
            cd infra
            docker compose -f docker-compose.prod.yml build
            docker compose -f docker-compose.prod.yml run --rm backend alembic upgrade head
            docker compose -f docker-compose.prod.yml up -d --no-deps backend worker mini-app
```

---

## 14. Bog'liq hujjatlar

- Tizim ko'rinishi: [01-architecture.md](01-architecture.md)
- Env var'lar mazmuni: tegishli komponent hujjatlarida (backend, bot, payments)
- Backup va observability: [10-observability.md](10-observability.md)
