# 07 — To'lovlar (Telegram Stars)

> **Status:** Draft v2 · **Oxirgi tahrir:** 2026-05-18
> **Tariflar tasdiqlandi.** Mavjud bot tahlilidan olingan benchmark.

Premium tier va Donate funksiyasi Telegram Stars (XTR) orqali. Tashqi to'lov tizimi (Stripe, click va h.k.) yo'q.

---

## 1. Telegram Stars haqida

| Atribut | Qiymat |
|---------|--------|
| Valyuta kodi | `XTR` |
| 1 ⭐ taxminiy | ~$0.013 (Telegram'ning ichki narxi) |
| Foydalanuvchi qaerdan oladi | Telegram ichida (Apple Pay / Google Pay / kartochka) |
| Tarmoq | Faqat Telegram ichida |
| Bot uchun komissiya | 0% |
| Refund | Bot orqali `refundStarPayment` API (90 kun ichida) |
| Cheklov | Bir to'lov: 1-10000 ⭐ |
| Hujjat | https://core.telegram.org/bots/payments-stars |

---

## 2. Premium afzalliklari

Free vs Premium:

| Imkoniyat | Free | Premium |
|-----------|------|---------|
| Aktiv notification soni | **1 ta** | **3 ta** |
| Tekshirish chastotasi | har **30 sekundda** | har **10 sekundda** |
| Yangi funksiyalarga kirish | keyin | **dastlab** |
| Boshqalardan tezroq topish | base | **3 baravar tezroq** |
| Support prioriteti | oddiy | yuqori |

> **3x tezroq topish** matematik isboti: free 30s cycle, premium 10s cycle. Bo'sh joy paydo bo'lganda premium o'rtacha 5s da topadi (10/2), free 15s da (30/2). Ya'ni premium taxminan 3 baravar oldin xabar oladi.

---

## 3. Tarif rejalari

Foydalanuvchi 5 ta plandan birini tanlaydi:

| Plan ID | Davomiylik | Narx ⭐ | ⭐/kun | Taxminiy USD | Tavsiya |
|---------|-----------|--------|--------|--------------|---------|
| `premium_1d`   | 1 kun   | 20  ⭐ | 20.0 | ~$0.26 | Test uchun |
| `premium_3d`   | 3 kun   | 50  ⭐ | 16.7 | ~$0.65 | Qisqa safar |
| `premium_5d`   | 5 kun   | 80  ⭐ | 16.0 | ~$1.05 | Hafta oxiri |
| `premium_10d`  | 10 kun  | 150 ⭐ | 15.0 | ~$1.95 | Standard |
| `premium_30d`  | 30 kun  | 350 ⭐ | 11.7 | ~$4.55 | 💎 Eng tejamli |

**Narx logikasi:** uzunroq plan = arzonroq kun/⭐. 30 kun planda 1 kun planga nisbatan ~42% tejash.

```python
# backend/app/services/plans.py
PLANS = {
    "premium_1d":  {"stars": 20,  "days": 1,  "label_uz": "1 kun",  "label_ru": "1 день",   "label_en": "1 day"},
    "premium_3d":  {"stars": 50,  "days": 3,  "label_uz": "3 kun",  "label_ru": "3 дня",    "label_en": "3 days"},
    "premium_5d":  {"stars": 80,  "days": 5,  "label_uz": "5 kun",  "label_ru": "5 дней",   "label_en": "5 days"},
    "premium_10d": {"stars": 150, "days": 10, "label_uz": "10 kun", "label_ru": "10 дней",  "label_en": "10 days"},
    "premium_30d": {"stars": 350, "days": 30, "label_uz": "30 kun", "label_ru": "30 дней",  "label_en": "30 days", "badge": "💎"},
}
```

---

## 4. Donate (qo'llab-quvvatlash)

Foydalanuvchi Premium olmasdan ham bot loyihasini qo'llab-quvvatlashi mumkin. Donate'lar:
- Premium status bermaydi
- Slot kengaytmaydi
- Faqat ramziy "spasibo"
- DB ga yoziladi (transparency va analytics)

### Donate variantlari

| Donate ID | Stars |
|-----------|-------|
| `donate_25`  | 25 ⭐ |
| `donate_50`  | 50 ⭐ |
| `donate_100` | 100 ⭐ |
| `donate_500` | 500 ⭐ |
| `donate_custom` | foydalanuvchi yozadi (10-5000 ⭐ oraliq) |

```python
DONATE_OPTIONS = {
    "donate_25":  {"stars": 25,  "label": "☕ Kichik rahmat"},
    "donate_50":  {"stars": 50,  "label": "🍪 O'rtacha rahmat"},
    "donate_100": {"stars": 100, "label": "🍰 Katta rahmat"},
    "donate_500": {"stars": 500, "label": "🎁 Generous"},
}
```

Donate flow Premium bilan deyarli bir xil, lekin success handler `users` ni o'zgartirmaydi — faqat `payments` ga yozadi (`plan` `donate_*` bilan boshlanadi).

---

## 5. To'lov oqimi (Premium)

```
User                Mini App / Bot     Backend            TG Stars
 │ Premium tap       │                  │                  │
 │──────────────────►│                  │                  │
 │                   │ GET /api/v1/payments/invoice?plan=premium_30d
 │                   │─────────────────►│                  │
 │                   │                  │ createInvoiceLink(payload, prices)
 │                   │                  │──────────────────────────────────►│
 │                   │                  │◄──────────────────────────────────│
 │                   │◄─────────────────│ {invoice_link}   │                  │
 │                   │ openInvoice(link)│                  │                  │
 │ Stars UI ko'radi  │                  │                  │                  │
 │ Pay tap           │                  │                  │                  │
 │──────────────────────────────────────────────────────────────────────────►│
 │                   │                  │                  │ pre_checkout_query
 │                   │                  │ POST /internal/v1/payments/precheck
 │                   │                  │◄─────────────────│                  │
 │                   │                  │─────────────────►│                  │
 │                   │                  │                  │ answerPreCheckoutQuery(ok=true)
 │                   │                  │                  │────────────────►│
 │                   │                  │                  │ successful_payment
 │                   │                  │ POST /internal/v1/payments/successful
 │                   │                  │◄─────────────────│                  │
 │                   │                  │ UPDATE users tier=premium          │
 │                   │                  │ INSERT payments                    │
 │                   │                  │─────────────────►│                  │
 │                   │                  │                  │ sendMessage("Premium aktiv!")
 │ ✅ Premium!       │                  │                  │                  │
```

Donate flow xuddi shu, lekin success handler'da `tier` o'zgarmaydi.

---

## 6. Backend implementatsiyasi

### 6.1 Invoice yaratish (Premium yoki Donate)

```python
# backend/app/services/payments.py
async def create_invoice_link(user_id: int, plan_id: str) -> str:
    if plan_id.startswith("premium_"):
        plan = PLANS[plan_id]
        title = f"⭐ Premium — {plan['label_uz']}"
        description = (
            f"• 3 ta aktiv notification\n"
            f"• Har 10 sekundda tekshirish\n"
            f"• {plan['days']} kun davomida"
        )
        amount = plan["stars"]
    elif plan_id.startswith("donate_"):
        opt = DONATE_OPTIONS[plan_id]
        title = "💝 Botni qo'llab-quvvatlash"
        description = opt["label"]
        amount = opt["stars"]
    else:
        raise ValueError("Unknown plan")

    payload = f"{plan_id}:{user_id}"

    resp = await httpx.AsyncClient().post(
        f"https://api.telegram.org/bot{settings.BOT_TOKEN}/createInvoiceLink",
        json={
            "title": title,
            "description": description,
            "payload": payload,
            "currency": "XTR",
            "prices": [{"label": title, "amount": amount}],
        },
    )
    data = resp.json()
    if not data.get("ok"):
        raise PaymentError(data.get("description"))
    return data["result"]
```

### 6.2 Pre-checkout validatsiya

```python
@router.post("/internal/v1/payments/precheck")
async def precheck(req: PrecheckRequest):
    plan_id, user_id_str = req.invoice_payload.split(":")

    if plan_id.startswith("premium_"):
        plan = PLANS.get(plan_id)
        expected = plan["stars"] if plan else None
    elif plan_id.startswith("donate_"):
        opt = DONATE_OPTIONS.get(plan_id)
        expected = opt["stars"] if opt else None
    else:
        return {"ok": False, "error_message": "Plan topilmadi"}

    if expected is None:
        return {"ok": False, "error_message": "Plan noma'lum"}
    if expected != req.stars_amount:
        return {"ok": False, "error_message": "Narx mos kelmadi"}
    if int(user_id_str) != await get_user_id_by_tg(req.tg_user_id):
        return {"ok": False, "error_message": "Foydalanuvchi mos kelmadi"}

    return {"ok": True}
```

### 6.3 Successful payment

```python
@router.post("/internal/v1/payments/successful")
async def payment_success(req, db):
    plan_id, user_id_str = req.invoice_payload.split(":")
    user_id = int(user_id_str)

    async with db.transaction():
        # Idempotency
        existing = await db.fetch_one(
            "SELECT id FROM payments WHERE tg_payment_charge_id = $1",
            req.tg_payment_charge_id,
        )
        if existing:
            return {"already_processed": True, "payment_id": existing["id"]}

        if plan_id.startswith("premium_"):
            plan = PLANS[plan_id]
            user = await db.fetch_one("SELECT * FROM users WHERE id = $1", user_id)
            granted_from = max(datetime.now(UTC), user["premium_until"] or datetime.min)
            granted_until = granted_from + timedelta(days=plan["days"])

            payment_id = await db.fetch_val(
                """INSERT INTO payments
                   (user_id, tg_payment_charge_id, stars_amount, plan, granted_from, granted_until, raw)
                   VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id""",
                user_id, req.tg_payment_charge_id, req.stars_amount,
                plan_id, granted_from, granted_until, req.raw,
            )
            await db.execute(
                "UPDATE users SET tier='premium', premium_until=$1 WHERE id=$2",
                granted_until, user_id,
            )
            return {"type": "premium", "payment_id": payment_id,
                    "granted_until": granted_until, "plan": plan_id}

        elif plan_id.startswith("donate_"):
            payment_id = await db.fetch_val(
                """INSERT INTO payments
                   (user_id, tg_payment_charge_id, stars_amount, plan, granted_from, granted_until, raw)
                   VALUES ($1,$2,$3,$4,now(),now(),$5) RETURNING id""",
                user_id, req.tg_payment_charge_id, req.stars_amount, plan_id, req.raw,
            )
            return {"type": "donate", "payment_id": payment_id, "stars": req.stars_amount}
```

> **Eslatma:** Donate uchun `granted_from = granted_until = now()` — schema CHECK constraint'ni qondirish uchun (`granted_until > granted_from` cheklov donate uchun bekor qilinadi yoki `>=` ga o'zgartiriladi — [03-database-schema.md](03-database-schema.md) da yangilanadi).

