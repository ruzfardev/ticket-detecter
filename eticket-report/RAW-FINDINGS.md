# RAW-FINDINGS — eticket.railway.uz jonli tekshiruv

> Bu fayl — xom (raw) kuzatuv yozuvlari. Rasmiy hujjat bo'limlari shu manbadan tayyorlanadi.
> Tekshiruv sanasi: **2026-06-03**. Usul: Claude-in-Chrome browser automation (kuzatuv asosida),
> foydalanuvchining shaxsiy login qilingan sessiyasi (`farrukhruzmetov2002@gmail.com`).
> Etika: faqat **kuzatuv** (passive). Faol hujum, DoS, eksploit, ma'lumot o'zgartirish — **yo'q**.
> Haqiqiy buyurtma/bron **yaratilmadi** (vagon-joy tanlash bosqichigacha bordik, "Davom etish" bosilmadi).

---

## 0. Tekshiruv ko'lami va metod

- Brauzer: Chrome (desktop, ~1512px kenglik), O'zbek (lotin) til tanlangan.
- Yo'l: Bosh sahifa → qidiruv (Toshkent→Samarqand, 06-iyun) → natijalar → vagon/joy tanlash.
- Texnik ma'lumot: `performance` API (resurs hajmlari), `fetch` orqali javob sarlavhalari (faqat header, body emas), `sessionStorage`/`cookie` **kalit nomlari** (qiymatlar emas — token/parol hech qachon o'qilmadi/saqlanmadi).
- Network: 14 ta API endpoint kuzatildi.

---

## 1. UI/UX kuzatuvlari

