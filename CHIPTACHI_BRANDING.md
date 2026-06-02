# Chiptachi — Brending paketi

Bot: **@railwayuzz_bot** · Kanal: **t.me/railwayuzz**

Ranglar (DESIGN.md'dan):
- Coral / primary **#cc785c** · quyuq coral **#a9583e**
- Krem-kanvas **#faf9f5** · krem yuza **#f5f0e8 / #efe9de**
- Qora-siyoh **#141413** · quyuq yuza **#181715**
- Aksent: teal **#5db8a6** · amber **#e8a55a**

Uslub: iliq, "humanist editorial" (Anthropic uslubi) — krem kanvas, coral urg'u, qora yuzalar. Zamonaviy, minimal, premium.

---

## 1. Gemini uchun rasm promptlari

> Eslatma: bu promptlar hozirgi logodan (chipta + lupa) MUSTAQIL — yangi, zamonaviy
> dizayn. Faqat DESIGN.md'dagi rang va uslubdan foydalanadi. Har promptning oxirida aspect
> ratio bor. AI harflarni xato chizgani uchun "no text, no letters" yozilgan — matnni keyin
> o'zingiz qo'shganingiz xavfsizroq.

### 1.1 Bot avatar / app icon (1:1, aylana-crop'ga mos)

```
A sleek, modern app icon for a railway ticket-alert assistant, premium 2025 design language,
warm humanist editorial style (inspired by Anthropic / Claude branding — NOT generic AI blue).
Soft warm cream background (#faf9f5) with a barely-there grain. Centered: a single bold,
minimal geometric mark — a stylized high-speed train head or a clean abstract seat/berth glyph
formed from smooth rounded shapes in warm coral (#cc785c), with a deeper coral (#a9583e) for
soft depth and a subtle long shadow. One small accent spark / dot in teal (#5db8a6) or amber
(#e8a55a) hinting at a live notification. Lots of negative space, perfectly centered inside the
circular safe zone, balanced and iconic at small sizes. Flat-with-soft-gradient vector style,
crisp edges, high contrast, elegant. No text, no letters, no magnifying glass, no paper ticket.
1:1 square aspect ratio.
```

> Muqobil (qora) variant: fonni krem o'rniga quyuq **#181715** qiling, belgini coral
> **#cc785c** holda qoldiring — chuqurroq, "tungi" ko'rinish.

### 1.2 Kanal avatar (1:1, "real-time ogohlantirish" urg'usi)

```
A modern, minimal icon for a Telegram channel about train-ticket availability alerts, matching
a warm editorial brand. Soft cream background (#faf9f5). Centered: a clean abstract mark that
fuses a stylized rail/track or train silhouette with a notification pulse — concentric signal
rings radiating outward — built from smooth rounded geometry in warm coral (#cc785c) and deeper
coral (#a9583e). A single glowing accent dot in amber (#e8a55a) at the pulse origin. Premium
flat-with-soft-gradient vector look, generous negative space, centered within the circular safe
zone, iconic and legible when small. No text, no letters, no magnifying glass. 1:1 square.
```

### 1.3 Kanal banneri / cover (16:9 yoki 1500×500)

```
A wide, modern hero banner for a railway ticket-alert brand, warm humanist editorial aesthetic
(Anthropic-inspired, cream + coral, never cold blue). Background: a soft cream-to-warm gradient
(#faf9f5 to #f5f0e8) on the left flowing into a deep near-black panel (#181715) on the right.
Across the composition: sleek abstract railway lines / motion streaks and a stylized modern
high-speed train silhouette receding toward a horizon, rendered in coral (#cc785c) and deeper
coral (#a9583e), with delicate teal (#5db8a6) and amber (#e8a55a) accent sparks suggesting
real-time notifications. Generous clean empty space in the upper area for a title to be added
later. Premium, minimal, high-detail flat illustration with soft gradients and subtle depth.
Keep edges calm and uncluttered. No text, no letters. 16:9 aspect ratio.
```

> Bannerga matn qo'shmoqchi bo'lsangiz, Gemini'dan keyin Canva/Figma'da quying:
> sarlavha **CHIPTACHI** (serif: Tiempos/Copernicus uslubi), tagline
> **«Bo'sh joy paydo bo'lsa — birinchi bo'lib bilasiz»**.

---

## 2. Bot matnlari (@BotFather)

**Display name:** `Chiptachi`

**Description** (`/setdescription` — chat ochilishidan oldingi ekran, ≤512 belgi):

```
🎫 Chiptachi — O'zbekiston temir yo'l chiptalarini siz uchun kuzatib turuvchi bot.

eticket.railway.uz da kerakli yo'nalish, sana va poyezdda bo'sh joy paydo bo'lishi bilan men sizga darhol xabar beraman. Bayram va ta'til mavsumida qaytarilgan chiptalarni endi qo'ldan boy bermaysiz.

👇 Boshlash uchun «Start» tugmasini bosing.
```

**About text** (`/setabouttext` — profil sahifasi, ≤120 belgi):

```
Temir yo'l chiptasida bo'sh joy paydo bo'lsa darhol xabar beraman. eticket.railway.uz kuzatuvchisi 🎫
```

**Commands** (`/setcommands` — bot kodda ham avtomatik o'rnatadi):

```
start - Botni ishga tushirish
menu - Asosiy menyu
help - Yordam
contact - Aloqa
language - Tilni tanlash
premium - Premium obuna
donate - Loyihani qo'llab-quvvatlash
```

---

## 3. Kanal matnlari (t.me/railwayuzz)

**Nomi:** `Chiptachi 🎫`

**Description** (≤255 belgi):

```
🎫 Temir yo'l chiptalari bo'yicha yangiliklar, maslahatlar va bo'sh joy e'lonlari.

🔔 Bo'sh joyni birinchilardan bo'lib biling
🤖 Bot: @railwayuzz_bot
🚆 eticket.railway.uz
```

**Birinchi (pin qilinadigan) post:**

```
🎫 Chiptachi kanaliga xush kelibsiz!

Bu kanal — O'zbekiston temir yo'l chiptalari haqidagi foydali ma'lumotlar manzili:

🔔 Bo'sh joylar va qaytarilgan chiptalar haqida e'lonlar
💡 Chipta olish bo'yicha maslahatlar va lifehacklar
🚆 Yo'nalishlar, narxlar va mavsumiy yangiliklar

Chiptangizni qo'ldan boy bermaslik uchun botimizdan foydalaning 👇
🤖 @railwayuzz_bot

eticket.railway.uz chiptalarini avtomatik kuzatamiz — siz faqat xabarni kutasiz.
```