---

## 7. Premium uzaytirish (stack)

Mavjud premium muddatida yangi plan sotib olinsa — yangi davr eski tugash vaqtidan boshlanadi:

```python
granted_from  = max(now, user.premium_until or now)
granted_until = granted_from + timedelta(days=plan.days)
```

**Misol:**
- Hozir: 2026-05-18, `premium_until = 2026-06-17` (30 kun qoldi)
- User 10d sotib oladi (150⭐)
- Yangi `premium_until = 2026-06-27`

---

## 8. Premium expire flow

Kunlik cron har soat 00:00 da:

```python
async def expire_premium():
    expired = await db.fetch(
        """UPDATE users SET tier = 'free'
           WHERE tier = 'premium' AND premium_until < now()
           RETURNING id, tg_user_id, lang"""
    )
    for user in expired:
        await send_telegram_message(
            user["tg_user_id"],
            t("payment.expired", lang=user["lang"]),
        )
        await event_log.insert("premium_expired", user_id=user["id"])
```

Yuboriladigan xabar:
```
⏰ Premium muddati tugadi

Aktiv notificationlaringiz ishlashda davom etadi, lekin yangisini
qo'sha olmaysiz (Free planda 1 ta slot).

Tekshirish chastotasi ham 10s dan 30s ga qaytarildi.

[⭐ Premium qayta sotib olish]
```

