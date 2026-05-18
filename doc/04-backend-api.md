# 04 — Backend API (FastAPI)

> **Status:** Draft v1 · **Oxirgi tahrir:** 2026-05-18
> **Framework:** FastAPI · **Schema docs:** auto-generated OpenAPI at `/docs`

Backend REST API kontrakti. Hamma endpointlar JSON qabul qiladi va JSON qaytaradi.

---

## 1. Asosiy ma'lumotlar

| Atribut | Qiymat |
|---------|--------|
| Base URL (prod) | `https://api.tdbot.example` |
| Base URL (dev) | `http://localhost:8000` |
| OpenAPI | `GET /docs` (Swagger UI), `GET /openapi.json` |
| Auth (Mini App) | `X-Tg-Init-Data` header |
| Auth (Bot ↔ Backend) | `Authorization: Bearer <internal JWT>` |
| Content-Type | `application/json` |
| Time format | ISO 8601 UTC: `2026-04-24T16:05:00Z` |
| Errors | RFC 7807 ga yaqin: `{"error": {"code", "message", "details"}}` |

---

## 2. Endpointlar guruhi

| Guruh | Prefix | Auth |
|-------|--------|------|
| Public (Mini App) | `/api/v1/*` | initData |
| Internal (Bot) | `/internal/v1/*` | Internal JWT |
| Webhooks | `/webhooks/*` | Telegram secret token |
| Health | `/health`, `/metrics` | None |

---

## 3. Authentication

### 3.1 initData verification (Mini App)

Telegram WebApp har bir foydalanuvchiga `initData` query string beradi (HMAC bilan imzolangan). Backend uni quyidagicha tekshiradi:

```python
import hmac, hashlib
from urllib.parse import parse_qsl

def verify_init_data(init_data: str, bot_token: str) -> dict:
    parsed = dict(parse_qsl(init_data))
    received_hash = parsed.pop("hash")
    auth_date = int(parsed["auth_date"])

    # 1) Freshness: 24 soat ichida
    if time.time() - auth_date > 86400:
        raise AuthError("expired")

    # 2) HMAC tekshirish
    data_check = "\n".join(f"{k}={v}" for k, v in sorted(parsed.items()))
    secret_key = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
    calc_hash = hmac.new(secret_key, data_check.encode(), hashlib.sha256).hexdigest()
    if calc_hash != received_hash:
        raise AuthError("bad_signature")

    return json.loads(parsed["user"])  # {id, first_name, username, ...}
```

`X-Tg-Init-Data` header da raw initData yuboriladi. FastAPI Depends:

```python
async def current_user(
    x_tg_init_data: str = Header(...),
    db: AsyncSession = Depends(get_db),
) -> User:
    tg_user = verify_init_data(x_tg_init_data, settings.BOT_TOKEN)
    return await user_service.upsert_from_tg(db, tg_user)
```

### 3.2 Internal JWT (Bot → Backend)

Bot va backend orasidagi aloqa uchun statik secret bilan imzolangan JWT.

```python
def make_internal_jwt() -> str:
    return jwt.encode(
        {"iss": "bot", "exp": time.time() + 60},
        settings.INTERNAL_JWT_SECRET,
        algorithm="HS256",
    )
```

Bot har so'rovga `Authorization: Bearer <token>` yuboradi.

### 3.3 Webhook secret token

Telegram Bot API'da webhook setup paytida `secret_token` o'rnatiladi. Telegram har webhook so'rovida `X-Telegram-Bot-Api-Secret-Token` header bilan yuboradi. Backend uni tekshiradi.

---

## 4. Public API (Mini App)

### 4.1 `POST /api/v1/auth/tg`

Mini App birinchi marta ochilganda initData ni tasdiqlatadi va user ni upsert qiladi.

