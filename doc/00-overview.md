# 00 — Mahsulot Umumiy Ko'rinishi (Overview)

> **Status:** Draft v1 · **Oxirgi tahrir:** 2026-05-18

Bu hujjat boshqa barcha hujjatlarning kirish nuqtasi. Loyihaga yangi qo'shilgan dasturchi shu hujjatdan boshlab o'qiganida, qolgan 11 ta hujjatga to'g'ri yo'naltirilgan bo'ladi.

---

## 1. Mahsulot vizyoni

**Bir jumla bilan:** O'zbekiston temir yo'l (eticket.railway.uz) chiptalarini avtomatik kuzatib, bo'sh joy paydo bo'lganda Telegram orqali real-time xabar beruvchi servis.

**Foydalanuvchi kerakli holatlar (use cases):**

1. **"Bayram oldidan chipta yo'q"** — Navro'z/Hayit/ta'til mavsumida chiptalar bir-ikki daqiqada sotilib ketadi. Foydalanuvchi qo'lda har 5 daqiqada saytni yangilab o'tirolmaydi.
2. **"Reja oldindan, chipta hali sotilmagan"** — chiptalar 60 kun oldin sotuvga qo'yiladi. Foydalanuvchi sotuv ochilishini sabr bilan kutmaslik istaydi.
3. **"Qaytarib topshirilgan chipta"** — kimdir chiptasini qaytaradi, bir necha soniya ichida boshqa odam oladi. Bizning bot bu joy paydo bo'lganda darhol xabar beradi.

**Nima qilmaydi (out of scope):**

- Chipta SOTIB OLMAYDI — faqat xabar beradi. Foydalanuvchi xabarni olganda o'zi eticket.railway.uz ga kirib sotib oladi.
- To'lov yoki bron qilish funksiyalari yo'q.
- Boshqa transport (avtobus, samolyot) qo'llab-quvvatlanmaydi.
- O'zbekistondan tashqari yo'nalishlar yo'q.

---

## 2. Foydalanuvchi turlari

| Imkoniyat | Free | Premium |
|-----------|------|---------|
| Aktiv notification | 1 ta | **3 ta** |
| Tekshirish chastotasi | har **30s** | har **10s** (3x tezroq) |
| Yangi funksiyalar | keyin | **dastlab** |
| Support | oddiy | yuqori |

**Premium tariflari** (Telegram Stars):

| Davomiylik | Narx | ⭐/kun |
|-----------|------|--------|
| 1 kun  | 15 ⭐  | 15.0 |
| 3 kun  | 40 ⭐  | 13.3 |
| 5 kun  | 65 ⭐  | 13.0 |
| 10 kun | 120 ⭐ | 12.0 |
| 30 kun | 300 ⭐ | 10.0 (💎 eng tejamli) |

**Donate** — Premium emas, faqat bot'ni qo'llab-quvvatlash (25/50/100/500 ⭐ yoki custom). Tafsilot [07-payments.md](07-payments.md).

**Tier o'tish qoidalari:**

- Free → Premium: Telegram Stars to'lovi muvaffaqiyatli o'tganda, `users.tier = 'premium'` va `users.premium_until` o'rnatiladi.
- Premium → Free: `premium_until` o'tganda kunlik cron orqali avtomatik. Eski subscription'lar **o'chirilmaydi** (`is_active` qoladi), faqat yangi subscription qo'shish bloklanadi.

---

## 3. Foydalanuvchi yo'li (User Journey)

```
1. Foydalanuvchi botni topadi (@TicketDetectorBot)
2. /start bosadi
3. Bot salomlashadi va "🎫 Notification yaratish" tugmasini ko'rsatadi (Mini App tugmasi)
4. Foydalanuvchi tugmani bosadi → Mini App ochiladi (Telegram ichida WebView)
5. Mini App da:
   a. Qayerdan? (station autocomplete)
   b. Qayerga? (station autocomplete)
   c. Qachon? (sana picker)
   d. Qaysi poyezd? (mavjud poyezdlar ro'yxati — backend railway.uz ga so'rov yuboradi)
   e. Vagon turi? (плацкарта/купе/люкс/св/сидячий)
   f. Berth tanlovi (плацкарта/купе bo'lsa: pastki / tepa / farqi yo'q)
   g. Saqlash
6. Bot tasdiq xabarini yuboradi
7. Watcher har 60s da railway.uz ni tekshiradi
8. Bo'sh joy topilsa — bot foydalanuvchiga rich notification yuboradi (poyezd raqami, vagon, joy raqamlari)
9. Foydalanuvchi xabardagi havola orqali eticket.railway.uz ga o'tib sotib oladi
10. Snapshot o'zgarmasa, qayta xabar yuborilmaydi; o'zgarsa — yana xabar
```

---

## 4. Asosiy texnik qarorlar (qisqacha)

