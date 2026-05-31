# 05 — Telegram Bot Spetsifikatsiyasi

> **Status:** Draft v1 · **Oxirgi tahrir:** 2026-05-18
> **Framework:** aiogram 3.x · **Mode:** Webhook (prod), polling (dev)

Bot oddiy "entry-point" — barcha murakkab konfiguratsiyalar Mini App da. Bot vazifasi: salomlashish, Mini App ochish, Stars to'lov, va notification yetkazib berish.

---

## 1. Bot kimligi

| Atribut | Qiymat |
|---------|--------|
| Bot username | `@TicketDetectorBot` (planning) |
| Display name | "🎫 Ticket Detector" |
| Description (short) | "O'zbekiston temir yo'l chiptasi paydo bo'lganda darhol xabar beradi" |
| Tillar | uz (default), ru, en |
| Privacy mode | Public (hamma kira oladi, allow-list yo'q) |

---

## 2. Bot Father sozlamalari (bir martalik)

`@BotFather` orqali:

1. `/setdescription` — qisqa description.
2. `/setabouttext` — about text.
3. `/setuserpic` — logo.
4. `/setcommands` — quyidagi commandlar ([3.1](#31-buyruqlar)).
5. `/newapp` — Mini App ro'yxatdan o'tkazish (URL: `https://app.tdbot.example`).
6. Payment Stars — avtomatik aktiv (alohida `/setpayment` shart emas Stars uchun).

---

## 3. Foydalanuvchi interfeysi

### 3.1 Buyruqlar

`/setcommands` da:

```
start - Botni ishga tushirish
search - Poyezd qidirish (Mini App)
my - Mening xabarnomalarim
premium - Premium obuna
donate - Loyihani qo'llab-quvvatlash
help - Yordam
contact - Aloqa
```

> Asosiy interaktsiya **Mini App** orqali, lekin har bir buyruq ham mustaqil ishlaydi.

### 3.2 Asosiy menyu (Reply Keyboard — pastki tugmalar)

`/start` bosilganda foydalanuvchi pastki kirish maydoni ustida doimiy tugmalar to'plamini ko'radi. Bu reply keyboard (inline emas) — har doim turadi:

```
┌──────────────────────────────────────┐
│  🔍 Poyezd qidirish │ 🔔 Xabarnomalar │
├─────────────────────┼─────────────────┤
│  ⭐ Premium         │ ❤️ Donate       │
├─────────────────────┼─────────────────┤
│  ℹ️ Yordam          │ 📞 Aloqa        │
└──────────────────────────────────────┘
```

aiogram bilan:
```python
keyboard = ReplyKeyboardMarkup(
    keyboard=[
        [KeyboardButton(text="🔍 Poyezd qidirish"),
         KeyboardButton(text="🔔 Xabarnomalar")],
        [KeyboardButton(text="⭐ Premium"),
         KeyboardButton(text="❤️ Donate")],
        [KeyboardButton(text="ℹ️ Yordam"),
         KeyboardButton(text="📞 Aloqa")],
    ],
    resize_keyboard=True,
    is_persistent=True,
)
```

**"🔍 Poyezd qidirish" → Mini App ochadi.** Reply keyboard'da `web_app` field ham bor:
```python
KeyboardButton(text="🔍 Poyezd qidirish", web_app=WebAppInfo(url="https://app.tdbot.example/"))
```

---

## 4. Conversation flowlar

### 4.1 `/start`

```
User: /start
Bot:  👋 Assalomu alaykum, {first_name}!

      Men eticket.railway.uz da poyezd chiptasi bo'sh joy paydo bo'lganda
      sizga darhol xabar beraman.

      Boshlash uchun pastdagi tugmani bosing 👇

      [🎫 Notification yaratish]    (Mini App tugma)
      [📋 Mening notif.] [⭐ Premium]
```

Internal: `POST /internal/v1/users/upsert` chaqiriladi.

### 4.2 `/my` yoki "🔔 Xabarnomalar"

```
User: 🔔 Xabarnomalar
Bot:  🔔 Sizning xabarnomalaringiz (1/1):

      1. 🚂 Toshkent → Urganch
         📅 2026-04-24
         🚆 Poyezd: 076Ж
         🪑 плацкарта · pastki
         🟢 Aktiv

      Tahrirlash uchun Mini App ni oching:

      [🔍 Poyezd qidirish]   ← Mini App tugmasi
      [⭐ Premium oling — 3 ta slot]   ← slot to'lganda
```

Internal: `GET /api/v1/subscriptions` orqali ma'lumot olinadi.

### 4.3 `/premium` yoki "⭐ Premium" tap

```
User: ⭐ Premium
Bot:  ⚡ <b>Premium obuna afzalliklari:</b>

      ✅ Har 10 sekundda tekshirish (oddiy: 30 sekund)
      ✅ 3 tagacha faol xabarnoma (oddiy: faqat 1 ta)
      ✅ Yangi funksiyalarga dastlab kirish
      ✅ Boshqalardan 3 baravar tezroq bilet topish

      <b>Premium obuna narxlari:</b>

      [⭐ 1 kun  - 15 Stars]
      [⭐ 3 kun  - 40 Stars]
      [⭐ 5 kun  - 65 Stars]
      [⭐ 10 kun - 120 Stars]
      [⭐ 30 kun - 300 Stars]
      [❌ Bekor qilish]
```

5 ta inline tugma — har bir plan uchun. Tugma bosilganda → backend `/api/v1/payments/invoice?plan=premium_Xd` → invoice link → Stars dialog.

```python
@router.message(F.text == "⭐ Premium")
@router.message(Command("premium"))
async def cmd_premium(msg, backend):
    user = await get_user(msg.from_user.id)
    text = render_premium_intro(lang=user.lang, current_tier=user.tier)

    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="⭐ 1 kun  - 15 Stars",  callback_data="pay_premium:premium_1d")],
        [InlineKeyboardButton(text="⭐ 3 kun  - 40 Stars",  callback_data="pay_premium:premium_3d")],
        [InlineKeyboardButton(text="⭐ 5 kun  - 65 Stars",  callback_data="pay_premium:premium_5d")],
        [InlineKeyboardButton(text="⭐ 10 kun - 120 Stars", callback_data="pay_premium:premium_10d")],
        [InlineKeyboardButton(text="⭐ 30 kun - 300 Stars", callback_data="pay_premium:premium_30d")],
        [InlineKeyboardButton(text="❌ Bekor qilish", callback_data="cancel")],
    ])
    await msg.answer(text, reply_markup=kb, parse_mode="HTML")
```

To'lov flow tafsiloti [07-payments.md](07-payments.md).

### 4.4 `/donate` yoki "❤️ Donate"

```
User: ❤️ Donate
Bot:  💝 <b>Botni qo'llab-quvvatlash</b>

      Sizning yordamingiz botning rivojlanishi va serverlar
      uchun ishlatiladi. Premium status bermaydi, lekin
      sizdan minnatdorman 🙏

      [☕ 25 ⭐ — Kichik rahmat]
      [🍪 50 ⭐ — O'rtacha rahmat]
      [🍰 100 ⭐ — Katta rahmat]
      [🎁 500 ⭐ — Generous]
      [✏️ Boshqa miqdor]   ← Mini App ochadi /donate-custom screen
      [❌ Bekor qilish]
```

Tugma bosilganda — invoice ochiladi (plan_id `donate_*`). Tafsilot [07-payments.md#4-donate](07-payments.md#4-donate-qollab-quvvatlash).

### 4.5 `/help` yoki "ℹ️ Yordam"

```
User: ℹ️ Yordam
Bot:  ℹ️ <b>Yordam</b>

      🔍 <b>Poyezd qidirish</b> — Mini App orqali marshrut, sana,
         poyezd, vagon turi va joy turini tanlang. Bo'sh joy
         paydo bo'lganda darhol xabar olasiz.

      🔔 <b>Xabarnomalar</b> — aktiv qidiruvlaringiz ro'yxati.

      ⭐ <b>Premium</b> — 3 ta xabarnoma + 3x tezroq tekshirish.

      ❤️ <b>Donate</b> — botni qo'llab-quvvatlash.

      📞 <b>Aloqa</b> — savol yoki muammo bo'lsa.

      Mini App: ushbu chat'ning kirish maydoni ustidagi
      tugma orqali ochiladi.
```

### 4.6 `/contact` yoki "📞 Aloqa"

```
User: 📞 Aloqa
Bot:  📞 <b>Aloqa</b>

      Texnik yordam: @TicketDetectorSupport
      Telegram kanal: @TicketTips
      Email: support@tdbot.example

      Yoki shu chat'ga xabar yozing — admin 24 soat ichida
      javob beradi.

      🌐 [Tilni o'zgartirish]   ← inline tugma
```

Inline tugma → `/language` flow ochiladi:

### 4.7 `/language`

```
User: /language
Bot:  🌐 Tilni tanlang:
      [🇺🇿 O'zbek]  [🇷🇺 Русский]  [🇬🇧 English]
```

Tanlanganda `PATCH users.lang`, bot va Mini App keyingi safar shu tilda chiqadi.

> MVP da admin xabarlari forwarding qilinmaydi — support chat URL beriladi.

### 4.8 Free text / unknown command

```
User: salom
Bot:  👋 Salom! Pastdagi tugmalardan foydalaning.
      (Reply keyboard har doim ko'rinadi)

User: /unknown
Bot:  🤔 Bu buyruq mavjud emas. ℹ️ Yordam yoki menyudan tanlang.
```

### 4.8 Notification yetkazib berish (worker → bot)

Worker bo'sh joy topganda quyidagi xabar yuboriladi:

```
🚂 <b>Chipta topildi!</b>
📍 Marshrut: <b>Toshkent → Urganch</b>
📅 Sana: <b>2026-04-24</b>

• <b>076Ж</b> (Yo'lovchi)
  🕐 16:05 → 05:23 (13:18)
  💺 Jami: <b>24 ta</b>

  🪑 <b>плацкарта</b>:
     Vagon 21 (2 ta):
        ⬇️ pastki (1): 21
        ⬆️ tepa   (1): 40
     Vagon 22 (5 ta):
        ⬇️ pastki (3): 23, 25, 27
        ⬆️ tepa   (2): 22, 24

🔗 <a href="https://eticket.railway.uz/uz/home">Bilet olish</a>

[🔇 Bu notif uchun 10 daqiqa jim] [❌ O'chirish]
```

Inline tugmalar:
- `🔇 Mute 10 min` — `callback_data: mute_sub:{sub_id}:600`
- `❌ O'chirish` — `callback_data: del_sub:{sub_id}` (confirm yo'q, eski sub yangi qo'shish mumkin)

---

## 5. Callback handlerlar

| Callback | Vazifa |
|----------|--------|
| `mute_sub:{id}:{sec}` | `subscriptions.muted_until` yangilash; worker shu davrda skip |
| `del_sub:{id}` | `DELETE /api/v1/subscriptions/{id}` |
| `lang:{uz\|ru\|en}` | Foydalanuvchi tilini yangilash |
| `pay_premium:{plan_id}` | `GET /api/v1/payments/invoice?plan=premium_*` → invoice link → openInvoice |
| `pay_donate:{plan_id}` | `GET /api/v1/payments/invoice?plan=donate_*` → invoice link |
| `cancel` | Joriy inline xabarni o'chirish (premium/donate kataloglari bekor qilinganda) |

---

## 6. FSM (Stars to'lov flow)

aiogram FSM faqat to'lov uchun. Mini App ish jarayonida bot FSM ishlatmaydi.

```python
class PremiumFlow(StatesGroup):
    waiting_payment = State()

@router.message(Command("premium"))
async def cmd_premium(msg, state):
    await state.set_state(PremiumFlow.waiting_payment)
    # send invoice
```

To'lov tugagandan keyin `state.clear()`.

---

## 7. Webhook handler

FastAPI backend `POST /webhooks/telegram` ni qabul qiladi va aiogram dispatcher ga uzatadi:

```python
@app.post("/webhooks/telegram")
async def telegram_webhook(request: Request):
    secret = request.headers.get("X-Telegram-Bot-Api-Secret-Token")
    if secret != settings.WEBHOOK_SECRET:
        raise HTTPException(403)
    update = Update.model_validate(await request.json())
    await dispatcher.feed_update(bot, update)
    return {"ok": True}
```

---

## 8. i18n

Hamma matn `bot/locales/{lang}.toml`:

```toml
[start]
greeting = "👋 Assalomu alaykum, {name}!"
intro    = "Men eticket.railway.uz da poyezd chiptasi bo'sh joy..."

[menu]
notification = "🎫 Notification yaratish"
my_subs      = "📋 Mening notif."
premium      = "⭐ Premium"
help         = "❓ Yordam"
language     = "🌐 Til"

[my]
title      = "📋 Sizning notificationlaringiz ({used}/{max}):"
empty      = "📭 Hozircha notification yo'q. Pastdagi tugma orqali yarating."
```

`bot/i18n.py` da `t(key, lang, **kwargs)` helper.

---

## 9. Error handling

| Holat | Bot harakati |
|-------|--------------|
| Backend `503` | "⚠️ Servis vaqtincha mavjud emas. Bir oz keyin urinib ko'ring." |
| Backend `429` | "⏱ Juda ko'p so'rov yuborildi. 1 daqiqadan keyin urinib ko'ring." |
| Backend timeout | Retry 2 marta, keyin xato xabari |
| Internal exception | Adminga `/internal/v1/events` orqali log + foydalanuvchiga generic xato xabari |
| Stars to'lov fail (precheck) | "❌ To'lovni qayta ishlab bo'lmadi. Yana urinib ko'ring." |

---

## 10. Rate limiting (bot tarafda)

Foydalanuvchi tomonidan flood (15 sekundda 10+ xabar) — aiogram `ThrottlingMiddleware`:

```python
dp.message.middleware(ThrottlingMiddleware(rate_limit=1.5))
```

> Spammer ban — `users.is_banned = true`, keyingi xabarlarda silent skip.

---

## 11. Bot deployment

**Production:** webhook rejimi (FastAPI orqali).

Webhook setup (bir martalik):
```bash
curl -X POST "https://api.telegram.org/bot{TOKEN}/setWebhook" \
  -d "url=https://api.tdbot.example/webhooks/telegram" \
  -d "secret_token=$WEBHOOK_SECRET" \
  -d "allowed_updates=[\"message\",\"callback_query\",\"pre_checkout_query\"]"
```

**Development:** polling rejimi.
```python
if settings.MODE == "dev":
    asyncio.run(dp.start_polling(bot))
```

---

## 12. Test (manual)

| Test | Kutilgan natija |
|------|-----------------|
| `/start` yangi user | "Assalomu alaykum" + Mini App tugmasi, DB da user yaratilgan |
| `/start` mavjud user | Salomlashish, `last_seen_at` yangilangan |
| `/my` (sub yo'q) | "Hozircha notification yo'q" |
| `/my` (sub bor) | Sub'lar ro'yxati |
| Mini App ochish | Foydalanuvchi initData orqali tasdiqlangan |
| `/premium` → tap → invoice | Stars dialog ochiladi |
| To'lov o'tdi | `tier='premium'`, slot 3 ga ko'tariladi, tabrik xabari |
| Notification xabari | HTML formatda, tugmalar ishlaydi |
| `🔇 Mute` callback | Sub muted_until set, worker skip qiladi |

---

## 13. Bog'liq hujjatlar

- Backend endpoints: [04-backend-api.md](04-backend-api.md)
- Mini App: [06-mini-app-spec.md](06-mini-app-spec.md)
- To'lov: [07-payments.md](07-payments.md)
- Worker xabar formati: [08-worker-notifier.md](08-worker-notifier.md)
- Notif formati (eski kod): [src/notifier.py](../src/notifier.py)