> **Muhim:** Mavjud aktiv subscription'lar **o'chirilmaydi**. Slot to'lgan bo'lsa, yangisini qo'shish bloklanadi, lekin eskilar ishlaydi.

---

## 9. Refund

90 kun ichida `refundStarPayment` API orqali:

```python
async def refund(tg_user_id: int, tg_payment_charge_id: str):
    resp = await tg_api.post("refundStarPayment", {
        "user_id": tg_user_id,
        "telegram_payment_charge_id": tg_payment_charge_id,
    })
    if resp["ok"]:
        # Premium bo'lsa — tier qaytariladi
        # Donate bo'lsa — payment yozuvi 'refunded' deb belgilanadi
        ...
```

MVP: faqat admin orqali manual.

---

## 10. Edge case'lar

| Senariy | Tizim harakati |
|---------|----------------|
| Pre-checkout 10s da javob yo'q | Telegram bekor qiladi |
| Backend down, successful_payment qabul qilindi | Telegram retry (60 min); `charge_id` UNIQUE idempotency |
| Premium muddatida 1d sotib olish | Stack: granted_until += 1 kun |
| Donate sotib olish premium paytida | Donate yoziladi, premium_until o'zgarmaydi |
| User 1d × 5 marta sotib oldi 1 kunda | Hammasi stack qilinadi: 5 kun premium |
| Stars yetishmaydi | Telegram UI'da blok, bot ga kelmaydi |

