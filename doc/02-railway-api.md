# 02 — eticket.railway.uz API Kontrakti

> **Status:** Draft v1 · **Oxirgi tahrir:** 2026-05-18
> **Manba:** [src/auth.py](../src/auth.py), [src/checker.py](../src/checker.py), [src/debug_api.py](../src/debug_api.py)

Ushbu hujjat eticket.railway.uz ning **rasmiy bo'lmagan** ichki JSON API si bilan ishlash uchun to'liq texnik spetsifikatsiya. Hamma payloadlar va response shapelar joriy `dev-tg` branch da haqiqatan ishlovchi koddan ko'chirilgan.

> ⚠️ **Eslatma:** Bu API rasmiy hujjatlanmagan. railway.uz har vaqt sxemani o'zgartirishi mumkin. `src/debug_api.py` ni davriy ishga tushirib, response strukturasini tekshirish kerak.

---

## 1. Asosiy ma'lumot

| Atribut | Qiymat |
|---------|--------|
| Base URL | `https://eticket.railway.uz` |
| Til | uz / ru / en (Accept-Language header orqali) |
| Auth | JWT Bearer + CSRF cookie kombinatsiyasi |
| Timeout | 15-20 soniya |
| Content-Type | `application/json` |

---

## 2. Auth flow (login + token boshqaruv)

### 2.1 Asosiy headers (har bir so'rov bilan)

```python
COMMON_HEADERS = {
    "Origin": "https://eticket.railway.uz",
    "Referer": "https://eticket.railway.uz/uz/auth/login",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/145.0.0.0 Safari/537.36",
    "Accept": "application/json",
    "Accept-Language": "uz",
    "device-type": "BROWSER",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
}
```

> **Muhim:** `device-type: BROWSER` qatori bo'lmasa, server 403 qaytarishi mumkin. `User-Agent` ni real brauzerga maksimal o'xshatib qoldirish kerak.

### 2.2 Step 1: CSRF token olish

```
GET /api/v1/csrf-token
Headers: COMMON_HEADERS
```