**Request:** `X-Tg-Init-Data: <raw>` (body bo'sh)

**Response 200:**
```json
{
  "user": {
    "id": 42,
    "tg_user_id": 970956519,
    "first_name": "Farrukh",
    "lang": "uz",
    "tier": "free",
    "premium_until": null
  },
  "slot": {
    "max": 1,
    "used": 0
  }
}
```

**Errors:**
- `401 invalid_init_data` — HMAC mos kelmadi
- `401 expired_init_data` — > 24 soat
- `403 banned` — `users.is_banned = true`

---

### 4.2 `GET /api/v1/me`

Joriy user profili + slot statistikasi.

**Response 200:** yuqoridagi `auth/tg` ko'rinishida.

---

### 4.3 `GET /api/v1/stations`

Stantsiya autocomplete.

**Query:**
- `q` (string, optional) — substring (case-insensitive, fuzzy)
- `lang` (string, default `uz`) — qaysi tilda qidiriladi

**Response 200:**
```json
{
  "stations": [
    {"code": "2900000", "name": "Toshkent", "city": "Toshkent"},
    {"code": "2900001", "name": "Toshkent-Pass.", "city": "Toshkent"}
  ]
}
```

`q` bo'sh bo'lsa — barcha aktiv stantsiyalar (alfavit bo'yicha, limit 100).

---

### 4.4 `POST /api/v1/trains/search`

Berilgan marshrut + sana uchun poyezdlar ro'yxati. Backend railway.uz ga proxy qiladi va cache qiladi.

**Request:**
```json
{
  "dep_code": "2900000",
  "arr_code": "2900790",
  "date": "2026-04-24"
}
```

**Response 200:**
```json
{
  "trains": [
    {
      "number": "076Ж",
      "brand": "Yo'lovchi",
      "departure": "2026-04-24T16:05:00",
      "arrival": "2026-04-25T05:23:00",
      "time_on_way": "13:18",
      "dep_station": "Toshkent",
      "arr_station": "Urganch",
      "car_types": [
        {"type": "плацкарта", "free_seats": 24, "supports_berth": true},
        {"type": "купе",      "free_seats": 8,  "supports_berth": true}
      ]
    }
  ],
  "cached": true,
  "fetched_at": "2026-05-18T12:34:56Z"
}
```

**Errors:**
- `400 invalid_date` — sana noto'g'ri yoki o'tgan
- `404 no_trains` — railway.uz bo'sh ro'yxat qaytardi
- `503 railway_unavailable` — railway.uz mavjud emas (cache yo'q yoki eski)

**Cache strategy:**
- Key: `trains:{dep}:{arr}:{date}`
- TTL: 30 soniya (in-memory yoki Redis)
- Mini App'ning bir nechta foydalanuvchisi parallel qarayotgan bo'lsa, faqat bitta railway.uz so'rovi yuboriladi (singleflight).

---

### 4.5 `GET /api/v1/subscriptions`

Joriy foydalanuvchining subscription'lari.

**Response 200:**
```json
{
  "subscriptions": [
    {
      "id": 17,
      "dep_code": "2900000",
      "arr_code": "2900790",
      "dep_name": "Toshkent",
      "arr_name": "Urganch",
      "travel_date": "2026-04-24",
      "train_number": "076Ж",
      "car_types": ["плацкарта"],
      "berth": "lower",
      "is_active": true,
      "created_at": "2026-05-18T10:00:00Z",
      "last_notified_at": "2026-05-18T11:23:45Z"
    }
  ],
  "slot": {"max": 1, "used": 1}
}
```

---

### 4.6 `POST /api/v1/subscriptions`

Yangi subscription yaratish.

**Request:**
```json
{
  "dep_code": "2900000",
  "arr_code": "2900790",
  "travel_date": "2026-04-24",
  "train_number": "076Ж",
  "car_types": ["плацкарта"],
  "berth": "lower"
}
```

**Validation:**
- `dep_code` va `arr_code` farqli, `stations` da mavjud, `is_active=true`
- `travel_date` >= bugun
- `train_number` — agar berilgan bo'lsa, NULL emas (bo'sh string emas)
- `car_types` — valid qiymatlar (`плацкарта`, `купе`, `люкс`, `св`, `сидячий`)
- `berth` — `lower`/`upper`/`any`. Agar `car_types` da `плацкарта`/`купе` bo'lmasa va `berth != 'any'` → `400 berth_not_applicable`
- Slot enforcement: `slot.used >= slot.max` → `409 slot_limit_reached`

**Response 201:**
```json
{
  "subscription": { /* same shape as GET */ },
  "slot": {"max": 1, "used": 1}
}
```

**Errors:**
- `400 invalid_payload` — har qanday validatsiya xatosi
- `409 slot_limit_reached` — slot to'lgan
- `409 duplicate` — bir xil parametrlarda aktiv sub mavjud (optional check)

---

### 4.7 `PATCH /api/v1/subscriptions/{id}`

Subscription ni yangilash (faqat `is_active` toggle yoki `car_types`/`berth` o'zgartirish).

**Request (kerakli fieldlar):**
```json
{
  "is_active": false
}
```

**Response 200:** yangilangan sub.

**Errors:**
- `404 not_found`
- `403 not_owner` — boshqa foydalanuvchining sub'iga tegmaslik
- `409 slot_limit_reached` — `is_active: false → true` qaytarayotganda slot to'lgan bo'lsa

---

### 4.8 `DELETE /api/v1/subscriptions/{id}`

Subscription o'chirish (hard delete).

**Response 204** (bo'sh body).

---

### 4.9 `GET /api/v1/payments/invoice`

Premium yoki Donate uchun Telegram Stars invoice link.

**Query:**
- `plan` (string, required) — plan ID:
  - Premium: `premium_1d`, `premium_3d`, `premium_5d`, `premium_10d`, `premium_30d`
  - Donate: `donate_25`, `donate_50`, `donate_100`, `donate_500`, `donate_custom`
- `amount` (int, optional) — faqat `donate_custom` uchun, 10-5000 ⭐

**Response 200 (premium):**
```json
{
  "invoice_link": "https://t.me/$...",
  "type": "premium",
  "plan": "premium_30d",
  "stars_amount": 350,
  "duration_days": 30
}
```

**Response 200 (donate):**
```json
{
  "invoice_link": "https://t.me/$...",
  "type": "donate",
  "plan": "donate_100",
  "stars_amount": 100
}
```

Mini App `tg.openInvoice(invoice_link, callback)` orqali ochadi. Bot `sendInvoice` ham ishlatishi mumkin.

**Errors:**
- `400 unknown_plan` — plan_id ro'yxatda yo'q
- `400 invalid_amount` — `donate_custom` uchun amount yo'q yoki diapazondan tashqari

---

### 4.10 `GET /api/v1/payments/history`

Foydalanuvchining to'lov va donate tarixi.

**Response 200:**
```json
{
  "payments": [
    {
      "id": 5,
      "type": "premium",
      "plan": "premium_30d",
      "stars_amount": 350,
      "granted_from": "2026-05-18T00:00:00Z",
      "granted_until": "2026-06-17T00:00:00Z",
      "created_at": "2026-05-18T00:00:00Z"
    },
    {
      "id": 4,
      "type": "donate",
      "plan": "donate_100",
      "stars_amount": 100,
      "created_at": "2026-05-10T15:30:00Z"
    }
  ]
}
```

### 4.11 `GET /api/v1/payments/plans`

Mavjud Premium va Donate variantlarini qaytaradi (Mini App hardcode'siz olishi uchun).

**Response 200:**
```json
{
  "premium": [
    {"id": "premium_1d",  "days": 1,  "stars": 20},
    {"id": "premium_3d",  "days": 3,  "stars": 50},
    {"id": "premium_5d",  "days": 5,  "stars": 80},
    {"id": "premium_10d", "days": 10, "stars": 150},
    {"id": "premium_30d", "days": 30, "stars": 350, "badge": "💎"}
  ],
  "donate": [
    {"id": "donate_25",  "stars": 25,  "label": "☕ Kichik rahmat"},
    {"id": "donate_50",  "stars": 50,  "label": "🍪 O'rtacha rahmat"},
    {"id": "donate_100", "stars": 100, "label": "🍰 Katta rahmat"},
    {"id": "donate_500", "stars": 500, "label": "🎁 Generous"}
  ],
  "donate_custom_range": {"min": 10, "max": 5000}
}
```

---

## 5. Internal API (Bot ↔ Backend)

Hamma endpointlar `Authorization: Bearer <internal JWT>` talab qiladi.

### 5.1 `POST /internal/v1/users/upsert`

Bot `/start` qabul qilganda chaqiradi.

**Request:**
```json
{
  "tg_user_id": 970956519,
  "tg_username": "farrukh",
  "first_name": "Farrukh",
  "last_name": "R",
  "lang": "uz"
}
```

**Response 200:**
```json
{"user": { /* User */ }, "is_new": true}
```

---

### 5.2 `POST /internal/v1/payments/precheck`

Bot `pre_checkout_query` qabul qilganda — to'lov validatsiyasi.

**Request:**
```json
{
  "tg_user_id": 970956519,
  "invoice_payload": "premium_30d:42",
  "stars_amount": 300
}
```

**Response 200:**
```json
{"ok": true}
```

yoki:
```json
{"ok": false, "error": "invalid_amount"}
```

Bot bu javobni `answerPreCheckoutQuery(ok=...)` ga uzatadi.

---

### 5.3 `POST /internal/v1/payments/successful`

To'lov muvaffaqiyatli o'tganda.

**Request:**
```json
{
  "tg_user_id": 970956519,
  "tg_payment_charge_id": "abc123",
  "provider_charge_id": "xyz",
  "invoice_payload": "premium_30d:42",
  "stars_amount": 300,
  "raw": { /* full successful_payment object */ }
}
```

**Response 200:**
```json
{
  "user": { /* updated User with new tier */ },
  "payment_id": 5,
  "granted_until": "2026-06-17T00:00:00Z"
}
```

Bot bu javobdan foydalanib user'ga tabrik xabari yuboradi.

---

### 5.4 `POST /internal/v1/notifications/send`

Worker → backend → bot orqali xabar yuborish (alternativa: worker to'g'ridan bot API ga).

> **MVP da bu endpoint emas, worker to'g'ridan TG Bot API ga `sendMessage` chaqiradi.** Endpoint kelajakda — agar centralized rate-limit yoki templating kerak bo'lsa.

---

## 6. Webhook endpoints

### 6.1 `POST /webhooks/telegram`

Telegram'dan kelgan update'lar. aiogram dispatcher ga uzatiladi.

**Headers:**
- `X-Telegram-Bot-Api-Secret-Token: <secret>` — tekshiriladi

**Response:** `200 OK` (Telegram bot'ning javobini o'qimaydi).

---

## 7. Health va metrics

### 7.1 `GET /health`

```json
{"status": "ok", "version": "1.0.0", "db": "ok"}
```

Faqat DB ping qiladi.

### 7.2 `GET /metrics`

Prometheus format. Tafsilot [10-observability.md](10-observability.md).

---

## 8. Error format

Barcha xatolar quyidagi shaklda:

```json
{
  "error": {
    "code": "slot_limit_reached",
    "message": "Maksimal aktiv notification soni: 1. Premium oling.",
    "details": {"slot_used": 1, "slot_max": 1}
  }
}
```

**Standart error code'lar:**

| Code | HTTP | Ma'no |
|------|------|-------|
| `invalid_init_data` | 401 | initData HMAC noto'g'ri |
| `expired_init_data` | 401 | initData 24 soatdan eski |
| `unauthorized` | 401 | Internal JWT noto'g'ri |
| `forbidden` | 403 | Foydalanuvchi banned yoki egasi emas |
| `not_found` | 404 | Resource topilmadi |
| `invalid_payload` | 400 | Pydantic validation fail |
| `slot_limit_reached` | 409 | Premium kerak |
| `duplicate` | 409 | Bir xil resource mavjud |
| `railway_unavailable` | 503 | railway.uz mavjud emas |
| `rate_limited` | 429 | Mini App haddan tashqari ko'p so'rov |
| `internal_error` | 500 | Kutilmagan xato |

---

## 9. Rate limiting

Mini App har 1 minutda 60 so'rov chegarasi (per user_id):

```python
@app.middleware("http")
async def ratelimit_mw(request, call_next):
    user_id = extract_user_id(request)
    if not await ratelimit.check(user_id, 60, 60):
        return JSONResponse(status_code=429, content={...})
    return await call_next(request)
```

Backend in-memory token bucket (Redis kerak bo'lganda).

---

## 10. CORS

Mini App Telegram WebView ichida ishlaydi — domen `web.telegram.org` (ba'zan boshqa). CORS:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://web.telegram.org",
        "https://k.web.telegram.org",
        "https://z.web.telegram.org",
        # dev:
        "http://localhost:5173",
    ],
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "X-Tg-Init-Data"],
)
```

---

## 11. Versioning

- URL'da `/v1/` — major versiyalar.
- Minor o'zgarishlar backward-compatible.
- Breaking change → `/v2/` ochiladi, `/v1/` 6 oy yashaydi.

---

## 12. OpenAPI generatsiya

FastAPI avto-generate qiladi. Mini App tomonida `openapi-typescript` yoki `orval` orqali TS tiplar yaratiladi:

```bash
npx openapi-typescript http://localhost:8000/openapi.json -o mini-app/src/api/types.ts
```

---

## 13. Bog'liq hujjatlar

- DB queries: [03-database-schema.md](03-database-schema.md)
- Bot bilan integratsiya: [05-bot-spec.md](05-bot-spec.md)
- Mini App tomonidan ishlatish: [06-mini-app-spec.md](06-mini-app-spec.md)
- To'lov flow: [07-payments.md](07-payments.md)
