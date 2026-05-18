# 03 — Database Schema (Postgres)

> **Status:** Draft v1 · **Oxirgi tahrir:** 2026-05-18
> **DBMS:** PostgreSQL 15+ · **Migratsiya:** Alembic

Ushbu hujjat barcha jadvallarni, indekslarni, va asosiy DB qarorlarini hujjatlaydi.

---

## 1. Umumiy qoidalar

- **Naming:** `snake_case`, jadvallar ko'plikda (`users`, `subscriptions`).
- **PK:** har bir jadvalda `id BIGSERIAL PRIMARY KEY` (yoki tabiy PK — masalan `stations.code`).
- **Timestamps:** `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`, kerak bo'lganda `updated_at`.
- **Time zone:** har doim `TIMESTAMPTZ` (UTC saqlanadi).
- **JSON:** ma'lumotsiz tuzilishlar uchun `JSONB`.
- **Soft delete yo'q** — `is_active BOOLEAN` ishlatamiz, audit log alohida.
- **Migration:** [Alembic](https://alembic.sqlalchemy.org/) (asyncpg bilan mos), versiya raqamlangan.

---

## 2. ER overview

```
users (1)─────(N) subscriptions (N)────(1) stations [dep_code]
                          │                      │
                          │                      └─(1) stations [arr_code]
                          │
                          └────(N) notification_log

users (1)─────(N) payments

watch_groups [view yoki materialized table from subscriptions]

railway_credentials [singleton]
event_log [audit, generic]
```

---

## 3. Jadvallar (batafsil)

### 3.1 `users`

Telegram foydalanuvchi profili.

```sql
CREATE TABLE users (
    id              BIGSERIAL PRIMARY KEY,
    tg_user_id      BIGINT NOT NULL UNIQUE,
    tg_username     TEXT,
    first_name      TEXT,
    last_name       TEXT,
    lang            TEXT NOT NULL DEFAULT 'uz' CHECK (lang IN ('uz', 'ru', 'en')),
    tier            TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'premium')),
    premium_until   TIMESTAMPTZ,
    is_banned       BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_premium_until ON users (premium_until)
    WHERE tier = 'premium';
```

**Qoidalar:**
- `tg_user_id` — Telegram User ID, immutable, unique.
- `premium_until` — `tier='premium'` bo'lganda majburiy; o'tgach kunlik cron `tier='free'` ga o'tkazadi.
- `is_banned` — kelajakda foydalanish qoidalarini buzgan userlar uchun.
- `last_seen_at` — har Mini App auth da yangilanadi (analytics).

---

### 3.2 `stations`

Stantsiya katalog. `bot.py`'dagi `STATIONS` dict dan seed.

```sql
CREATE TABLE stations (
    code        TEXT PRIMARY KEY,
    name_uz     TEXT NOT NULL,
    name_ru     TEXT NOT NULL,
    name_en     TEXT,
    city        TEXT,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_stations_active ON stations (is_active) WHERE is_active;
CREATE INDEX idx_stations_name_uz_trgm ON stations USING gin (name_uz gin_trgm_ops);
CREATE INDEX idx_stations_name_ru_trgm ON stations USING gin (name_ru gin_trgm_ops);
```

> `pg_trgm` extension yoqilishi kerak (`CREATE EXTENSION pg_trgm`) — autocomplete uchun fuzzy search.

**Seed misol:**
```sql
INSERT INTO stations (code, name_uz, name_ru) VALUES
  ('2900000', 'Toshkent',  'Ташкент'),
  ('2900680', 'Samarqand', 'Самарканд'),
  ('2900790', 'Urganch',   'Ургенч'),
  -- ... [02-railway-api.md] dagi ro'yxat
  ;
```

---

### 3.3 `subscriptions`

Foydalanuvchining notification qoidalari.

```sql
CREATE TABLE subscriptions (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    dep_code        TEXT NOT NULL REFERENCES stations(code),
    arr_code        TEXT NOT NULL REFERENCES stations(code),
    travel_date     DATE NOT NULL,
    train_number    TEXT,                  -- NULL = barcha poyezdlar
    car_types       TEXT[] NOT NULL DEFAULT '{}',   -- bo'sh = barcha turlar
    berth           TEXT NOT NULL DEFAULT 'any' CHECK (berth IN ('lower', 'upper', 'any')),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    paused_at       TIMESTAMPTZ,           -- user pause qilgan bo'lsa
    muted_until     TIMESTAMPTZ,           -- bot xabaridagi "🔇 10 daq jim" tugmasi
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CHECK (dep_code <> arr_code),
    CHECK (travel_date >= '2020-01-01')
);

CREATE INDEX idx_subs_user_active   ON subscriptions (user_id) WHERE is_active;
CREATE INDEX idx_subs_route_date    ON subscriptions (dep_code, arr_code, travel_date)
    WHERE is_active;
CREATE INDEX idx_subs_travel_date   ON subscriptions (travel_date) WHERE is_active;
```

**Qoidalar:**
- `train_number` — masalan `"076Ж"`. NULL bo'lishi mumkin, lekin asosiy use case'da Mini App user'ni majburlaydi tanlashga (MVP).
- `car_types` — TEXT[] (Postgres array). Misol: `{плацкарта, купе}`. Bo'sh array = "har qanday".
- `berth` — faqat плацкарта/купе uchun ma'noli; boshqa turlar bilan `any` saqlanadi.
- Slot enforcement **app layer da** (DB CHECK constraint tier'ga bog'liq — application transaction'da tekshiriladi).
- O'tgan sanalar nightly cron tomonidan `is_active=false` qilinadi.

---

### 3.4 `notification_log`

Yuborilgan notificationlar tarixi + dedup uchun.

```sql
CREATE TABLE notification_log (
    id                BIGSERIAL PRIMARY KEY,
    subscription_id   BIGINT NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    user_id           BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    train_number      TEXT NOT NULL,
    seats_snapshot    JSONB NOT NULL,        -- {"21": {"lower": [...], "upper": [...]}, ...}
    snapshot_hash     TEXT NOT NULL,         -- SHA256[:16] of canonical snapshot
    seats_count       INT NOT NULL,
    tg_message_id     BIGINT,                -- yuborilgan xabar ID si (analytics)
    sent_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notif_log_dedup ON notification_log
    (subscription_id, train_number, snapshot_hash, sent_at DESC);

CREATE INDEX idx_notif_log_user_recent ON notification_log
    (user_id, sent_at DESC);
```

**Dedup logikasi:**

```sql
-- Worker da: shu sub + shu train + shu snapshot oxirgi 30 daqiqada yuborilganmi?
SELECT 1 FROM notification_log
WHERE subscription_id = $1
  AND train_number    = $2
  AND snapshot_hash   = $3
  AND sent_at > now() - INTERVAL '30 minutes'
LIMIT 1;
```

Agar topilsa — skip. Aks holda — INSERT va yuborish.

`snapshot_hash` qanday hisoblanadi:
```python
canonical = json.dumps(snapshot, sort_keys=True, separators=(",", ":"))
hash = hashlib.sha256(canonical.encode()).hexdigest()[:16]
```

**Saqlash davomiyligi:** 30 kun (cron orqali eski yozuvlar o'chiriladi).

---

### 3.5 `payments`

Telegram Stars to'lov tarixi (Premium va Donate ikkalasi ham).

```sql
CREATE TABLE payments (
    id                     BIGSERIAL PRIMARY KEY,
    user_id                BIGINT NOT NULL REFERENCES users(id),
    tg_payment_charge_id   TEXT NOT NULL UNIQUE,
    provider_charge_id     TEXT,
    stars_amount           INT NOT NULL CHECK (stars_amount > 0),
    currency               TEXT NOT NULL DEFAULT 'XTR',
    type                   TEXT NOT NULL CHECK (type IN ('premium', 'donate')),
    plan                   TEXT NOT NULL,
    -- Premium uchun: 'premium_1d', 'premium_3d', 'premium_5d',
    --                 'premium_10d', 'premium_30d'
    -- Donate uchun:  'donate_25', 'donate_50', 'donate_100',
    --                 'donate_500', 'donate_custom'
    granted_from           TIMESTAMPTZ NOT NULL,
    granted_until          TIMESTAMPTZ NOT NULL,
    refunded_at            TIMESTAMPTZ,
    raw                    JSONB NOT NULL,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),

    CHECK (granted_until >= granted_from)   -- donate: from == until == now()
);

CREATE INDEX idx_payments_user        ON payments (user_id, created_at DESC);
CREATE INDEX idx_payments_premium_active ON payments (user_id, granted_until DESC)
    WHERE type = 'premium' AND refunded_at IS NULL;
```

**Tip ajratish:** `type` ustuni — premium yoki donate. `plan` ustuni esa specific ID.

**Idempotency:** `tg_payment_charge_id` UNIQUE — bir to'lov ikki marta yozilmaydi (Telegram retry yuborsa ham).

**Premium granted period (stack):**
```python
granted_from  = max(now, user.premium_until or now)
granted_until = granted_from + plan.duration  # +1, +3, +5, +10, +30 days
# UPDATE users SET premium_until = granted_until, tier = 'premium'
```

**Donate granted period:**
```python
granted_from = granted_until = now()  # CHECK constraint >= ni qondiradi
# users.tier o'zgarmaydi
```

---

### 3.6 `watch_groups`

Distinct `(dep, arr, date)` kombinatsiyalar. Per-tier cadence (premium 10s, free 30s) zarurati uchun **jadval** (view emas) qilinadi.

```sql
CREATE TABLE watch_groups (
    id               BIGSERIAL PRIMARY KEY,
    dep_code         TEXT NOT NULL REFERENCES stations(code),
    arr_code         TEXT NOT NULL REFERENCES stations(code),
    travel_date      DATE NOT NULL,
    has_premium      BOOLEAN NOT NULL DEFAULT FALSE,  -- guruhda kamida 1 premium subscriber bormi
    subscriber_count INT     NOT NULL DEFAULT 0,
    last_polled_at   TIMESTAMPTZ,
    next_poll_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    cooldown_until   TIMESTAMPTZ,
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (dep_code, arr_code, travel_date)
);

CREATE INDEX idx_wg_pollable ON watch_groups (next_poll_at)
    WHERE (cooldown_until IS NULL OR cooldown_until < now());
CREATE INDEX idx_wg_premium  ON watch_groups (has_premium DESC, subscriber_count DESC);
```

**Refresh strategiyasi** (har 60s da cron yoki `subscriptions`/`users` o'zgargandagi trigger):

```sql
INSERT INTO watch_groups (dep_code, arr_code, travel_date, has_premium, subscriber_count)
SELECT
    s.dep_code, s.arr_code, s.travel_date,
    bool_or(u.tier = 'premium') AS has_premium,
    COUNT(*) AS subscriber_count
FROM subscriptions s
JOIN users u ON u.id = s.user_id
WHERE s.is_active AND s.travel_date >= CURRENT_DATE
GROUP BY s.dep_code, s.arr_code, s.travel_date
ON CONFLICT (dep_code, arr_code, travel_date) DO UPDATE
SET has_premium     = EXCLUDED.has_premium,
    subscriber_count = EXCLUDED.subscriber_count,
    updated_at       = now();

-- Endi obunachi yo'q bo'lib qolgan groupslarni o'chirish
DELETE FROM watch_groups
WHERE NOT EXISTS (
    SELECT 1 FROM subscriptions s
    WHERE s.is_active
      AND s.dep_code = watch_groups.dep_code
      AND s.arr_code = watch_groups.arr_code
      AND s.travel_date = watch_groups.travel_date
);
```

**Worker polling cycle uchun:**

```sql
-- Aktiv, poll qilinadigan groups
SELECT * FROM watch_groups
WHERE next_poll_at <= now()
  AND (cooldown_until IS NULL OR cooldown_until <= now())
  AND travel_date >= CURRENT_DATE
ORDER BY has_premium DESC, subscriber_count DESC;

-- Poll qilingach next_poll_at yangilash:
UPDATE watch_groups
SET last_polled_at = now(),
    next_poll_at   = now() + (CASE WHEN has_premium THEN INTERVAL '10 seconds'
                                                    ELSE INTERVAL '30 seconds' END)
WHERE id = $1;
```

Cadence tafsilot [08-worker-notifier.md](08-worker-notifier.md).

---

### 3.7 `railway_credentials`

Shared railway.uz hisobi. Bitta qator (singleton), keyin rotation uchun ko'paytirish mumkin.

```sql
CREATE TABLE railway_credentials (
    id              SERIAL PRIMARY KEY,
    username        TEXT NOT NULL,
    password_enc    TEXT NOT NULL,         -- Fernet/AES-encrypted
    access_token    TEXT,                  -- JWT, last login
    refresh_token   TEXT,
    csrf_token      TEXT,
    cookie_str      TEXT,
    token_exp_at    TIMESTAMPTZ,
    last_login_at   TIMESTAMPTZ,
    cooldown_until  TIMESTAMPTZ,           -- 429 dan keyin shu vaqtgacha so'rov yubormaymiz
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Encryption:** `password_enc` Fernet (cryptography paketi) bilan shifrlanadi. Kalit env var `RAILWAY_CRED_KEY` da.

**Concurrent login mutex:**
```sql
-- Worker login qilishdan oldin advisory lock oladi
SELECT pg_advisory_lock(hashtext('railway_login'));
-- ... login flow
SELECT pg_advisory_unlock(hashtext('railway_login'));
```

---

### 3.8 `event_log`

Generic audit log — support uchun.

```sql
CREATE TABLE event_log (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT REFERENCES users(id),
    type        TEXT NOT NULL,            -- 'login', 'sub_created', 'payment_success', 'site_down', etc.
    payload     JSONB NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_event_log_type_ts ON event_log (type, created_at DESC);
CREATE INDEX idx_event_log_user    ON event_log (user_id, created_at DESC);
```

**Saqlash:** 90 kun (nightly cleanup).

---

## 4. Asosiy queries

### 4.1 Foydalanuvchining slot statistikasi

```sql
SELECT
    u.tier,
    CASE u.tier WHEN 'premium' THEN 3 ELSE 1 END AS slot_max,
    COUNT(s.id) FILTER (WHERE s.is_active) AS slot_used
FROM users u
LEFT JOIN subscriptions s ON s.user_id = u.id
WHERE u.id = $1
GROUP BY u.tier;
```

### 4.2 Subscription yaratish (slot enforcement bilan)

```sql
WITH check_slot AS (
    SELECT
        CASE tier WHEN 'premium' THEN 3 ELSE 1 END AS slot_max,
        (SELECT COUNT(*) FROM subscriptions
         WHERE user_id = $1 AND is_active) AS slot_used
    FROM users WHERE id = $1
)
INSERT INTO subscriptions (user_id, dep_code, arr_code, travel_date,
                           train_number, car_types, berth)
SELECT $1, $2, $3, $4, $5, $6, $7
FROM check_slot
WHERE slot_used < slot_max
RETURNING id;
```

Agar `RETURNING` bo'sh — slot to'lgan, app `409 Conflict` qaytaradi.

### 4.3 Watcher uchun aktiv groups

```sql
SELECT dep_code, arr_code, travel_date, subscriber_count
FROM watch_groups
WHERE travel_date >= CURRENT_DATE
ORDER BY subscriber_count DESC;
```

### 4.4 Sub bilan match qilingan foydalanuvchilarni topish

```sql
SELECT s.id, s.user_id, s.train_number, s.car_types, s.berth, u.lang, u.tg_user_id
FROM subscriptions s
JOIN users u ON u.id = s.user_id
WHERE s.is_active
  AND s.dep_code    = $1
  AND s.arr_code    = $2
  AND s.travel_date = $3
  AND (s.train_number IS NULL OR s.train_number = $4)
  AND (cardinality(s.car_types) = 0 OR $5 = ANY(s.car_types));
```

`berth` filter Python tarafida (snapshot ichida).

### 4.5 Premium muddati tugagan userlarni topish (kunlik cron)

```sql
UPDATE users
SET tier = 'free'
WHERE tier = 'premium'
  AND premium_until < now()
RETURNING id, tg_user_id;
-- Application: ortiqcha (>1) aktiv sub'larni `is_active=false` qiladi
-- yoki user'ga "sizning premium tugadi, qaysi sub qoladi?" so'roq yuboradi
```

> **Tier downgrade qoidasi:** Premium tugaganda mavjud sub'lar **avtomatik o'chirilmaydi**. User'ga bot orqali xabar yuboriladi, keyin 7 kun ichida o'zi tanlasin yoki tizim eng eski 2 ta sub'ni `is_active=false` qiladi.

---

## 5. Migratsiyalar (Alembic plan)

| Version | Mazmun |
|---------|--------|
| `0001_initial` | `users`, `stations`, `subscriptions` (muted_until bilan) |
| `0002_payments` | `payments` jadval (type + plan, donate+premium birga) |
| `0003_notif_log` | `notification_log` |
| `0004_watch_groups` | Jadval (view emas) — `has_premium`, `next_poll_at`, `cooldown_until` |
| `0005_credentials` | `railway_credentials` |
| `0006_event_log` | Audit log |
| `0007_stations_seed` | `INSERT INTO stations` (data migration) |
| `0008_pg_trgm` | `CREATE EXTENSION IF NOT EXISTS pg_trgm` |

Har bir migration `upgrade()` + `downgrade()` ikkalasini ham implementatsiya qiladi.

---

## 6. Backup va retention

| Item | Strategy |
|------|----------|
| Full DB backup | Kunlik `pg_dump`, 14 kun saqlanadi, off-site rsync |
| WAL archive | Continuous, 7 kun |
| `notification_log` cleanup | Kunlik cron: 30 kundan eski o'chiriladi |
| `event_log` cleanup | Kunlik cron: 90 kundan eski o'chiriladi |
| `payments` | Hech qachon o'chirilmaydi (finansiy yozuv) |

---

## 7. Bog'liq hujjatlar

- API endpointlar bu schema bilan ishlaydi: [04-backend-api.md](04-backend-api.md)
- Worker queries: [08-worker-notifier.md](08-worker-notifier.md)
- Stations seed manbai: [02-railway-api.md](02-railway-api.md#5-stantsiya-kodlari)