| Qaror | Tanlov | Sabab |
|-------|--------|-------|
| Backend tili | Python 3.11+ | Mavjud `auth.py`/`checker.py` ni qayta foydalanish; railway.uz API logikasi allaqachon Python da |
| Backend framework | FastAPI | Async, OpenAPI auto-gen, Pydantic validatsiya |
| Telegram bot | aiogram 3.x | Zamonaviy async API, FSM, Mini App integratsiyasi |
| DB | Postgres 15+ | Multi-user, durable, JSONB for snapshots, partial indexes |
| Frontend | React + Vite + **@telegram-apps/telegram-ui** | Native Telegram look (iOS HIG va Material Design avto-switching), `usePlatform` orqali |
| Repo | Monorepo (`backend/`, `bot/`, `mini-app/`) | Boshlanish uchun oson, har bir xizmat o'z Dockerfile bilan |
| Deploy | Docker Compose, shaxsiy VPS | Tejamli, oddiy operatsiya |
| Railway.uz auth | Bitta umumiy hisob | Foydalanuvchilar railway.uz da ro'yxatdan o'tmaydi; biz proxy qilamiz |

---

## 5. Terminlar lug'ati

| Termin | Ta'rif |
|--------|--------|
| **eticket.railway.uz** | O'zbekiston temir yo'l rasmiy chipta sotish sayti. Bizning ma'lumot manbamiz. |
| **railway.uz API** | O'sha saytning ichki JSON API (rasmiy hujjatlanmagan, F12 Network orqali aniqlangan) |
| **Notification / Subscription** | Foydalanuvchining "shu marshrut, shu sana, shu poyezdda joy topilsa xabar ber" qoidasi |
| **Slot** | Foydalanuvchining bitta aktiv subscription ushlab turish huquqi (free=1, premium=3) |
| **Watcher / Worker** | Backend ning fonida ishlovchi process — railway.uz ni davriy so'rovlar bilan tekshiradi |
| **Watch group** | Distinct `(dep, arr, date)` kombinatsiya — bir nechta subscription bitta watch group ga tegishli bo'lishi mumkin (dedup uchun) |
| **Berth (joy turi)** | Plaskart/Kupe vagonlarida pastki (toq raqam) yoki tepa (juft raqam) joy |
| **Snapshot** | Aniq vaqtda railway.uz dan olingan vagon-joy holati (`{vagon_21: [38,44]}` kabi) |
| **Snapshot hash** | Snapshot ning SHA256 ning birinchi 8 belgisi — dedup kalit |
| **TG Stars / ⭐** | Telegram ning ichki to'lov valyutasi (1 ⭐ ≈ $0.013) |
| **initData** | Telegram Mini App ochilganda foydalanuvchini autentifikatsiya qilish uchun beriladigan signed payload |
| **Tier** | Foydalanuvchi sathi — `free` yoki `premium` |

---

## 6. Hujjatlarga yo'naltirgich

| Savol | Hujjat |
|-------|--------|
| Tizim qanday ishlaydi (umuman)? | [01-architecture.md](01-architecture.md) |
| railway.uz API qanday chaqiriladi? | [02-railway-api.md](02-railway-api.md) |
| DB tuzilmasi qanday? | [03-database-schema.md](03-database-schema.md) |
| Backend qaysi endpointlarni beradi? | [04-backend-api.md](04-backend-api.md) |
| Bot qanday buyruqlarni qabul qiladi? | [05-bot-spec.md](05-bot-spec.md) |
| Mini App da nima ko'rinadi? | [06-mini-app-spec.md](06-mini-app-spec.md) |
| Premium qanday sotib olinadi? | [07-payments.md](07-payments.md) |
| Bo'sh joyni qanday topadi? | [08-worker-notifier.md](08-worker-notifier.md) |
| Qanday deploy qilinadi? | [09-deployment.md](09-deployment.md) |
| Loglar va monitoring? | [10-observability.md](10-observability.md) |
| Qadamma-qadam reja? | [11-roadmap.md](11-roadmap.md) |

---

## 7. Loyihaning hozirgi holati

Joriy `dev-tg` branch da eski (bir foydalanuvchili) `src/` mavjud:

- [src/auth.py](../src/auth.py) — railway.uz login (port qilinadi)
- [src/checker.py](../src/checker.py) — API so'rov logikasi (port qilinadi)
- [src/notifier.py](../src/notifier.py) — Telegram xabar formati (qisman port)
- [src/bot.py](../src/bot.py) — eski personal bot (o'chiriladi)
- [src/state.py](../src/state.py), `runtime.py`, `eventlog.py`, `main.py` — o'chiriladi (DB ga ko'chiriladi)

Ushbu docs yozilgandan keyin keyingi qadamlar:

1. `dev-tg` branch da eski `src/` ni tozalash
2. Yangi `backend/`, `bot/`, `mini-app/` skeletini scaffoldlash
3. M1 milestone'dan boshlab implementatsiya ([11-roadmap.md](11-roadmap.md))

---

## 8. Muvaffaqiyat mezonlari (Success criteria — MVP)

MVP "tayyor" deyiladi qachonki:

1. ✅ Yangi foydalanuvchi botga kirib, Mini App orqali 1 ta notification yaratadi
2. ✅ Watcher har 60s ichida railway.uz ga so'rov yuboradi
3. ✅ Bo'sh joy topilganda 10 soniya ichida foydalanuvchiga xabar yetadi
4. ✅ Premium Stars to'lovi muvaffaqiyatli o'tadi va slot 3 ga ko'tariladi
5. ✅ 100+ aktiv subscription bilan railway.uz ga 429 yoki ban kelmaydi (rate-limit dedup ishlaydi)
6. ✅ Bot 24 soat to'xtamasdan ishlaydi (healthcheck yashil)
