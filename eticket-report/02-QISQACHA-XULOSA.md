# Qisqacha xulosa (Executive Summary)

Ushbu hujjat eticket.railway.uz xizmatining mustaqil tahlilida aniqlangan kamchiliklarni va ularning yechimlarini jamlaydi. Topilmalar ikki manbadan: jonli interfeysni **passiv kuzatish**, va buyurtma/to'lov oqimi bo'yicha — **o'z akkountimizdagi nazoratli funksional testlar** (batafsil: *03-Metodologiya va etika*). Hech qanday DoS, eksploit, ruxsatsiz kirish yoki uchinchi shaxsga zarar bo'lmagan. Topilmalar **mas'uliyatli oshkor qilish** ruhida, faqat xavf va yumshatish doirasida.

## Topilmalar — jiddiylik bo'yicha tartiblangan

| # | Jiddiylik | Soha | Mohiyat (dalil) | Asosiy yechim |
|---|---|---|---|---|
| 1 | **Yuqori** | Buyurtma/to'lov | **Bron qilingan (to'lovi tugallanmagan) buyurtmani "Faol buyurtmalar" ro'yxatidan turib qayta to'lab bo'lmaydi** — to'lov formasini ochuvchi amal yo'q. Sabab: to'lov sessiyasi `orderId`ga emas, brauzer oqimiga bog'langan. Natija: yo'qotilgan savdo + bekor bo'lguncha bloklangan joy | "To'lovni davom ettirish" amali + taymer + bekor qilish; to'lov sessiyasini `orderId`ga bog'lash |
| 2 | **Yuqori** | Buyurtma/to'lov | Bron↔to'lov assimetriyasi: `create` tashqaridan ishlaydi va joyni ~10 daq rezerv qiladi; to'lov (`payment-type/list`) faqat brauzer-oqim `paymentId`'i uchun **200**, tashqaridan **204**. Himoya to'lovda, inventarni bloklaydigan `create`'da yo'q → seat-hoarding xavfi | `create`'ni payment-intent bilan bog'lash; majburiy auth + rate-limit + bot-himoya; hold qisqartirish |
| 3 | **O'rta–yuqori** | Xavfsizlik | Token (JWT) `sessionStorage`'da (JS o'qiy oladi) + CSP'da `script-src` yo'q → bitta XSS to'liq sessiya o'g'irlanishiga olib kelishi mumkin. Yetishmayotgan: HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy. `security.txt` yo'q | Token'ni `HttpOnly`+`Secure`+`SameSite` cookie'ga; CSP `script-src`; yetishmayotgan header'lar; `security.txt` |
| 4 | **O'rta** | Performance | Sahifa ~2.6MB / 41 resurs. Shriftlar ~1.33MB (Inter + Gilroy, `.ttf`, subset yo'q); JS ~723KB (`main.js` 326KB); reCAPTCHA 374KB bosh sahifada. Angular **11.1.2 (EOL)**. `stations/list` ikki marta (204) | Shriftlar: woff2 + subset + bitta oila (~1MB tejov); reCAPTCHA lazy-load; route code-splitting; Angular LTS upgrade |
| 5 | **Past–o'rta** | UI/UX | Kirill/lotin aralashuvi (lotin tanlansa-da "САМАРКАНД boradigan poyezdlar", bir ro'yxatda "ТАШКЕНТ Ц" va "TOSHKENT"); prod tizimda "BETA"; panelda to'liq email; past kontrast + ALL-CAPS forma; "QAYERGA"da boshlang'ich shahar filtrlanmaydi | Localization/transliteratsiya qatlami; email niqoblash; "BETA"ni olib tashlash; WCAG AA kontrast |

> **Jiddiylik izohi:** UI/UX bo'limidagi kirill/lotin bandi shu **kategoriya ichida** "KRITIK" (eng ustuvor), umumiy biznes-jiddiylik bo'yicha esa Past–o'rta — chunki u xavfsizlik emas, ishonch/tajriba masalasi.

## Yangi imkoniyat tavsiyasi

Joy kutayotgan foydalanuvchi hozir sahifani qayta-qayta yangilashga majbur. Tavsiya: saytning/ilovaning o'zida **joy bo'shaganda bildirishnoma (obuna)** funksiyasi — foydalanuvchi obuna qo'yadi, joy paydo bo'lganda xabar oladi va xaridni o'zi qiladi. **Avtomatik sotib olish (auto-buy) tavsiya etilmaydi** — u aynan joy egallab qolishni kuchaytiradi (*08-bo'lim*).

## Tan olingan kuchli tomonlar

To'lov qatlami puxta himoyalangan; CSRF (`XSRF-TOKEN` + `X-XSRF-TOKEN`) to'g'ri; CORS qulflangan; texnologiya steki yashirilgan; ikki qatlamli clickjacking himoyasi (`X-Frame-Options: DENY` + CSP `frame-ancestors 'none'`); Angular production mode; reCAPTCHA. Sourcemap fosh qilinmagan. Bron oqimi, ikki oylik kalendar, 5-bosqichli wizard va axborotga boy natijalar ro'yxati yaxshi o'ylangan.

## Eng zaif nuqta va biznesga ta'siri

Eng tez sotiladigan yo'nalishlarda muammolar ta'siri keskin: Toshkent–Samarqand Afrosiyob 08:00 reysi to'liq sotilgan, 08:30 da atigi 6 joy, 19:48 da 1 joy. Bunday sharoitda (a) qayta to'lab bo'lmaydigan "osilib qolgan" bronlar va (b) spekulyativ joy egallashlar — real foydalanuvchilarga mavjudlikni pasaytiradi, eticket'ga esa savdoni yo'qotadi.
