# Xavfsizlik kuzatuvlari (mas'uliyatli oshkor qilish)

Quyidagi kuzatuvlar 2026-yil 3-iyun kuni faqat **passiv** usulda (foydalanuvchining oddiy login qilingan sessiyasidagi HTTP javoblari va brauzer storage'ini o'qish) olib borildi — hech qanday faol hujum, eksploit, DoS yoki ma'lumot o'zgartirish bajarilmadi. Maqsadimiz ayblash emas, balki mas'uliyatli oshkor qilish (responsible disclosure) ruhida xavflarni ko'rsatib, ularni birgalikda yumshatish. Aksariyat topilmalar serverda bir nechta response header qo'shish bilan hal bo'ladi.

## 1. Yetishmayotgan xavfsizlik header'lari

HTML javobida bir qator standart himoya header'lari topilmadi. Bular alohida-alohida past xavf bo'lsa-da, JWT token brauzer storage'ida saqlanishi bilan birlashganda umumiy xavf darajasi oshadi (2-bo'limga qarang).

| Header | Holat | Ta'sir | Tavsiya |
|---|---|---|---|
| `Strict-Transport-Security` (HSTS) | Yo'q | SSL-stripping / protokol downgrade — ulanishni HTTPS'dan HTTP'ga tushirishga urinish himoyasiz | `max-age=31536000; includeSubDomains; preload` qo'shish |
| `X-Content-Type-Options` | Yo'q | MIME-sniffing — brauzer kontent turini noto'g'ri talqin qilishi mumkin | `nosniff` qo'shish |
| `Referrer-Policy` | Yo'q | URL'lardagi ma'lumot tashqi saytlarga oqib ketishi mumkin | `strict-origin-when-cross-origin` qo'shish |
| `Permissions-Policy` | Yo'q | Brauzer imkoniyatlari (kamera, geolokatsiya h.k.) cheklanmagan | Faqat kerakli imkoniyatlarni ruxsat etish |
| `Content-Security-Policy` | Juda minimal — faqat `frame-ancestors 'none'` | Clickjacking himoyasi bor (yaxshi), lekin `script-src` / `default-src` yo'q → **XSS yumshatish qatlami mavjud emas** | Bosqichma-bosqich `script-src`, `default-src`, `connect-src` qo'shish |

**Ta'sir:** Bu header'larning yo'qligi alohida holda kritik emas, lekin himoyaning "chuqurlik bo'yicha mudofaa" (defense-in-depth) qatlamini zaiflashtiradi. Ayniqsa CSP'da `script-src` yo'qligi XSS hodisasi yuz berganda uni cheklab turadigan hech qanday to'siq qoldirmaydi.

## 2. Token saqlash (eng yuqori e'tibordagi nuqta)

JWT token va foydalanuvchi profili `sessionStorage`'da saqlanadi. `sessionStorage` JavaScript orqali to'liq o'qiladigan saqlash maydoni — ya'ni har qanday XSS zaifligi yuzaga kelsa, hujumchi token'ni o'g'irlab, foydalanuvchi nomidan ish ko'rishi mumkin.

- **Alomat/dalil:** `sessionStorage`'da `token` (JWT) va user profili; shuningdek `userId`, `serviceId`, `activeOrderCount`, `captcha`, `key`, `redirectURL`, `st-name`/`st-code`/`sf-name`/`sf-code` kabi kalitlar. *(Eslatma: biz token va profil qiymatlarini o'qimadik/saqlamadik — faqat kalit nomlarini qayd etdik.)*
- **Ta'sir:** Yuqoridagi 1-bo'limdagi CSP zaifligi (XSS yumshatish yo'q) bilan **birlashganda** bu yuqori xavf hosil qiladi: token JS-o'qiy oladigan joyda + XSS'ni cheklaydigan CSP yo'q = bitta XSS hodisasi to'liq sessiya o'g'irlanishiga olib kelishi mumkin.
- **Tavsiya:** Imkon bo'lsa, autentifikatsiya token'ini `HttpOnly` + `Secure` + `SameSite` cookie'da saqlash (JS o'qiy olmaydi). Agar arxitektura sababli token storage'da qolishi shart bo'lsa, uni qisqa muddatli token + silent refresh bilan birlashtirish va yuqoridagi CSP `script-src` qatlamini joriy etish zarurati yanada oshadi.

