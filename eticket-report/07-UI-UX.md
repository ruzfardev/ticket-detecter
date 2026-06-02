# UI/UX kamchiliklari va foydalanish qulayligi

eticket.railway.uz interfeysini login qilingan sessiyada passiv kuzatdik. Umumiy taassurot: oqim (flow) yaxshi o'ylangan va zamonaviy, biroq lokalizatsiya va kichik qulaylik detallari foydalanuvchi ishonchiga ta'sir qilmoqda. Quyida muammolarni dalil → ta'sir → tavsiya ko'rinishida, ijobiy tomonlarni ham tan olgan holda keltiramiz.

> **Jiddiylik haqida:** Quyida "KRITIK" deb belgilangan band — **shu UI/UX kategoriyasi ichida eng ustuvor**. Umumiy biznes-jiddiylik bo'yicha (xavfsizlik bilan solishtirganda) bu band past-o'rta darajada, chunki u xavfsizlik emas, foydalanuvchi ishonchi va tajribasi masalasi.

## 1.1 KRITIK (kategoriya ichida) — Kirill va lotin yozuvlarining aralashishi

Eng e'tiborli muammo: til sozlamasida "O'zbek (lotin)" tanlangan bo'lsa-da, stansiya va poyezd nomlari kirill alifbosida, ko'pincha bir ro'yxatda lotin bilan aralash holda ko'rsatiladi.

**Alomat / dalil (jonli kuzatuv):**

| Joylashuv | Kuzatilgan matn | Izoh |
|---|---|---|
| Natijalar sarlavhasi | "**САМАРКАНД** boradigan poyezdlar" | Shahar nomi kirill, qolgan matn lotin — bir jumlada aralash |
| Natijalar ro'yxati (1-poyezd) | "**ТАШКЕНТ Ц → САМАРКАНД**" | To'liq kirill |
| Natijalar ro'yxati (2–6-poyezdlar) | "**TOSHKENT / SAMARQAND**" | Lotin — ayni bir ro'yxatda ikki xil yozuv |
| Vagon-joy sahifasi | "**ТАШКЕНТ Ц**", "**САМАРКАНД**", "**770Ф (УТН)**" | Kirill, til sozlamasiga qaramay |

**Sabab (texnik):** Stansiya va poyezd nomlari backend handbook'dan kirillda kelmoqda va tanlangan til sozlamasiga (locale) bo'ysunmaydi. Frontend tarafda transliteratsiya yoki lokalizatsiya qatlami (localization layer) mavjud emas, shu sababli handbook qiymatlari to'g'ridan-to'g'ri ekranga chiqadi.

**Ta'sir:** Lotin tilini tanlagan foydalanuvchi kirill matnni ko'rganda tizim tugallanmagan yoki ishonchsiz degan taassurot oladi. Bir ro'yxat ichida ikki xil yozuv (ТАШКЕНТ Ц va TOSHKENT) izchillikni buzadi, o'qishni sekinlashtiradi va bron qilish jarayonida ikkilanishga sabab bo'ladi — bu milliy darajadagi xizmat uchun professional taassurotni kamaytiradi.

**Tavsiya:**
- Backend yoki frontend tarafida yagona **localization/transliteratsiya qatlami** joriy etish: handbook qiymatlari (stansiya, poyezd, vagon turi) tanlangan locale'ga ko'ra lotin yoki kirillda render qilinsin.
- Eng amaliy birinchi qadam — handbook'ga har bir yozuvga `name_lat` / `name_cyr` maydonlarini qo'shish (yoki ishonchli transliteratsiya jadvali). Shu bilan UI butun oqim bo'ylab (sarlavha, ro'yxat, seat-map) bitta yozuvda ko'rsatadi.
- Maxsus belgilar ("770Ф (УТН)", "ТАШКЕНТ Ц" dagi "Ц") uchun transliteratsiya qoidalari aniq belgilansin, chunki avtomatik konvertatsiya bunday qisqartmalarda xato berishi mumkin.

## 1.2 "BETA" yorlig'i ishlab chiqarish (prod) tizimida

