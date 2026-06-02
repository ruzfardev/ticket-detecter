# Buyurtma va to'lov oqimidagi muammolar

Bu bo'lim buyurtma (bron) va to'lov oqimidagi ikkita o'zaro bog'liq kamchilikni va ularning yechimini bayon etadi. Ikkala muammoning **umumiy ildizi bitta**: to'lov sessiyasi buyurtmaga (`orderId`) emas, vaqtinchalik **brauzer oqimiga** bog'langan.

> **Manba eslatmasi.** Bu kuzatuvlar bizning **o'z eticket akkountimizda** o'tkazilgan nazoratli sinovlar va jonli interfeys kuzatuvi asosida. Test bronlari darhol bekor qilingan yoki ~10 daqiqada avtomatik bekor bo'lgan; real inventarga zarar yetkazilmagan. Quyida ataylab operatsion suiiste'mol qadamlari keltirilmaydi — faqat xavf va yechim.

---

## 4.1 — Bron qilingan buyurtmani qayta to'lab bo'lmaydi (KRITIK funksional kamchilik)

**Muammo.** Foydalanuvchi joyni band qilib, lekin to'lovni yakunlamasa (masalan, brauzer yopildi, to'lov uzilib qoldi, internet o'chdi, yoki bilib turib keyinroq to'lamoqchi bo'ldi), u **"Faol buyurtmalar" ro'yxatidan turib to'lov formasini qayta ocholmaydi** — to'lovni davom ettirishning hech qanday yo'li yo'q.

**Alomat / dalil (jonli tasdiqlangan, 2026-06-03).**
- Yo'l: foydalanuvchi menyusi → "Mening yangi buyurtmalarim" → sahifa `/uz/cabinet/orders` ("**Faol buyurtmalar**").
- Test bronidan (Sharq 712Ф, joy 016, vagon 19) so'ng bu sahifada buyurtma ko'rindi, holati:
  > "Sizning chiptangiz poyezdda 712ФЦ ... shakllanmoqda" — "**Sizning chiptangiz shakllanmoqda. Iltimos, kuting...**"