## 3. Cookie'lar

Cookie holati umuman tartibli; quyida qayd etamiz.

| Cookie | Manba | Izoh |
|---|---|---|
| `XSRF-TOKEN` | eticket | CSRF himoyasi to'g'ri qo'llangan — **ijobiy** |
| `_ga`, `_ga_*` | Google Analytics | Analitika |
| `g_state` | Google Sign-In | Autentifikatsiya holati |
| `__stripe_mid`, `__stripe_sid` | Stripe | To'lov bilan bog'liq — quyida alohida izoh |

**Stripe haqida alohida izoh.** Milliy to'lov provayderlari (Hamkorbank-Hold, Payme va h.k.) yonida **Stripe** cookie'larining ko'rinishi — to'lov yoki ro'yxatdan o'tish oqimida uchinchi tomon (Stripe) skripti ishtirok etishini bildiradi. PCI-DSS va maxfiylik nuqtai nazaridan tekshirishni tavsiya etamiz: (a) Stripe skriptiga aynan qaysi to'lov yoki shaxsiy ma'lumotlar yetib boradi; (b) bu integratsiya hujjatlashtirilgan va zarurmi; (c) agar foydalanilmasa, uni olib tashlash hujum yuzasini (attack surface) kamaytiradi.

## 4. Zaiflik-xabar kanalining yo'qligi

`/.well-known/security.txt` fayli mavjud emas (so'rovga 200 qaytsa-da, bu aslida SPA'ning `index.html` javobi, security.txt emas). Bu rasmiy responsible-disclosure kanali yo'qligini bildiradi — ya'ni xavfsizlik tadqiqotchilari topilmalarni qayerga yuborishni bilmaydi.

- **Ta'sir:** Aynan shu bo'shliq sababli ushbu hujjat/tashabbus o'rinli — rasmiy kanal bo'lganida topilmalar to'g'ridan-to'g'ri jamoangizga yo'naltirilgan bo'lardi.
- **Tavsiya:** `/.well-known/security.txt` joriy etish (aloqa email, til, oshkor qilish siyosati havolasi bilan).

## 5. SPA catch-all xulqi

Mavjud bo'lmagan har qanday yo'l (`/robots.txt`, `*.js.map` va h.k.) `404` o'rniga `200` + `index.html` qaytaradi (SPA catch-all marshrutlash).

- **Ta'sir:** Keshlash va SEO uchun nomaqbul — mavjud bo'lmagan resurs "muvaffaqiyatli" deb belgilanadi.
- **Ijobiy:** Muhimi shundaki, hech qanday sourcemap (`*.js.map`) fosh **qilinmagan** — manba kodi tashqariga chiqmaydi.
- **Tavsiya:** Haqiqatan mavjud bo'lmagan statik resurslar (`.map`, `.txt` h.k.) uchun to'g'ri `404` qaytarish; SPA fallback'ni faqat ilova marshrutlariga cheklash.

## 6. Ijobiy xavfsizlik tomonlari

Adolat yuzasidan, jamoa allaqachon to'g'ri qo'llagan muhim himoyalarni tan olamiz:

- **CSRF himoyasi to'g'ri:** `XSRF-TOKEN` + `X-XSRF-TOKEN` juftligi qoidaga muvofiq ishlatilgan.
- **CORS qulflangan:** API'lar o'z origin'iga bog'langan — cross-origin so'rovlar bloklanadi.
- **Stack yashirilgan:** `Server` va `X-Powered-By` header'lari fosh qilinmagan (texnologiya steki oshkor emas).
- **Clickjacking himoyasi:** `X-Frame-Options: DENY` + CSP `frame-ancestors 'none'` — ikki qatlamli himoya.
- **reCAPTCHA** bot-himoyasi va **Angular production mode** (dev-mode emas) yoqilgan.

---

**Yakuniy izoh:** Yuqoridagilarning hammasi faqat passiv kuzatuv natijasidir — hech bir zaiflik faol eksploit qilinmagan, hech qanday token o'g'irlanmagan yoki sessiya buzilmagan. Topilmalar mas'uliyatli oshkor qilish ruhida taqdim etilgan; ularni eng avvalo bir nechta header qo'shish va `security.txt` joriy etish kabi tez yutuqlardan boshlab hal qilish tavsiya etiladi.
