# Texnik holat va performance

Bu bo'limda eticket.railway.uz frontend va resurs yuklash holatini passiv kuzatuv (Claude-in-Chrome browser automation, login qilingan sessiya) natijalari asosida ko'rib chiqamiz. Maqsad — tizimning kuchli tomonlarini tan olib, foydalanuvchi tezligi va xizmat barqarorligini oshiradigan amaliy yaxshilanish nuqtalarini birgalikda aniqlash.

## Umumiy taassurot va ijobiy tomonlar

Avval ijobiy jihatlarni tan olamiz: ilova Angular **production mode** (`isProd=true`) da ishlaydi — bu dev-mode ortiqcha yukini olib tashlaydi va to'g'ri konfiguratsiyadir. Google Analytics/GTM va reCAPTCHA integratsiyasi mavjud. Warm-cache holatida FCP (First Contentful Paint) ~144ms — kesh isiganda sezilarli darajada tez.

> **O'lchov eslatmasi:** Quyidagi hajmlar warm-cache (kesh isigan) holatida `encodedBodySize` bo'yicha olingan. Birinchi (cold) tashrifda real tarmoq yuki va yuklanish vaqti sezilarli darajada kattaroq bo'ladi — shu sababli optimizatsiya ta'siri amalda yanada yuqori.

## 1. Frontend stack — Angular 11.1.2 (EOL)

**Tavsif.** Frontend Angular 11.1.2 versiyasida qurilgan.

**Alomat/dalil.** Angular 11.1.2 — 2021-yil nashri va hozirda **EOL (End of Life)**, ya'ni rasmiy qo'llab-quvvatlash tugagan. Joriy barqaror versiya 19+. Zone.js mavjud, ilova production mode'da.

**Ta'sir.** EOL versiyada xavfsizlik patch'lari, performance yangilanishlari va zamonaviy build optimizatsiyalari (masalan, yangi bundler imkoniyatlari) yetib kelmaydi. Vaqt o'tgani sayin ma'lum zaifliklar yopilmay qoladi va texnik qarz to'planadi.

**Tavsiya.** Angular'ni zamonaviy LTS versiyasiga **bosqichma-bosqich** ko'tarish (bir necha major versiya orqali, har bir qadamda migration guide va testlar bilan). Bu xavfsizlik va build tezligi nuqtai nazaridan eng strategik investitsiya.

## 2. Sahifa og'irligi — shriftlar eng katta yuk

Sahifa warm-cache holatida jami **~2.6MB / 41 resurs**. Eng katta hissa shriftlarga to'g'ri keladi.

**Alomat/dalil — shriftlar (~1.33MB).** Ikkita alohida shrift oilasi yuklanadi, hammasi `.ttf` formatida (woff2 emas), subset qilinmagan:

| Shrift fayli | Oila | Hajm |
|---|---|---|
| Inter-Regular | Inter | 303 KB |
| Inter-SemiBold | Inter | 309 KB |
| Inter-Bold | Inter | 309 KB |
| Gilroy-Regular | Gilroy | 142 KB |
| Gilroy-SemiBold | Gilroy | 137 KB |
| Gilroy-Bold | Gilroy | 134 KB |
| **Jami** | | **~1.33 MB** |

**Ta'sir.** Ikki shrift oilasini (`Inter` VA `Gilroy`) bir vaqtda yuklash dizayn nomuvofiqligini va ortiqcha tarmoq yukini keltirib chiqaradi. `.ttf` format `woff2` ga nisbatan ~40-50% kattaroq; subset yo'qligi esa hech qachon ishlatilmaydigan glif'larni ham yuklaydi. Bu, ayniqsa, mobil va sekin tarmoqdagi foydalanuvchilar uchun birinchi yuklanishni sezilarli sekinlashtiradi.

