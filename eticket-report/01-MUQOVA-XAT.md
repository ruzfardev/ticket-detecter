# Texnik kuzatuvlar va takliflar — eticket.railway.uz

**Kimga:** "O'zbekiston Temir Yo'llari" AJ — eticket.railway.uz texnik va mahsulot jamoasiga
**Sana:** 2026-yil 3-iyun
**Mavzu:** Mas'uliyatli oshkor qilish ruhida aniqlangan kamchiliklar va ularning yechimlari

---

Hurmatli eticket jamoasi,

Ushbu hujjat eticket.railway.uz xizmatining **mustaqil texnik va foydalanuvchi tahlili** natijasidir. Xizmatdan foydalanish jarayonida bir qator texnik, xavfsizlik va foydalanish kamchiliklarini diqqat bilan kuzatdik va ularni — har biriga aniq yechim tavsiyasi bilan — sizlar bilan ochiq, konstruktiv ruhda bo'lishishni o'z burchimiz deb bildik. Maqsadimiz ayblash emas, balki xizmatni yanada yaxshilashga hissa qo'shish.

**Metodologiya — halol bayon.** Topilmalar ikki manbadan: (1) jonli interfeys va tarmoq so'rovlarini oddiy login qilingan sessiyada **passiv kuzatish**; va (2) buyurtma/to'lov oqimiga oid topilmalar bo'yicha — **o'z eticket akkountimizda, o'z joylarimizda** o'tkazilgan **nazoratli funksional testlar**. Bu sinovlarda yaratilgan har qanday vaqtinchalik bron darhol bekor qilingan yoki ~10 daqiqada avtomatik bekor bo'lgan; **uchinchi shaxslarga, real inventarga yoki boshqa yo'lovchilarga zarar yetkazilmagan**. Hech qanday DoS, ommaviy so'rov, eksploit yoki ruxsatsiz kirish bo'lmagan. Batafsil: *03-Metodologiya va etika*. Hujjat faqat **xavf va uni yumshatish** doirasida tayyorlangan — "hujum qo'llanmasi" emas.

**Hujjat tarkibi:**
- **04** — Buyurtma va to'lov oqimi: bron qilingan buyurtmani qayta to'lab bo'lmasligi va bron↔to'lov assimetriyasi (joy egallab qolish xavfi);
- **05** — Xavfsizlik kuzatuvlari va tez yechimlar;
- **06** — Frontend performance va resurs optimizatsiyasi;
- **07** — UI/UX va lokalizatsiya kamchiliklari;
- **08** — Tavsiya etilgan yangi imkoniyatlar (bildirishnoma obunasi) va yakuniy xulosa.

Adolat yuzasidan, tizimning kuchli tomonlarini ham — puxta himoyalangan to'lov qatlami, to'g'ri qo'llangan CSRF himoyasi, qulflangan CORS, Angular production mode va aniq tuzilgan bron oqimini — alohida tan oldik.

Har qanday savol yoki izohga ochiqmiz. Vaqtingiz va e'tiboringiz uchun oldindan minnatdormiz.

Hurmat bilan,

**[Ism / aloqa ma'lumotlari — to'ldiring]**
