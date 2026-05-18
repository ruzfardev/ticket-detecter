# 10 — Observability (Loglar, Metriklar, Alertlar)

> **Status:** Draft v1 · **Oxirgi tahrir:** 2026-05-18

Tizim 24/7 ishlashi kerak. Bu hujjat qanday loglar yoziladi, qanday metriklar to'planadi, va qachon admin xabardor qilinadi.

---

## 1. Tamoyillar

- **Logs:** debug uchun (`nima bo'ldi?`)
- **Metrics:** trend uchun (`qancha?`)
- **Traces:** kelajak (faqat OpenTelemetry kerak bo'lganda)
- **Alerts:** harakat talab qiluvchi muammolar (`nima qilish kerak?`)

MVP: structured JSON logs + Prometheus metrics + Telegram admin alert. Sentry optional.

---

## 2. Logging

### 2.1 Format

Hamma loglar **structured JSON** (Python `structlog`):

```json
{
  "ts": "2026-05-18T11:23:45.123Z",
  "level": "info",
  "logger": "worker.cycle",
  "msg": "ticket_found",
  "sub_id": 17,
  "user_id": 42,
  "train": "076Ж",
  "seats": 3,
  "snapshot_hash": "abc12345"
}
```

### 2.2 Log levels

| Level | Foydalanish |
|-------|-------------|
| DEBUG | Verbose, dev'da, prod'da o'chirilgan |
| INFO | Normal flow events (login, sub yaratildi, notif yuborildi) |
| WARN | Anomaliya, lekin recovered (429, retry) |
| ERROR | Xato; user-facing degraded |
| CRITICAL | Service ishlamaydi (DB down, auth fail rolling) |

### 2.3 Strukturalashgan loglar

`backend/app/core/logging.py`:

```python
import structlog
import logging

structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso", utc=True),
        structlog.processors.dict_tracebacks,
        structlog.processors.JSONRenderer(),
    ],
    wrapper_class=structlog.make_filtering_bound_logger(
        logging.getLevelName(settings.LOG_LEVEL),
    ),
)

logger = structlog.get_logger()
```

Ishlatish:
```python
logger.info("subscription_created", sub_id=sub.id, user_id=user.id, route=f"{dep}-{arr}")
logger.warning("railway_429", group_id=g.id, cooldown_until=cooldown)
logger.error("auth_failed", reason=str(e))
```

### 2.4 Trace context

Har bir HTTP so'rovga `request_id` (UUID) qo'shiladi:

```python
@app.middleware("http")
async def add_request_id(request, call_next):
    rid = request.headers.get("X-Request-ID") or str(uuid.uuid4())
    with structlog.contextvars.bound_contextvars(request_id=rid):
        response = await call_next(request)
        response.headers["X-Request-ID"] = rid
        return response
```

### 2.5 Log destinations

| Komponent | Destination | Retention |
|-----------|-------------|-----------|
| Backend | stdout → Docker → JSON file rotation | 30 kun |
| Worker | stdout → Docker | 30 kun |
| Caddy access log | `/var/log/caddy/api.log` | 14 kun |
| Postgres | `/var/log/postgres.log` | 14 kun |

Docker default JSON logger:
```yaml
# docker-compose
backend:
  logging:
    driver: "json-file"
    options:
      max-size: "10m"
      max-file: "5"
```

> **Kelajak:** Loki + Grafana yoki ELK stack centralized log aggregation uchun.

### 2.6 Asosiy log eventlar (taxonomy)

Komponent-bo'yicha kutilgan eventlar:

**Backend (API):**
- `api.request` — har so'rov (path, status, duration_ms)
- `api.auth.success` / `api.auth.fail`
- `subscription.created` / `subscription.updated` / `subscription.deleted`
- `payment.invoice_created`
- `payment.precheck_ok` / `payment.precheck_fail`
- `payment.success`

**Bot:**
- `bot.command` (cmd, user_id)
- `bot.callback` (data, user_id)
- `bot.payment_received`
- `bot.message_sent`

**Worker:**
- `worker.cycle_start` / `worker.cycle_end` (duration_ms, groups_checked)
- `worker.group_polled` (group_id, trains_count)
- `worker.train_matched` (sub_id, train, seats)
- `worker.notification_sent` / `worker.notification_dedup_skip`
- `worker.railway_429` / `worker.railway_5xx`
- `worker.auth_relogin`

**Railway client:**
- `railway.list_trains` (duration_ms, status)
- `railway.train_detail` (duration_ms, status)
- `railway.login` (status)

---

## 3. Metriklar (Prometheus)

### 3.1 Metric endpoint

`GET /metrics` (Backend) — `prometheus_client` orqali avtomatik.

### 3.2 Asosiy metriklar

**Counter:**

```python
sub_created_total      = Counter("td_subscriptions_created_total", "...")
sub_deleted_total      = Counter("td_subscriptions_deleted_total", "...")
notif_sent_total       = Counter("td_notifications_sent_total", "...", ["lang"])
notif_dedup_total      = Counter("td_notifications_dedup_total", "...")
payment_success_total  = Counter("td_payments_success_total", "...", ["plan"])
railway_429_total      = Counter("td_railway_429_total", "...")
railway_5xx_total      = Counter("td_railway_5xx_total", "...")
auth_relogin_total     = Counter("td_railway_relogin_total", "...")
```

**Gauge:**

```python
active_subs_gauge      = Gauge("td_subscriptions_active", "...", ["tier"])
premium_users_gauge    = Gauge("td_users_premium", "...")
watch_groups_gauge     = Gauge("td_watch_groups_active", "...")
worker_lag_seconds     = Gauge("td_worker_lag_seconds", "Seconds since last cycle")
```

**Histogram:**

```python
api_latency_seconds    = Histogram("td_api_latency_seconds", "...", ["endpoint"])
railway_latency_secs   = Histogram("td_railway_latency_seconds", "...", ["endpoint"])
worker_cycle_duration  = Histogram("td_worker_cycle_seconds", "...")
notif_delay_seconds    = Histogram("td_notif_delay_seconds", "Time from match to send")
```

### 3.3 Prometheus scrape (optional, agar Grafana ulansa)

`prometheus.yml`:
```yaml
scrape_configs:
  - job_name: 'ticketbot'
    scrape_interval: 30s
    static_configs:
      - targets: ['backend:8000']
```

### 3.4 Asosiy dashboard panellari (Grafana)

1. **Health overview**
   - Active subscriptions (line, by tier)
   - Premium users (gauge)
   - Worker lag (gauge — alert if > 120s)
   - Last cycle timestamp

2. **API performance**
   - Request rate (p99/p95 latency)
   - Error rate (4xx/5xx breakdown)
   - Auth failures

3. **Worker activity**
   - Cycles/minute
   - Cycle duration histogram
   - Watch groups count
   - Notifications sent/hour (by lang)
   - Dedup ratio

4. **Railway.uz health**
   - Latency p99 (list vs detail)
   - 429 rate
   - 5xx rate
   - Re-login count

5. **Business**
   - Daily new users
   - Payment conversion (invoice → success)
   - Premium retention (active premium / total ever premium)

---

## 4. Healthchecks

### 4.1 Liveness

`GET /health`:
```json
{"status": "ok", "version": "1.0.0", "db": "ok", "uptime_s": 12345}
```

Faqat process tirikligini ko'rsatadi. DB ping qiladi (1s timeout).

### 4.2 Readiness

`GET /ready`:
- DB connection pool: ok
- Railway credentials: token mavjud va eski emas
- Worker last cycle: < 120s

```json
{
  "ready": true,
  "checks": {
    "db": "ok",
    "railway_auth": "ok",
    "worker_lag_s": 23
  }
}
```

### 4.3 Docker healthcheck

Yuqorida `09-deployment.md` da ko'rsatilgan. Container `unhealthy` bo'lsa, Docker daemon restart qilmaydi (faqat `restart: unless-stopped` ishlaydi muammosi yo'q paytda) — alert orqali bilamiz.

---

## 5. Alerting

### 5.1 Alert qoidalari

| Holat | Asbob | Harakat |
|-------|-------|---------|
| Worker lag > 5 min | Cron check | Telegram admin xabari |
| API 5xx rate > 1% so'nggi 5 min | Prometheus | Telegram admin |
| Railway 429 rolling 10 dan ko'p | Prometheus | Telegram + cooldown |
| Auth re-login > 5 / soat | Prometheus | Telegram admin (hisob bloklangan?) |
| Postgres disk > 80% | Node exporter / cron | Telegram + email |
| Backup oxirgi 25 soat ichida yo'q | Cron check | Telegram admin |
| Sub'siz user > 100 (botda qolgan) | Daily report | Marketing signal |
| Mini App build fail | CI | GitHub status check |

### 5.2 Telegram admin chat

`.env` da `ADMIN_CHAT_ID` — bot shu chatga alert yuboradi:

```python
# backend/app/core/alerts.py
async def admin_alert(text: str, level: str = "warning"):
    prefix = {"info": "ℹ️", "warning": "⚠️", "critical": "🚨"}[level]
    await bot.send_message(
        settings.ADMIN_CHAT_ID,
        f"{prefix} <b>{level.upper()}</b>\n{text}",
        parse_mode="HTML",
    )
```

Asosiy alert eventlari:

```python
await admin_alert(
    f"Worker lag: {lag}s ({reason})", level="warning"
)

await admin_alert(
    f"Railway re-login failed: {error}\nBot is degraded.", level="critical"
)
```

### 5.3 Throttling

Bir xil alert turini har 30 daqiqada 1 marta yuborish:

```python
_last_alert: dict[str, float] = {}
def should_alert(key: str, cooldown: int = 1800) -> bool:
    now = time.time()
    if now - _last_alert.get(key, 0) > cooldown:
        _last_alert[key] = now
        return True
    return False
```

---

## 6. Error tracking (optional)

Sentry integratsiyasi:

```python
import sentry_sdk
sentry_sdk.init(
    dsn=settings.SENTRY_DSN,
    traces_sample_rate=0.1,
    environment=settings.MODE,
    release=settings.VERSION,
)
```

Sentry'da:
- Issue grouping by stacktrace
- Slack/Telegram integration
- Performance traces

> **MVP:** Sentry shart emas. Loglar yetarli. Production scale qilingach yoqiladi.

---

## 7. Audit log (DB)

`event_log` jadvali (03-database-schema.md) — DB ichida saqlanadigan audit yozuvlari. Foydalanuvchi destruktiv amallari uchun (delete, refund, ban) qo'shimcha qatlam.

Misol query — admin uchun:
```sql
-- Oxirgi 24 soat ichida muammoli userlar
SELECT user_id, type, payload, created_at
FROM event_log
WHERE type IN ('payment_precheck_fail', 'auth_failed')
  AND created_at > now() - INTERVAL '24 hours'
ORDER BY created_at DESC;
```

---

## 8. Support workflow

Foydalanuvchi `/support` orqali muammo bildirsa, admin DB orqali debug qiladi:

```sql
-- Foydalanuvchi profili
SELECT * FROM users WHERE tg_user_id = $1;

-- Aktiv sub'lari
SELECT * FROM subscriptions WHERE user_id = $1 AND is_active;

-- Oxirgi notification logi
SELECT * FROM notification_log WHERE user_id = $1 ORDER BY sent_at DESC LIMIT 10;

-- Audit
SELECT * FROM event_log WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20;
```

Helper script `backend/app/scripts/debug_user.py`:
```bash
docker compose exec backend python -m app.scripts.debug_user --tg-id 970956519
```

Bu skript yuqoridagi to'rt query'ni bajaradi va tartiblangan output beradi.

---

## 9. SLO va SLA (informational)

MVP da rasmiy SLA yo'q (free service), lekin maqsadlar:

| Metric | Target |
|--------|--------|
| API availability | 99% (oylik) |
| Notification latency (match→send) | 95% < 30s |
| Mini App load time | p95 < 2s |
| Bot response time (`/start` va h.k.) | p95 < 1s |
| Worker cycle frequency | 1 cycle / 60s ± 30s |

Yiliga 1-2 marta planli downtime (deploy, migration) — admin chat'ga oldindan e'lon.

---

## 10. Bog'liq hujjatlar

- DB event_log: [03-database-schema.md](03-database-schema.md#38-event_log)
- Worker metriklar: [08-worker-notifier.md](08-worker-notifier.md)
- Deploy va healthcheck: [09-deployment.md](09-deployment.md)