### 1.1 — KRITIK: Aralash yozuv (kirill ↔ lotin) bir sahifada
- Til "O'zbek (lotin)" tanlangan bo'lsa-da, natijalar sahifasi sarlavhasi: **"САМАРКАНД boradigan poyezdlar"** — shahar nomi **kirill**, qolgani lotin.
- Natijalar ro'yxatida nomuvofiqlik: 1-poyezd stansiyalari **"ТАШКЕНТ Ц → САМАРКАНД"** (kirill), 2–6-poyezdlar **"TOSHKENT / SAMARQAND"** (lotin) — **ayni bir ro'yxatda ikki xil yozuv**.
- Vagon-joy sahifasida ham: "ТАШКЕНТ Ц", "САМАРКАНД", poyezd turi "770Ф (УТН)" — kirill.
- Sabab: stansiya/poyezd nomlari backend handbook'dan kirillda keladi va til sozlamasiga bo'ysunmaydi (transliteratsiya/lokalizatsiya qatlamining yo'qligi).
- Ta'sir: ishonchsiz, "tugallanmagan" taassurot; xalqaro/yosh foydalanuvchilar uchun o'qish qiyin.

### 1.2 — "BETA" yorlig'i ishlab chiqarish (production) tizimida
- Logotip yonida doimiy **"BETA"** belgisi. Real pul bilan ishlaydigan milliy chipta tizimida "beta" — ishonchni pasaytiradi.

### 1.3 — Maxfiylik: to'liq email yuqori panelda
- Tizimga kirgan foydalanuvchining **to'liq email manzili** ("FARRUKHRUZMETOV2002@...") yuqori o'ng burchakda, BOSH HARFLARDA ko'rsatilgan. Yelka-ortidan o'qish (shoulder-surfing) xavfi; ism yoki niqoblangan email afzal.

### 1.4 — Bosh sahifa o'qilishi (legibility)
- Qidiruv formasi yarim-shaffof, **band fon-rasm** ustida. Oq matn + rangli fon = past kontrast.
- Forma matnlari (QAYERDAN, QAYERGA, SANANI TANLANG) butunlay **BOSH HARFLARDA** — o'qish tezligini pasaytiradi (all-caps anti-pattern).

### 1.5 — Shahar tanlash: modal oyna
- "QAYERDAN" bosilganda inline dropdown emas, **butun modal** ochiladi (qidiruv + ro'yxat). Og'irroq interaktsiya, lekin mobil uchun maqbul.
- Ijobiy: shahar tanlanganda avtomatik keyingi maydonga o'tadi ("QAYERGA" → kalendar). Yaxshi flow.
- Kamchilik: "QAYERGA" ro'yxatida allaqachon tanlangan **boshlang'ich shahar (Toshkent) o'chirilmagan** — Toshkent→Toshkent tanlash mumkin.

### 1.6 — Kalendar
- Ikki oylik ko'rinish (Iyun/Iyul 2026), hafta dushanbadan boshlanadi (DU SE CH PA JU SH YA). Bugungi sana yashil. Yaxshi.
- "Bir tomonga" (one-way) toggle bor.

### 1.7 — Natijalar ro'yxati (yaxshi tomonlari)
- Aniq: ketish/kelish vaqti, davomiylik (02:19), poyezd turi (Afrosiyob/Sharq/Nasaf), klass (Ekonom/O'rindiqli), **bo'sh joy soni** (6/137/43/1/241), narx.
- Tez sana almashtirish tab'lari (Pay 04 / Jum 05 / Shan 06 / Yak 07 / Dush 08).
- Sotilgan poyezd ("Joylar qolmagan") kulrang, lekin ro'yxatda qoladi.
- Kamchilik: uzun poyezd nomlari kesilgan ("770Ф (YT...", "768Ф (Вы...") — tooltip yo'q.
- Eslatma (kontekst): 08:00 Afrosiyob allaqachon **sotilgan**, 08:30 da **6 joy**, 19:48 da **1 joy** — Afrosiyob juda tez sotiladi (hoarding muammosining asosi, 2-bo'lim).

### 1.8 — 5-bosqichli wizard
- Poyezd tanlash → Vagon va joy tanlash → Yo'lovchi ma'lumotlari → Buyurtmani tasdiqlash → To'lov. Aniq progress indikatori. Yaxshi.

### 1.9 — Seat-map (vagon sxemasi)
- Vizual vagon xaritasi: raqamli joylar, konduktor belgisi, yo'nalish strelkalari, "Xaritada 4 tagacha joyni tanlang", "Ovqat tanlash". Umuman yaxshi.
- Kamchilik: bo'sh joylar **kulrang** ko'rsatilgan — kulrang odatda "band" degani; rang-kodlash noaniq (bo'sh/band farqi tushunarsiz bo'lishi mumkin).
- Vagon xaritasi pastdan kesilgan (scroll kerak).

---

## 2. API & "tashqaridan order-create" muammosi (ASOSIY)

### 2.1 — Kuzatilgan endpointlar (jonli)
| Endpoint | Method | Status | Izoh |
|---|---|---|---|
| `/api/v3/handbook/trains/list` | POST | 200 | poyezd/joy mavjudligi (qidiruv natijasi) |
| `/api/v2/query/orders/count` | GET | 200 | faol buyurtma soni (badge) |
| `/api/v1/line-runner` | GET | 204 | bo'sh (e'lon satri?) |
| `/api/v1/handbook/stations/list` | POST | **204** | **ikki marta chaqirilgan, ikkalasi bo'sh** |
| `/api/v2/discounts/available` | POST | 200 | chegirmalar |
| `/api/v1/handbook/trains` | POST | 200 | vagon/joy sxemasi |
| `/api/v1/handbook/catering/product-templates` | POST | 200 | ovqat |
| `/api/v1/insurance/check` | GET | 200 | sug'urta |
| `/api/v1/csrf-token` | GET | — | XSRF-TOKEN cookie |
| `/api/v1/auth/login` | POST | — | `{username,password}` → `{token,refreshToken}` |
| `/api/v2/universal-orders/create` | POST | — | buyurtma/bron yaratish (joyni rezerv qiladi) |
| `/api/v3/payment-type/list` | POST | — | to'lov turlari (`device-type: BROWSER` header kerak) |
| `/api/.../hamkorbank-hold/do-payment` | POST | — | to'lov (HamkorbankHold) |

### 2.2 — Asosiy nuqson: bron qilish ↔ to'lov o'rtasidagi assimetriya
- `universal-orders/create` (joyni band qilish) **API orqali tashqaridan ishlaydi** — joy rezerv qilinadi (~10 daqiqa hold).
- BIROQ `payment-type/list` **faqat** eticket'ning haqiqiy brauzer-oqimida yaratilgan `paymentId` uchun 200 qaytaradi. Tashqaridan (client) yaratilgan har qanday `paymentId` uchun **204 (bo'sh)** — bir xil header, bir xil order holati bo'lsa ham.
- Bu — yashirin **server-side to'lov-sessiya bog'lanishi** (genuine browser navigation'ga bog'liq). Oldingi sessiyada ~45 ta nazoratli test bilan tasdiqlangan.

### 2.3 — Ijtimoiy ta'sir: "seat-hoarding" (joy egallab turish) hujumi
- Natija: skript/bot `create` orqali **joylarni ommaviy band qiladi**, lekin to'lovni yakunlay olmaydi (yoki yakunlamaydi). Joylar ~10 daqiqa bloklanadi, so'ng bo'shaydi, qayta band qilinadi.
- Oddiy foydalanuvchi qidiruvda **"Joylar qolmagan"** ko'radi — aslida hech kim sotib olmagan. Eng tez sotiladigan yo'nalishlar (Toshkent–Samarqand Afrosiyob) bunga eng zaif.
- Ya'ni: ochiq, stateless `create` endpoint + zaif rate-limit = **mavjudlikni rad etish (denial-of-availability)** va spekulyatsiya (qora bozor) uchun sharoit.
- Assimetriya muammoni kuchaytiradi: hech qachon sotuvga aylanmaydigan bronlar ham inventarni bloklaydi.

### 2.4 — Tavsiya etiladigan tizimli yechimlar (eticket uchun)
- Bron'ni **to'lov-niyati (payment intent)** bilan bog'lash: `create` faqat to'lov boshlanganda joyni ushlasin; aks holda yengil "soft-lock" (qisqaroq, masalan 2–3 daqiqa).
- `create` endpoint'iga: **autentifikatsiya majburiy**, **qattiq rate-limit** (akkount + IP + qurilma), **captcha/bot-himoya**.
- Hold muddatini qisqartirish + bekor qilingan/yakunlanmagan bronlar uchun **cooldown**.
- Anomaliya monitoringi (bir akkount/IP juda ko'p create+abort).

---

## 3. Texnik holat & performance

### 3.1 — Frontend stack
- **Angular 11.1.2** — 2021-yil nashri, **EOL (qo'llab-quvvatlash tugagan)**. Joriy barqaror versiya ancha yuqori (19+). Xavfsizlik patch'lari, performance yangilanishlari, zamonaviy build (esbuild, hydration) yo'q.
- Zone.js bor; Angular **production mode** (dev-mode emas — yaxshi). `isProd=true`.
- Google Analytics / GTM (`gtag`, `dataLayer`) bor; reCAPTCHA bor.
- Service Worker API mavjud, lekin **registratsiya yo'q** (PWA/offline yo'q).

### 3.2 — Sahifa og'irligi (warm-cache o'lchovlari, ~encodedBodySize)
- Jami: ~**2.6 MB**, 41 resurs.
- **Shriftlar: ~1.33 MB** — eng katta muammo:
  - `Inter-Regular.ttf` 303KB + `Inter-SemiBold.ttf` 309KB + `Inter-Bold.ttf` 309KB
  - `Gilroy-Regular.ttf` 142KB + `Gilroy-SemiBold.ttf` 137KB + `Gilroy-Bold.ttf` 134KB
  - **Ikki shrift oilasi** (Inter VA Gilroy) — dizayn nomuvofiqligi + ortiqcha yuk.
  - Format **`.ttf`** (woff2 emas!) — woff2 ~40–50% kichikroq bo'lardi. Subset ham yo'q.
- **JS: ~723 KB** — `main.*.js` 326KB (yagona bundle, route-level lazy-loading belgisi yo'q), reCAPTCHA `recaptcha__en.js` **374KB** (bosh sahifada darhol yuklanadi).
- CSS ~44KB, rasmlar ~288KB.
- FCP ~144ms (warm cache; birinchi tashrif sezilarli sekinroq bo'ladi).

### 3.3 — Network samaradorligi
- `/api/v1/handbook/stations/list` **ikki marta** chaqirilgan, ikkalasi **204** — takroriy/keraksiz so'rov.
- Bir nechta endpoint 204 (line-runner, stations/list) — bo'sh javoblar.

### 3.4 — Tavsiyalar
- Shriftlarni **woff2 + subset (lotin/kirill)** ga o'tkazish, bitta oilaga kelishish, faqat kerakli og'irliklar → ~1MB tejash.
- reCAPTCHA'ni faqat kerak bo'lganda (login/to'lov) lazy-load qilish.
- Route-level code-splitting; Angular'ni zamonaviy LTS'ga bosqichma-bosqich ko'tarish.
- Takroriy `stations/list` chaqiruvini bartaraf etish.

---

## 4. Xavfsizlik kuzatuvlari (faqat passive)

### 4.1 — Yetishmayotgan xavfsizlik sarlavhalari (HTML javobida)
- **`Strict-Transport-Security` (HSTS) — YO'Q.** SSL-stripping/downgrade xavfi.
- **`X-Content-Type-Options: nosniff` — YO'Q.** MIME-sniffing xavfi.
- **`Referrer-Policy` — YO'Q.**
- **`Permissions-Policy` — YO'Q.**
- **CSP juda minimal:** faqat `frame-ancestors 'none';` — clickjacking himoyasi bor, lekin **`script-src`/`default-src` yo'q** → XSS yumshatish yo'q.

### 4.2 — Token saqlash (XSS ta'sirini kuchaytiradi)
- `sessionStorage` da: **`token` (JWT)** va **`user`** profili. JWT'ni JS-o'qiy oladigan storage'da saqlash — har qanday XSS = **token o'g'irlash**. CSP zaifligi bilan birga, bu yuqori xavf.
- Boshqa sessionStorage kalitlari: `userId`, `serviceId`, `activeOrderCount`, `captcha`, `key`, `redirectURL`, `st-name/st-code/sf-name/sf-code`, `contrast`, `isProd`.

### 4.3 — Cookie'lar
- `XSRF-TOKEN` (CSRF himoyasi — **yaxshi**), `_ga`/`_ga_*` (GA), `g_state` (Google sign-in), **`__stripe_mid`/`__stripe_sid`** (Stripe — to'lov bilan bog'liq sana, e'tiborli).

### 4.4 — Zaiflik-xabar kanali yo'q
- `/.well-known/security.txt` — **yo'q** (200 lekin SPA HTML qaytaradi). Rasmiy responsible-disclosure kanali mavjud emas → bu hujjat/tashabbus o'rinli.
- Har qanday noma'lum yo'l (`/robots.txt`, `*.js.map`) **200 + index.html** qaytaradi (SPA catch-all). Yo'q fayl uchun 404 emas, 200 HTML — keshlash/SEO uchun nomaqbul; lekin **sourcemap fosh EMAS** (yaxshi).

### 4.5 — Ijobiy xavfsizlik tomonlari (adolat uchun)
- CSRF token (`XSRF-TOKEN` + `X-XSRF-TOKEN`) to'g'ri qo'llangan.
- API'lar **CORS bilan o'z origin'iga qulflangan** (cross-origin chaqiruv bloklanadi) — yaxshi.
- `Server` / `X-Powered-By` sarlavhalari **fosh qilinmagan** (stack yashirilgan).
- `X-Frame-Options: DENY` + `frame-ancestors 'none'` (clickjacking himoyasi).
- reCAPTCHA + Angular production mode.

---

## 2bis. YANGI BUG (2026-06-03) — Bron qilingan buyurtmani qayta to'lab bo'lmaydi

- Yo'l: foydalanuvchi menyusi → "Mening yangi buyurtmalarim" → `/uz/cabinet/orders` ("Faol buyurtmalar").
- Bron qilingan, to'lovi tugallanmagan buyurtma shu yerda ko'rinadi, LEKIN to'lov formasini ochuvchi/"To'lovni davom ettirish" amali YO'Q.
- Audit paytida ro'yxat bo'sh edi ("Ayni paytda sizda faol buyurtmalar yo'q"); bron holatidagi xulq (shakllanmoqda, to'lov tugmasisiz) oldingi nazoratli testlarda tasdiqlangan.
- Umumiy ildiz: to'lov sessiyasi `orderId`ga emas, brauzer oqimiga bog'langan (2.2 bilan bir narsaning ikki tomoni). 2.2 = tashqi tomon to'lay olmaydi (kuchli tomon); 2bis = egasi ham to'lay olmaydi (kamchilik).
- Ta'sir: yo'qotilgan savdo + hold tugaguncha bloklangan joy.
- Yechim: "To'lovni davom ettirish" amali + qolgan vaqt taymeri + aniq bekor qilish; to'lov sessiyasini server tomonda `orderId`ga bog'lash.

---

## 5. Tavsiya etilgan yangi imkoniyatlar (neytral)

- **Bildirishnoma obunasi (TAVSIYA):** saytning/ilovaning o'zida foydalanuvchi yo'nalish+sanaga obuna qo'ysin, joy paydo bo'lganda xabar (push/SMS/email/Telegram) olsin va xaridni o'zi qilsin. Qayta-yangilash zaruratini, server yukini va bot ehtiyojini kamaytiradi; hech kimga afzallik bermaydi.
- **Auto-buy (TAVSIYA ETILMAYDI):** avtomatik bron/sotib olish aynan seat-hoarding'ni kuchaytiradi → adolatli foydalanuvchini siqib chiqaradi. Avtomatlashtirish faqat kuzatish+xabar berishda bo'lsin, band qilish/sotib olishda emas.

---

## 6. Hujjat parametrlari (foydalanuvchi tanlovi, yangilangan)
- Til: **O'zbek (lotin)**, texnik atamalar inglizcha qoladi.
- Ohang: **Faqat kamchiliklar + yechimlar** (neytral audit). Chiptachi/hamkorlik/tijoriy taklif YO'Q.
- Bo'limlar: Buyurtma/to'lov (4.1 qayta to'lash + 4.2 hoarding), Xavfsizlik, Texnik/performance, UI/UX, Tavsiyalar (bildirishnoma, auto-buy emas).
