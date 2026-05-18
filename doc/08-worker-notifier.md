# 08 — Watcher Worker va Notifier

> **Status:** Draft v1 · **Oxirgi tahrir:** 2026-05-18

Backend ning yurak-tomir tizimi. Watcher davriy ravishda railway.uz ni tekshiradi va bo'sh joy paydo bo'lganda foydalanuvchilarga xabar yuboradi.

---

## 1. Vazifa va talablar

| Talab | Qiymat |
|-------|--------|
| Loop ticki | Har **10 sekundda** (eng tez cadence) |
| Premium watch_group cadence | **10s** |
| Free watch_group cadence | **30s** |
| Aralash group (premium+free) | **10s** (premium ustun) |
| railway.uz so'rovlari (max) | ≤ 2 so'rov / sekund global token bucket |
| Notification kechikishi (premium) | Bo'sh joy paydo bo'lganidan ≤ 15s |
| Notification kechikishi (free) | ≤ 45s |
| Dedup oynasi | 30 daqiqa (bir xil snapshot uchun) |
| Past sanalarni GC | Kunlik 03:00 da |
| Concurrent workers | 1 (MVP), keyinroq advisory lock bilan N |

**Per-tier cadence asoslantirish:**
- Premium foydalanuvchilarga "3x tezroq topish" va'da qilingan ([07-payments.md](07-payments.md))
- Loop har 10s da ishlaydi, lekin har `watch_group` ning `next_poll_at` mustaqil:
  - Premium subscriber bo'lgan group: keyingi poll = `last_polled + 10s`
  - Faqat free subscriber: keyingi poll = `last_polled + 30s`
- Bitta group bir nechta sub'lar yig'indisi — premium ham, free ham. Premium bo'lsa, butun group premium cadence'da tekshiriladi (free user ham foyda oladi, bu OK).

---

## 2. Asosiy arxitektura

```
                    ┌────────────────────────────┐
                    │   Watcher Main Loop        │
                    │   tick every 10s           │
                    └────────┬───────────────────┘
                             │
                  ┌──────────▼──────────────────────┐
                  │ 1. Fetch watch_groups where     │
                  │    next_poll_at <= now()        │
                  └──────────┬──────────────────────┘
                             │
                  ┌──────────▼──────────────┐
                  │  2. For each group:     │
                  │     Token bucket wait   │
                  │     Call trains/list    │
                  └──────────┬──────────────┘
                             │
                  ┌──────────▼──────────────┐
                  │  3. Filter matchable    │
                  │     trains in group     │
                  └──────────┬──────────────┘
                             │
                  ┌──────────▼──────────────┐
                  │  4. Fetch detail        │
                  │     (per train, with    │
                  │     jitter)             │
                  └──────────┬──────────────┘
                             │
                  ┌──────────▼──────────────┐
                  │  5. Load subscribers    │
                  │     for the group       │
                  └──────────┬──────────────┘
                             │
                  ┌──────────▼──────────────┐
                  │  6. Match each sub      │
                  │     against snapshot    │
                  └──────────┬──────────────┘
                             │
                  ┌──────────▼──────────────┐
                  │  7. Dedup + insert log  │
                  │     + send TG message   │
                  └─────────────────────────┘
```

---

## 3. Watcher cycle (detail)

### 3.1 Step 1 — Watch groups olish

> Per-tier cadence uchun `watch_groups` jadval (view emas) zarur — `next_poll_at` saqlanishi kerak. MVP da ham table variantni ishlatamiz, view variantdan voz kechamiz.

`watch_groups` materialization:

```sql
-- Har minut yoki sub o'zgarishida `watch_groups` ni recalc qilamiz
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
    subscriber_count = EXCLUDED.subscriber_count;
```

Aktiv pollable groups:

```sql
SELECT id, dep_code, arr_code, travel_date, has_premium, subscriber_count
FROM watch_groups
WHERE travel_date >= CURRENT_DATE
  AND (next_poll_at IS NULL OR next_poll_at <= now())
  AND (cooldown_until IS NULL OR cooldown_until <= now())
ORDER BY has_premium DESC, subscriber_count DESC;
```