**Alomat / dalil:** Logotip yonida doimiy "BETA" belgisi ko'rinadi.

**Ta'sir:** Real pul bilan ishlaydigan, milliy darajadagi chipta tizimida "BETA" yorlig'i foydalanuvchi ishonchini pasaytiradi — to'lov xavfsizligi yoki tizim barqarorligi haqida shubha uyg'otishi mumkin.

**Tavsiya:** Tizim ishlab chiqarishga to'liq tayyor bo'lsa, "BETA" yorlig'ini olib tashlash; agar maqsadli ravishda erta kirish (early access) belgilanayotgan bo'lsa, uni faqat aniq, vaqtinchalik kontekstda saqlash tavsiya etiladi.

## 1.3 Maxfiylik — to'liq email yuqori panelda

**Alomat / dalil:** Yuqori panelda foydalanuvchining to'liq elektron pochtasi BOSH HARFLARDA ko'rsatiladi ("FARRUKHRUZMETOV2002@..." ko'rinishida).

**Ta'sir:** To'liq email ekranda doimiy ko'rinishi shoulder-surfing (yelka osha qarash) xavfini oshiradi — ayniqsa umumiy joylarda yoki ekran ulashishda foydalanuvchi shaxsiy ma'lumoti fosh bo'lishi mumkin.

**Tavsiya:** Yuqori panelda to'liq email o'rniga foydalanuvchi ismini yoki niqoblangan email ko'rsatish (masalan, `f****v@...`). To'liq email faqat profil sahifasida, talab bo'yicha ochilsin.

## 1.4 Bosh sahifa o'qilishi — past kontrast va ALL-CAPS forma

**Alomat / dalil:** Qidiruv formasi yarim-shaffof, band fon-rasm ustida joylashgan (past kontrast). Forma yorliqlari ("QAYERDAN", "QAYERGA", "SANANI TANLANG") to'liq bosh harflarda.

**Ta'sir:** Past kontrast matnni fon ustida ajratib ko'rishni qiyinlashtiradi (accessibility/WCAG kontrast mezonlari nuqtai nazaridan ham muammoli). To'liq ALL-CAPS matn o'qish tezligini pasaytiradi, chunki harflar shakli bir xil balandlikda bo'lib, ko'z uchun tanib olish qiyinlashadi.

**Tavsiya:**
- Forma ostiga to'q (yoki yarim shaffof qoraytiruvchi) qatlam (overlay) qo'shib, matn-fon kontrastini WCAG AA darajasiga yetkazish.
- Yorliqlarda ALL-CAPS o'rniga oddiy yozuvni (Sentence case) qo'llash, vizual urg'u uchun shrift og'irligi yoki rangdan foydalanish.

## 1.5 Shahar tanlash — modal oqimi va boshlang'ich shahar takrori

**Alomat / dalil:** Shahar tanlash inline dropdown emas, butun modal oyna orqali amalga oshadi.

**Ijobiy:** Shahar tanlanganda fokus avtomatik keyingi maydonga o'tadi — bu yaxshi, uzluksiz flow yaratadi va ortiqcha bosishni kamaytiradi.

**Kamchilik (dalil):** "QAYERGA" ro'yxatida boshlang'ich shahar (Toshkent) o'chmaydi — natijada Toshkent → Toshkent kabi mantiqan noto'g'ri tanlovga yo'l qo'yiladi.

**Tavsiya:** "QAYERGA" ro'yxatidan allaqachon "QAYERDAN" sifatida tanlangan shaharni filtrlash (yoki o'chirilgan/disabled holatda ko'rsatish), shu bilan bir xil shahar tanlanishining oldini olish.

## 1.6 Kalendar (ijobiy)

**Dalil:** Kalendar ikki oylik ko'rinishda, hafta dushanbadan boshlanadi (DU SE CH PA JU SH YA), bugungi sana yashil rangda ajratilgan, "Bir tomonga" toggle mavjud.

**Baho:** Bu yaxshi yechim — mahalliy hafta tartibiga mos, vizual jihatdan tushunarli va bir/ikki tomonlama sayohatni qulay tanlash imkonini beradi. Bu yondashuvni saqlash tavsiya etiladi.

## 1.7 Natijalar ro'yxati — boy ma'lumot, ammo kesilgan nomlar

**Ijobiy (dalil):** Har bir poyezd kartasi to'liq ma'lumot beradi: jo'nash vaqti, davomiylik (masalan, 02:19), poyezd turi (Afrosiyob / Sharq / Nasaf), klass (Ekonom / O'rindiqli), bo'sh joy soni (6 / 137 / 43 / 1 / 241), narx va tezkor sana tab'lari. Sotilgan poyezdlar ("Joylar qolmagan") kulrang ko'rsatiladi — holat farqi aniq. Bu axborotga boy va foydalanuvchiga qaror qabul qilishda yordam beruvchi dizayn.