**Response:**
- Status: 200
- Body: ahamiyatli emas (bo'sh yoki `{"status":"ok"}` kabi)
- **Asosiy ma'lumot Set-Cookie header da:**
  - `XSRF-TOKEN=<value>` — bu CSRF token qiymati
  - Boshqa session cookie'lar (mavjudligini kuzatish kerak)

**Saqlanadi:**
- `csrf_value` = `XSRF-TOKEN` cookie qiymati
- `cookie_str` = barcha cookie'larning `name=value; ...` ko'rinishidagi to'plami

### 2.3 Step 2: Login

```
POST /api/v1/auth/login
Headers:
  ...COMMON_HEADERS
  Content-Type: application/json
  X-XSRF-TOKEN: <csrf_value>
  Cookie: <cookie_str>
Body:
  {"username": "<email>", "password": "<password>"}
```

**Response (200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

- `token` — Access JWT. Payload da `exp` (unix time) bor. Tokenni decode qilib expiry vaqtini bilish mumkin (signature tekshirish shart emas, faqat client-side):
  ```python
  jwt.decode(token, options={"verify_signature": False})
  ```
- `refreshToken` — saqlanadi, lekin hozircha qayta-login soddaroq (refresh endpoint hujjatlanmagan).

**Qo'shimcha:** login response ham yangi cookie'larni qaytaradi — ularni eski `cookie_str` ga **birlashtirish** kerak.

### 2.4 Authenticated requests

Har bir API chaqiruvida quyidagi headers:

```python
{
    **COMMON_HEADERS,
    "Content-Type": "application/json",
    "Authorization": f"Bearer {access_token}",
    "X-XSRF-TOKEN": csrf_token,
    "Cookie": cookie_str,
}
```

### 2.5 Token muddati va re-login

Joriy logika ([src/auth.py:33-38](../src/auth.py)):

```python
def _is_expired(token, buffer_seconds=60):
    payload = jwt.decode(token, options={"verify_signature": False})
    return time.time() >= (payload.get("exp", 0) - buffer_seconds)
```

Har bir API chaqiruv oldidan tekshiriladi. Agar 60s ichida tugasa — qayta login.

**Multi-worker holatda:**
- Re-login **mutex** (asyncio.Lock yoki DB advisory lock) bilan o'ralishi kerak.
- Faqat bitta worker bir vaqtda login qilsin, qolganlari kutadi.
- Yangi token DB ga (`railway_credentials` jadvali) yoziladi, hammasi shu yerdan o'qiydi.

### 2.6 Xato holatlari

| Status | Sabab | Harakat |
|--------|-------|---------|
| 401 | Token tugagan yoki noto'g'ri | Mutex ostida re-login |
| 403 | CSRF noto'g'ri yoki cookie yo'qolgan | CSRF qayta olish + re-login |
| 429 | Rate limit | Exponential backoff (5s → 10s → 30s → 60s), `railway_credentials.cooldown_until` ga yozish |
| 5xx | Server xato | Backoff + retry (max 3) |
| Timeout / ConnError | Tarmoq | `site_down` event, foydalanuvchilarga xabar bermaslik kerak (faqat statusda ko'rinadi) |

---

## 3. Endpoint #1 — Poyezdlar ro'yxati

**Vazifasi:** Berilgan sana + marshrut uchun mavjud poyezdlar va har birining vagon turlarini olish.

```
POST /api/v3/handbook/trains/list
Headers: authenticated headers (yuqorida)
Body:
{
  "directions": {
    "forward": {
      "date": "2026-04-24",
      "depStationCode": "2900000",
      "arvStationCode": "2900790"
    }
  }
}
```

### 3.1 Response shape

```json
{
  "data": {
    "directions": {
      "forward": {
        "trains": [
          {
            "number": "076Ж",
            "brand": "Yo'lovchi",
            "departureDate": "2026-04-24T16:05:00",
            "arrivalDate": "2026-04-25T05:23:00",
            "timeOnWay": "13:18",
            "trainId": "1234abcd-...",
            "subRoute": {
              "depStationName": "Toshkent",
              "arvStationName": "Urganch"
            },
            "cars": [
              {"type": "плацкарта", "freeSeats": 24},
              {"type": "купе", "freeSeats": 8}
            ]
          }
        ]
      }
    }
  }
}
```

### 3.2 Ishlatilayotgan fieldlar

| Path | Tip | Misol | Izoh |
|------|-----|-------|------|
| `data.directions.forward.trains[]` | array | — | Poyezdlar ro'yxati |
| `[].number` | string | `"076Ж"` | Poyezd raqami (cirilica) |
| `[].brand` | string | `"Yo'lovchi"` | Poyezd brendi |
| `[].departureDate` | ISO datetime | `"2026-04-24T16:05:00"` | Jo'nash vaqti |
| `[].arrivalDate` | ISO datetime | `"2026-04-25T05:23:00"` | Yetib borish vaqti |
| `[].timeOnWay` | string | `"13:18"` | HH:MM yo'l vaqti |
| `[].trainId` | string \| null | `"abc..."` | Detail so'rov uchun. Null bo'lishi mumkin, lekin baribir ishlaydi |
| `[].subRoute.depStationName` | string | `"Toshkent"` | Display nomi |
| `[].subRoute.arvStationName` | string | `"Urganch"` | Display nomi |
| `[].cars[]` | array | — | Vagon turlari (high-level) |
| `[].cars[].type` | string | `"плацкарта"` | Vagon turi (raw — normalize qilinadi) |
| `[].cars[].freeSeats` | int | `24` | Bu turdagi vagonlardagi jami bo'sh joy |

### 3.3 Vagon turi nomenklaturasi

API ba'zan transliteratsiya, ba'zan kirill qaytaradi. Normalize qilish kerak ([src/checker.py:11-24](../src/checker.py)):

```python
CAR_TYPE_MAP = {
    "plaskartli": "плацкарта",
    "плацкартный": "плацкарта",
    "плацкарта": "плацкарта",
    "kupe": "купе",
    "купе": "купе",
    "lyuks": "люкс",
    "люкс": "люкс",
    "sv": "св",
    "св": "св",
    "sidyachiy": "сидячий",
    "сидячий": "сидячий",
}

def normalize_car_type(raw: str) -> str:
    return CAR_TYPE_MAP.get(raw.strip().lower(), raw.strip().lower())
```

---

## 4. Endpoint #2 — Poyezd tafsilotlari

**Vazifasi:** Berilgan poyezd uchun har bir vagon raqami va har bir vagondagi aniq bo'sh joy raqamlari.

```
POST /api/v1/handbook/trains
Headers: authenticated headers
Body:
{
  "depDate": "2026-04-24",
  "depStationCode": "2900000",
  "arvStationCode": "2900790",
  "trainNumber": "076Ж",
  "trainId": "1234abcd-..."
}
```

### 4.1 Response shape

```json
{
  "data": {
    "train": {
      "carGroup": [
        {
          "typeShow": "плацкарта",
          "type": "plaskartli",
          "cars": [
            {
              "number": "21",
              "places": [38, 44]
            },
            {
              "number": "22",
              "places": [22, 40, 44, 48, 54]
            }
          ]
        },
        {
          "typeShow": "купе",
          "type": "kupe",
          "cars": [
            {"number": "10", "places": [3, 7, 11]}
          ]
        }
      ]
    }
  }
}
```

### 4.2 Ishlatilayotgan fieldlar

| Path | Tip | Izoh |
|------|-----|------|
| `data.train.carGroup[]` | array | Vagon turlari bo'yicha guruhlar |
| `[].typeShow` | string | Display nom (afzal, normalize qilinadi) |
| `[].type` | string | Fallback (typeShow yo'q bo'lsa) |
| `[].cars[]` | array | Shu turdagi vagonlar |
| `[].cars[].number` | string | Vagon raqami |
| `[].cars[].places` | int[] | Bo'sh joy raqamlari ro'yxati |

> `len(places)` = `freeSeats` (list endpoint dagi `cars[].freeSeats` bilan mos).

### 4.3 Berth (joy turi) ajratish

**Faqat плацкарта va купе uchun:**
- **Toq** raqam = **pastki** joy (oson chiqish, kichikroq bagaj)
- **Juft** raqam = **tepa** joy

Mantiq ([src/notifier.py:88-94](../src/notifier.py)):

```python
def split_berths(places: list[int]) -> tuple[list[int], list[int]]:
    lower = sorted(p for p in places if p % 2 == 1)
    upper = sorted(p for p in places if p % 2 == 0)
    return lower, upper
```

Boshqa vagon turlari (люкс, св, сидячий) uchun bu farq mantiqsiz — places sifatida har bir joy raqami ko'rsatiladi.

---

## 5. Stantsiya kodlari

API stantsiyalarni 7 raqamli kodlar orqali qabul qiladi. Asosiy O'zbekiston stantsiyalari ([src/bot.py:32-46](../src/bot.py)):

| Kod | Stantsiya |
|-----|-----------|
| `2900000` | Toshkent |
| `2900001` | Toshkent-Pass. |
| `2900680` | Samarqand |
| `2900700` | Buxoro |
| `2900790` | Urganch |
| `2900800` | Xiva |
| `2900720` | Navoiy |
| `2900750` | Qarshi |
| `2900760` | Termiz |
| `2900770` | Qo'qon |
| `2900780` | Andijon |
| `2900730` | Nukus |
| `2900740` | Farg'ona |

Qo'shimcha kodlar eticket.railway.uz da F12 → Network → "city autocomplete" so'rovidan topiladi.

Yangi tizimda bu jadval `stations` DB jadvaliga seed qilinadi va kerak bo'lsa kengaytiriladi.

---

## 6. Backend client implementatsiyasi

`backend/app/railway/client.py` quyidagi interfeysni ekspozitsiya qiladi:

```python
class RailwayClient:
    def __init__(self, db: AsyncDB):
        self._db = db
        self._lock = asyncio.Lock()
        self._http = httpx.AsyncClient(headers=COMMON_HEADERS, timeout=20)

    async def list_trains(
        self,
        dep_code: str,
        arr_code: str,
        date: str,  # "YYYY-MM-DD"
    ) -> list[TrainSummary]: ...

    async def get_train_detail(
        self,
        dep_code: str,
        arr_code: str,
        date: str,
        train_number: str,
        train_id: str | None,
    ) -> list[CarDetail]: ...

    async def _ensure_auth(self) -> dict:
        """Returns auth headers, refreshing token if needed (mutex'd)."""
        ...
```

`_ensure_auth` ichida:
1. `railway_credentials` jadvalidan token o'qiladi.
2. Agar `exp - 60s` o'tgan bo'lsa — `self._lock` ostida re-login (Step 1+2).
3. Yangi token DB ga yoziladi.
4. Headers qaytariladi.

---

## 7. Rate limiting va anti-ban

railway.uz konkret rate-limit chegarasini e'lon qilmagan, lekin amaliyot:

- **≤ 1 so'rov/sekundga** — xavfsiz zona
- **2 so'rov/sekundga** — vaqti-vaqti bilan 429 keladi
- **5+ so'rov/sekundga** — vaqtinchalik ban xavfi

**Watcher strategiyasi:**
- Global token bucket: 1 token/s, max 5 token.
- Har bir so'rov oldidan `await bucket.acquire()`.
- 429 kelganda backoff + `cooldown_until = now() + 5min` (DB ga).
- Worker `cooldown_until > now()` bo'lsa — cycle skip.
- Detail so'rovlar orasida `asyncio.sleep(1)` jitter.

Tafsilot: [08-worker-notifier.md](08-worker-notifier.md).

---

## 8. Test fixturalari

Test qilish uchun real response namunalari `data/debug/` ga saqlanadi. `src/debug_api.py` orqali generatsiya qilinadi:

```bash
python src/debug_api.py
# Saves: data/debug/YYYYMMDD_HHMMSS_trains_list_*.json
#        data/debug/YYYYMMDD_HHMMSS_train_detail_*.json
```

Unit testlarda bu JSON fayllar fixture sifatida ishlatiladi (railway.uz ga real so'rov yubormasdan).

---

## 9. Ma'lum cheklovlar va xavflar

| Xavf | Sabab | Yumshatish |
|------|-------|-----------|
| API sxema o'zgarishi | Rasmiy hujjat yo'q | Kunlik smoke test (debug_api.py kabi) |
| IP ban | Ko'p so'rov | Rate limit + birdan ortiq IP rotation (kelajakda) |
| Hisob bloklanishi | Bot detection | Headers maksimal brauzerga o'xshatib, jitter |
| Captcha qo'shilishi | Anti-bot | Plan B: foydalanuvchi o'z hisobini ulashi (kelajak feature) |
| Login uzilishi | Hisob parol o'zgartirilgan | Adminga Telegram orqali alert (`010-observability.md`) |

---

## 10. Bog'liq hujjatlar

- Watcher cycle: [08-worker-notifier.md](08-worker-notifier.md)
- `railway_credentials` jadvali: [03-database-schema.md](03-database-schema.md)
- Observability va alertlar: [10-observability.md](10-observability.md)