Eng avval premium groups (ulargacha 3x tezroq xabar borishi kerak), keyin ko'p obunachili free groups.

Polled bo'lgandan keyin:
```sql
UPDATE watch_groups
SET last_polled_at = now(),
    next_poll_at   = now() + (CASE WHEN has_premium THEN INTERVAL '10 seconds' ELSE INTERVAL '30 seconds' END)
WHERE id = $1;
```

### 3.2 Step 2 — Token bucket

Global rate-limiter (10s cycle uchun rate 2 req/s):

```python
class TokenBucket:
    def __init__(self, rate: float = 2.0, capacity: int = 10):
        self._rate = rate
        self._capacity = capacity
        self._tokens = capacity
        self._lock = asyncio.Lock()
        self._last = time.monotonic()

    async def acquire(self):
        async with self._lock:
            now = time.monotonic()
            elapsed = now - self._last
            self._tokens = min(self._capacity, self._tokens + elapsed * self._rate)
            self._last = now
            if self._tokens >= 1:
                self._tokens -= 1
                return
            wait = (1 - self._tokens) / self._rate
        await asyncio.sleep(wait)
        await self.acquire()
```

Har bir railway.uz so'rovidan oldin: `await bucket.acquire()`.

### 3.3 Step 3 — trains/list

```python
trains = await railway.list_trains(g.dep_code, g.arr_code, g.travel_date)
```

Eslatma: bu ham 30s cache ishlatadi (Mini App search bilan umumiy cache). Worker uchun cache TTL kichikroq qilinadi (10s) — fresh data muhim.

### 3.4 Step 4 — Filtering qaysi poyezdlar uchun detail kerak

Subscriber filterlariga mos kelmaydigan poyezdlar uchun detail so'rov yuborilmaydi:

```python
relevant_trains = []
for train in trains:
    has_subscriber = await db.fetch_val(
        """
        SELECT 1 FROM subscriptions
        WHERE is_active
          AND dep_code = $1 AND arr_code = $2 AND travel_date = $3
          AND (train_number IS NULL OR train_number = $4)
        LIMIT 1
        """,
        g.dep_code, g.arr_code, g.travel_date, train.number,
    )
    if has_subscriber:
        relevant_trains.append(train)
```

### 3.5 Step 5 — Detail olish (jitter bilan)

```python
for i, train in enumerate(relevant_trains):
    if i > 0:
        await asyncio.sleep(random.uniform(0.8, 1.2))  # anti-ban jitter
    await bucket.acquire()
    cars_detail = await railway.get_train_detail(
        g.dep_code, g.arr_code, g.travel_date,
        train.number, train.train_id,
    )
    await process_train(g, train, cars_detail)
```

### 3.6 Step 6 — Subscribers + match

```python
subs = await db.fetch(
    """
    SELECT s.id, s.user_id, s.train_number, s.car_types, s.berth,
           u.tg_user_id, u.lang
    FROM subscriptions s
    JOIN users u ON u.id = s.user_id
    WHERE s.is_active
      AND s.dep_code    = $1
      AND s.arr_code    = $2
      AND s.travel_date = $3
      AND (s.train_number IS NULL OR s.train_number = $4)
    """,
    g.dep_code, g.arr_code, g.travel_date, train.number,
)

for sub in subs:
    matched_snapshot = match_filter(sub, cars_detail)
    if matched_snapshot:
        await notify_if_needed(sub, train, matched_snapshot)
```

---

## 4. Filter matching algoritmi

```python
def match_filter(sub, cars_detail: list[CarDetail]) -> dict | None:
    """
    Returns:
      None — hech narsa mos kelmaydi (notification yuborilmaydi)
      dict — snapshot: {car_number: {"lower": [...], "upper": [...]}}
    """
    snapshot = {}
    car_type_filter = set(sub.car_types) if sub.car_types else None

    for car in cars_detail:
        # 1. Vagon turi filtri
        if car_type_filter and car.type not in car_type_filter:
            continue

        # 2. Berth filtri (faqat плацкарта/купе)
        if car.type in ("плацкарта", "купе"):
            lower = sorted(p for p in car.places if p % 2 == 1)
            upper = sorted(p for p in car.places if p % 2 == 0)

            if sub.berth == "lower":
                if not lower:
                    continue
                snapshot[car.number] = {"lower": lower, "upper": []}
            elif sub.berth == "upper":
                if not upper:
                    continue
                snapshot[car.number] = {"lower": [], "upper": upper}
            else:  # any
                snapshot[car.number] = {"lower": lower, "upper": upper}
        else:
            # Boshqa turlar — berth ma'nosiz
            if not car.places:
                continue
            snapshot[car.number] = {"places": sorted(car.places)}

    return snapshot if snapshot else None
```

