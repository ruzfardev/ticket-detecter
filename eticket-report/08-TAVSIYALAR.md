# Tavsiya etilgan yangi imkoniyatlar va yakuniy xulosa

Bu bo'lim — aniqlangan kamchiliklardan kelib chiqqan, foydalanuvchi tajribasini yaxshilaydigan va shu bilan birga tizimni joy egallab qolish (hoarding) muammosidan himoya qiladigan ikkita ijobiy tavsiya.

## 1. Joy bo'shaganda bildirishnoma (obuna) funksiyasi — TAVSIYA ETILADI

**Muammo.** Eng tez sotiladigan yo'nalishlarda (Toshkent–Samarqand Afrosiyob va h.k.) chipta soniyalarda tugaydi. Joy kutayotgan foydalanuvchi hozir **sahifani qayta-qayta yangilashga** majbur. Bu:
- foydalanuvchini charchatadi va ko'pincha kech qoldiradi;
- serverga keraksiz takroriy yuk beradi;
- aynan shu ehtiyoj sababli odamlarni **uchinchi tomon botlariga** va yarim-legal vositalarga undaydi.

**Yechim — saytning/ilovaning o'zida bildirishnoma obunasi.** Foydalanuvchi yo'nalish + sanaga **obuna** qo'ysin; joy paydo bo'lishi bilan tizim unga **avtomatik xabar** bersin (push / SMS / email / Telegram). Foydalanuvchi xabarni olib, **xaridni o'zi** amalga oshiradi.

**Foydasi:**
- Foydalanuvchi qayta-yangilashdan xalos bo'ladi va joyni o'tkazib yubormaydi.
- Server yuki kamayadi (stixiyali polling o'rniga nazoratli bildirishnoma).
- Bot ehtiyoji pasayadi — legitim, adolatli kanal paydo bo'ladi.
- Bu funksiya hech kimga afzallik bermaydi: xabar barcha obunachilarga teng yetadi, xarid esa odatdagidek "birinchi kelgan — birinchi oladi" tartibida qoladi.

## 2. Avtomatik sotib olish (auto-buy) — TAVSIYA ETILMAYDI

Aksincha, biz tizimga **avtomatik sotib olish (auto-buy)** funksiyasini qo'shishni **tavsiya etmaymiz**.

**Sabab.** Avtomatik xarid (yoki avtomatik bron) aynan *04-bo'limda* tasvirlangan **joy egallab qolish (seat-hoarding)** muammosini kuchaytiradi:
- avtomatlashtirish joylarni odamdan tezroq band qiladi;
- bu real, adolatli foydalanuvchilarni navbatdan siqib chiqaradi;
- natijada inventar avtomatlashtirilgan vositalar qo'lida to'planadi.

**To'g'ri yondashuv** — odamni jarayonda qoldirish: tizim **xabar beradi**, qaror va xaridni **foydalanuvchining o'zi** qiladi. Avtomatlashtirish faqat **kuzatish va xabar berish** qismida bo'lsin, **band qilish/sotib olishda emas**. Hoarding'ning asl yechimi — *04-bo'limdagi* bron↔to'lov bog'lanishi va rate-limit, avtomatik xarid emas.

## Yakuniy xulosa

Tizimning asosi mustahkam: puxta himoyalangan to'lov qatlami, to'g'ri CSRF/CORS, aniq 5-bosqichli bron oqimi, axborotga boy natijalar ro'yxati va vizual seat-map. Quyidagi kamchiliklarni bartaraf etish xizmatni sezilarli darajada yaxshilaydi:

| Ustuvorlik | Kamchilik | Asosiy yechim |
|---|---|---|
| Yuqori | Bron qilingan buyurtmani qayta to'lab bo'lmasligi (4.1) | "To'lovni davom ettirish" amali; to'lov sessiyasini `orderId`ga bog'lash |
| Yuqori | Bron↔to'lov assimetriyasi / hoarding (4.2) | Payment-intent bog'lash; `create`'ga auth + rate-limit |
| O'rta–yuqori | Token storage'da + zaif CSP, yetishmayotgan header'lar (05) | `HttpOnly` cookie; CSP `script-src`; HSTS va boshqalar |
| O'rta | Shriftlar ~1.33MB, Angular EOL, bundle (06) | woff2+subset; reCAPTCHA lazy-load; Angular upgrade |
| Past–o'rta | Kirill/lotin aralashuvi va UX detallari (07) | Localization qatlami; email niqoblash; kontrast |
| Yangi imkoniyat | Joy kutish — qayta-yangilash zarurati | Bildirishnoma obunasi (auto-buy emas) |

Bu tuzatishlarning aksariyati past-o'rta mehnat bilan amalga oshadi va foydalanuvchi ishonchi, tezligi hamda adolatli kirishida darhol sezilarli natija beradi.