**Kamchilik (dalil):** Uzun poyezd nomlari kesilgan ("770Ф (YT...") va tooltip (to'liq matnni ko'rsatuvchi ko'rsatma) yo'q — foydalanuvchi to'liq nomni ko'ra olmaydi.

**Tavsiya:** Kesilgan nomlar uchun hover/tap tooltip qo'shish yoki kartani moslashuvchan (responsive) qilib to'liq nomga joy ajratish. Bu, ayniqsa, 1.1-band bo'yicha lokalizatsiya tuzatilgandan keyin yanada tushunarli bo'ladi.

## 1.8 5-bosqichli wizard (ijobiy)

**Dalil:** Bron jarayoni aniq 5 bosqichga bo'lingan: Poyezd tanlash → Vagon va joy → Yo'lovchi ma'lumotlari → Buyurtmani tasdiqlash → To'lov. Progress ko'rinadi.

**Baho:** Bu juda yaxshi yechim — foydalanuvchi qayerda turganini va nechta qadam qolganini biladi, bu kognitiv yukni kamaytiradi va jarayonni shaffof qiladi. Saqlanishi tavsiya etiladi.

## 1.9 Seat-map (joy xaritasi) — kuchli, lekin rang-kodlash noaniq

**Ijobiy (dalil):** Vagonning vizual sxemasi, raqamlangan joylar, konduktor belgisi, "Xaritada 4 tagacha joyni tanlang" cheklovi va "Ovqat tanlash" imkoniyati mavjud — umuman olganda kuchli va intuitiv.

**Kamchilik (dalil):** Bo'sh joylar kulrang rangda ko'rsatiladi — kulrang odatda "band" yoki "mavjud emas" degan ma'noni anglatadi, shu sababli rang-kodlash noaniq. Bundan tashqari, xarita pastki qismdan kesilgan (to'liq ko'rinmaydi).

**Tavsiya:**
- Holat ranglarini intuitiv mantiqqa moslashtirish: bo'sh joy — neytral/yashil yoki ochiq rang, band joy — kulrang/o'chirilgan, tanlangan joy — urg'uli (accent) rang. Rang bilan birga ikona yoki belgi qo'shish (rang ko'rmaydiganlar uchun accessibility).
- Seat-map konteynerini to'liq ko'rinadigan qilish (scroll yoki moslashuvchan balandlik) — joriy holatda xarita pastdan kesilmasligi kerak.

## Xulosa

Tizimning asosiy oqimi — modal shahar tanlash, avtomatik fokus o'tishi, ikki oylik kalendar, axborotga boy natijalar ro'yxati, 5-bosqichli wizard va vizual seat-map — zamonaviy va yaxshi o'ylangan. Asosiy ustuvor tuzatish — **kirill/lotin lokalizatsiya qatlami (1.1)**, chunki u butun oqim bo'ylab ko'rinadi va ishonchga eng ko'p ta'sir qiladi. Undan keyin maxfiylik (to'liq email), prod tizimdagi "BETA" yorlig'i, kontrast/ALL-CAPS o'qilishi va seat-map rang-kodlashi nisbatan kichik, ammo tez hal qilinadigan yaxshilanishlardir.