**Tavsiya.**
- Shriftlarni `woff2` formatga o'tkazish va kerakli belgilar to'plami bo'yicha **subset** qilish (lotin/kirill).
- Bitta shrift oilasiga kelishish va faqat haqiqatan kerak bo'lgan og'irliklarni (weights) yuklash.
- Taxminiy tejov: **~1MB** — bu jami sahifa hajmining katta qismini qisqartiradi.

## 3. JavaScript bundle va reCAPTCHA

JS resurslari jami **~723KB**. Taqsimot quyidagicha:

| Resurs | Hajm | Izoh |
|---|---|---|
| `main.*.js` | 326 KB | Yagona bundle, route-level lazy-loading belgisi yo'q |
| reCAPTCHA (`recaptcha__en.js`) | 374 KB | Bosh sahifada darhol yuklanadi |

**Ta'sir.** `main` bundle yagona fayl sifatida keladi — route bo'yicha code-splitting yo'qligi foydalanuvchi hali kirmagan sahifalar kodini ham birinchi yuklanishga qo'shadi. reCAPTCHA (374KB) bosh sahifadayoq yuklanishi — u faqat login va to'lov bosqichlarida kerak bo'lsa-da — boshlang'ich yukni ortiqcha og'irlashtiradi.

**Tavsiya.**
- reCAPTCHA'ni faqat kerak bo'lganda (login/to'lov sahifalarida) **lazy-load** qilish.
- **Route-level code-splitting** joriy etish — har bir wizard bosqichi yoki marshrut o'z bundle'ini alohida yuklasin.

## 4. Network samaradorligi — takroriy chaqiruv

**Alomat/dalil.** `POST /api/v1/handbook/stations/list` endpoint'i **ikki marta** chaqirilgan, ikkala javob ham **204** (bo'sh javob) qaytargan. Bir nechta endpoint (`line-runner`, `stations/list`) bo'sh `204` javoblar bilan keladi.

**Ta'sir.** Bir xil endpoint'ning takroriy chaqirilishi keraksiz tarmoq trafigi va ortiqcha so'rovlarni keltirib chiqaradi — kichik bo'lsa-da, oson tuzatiladigan samaradorlik nuqsoni.

**Tavsiya.** Takroriy `stations/list` chaqiruvini aniqlab, dedup qilish yoki keshlash (bir marta yuklab, qayta ishlatish).

## 5. Service Worker / PWA

**Alomat/dalil.** Service Worker API brauzerda mavjud, biroq ilova uni **ro'yxatdan o'tkazmaydi** (registratsiya yo'q) — ya'ni PWA/offline imkoniyatlari ishlatilmagan.

**Ta'sir.** Service Worker orqali statik resurslarni (shriftlar, JS, CSS) keshlash takroriy tashriflarda yuklanishni keskin tezlashtirishi mumkin edi — hozir bu imkoniyatdan foydalanilmayapti.

**Tavsiya.** Statik resurslar uchun Service Worker keshlash strategiyasini joriy etish (Angular'ning o'z `@angular/service-worker` paketi orqali) — takroriy tashriflar uchun sezilarli tezlik foydasi beradi.

## Xulosa — ustuvorliklar

| Tavsiya | Asosiy foyda | Taxminiy mehnat |
|---|---|---|
| Shriftlar: woff2 + subset + bitta oila | ~1MB tejov, eng katta yutuq | O'rta |
| reCAPTCHA lazy-load | Boshlang'ich yuk yengillashadi | Past |
| Route-level code-splitting | Birinchi yuklanish tezlashadi | O'rta |
| Takroriy `stations/list` ni olib tashlash | Keraksiz so'rovlar kamayadi | Past |
| Service Worker keshlash | Takroriy tashrif tezlashadi | O'rta |
| Angular LTS'ga upgrade | Xavfsizlik + build tezligi | Yuqori |

Bu yaxshilanishlarning aksariyati past-o'rta mehnat bilan amalga oshadi va birinchi yuklanish tezligida darhol sezilarli natija beradi. Eng katta tezkor yutuq — shrift optimizatsiyasi (~1MB), eng strategik investitsiya esa Angular versiyasini zamonaviylashtirish.
