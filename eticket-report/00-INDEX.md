# eticket.railway.uz — Texnik kuzatuvlar va takliflar

Bu papka "O'zbekiston Temir Yo'llari" AJ / eticket.railway.uz texnik va mahsulot jamoasiga yuborish uchun tayyorlangan **mustaqil texnik audit hujjati**ni o'z ichiga oladi. Til: **O'zbek (lotin)**. Mazmun: **faqat kamchiliklar va ularning yechimlari** (neytral, konstruktiv). Hech qanday tijoriy taklif yoki hamkorlik pitch'i yo'q.

## O'qish tartibi

| # | Fayl | Mazmuni |
|---|---|---|
| 00 | `00-INDEX.md` | Ushbu navigatsiya |
| 01 | `01-MUQOVA-XAT.md` | Muqova-xat (jamoaga murojaat) |
| 02 | `02-QISQACHA-XULOSA.md` | Executive summary — barcha topilmalar jiddiylik bo'yicha |
| 03 | `03-METODOLOGIYA-VA-ETIKA.md` | Topilmalar qanday olingani va etik chegaralar |
| 04 | `04-BUYURTMA-TOLOV.md` | Buyurtma/to'lov: qayta to'lab bo'lmasligi (4.1) + bron↔to'lov assimetriyasi (4.2) |
| 05 | `05-XAVFSIZLIK.md` | Xavfsizlik kuzatuvlari (passiv, responsible disclosure) |
| 06 | `06-TEXNIK-PERFORMANCE.md` | Frontend stack, performance, resurs optimizatsiyasi |
| 07 | `07-UI-UX.md` | UI/UX va lokalizatsiya kamchiliklari |
| 08 | `08-TAVSIYALAR.md` | Tavsiya: bildirishnoma obunasi (auto-buy emas) + yakuniy xulosa |
| — | `RAW-FINDINGS.md` | Xom kuzatuv yozuvlari (ichki manba — yuborilmaydi) |
| — | `assets/` | Skrinshotlar uchun (hozircha bo'sh — qo'lda qo'shiladi) |

## Asosiy topilmalar (qisqa)

1. **(Yuqori)** Bron qilingan, to'lovi tugallanmagan buyurtmani "Faol buyurtmalar"dan turib **qayta to'lab bo'lmaydi** (4.1).
2. **(Yuqori)** Bron↔to'lov assimetriyasi → **joy egallab qolish** (hoarding) xavfi (4.2).
3. **(O'rta–yuqori)** Token `sessionStorage`'da + zaif CSP; yetishmayotgan xavfsizlik header'lari (05).
4. **(O'rta)** Angular 11.1.2 (EOL), ~1.33MB shrift, ortiqcha bundle (06).
5. **(Past–o'rta)** Kirill/lotin aralashuvi va UX detallari (07).
6. **(Tavsiya)** Saytga **bildirishnoma obunasi** qo'shish; **auto-buy emas** — u hoarding'ni kuchaytiradi (08).

## Holat

- Topilmalar **2026-06-03** kuni jonli tekshiruv (passiv) + o'z akkountdagi nazoratli testlar asosida.
- 4.1 (qayta to'lab bo'lmaslik) "Faol buyurtmalar" sahifasida kuzatildi; bron holatidagi xulq oldingi nazoratli testlarda ham tasdiqlangan.

## Yuborishdan oldin to'ldirish kerak

- [ ] Muqova-xatda **ism / aloqa ma'lumotlari**.
- [ ] `assets/` ga asosiy **skrinshotlar** (kirill/lotin natijalar sahifasi, "Faol buyurtmalar" bo'sh/holati, seat-map) — dalil sifatida.
- [ ] Ixtiyoriy: `01`–`08` ni bitta **PDF**ga birlashtirish.
- [ ] Ixtiyoriy: rasmiy yozishma uchun qisqa **rus tilidagi muqova**.

## Eslatma

`RAW-FINDINGS.md` — ichki ish hujjati; eticket jamoasiga **faqat `01`–`08` fayllari** yuboriladi.