- Bu kartochkada **na "To'lovni davom ettirish" (to'lov) tugmasi, na "Bekor qilish" tugmasi** bor — faqat "shakllanmoqda, kuting" holati. Ya'ni foydalanuvchi bu yerdan **to'lay ham, bekor ham qila olmaydi**.
- Bronni bekor qilishning yagona yo'li — **tasdiqlash sahifasiga (`confirm-page`) qaytib**, hold taymeri tugamasdan "Bekor qilish" bosish edi. Lekin tab'ni yopgan yoki oqimni yo'qotgan foydalanuvchi u sahifaga qaytib bora olmaydi → bron faqat **avtomatik muddati tuganda** (~10 daqiqa) bo'shaydi.

**Sabab (texnik).** To'lov formasi `orderId` bo'yicha qayta tiklanmaydi — to'lov sessiyasi dastlabki brauzer navigatsiyasiga bog'langan. Foydalanuvchi o'sha oqimdan chiqib ketsa, buyurtma serverda "ochiq" tursa-da, unga ulanib to'lash imkoni qolmaydi.

**Ta'sir.**
- **Foydalanuvchi:** joyni band qildi, lekin to'lay olmaydi — bron muddati tugaydi, chipta yo'qoladi, ovora bo'ladi.
- **eticket (biznes):** **yo'qotilgan savdo** — sotuvga tayyor mijoz to'lay olmadi; va joy hold muddati davomida boshqalardan ham bloklanadi.
- Bu, ayniqsa, to'lov birinchi urinishda uzilib qolgan (karta/3-D Secure/internet muammosi) holatlarda eng og'riqli — mijoz qayta urinish o'rniga butunlay mahrum bo'ladi.

**Yechim.**
- "Faol buyurtmalar" ro'yxatidagi har bir to'lanmagan buyurtmaga **"To'lovni davom ettirish"** amali qo'shilsin — u `orderId` bo'yicha to'lov formasini qayta ochsin.
- Hold (rezerv) muddati tugamaguncha qolgan **vaqt taymeri** ko'rsatilsin.
- Foydalanuvchiga buyurtmani **aniq bekor qilish** imkoni berilsin (joy darhol bo'shasin).
- Asosiy arxitektura tuzatishi: to'lov sessiyasini **`orderId`ga (server tomonda) bog'lash** — shunda egasi istalgan qurilma/sessiyadan to'lovni davom ettira oladi.

---

## 4.2 — Bron ↔ to'lov assimetriyasi (joy egallab qolish xavfi)

**Muammo.** Joy band qilish (`POST /api/v2/universal-orders/create`) va to'lov turlarini olish (`POST /api/v3/payment-type/list`) bosqichlari turlicha himoyalangan:

- **`create`** — joyni ~10 daqiqaga rezerv qiladi va tashqaridan (oddiy API chaqiruvi bilan) **ishlaydi**.
- **`payment-type/list`** — faqat haqiqiy brauzer-oqimida yaratilgan `paymentId` uchun **200** qaytaradi; tashqaridan yaratilgani uchun bir xil header/holatda ham **204** (bo'sh).

Ya'ni himoya **to'lovda** kuchli (maqtovga loyiq), lekin **inventarni bloklaydigan `create` bosqichida yo'q**.

**Ta'sir — seat-hoarding (joy egallab turish).** Himoya faqat to'lovda bo'lgani uchun, `create` bosqichini to'lovni hech qachon yakunlamasdan avtomatlashtirish nazariy jihatdan mumkin — natijada joylar to'lovga aylanmasdan bloklanadi, hold tugagach bo'shaydi va qayta egallanishi mumkin. Oddiy foydalanuvchi **"Joylar qolmagan"** ko'radi — aslida hech kim sotib olmagan bo'lsa ham. Bu **denial-of-availability**: inventar real sotuvga aylanmasdan bloklanadi. (Operatsion tafsilotlar ataylab keltirilmaydi.)

**Eng zaif nuqta.** Eng tez sotiladigan yo'nalishlar. Kuzatuvda Toshkent–Samarqand Afrosiyob: 08:00 reysi to'liq sotilgan, 08:30 da atigi 6 joy, 19:48 da 1 joy. Bunday past inventarda hatto kichik spekulyativ bronlar ham real foydalanuvchilarga mavjudlikni keskin pasaytiradi va qora bozorga sharoit yaratadi.

**Yechim.**

| # | Tavsiya | Maqsad |
|---|---|---|
| 1 | **Bron'ni payment-intent bilan bog'lash** — `create` joyni faqat to'lov niyati boshlanganda ushlasin yoki dastlab qisqa (2–3 daqiqa) soft-lock qo'ysin | "O'lik" bronlar inventarni uzoq bloklamaydi |
| 2 | **`create`'ga majburiy auth + qattiq rate-limit** (akkount+IP+qurilma) + bot-himoya (captcha) | Ommaviy avtomatlashtirilgan band qilish qiyinlashadi |
| 3 | **Hold muddatini qisqartirish + abort cooldown** (bekor qilingan bronlardan keyin) | Tez band qilish–bekor qilish sikli sekinlashadi |
| 4 | **Anomaliya monitoringi** — bir akkount/IP'da ko'p `create`+abort naqshi | Hoarding'ni erta aniqlash |

---

## Umumiy ildiz va yagona arxitektura tuzatishi

4.1 va 4.2 — **bitta dizayn qarorining ikki tomoni**: to'lov sessiyasi buyurtmaga emas, brauzer oqimiga bog'langan.

- 4.2'da bu **kuchli tomon** ko'rinadi (tashqi tomon to'lay olmaydi);
- 4.1'da bu **kamchilik** bo'lib chiqadi (**egasi ham** to'lay olmaydi).

Yechim ikkalasini birga hal qiladi: **to'lov sessiyasini `orderId`ga server tomonda bog'lash** va uni autentifikatsiya + rate-limit bilan boshqarish. Shunda (a) legitim egasi buyurtmani istalgan vaqt/qurilmadan to'lay oladi, (b) tizim kim, qachon va qancha bron qilayotganini nazorat qila oladi — bu hoarding'ni cheklaydi va yo'qotilgan savdoni qaytaradi.

## Endpoint inventarizatsiyasi (ma'lumot uchun)

| Endpoint | Metod | Holat | Izoh |
|---|---|---|---|
| `/api/v3/handbook/trains/list` | POST | 200 | Poyezd qidiruvi |
| `/api/v1/handbook/trains` | POST | 200 | Vagon sxemasi |
| `/api/v2/discounts/available` | POST | 200 | Chegirmalar |
| `/api/v1/insurance/check` | GET | 200 | Sug'urta |
| `/api/v1/auth/login` | POST | 200 | `{username,password}` → `{token,refreshToken}` |
| **`/api/v2/universal-orders/create`** | **POST** | **200** | **Bron — joyni ~10 daq rezerv (tashqaridan ishlaydi)** |
| **`/api/v3/payment-type/list`** | **POST** | **200/204** | **`device-type: BROWSER` kerak; faqat brauzer-oqim `paymentId`'i uchun 200** |