---

## 5. Dedup va notify

```python
import hashlib, json

async def notify_if_needed(sub, train, snapshot: dict):
    canonical = json.dumps(snapshot, sort_keys=True, separators=(",", ":"))
    snap_hash = hashlib.sha256(canonical.encode()).hexdigest()[:16]

    # Dedup window: 30 daqiqa
    duplicate = await db.fetch_val(
        """
        SELECT 1 FROM notification_log
        WHERE subscription_id = $1
          AND train_number    = $2
          AND snapshot_hash   = $3
          AND sent_at > now() - INTERVAL '30 minutes'
        LIMIT 1
        """,
        sub.id, train.number, snap_hash,
    )
    if duplicate:
        return  # skip

    # Mute window check
    muted = await db.fetch_val(
        """
        SELECT muted_until FROM subscriptions
        WHERE id = $1 AND muted_until > now()
        """,
        sub.id,
    )
    if muted:
        return  # user muted

    # Send TG message
    seats_count = sum(
        len(s.get("lower", [])) + len(s.get("upper", [])) + len(s.get("places", []))
        for s in snapshot.values()
    )
    text = format_ticket_alert(sub, train, snapshot, lang=sub.lang)
    msg_id = await tg_send(sub.tg_user_id, text, reply_markup=...)

    await db.execute(
        """
        INSERT INTO notification_log
          (subscription_id, user_id, train_number,
           seats_snapshot, snapshot_hash, seats_count, tg_message_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        """,
        sub.id, sub.user_id, train.number,
        snapshot, snap_hash, seats_count, msg_id,
    )
```

---

## 6. Notification xabar formati

`format_ticket_alert(sub, train, snapshot, lang)` HTML qaytaradi. Mavjud `src/notifier.py:97-144` ga asoslangan:

```html
🚂 <b>Chipta topildi!</b>
📍 Marshrut: <b>Toshkent → Urganch</b>
📅 Sana: <b>2026-04-24</b>

• <b>076Ж</b> (Yo'lovchi)
  🕐 16:05 → 05:23 (13:18)
  💺 Jami: <b>3 ta</b>

  🪑 <b>плацкарта</b>:
     Vagon 21 (3 ta):
        ⬇️ pastki (2): 23, 25
        ⬆️ tepa   (1): 24

🔗 <a href="https://eticket.railway.uz/uz/home">Bilet olish</a>
```

> **Muhim:** faqat **mos kelgan filtrlardagi** joylar ko'rsatiladi. User "pastki" tanlagan bo'lsa, faqat pastki joylar; tepa joylar haqida xabar berilmaydi.

Reply markup:
```python
{
    "inline_keyboard": [[
        {"text": "🔇 10 daqiqa jim", "callback_data": f"mute_sub:{sub.id}:600"},
        {"text": "❌ O'chirish",     "callback_data": f"del_sub:{sub.id}"},
    ]]
}
```

---

## 7. Re-notification policy

> **Foydalanuvchi xohishi:** "Joy topilganda yuborip turaveradi notification" — snapshot o'zgarsa qayta xabar yuboriladi.