---

## 11. Audit (event_log)

| Event | Payload |
|-------|---------|
| `payment_intent` | `{plan_id, user_id}` |
| `payment_precheck_ok` | `{charge_id, amount, plan_id}` |
| `payment_precheck_fail` | `{reason, payload}` |
| `payment_premium_success` | `{payment_id, plan_id, stars, granted_until}` |
| `payment_donate_success` | `{payment_id, stars}` |
| `payment_refund` | `{payment_id, reason}` |
| `premium_expired` | `{user_id}` |

---

## 12. Test checklist

**Premium:**
- [ ] 1d, 3d, 5d, 10d, 30d har biri invoice ochiladi
- [ ] Stars UI to'g'ri summa ko'rsatadi
- [ ] Bekor qilish → hech narsa yozilmaydi
- [ ] Noto'g'ri amount → precheck fail
- [ ] Muvaffaqiyatli → tier='premium', granted_until to'g'ri, slot 3
- [ ] Uzaytirish stack: 30d + 10d → 40 kun premium
- [ ] Expire: cron tier='free' qiladi, xabar yuboradi
- [ ] Worker cadence yangilanadi (30s → 10s premium bo'lganda)

**Donate:**
- [ ] 25, 50, 100, 500 har biri ishlaydi
- [ ] Custom amount (faqat Mini App orqali) — 10-5000 oraliq validatsiya
- [ ] Donate o'tdi → payments da yozuv, lekin users.tier o'zgarmaydi
- [ ] Donate uchun rahmat xabari yuboriladi

---

## 13. Bog'liq hujjatlar

- `payments` jadval: [03-database-schema.md](03-database-schema.md#35-payments)
- API endpoints: [04-backend-api.md](04-backend-api.md)
- Bot handlerlar: [05-bot-spec.md](05-bot-spec.md)
- Mini App premium screen: [06-mini-app-spec.md](06-mini-app-spec.md)
- Worker per-tier cadence: [08-worker-notifier.md](08-worker-notifier.md)
- Telegram Stars: https://core.telegram.org/bots/payments-stars
