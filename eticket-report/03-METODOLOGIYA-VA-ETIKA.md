# Metodologiya va etika

Bu bo'lim hujjatdagi topilmalar **qanday** olingani va qaysi etik chegaralarga rioya qilingani bayon etadi. Buni boshida keltirishimizning sababi — texnik va xavfsizlik jamoasi har bir da'voning manbasini va chegaralarini aniq bilishi kerak.

## 1. Topilmalar manbai — ikki xil

**(a) Joriy passiv kuzatuv (2026-06-03).**
eticket'ning jonli interfeysi, tarmoq so'rovlari (Network) va brauzer storage'ini (`sessionStorage`, cookie kalit nomlari) **oddiy login qilingan foydalanuvchi sessiyasida** o'qish. Bu jarayonda hech narsa o'zgartirilmadi, hech qanday yozish (write) so'rovi yuborilmadi. UI/UX, performance, xavfsizlik header'lari va "Faol buyurtmalar" sahifasi kuzatuvi shu manbadan.

**(b) Nazoratli funksional testlar (o'z akkountimizda).**
Buyurtma/to'lov oqimiga oid topilmalar — `universal-orders/create` xulqi, to'lov sessiyasining brauzerga bog'langani va bron qilingan buyurtmani qayta to'lab bo'lmasligi — bizning **o'z eticket akkountimizda**, **o'z joylarimizda** o'tkazilgan nazoratli sinovlar orqali aniqlangan. Bu sinovlar **passiv emas** — ularda haqiqiy `create` so'rovlari yuborilgan. Shuning uchun biz ularni alohida, halol ajratamiz.

> **Aniqlik uchun:** "create tashqaridan ishlaydi, joyni ~10 daqiqa rezerv qiladi" va "bron qilingan buyurtmani qayta to'lab bo'lmaydi" degan da'volar (b) manbasiga — o'z akkountimizdagi nazoratli testga tegishli, sof passiv kuzatuvga emas.

## 2. Etik chegaralar (nimalarni qilMAdik)

- **Hech qanday DoS, flood yoki ommaviy so'rov** yuborilmadi — yagona maqsad xulq-atvorni tushunish edi.
- **Hech qanday eksploit yoki ruxsatsiz kirish** bo'lmagan; faqat o'z akkountimiz va o'z sessiyamiz ishlatildi.
- Testlarda yaratilgan **har qanday vaqtinchalik bron darhol bekor qilindi**; bekor qilinmaganlari ~10 daqiqada avtomatik bekor bo'ladi. **Uchinchi shaxslarga, real inventarga yoki boshqa yo'lovchilarga zarar yetkazilmadi.**
- **Hech kimning** karta, parol yoki shaxsiy ma'lumoti o'qilmadi/saqlanmadi (token va profil qiymatlari ham o'qilmadi — faqat kalit nomlari qayd etildi).

## 3. Mas'uliyatli oshkor qilish ruhi

Topilmalarni faqat **xavf** va **uni yumshatish (remediation)** doirasida taqdim etamiz. Hujjat **"hujum qo'llanmasi" emas** — biz ataylab operatsion suiiste'mol qadamlarini bosqichma-bosqich keltirmaymiz. Aynan rasmiy zaiflik-xabar kanali (`/.well-known/security.txt`) mavjud emasligi ham bizni to'g'ridan-to'g'ri sizga yozma murojaat qilishga undadi.