Mantiq:
- Bir xil `(sub, train, snapshot_hash)` 30 daqiqa ichida — **skip**.
- Bir xil `(sub, train)` lekin **boshqa snapshot_hash** (joylar soni o'zgardi) — **yuboriladi**.
- 30 daqiqa o'tgandan keyin bir xil snapshot — **yuboriladi** (yangi xotira).

Misol:
| Vaqt | Snapshot | Hash | Xato/Yuborildi |
|------|----------|------|----------------|
| 10:00 | {21: [23, 25]} | `abc` | Yuborildi |
| 10:05 | {21: [23, 25]} | `abc` | Skip (dedup) |
| 10:10 | {21: [23, 25, 27]} | `def` | Yuborildi (yangi joy) |
| 10:20 | {21: [23, 25]} | `abc` | Skip (`abc` 30 min ichida) |
| 10:45 | {21: [23, 25]} | `abc` | Yuborildi (oyna o'tdi) |

> **Kelajak feature:** Per-sub `re_notify_after_minutes` (premium). MVP da hard-coded 30 daqiqa.

---

## 8. Mute mexanizmi

Foydalanuvchi notif xabaridagi "🔇 10 daqiqa jim" tugmasini bossa:

```sql
ALTER TABLE subscriptions ADD COLUMN muted_until TIMESTAMPTZ;
```

Callback handler:
```python
@router.callback_query(F.data.startswith("mute_sub:"))
async def mute_handler(cb):
    _, sub_id, sec = cb.data.split(":")
    until = datetime.now(UTC) + timedelta(seconds=int(sec))
    await db.execute(
        "UPDATE subscriptions SET muted_until = $1 WHERE id = $2 AND user_id = $3",
        until, int(sub_id), cb.from_user.id,
    )
    await cb.answer(f"🔇 {sec}s jim qilindi")
```

---

## 9. Auth re-login (mutex)

Re-login `pg_advisory_lock` bilan o'ralgan:

```python
async def ensure_token(db):
    cred = await db.fetch_one("SELECT * FROM railway_credentials WHERE is_active LIMIT 1")
    if cred.token_exp_at and cred.token_exp_at - timedelta(seconds=60) > datetime.now(UTC):
        return cred.access_token

    # Lock for exclusive login
    await db.execute("SELECT pg_advisory_lock(hashtext('railway_login'))")
    try:
        cred = await db.fetch_one("SELECT * FROM railway_credentials WHERE is_active LIMIT 1")
        if cred.token_exp_at and cred.token_exp_at - timedelta(seconds=60) > datetime.now(UTC):
            return cred.access_token  # another worker beat us to it

        new_token, refresh, csrf, cookie, exp = await railway_login_flow(cred)
        await db.execute(
            """UPDATE railway_credentials SET
                 access_token=$1, refresh_token=$2, csrf_token=$3,
                 cookie_str=$4, token_exp_at=$5, last_login_at=now()
               WHERE id=$6""",
            new_token, refresh, csrf, cookie, exp, cred.id,
        )
        return new_token
    finally:
        await db.execute("SELECT pg_advisory_unlock(hashtext('railway_login'))")
```

---

## 10. Cooldown va backoff

| Xato | Harakat |
|------|---------|
| 429 | `cooldown_until = now() + 5 min`, cycle skip |
| 5xx | Backoff: 5s → 10s → 30s → 60s; max retry 3, keyin cooldown |
| Timeout | Retry 1, keyin cooldown 2 min |
| 401 | Re-login (mutex'd), keyingi cycle |

```python
async def fetch_with_retry(coro, max_attempts=3):
    backoff = 5
    for attempt in range(max_attempts):
        try:
            return await coro()
        except RateLimitError:
            await set_cooldown(timedelta(minutes=5))
            raise
        except ServerError:
            if attempt == max_attempts - 1:
                raise
            await asyncio.sleep(backoff)
            backoff *= 2
```

---

## 11. Past dates cleanup

Kunlik 03:00 cron:

```python
async def cleanup_past_dates():
    # Sub'larni deactivate
    deactivated = await db.fetch(
        """
        UPDATE subscriptions
        SET is_active = false
        WHERE is_active = true AND travel_date < CURRENT_DATE
        RETURNING id, user_id
        """,
    )
    # Foydalanuvchilarni xabardor qilish (optional)
    for s in deactivated:
        await tg_send(s.user_id, t("sub.expired", lang=...))

    # Eski notification_log ni o'chirish (30+ kun)
    await db.execute(
        "DELETE FROM notification_log WHERE sent_at < now() - INTERVAL '30 days'"
    )
```

---

## 12. Horizontal scale (kelajak)

MVP da bitta worker yetarli. 1000+ aktiv sub bo'lsa:

1. **Variant A:** `watch_groups` jadval (view emas) + `next_poll_at` + advisory lock per group:
   ```python
   group = await db.fetch_one("""
       SELECT id FROM watch_groups
       WHERE next_poll_at <= now()
         AND pg_try_advisory_lock(hashtext('wg_' || id))
       LIMIT 1 FOR UPDATE SKIP LOCKED
   """)
   ```
2. **Variant B:** Redis queue + Celery/RQ workers.
3. **Variant C:** Kubernetes CronJob har 60s da N replica.

> **Tavsiya:** Variant A — Postgres orqali, qo'shimcha Redis kerak emas.

---

## 13. Konfiguratsiya

`backend/app/core/config.py`:

```python
WATCHER_TICK_SECONDS         = 10    # loop tick chastotasi (eng tez cadence)
WATCHER_PREMIUM_INTERVAL_S   = 10    # premium group poll interval
WATCHER_FREE_INTERVAL_S      = 30    # free-only group poll interval
WATCHER_DEDUP_MINUTES        = 30    # dedup oynasi
WATCHER_RATE_PER_SECOND      = 2.0   # railway.uz uchun token bucket (10s cycle bilan ko'tarildi)
WATCHER_DETAIL_JITTER        = 0.5   # detail so'rovlar orasidagi jitter (s) — kichikroq, 10s budget'da
WATCHER_LIST_CACHE_TTL       = 5     # trains/list cache TTL (s) — 10s cycle uchun qisqaroq
RAILWAY_COOLDOWN_429         = 300   # 5 daqiqa cooldown 429 dan keyin
NOTIF_LOG_RETENTION_DAYS     = 30
WATCH_GROUPS_REFRESH_SECONDS = 60    # watch_groups jadvalini qanchadan keyin rebuild qilish
```

**Yuk hisobi:**
- 10s cycle: agar 30 ta premium group bo'lsa → har 10s da 30 so'rov = 3 req/s, lekin token bucket 2 req/s → 15s da o'tadi (OK).
- 100 ta group (mixed): premium har 10s, free har 30s. Hisob: `100/10 + (free_count)/30` so'rov/s.
- Misol: 50 premium + 50 free → 50/10 + 50/30 = 5 + 1.67 ≈ 6.7 req/s — bu xavfli, token bucket'ni oshirish kerak yoki cooldown ishlaydi.

> **Scale chegarasi:** Hozirgi konfiguratsiyada taxminan **40 premium groups + 100 free groups** muvozanat (~4 req/s). Bundan ortiq bo'lsa: (1) ko'p Railway hisoblari, (2) IP rotation, (3) horizontal worker. Tafsilot [11-roadmap.md](11-roadmap.md) M7+.

---

## 14. Test (manual)

| Test | Scenario | Kutilgan |
|------|----------|----------|
| Sub yaratish + tekshirish | 1 ta sub, real route+date | 60s ichida cycle ishlaydi |
| Bo'sh joy yo'q | railway.uz hech narsa qaytarmaydi | Notification yuborilmaydi |
| Yangi joy paydo bo'ldi | Fake railway.uz response | Xabar keladi |
| Bir xil snapshot ikki marta | 2 cycle ketma-ket | Faqat 1 ta xabar |
| Joylar ko'paydi | 2-cycle da boshqa snapshot | 2 ta xabar |
| Pastki tanlangan, faqat tepa bor | filter test | Xabar yuborilmaydi |
| Mute 10s | Tugma bosish | 10s davomida skip |
| railway.uz 429 | Mock response | Cooldown 5 min, log warning |
| railway.uz down | Network error | Cycle skip, hech qanday xato user'ga emas |
| O'tgan sana | sub.travel_date < today | Nightly deactivated, list endpointga kelmaydi |

---

## 15. Bog'liq hujjatlar

- railway.uz API: [02-railway-api.md](02-railway-api.md)
- DB jadvallari: [03-database-schema.md](03-database-schema.md)
- Notification HTML formati: [src/notifier.py](../src/notifier.py)
- Observability: [10-observability.md](10-observability.md)
