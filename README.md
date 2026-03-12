# Ticket Detector — eticket.railway.uz

Poyezd chiptalarini avtomatik tekshiradi va Telegram orqali xabar beradi.

## O'rnatish

```bash
pip install -r requirements.txt
```

## Sozlash

### 1. `.env` fayl yarating

```bash
cp .env.example .env
```

`.env` ni to'ldiring:

| Kalit | Izoh |
|-------|------|
| `REFRESH_TOKEN` | Railway saytidan Google login qilib olinadi (30 kun ishlaydi) |
| `TELEGRAM_BOT_TOKEN` | @BotFather dan oling |
| `TELEGRAM_CHAT_ID` | @userinfobot dan oling |

**RefreshToken olish:**
1. [eticket.railway.uz](https://eticket.railway.uz/uz/home) ga kiring
2. F12 → Network tab → Google orqali login qiling
3. `POST /api/v1/auth/register/google` so'rovining javobida `refreshToken` ni toping
4. `.env` ga qo'shing

### 2. `config.json` ni sozlang

```json
{
  "check_interval_minutes": 15,
  "routes": [
    {
      "name": "Urganch → Toshkent",
      "dep_station_code": "2900790",
      "arr_station_code": "2900000",
      "dates": ["2026-03-18"],
      "car_types": []
    }
  ]
}
```

**`car_types`** — bo'sh `[]` bo'lsa barcha vagon turlari tekshiriladi.
Filtrlash uchun: `["купе", "плацкарта"]`

**Stansiya kodlari (ma'lum bo'lganlar):**
| Stansiya | Kod |
|----------|-----|
| Toshkent | `2900000` |
| Urganch | `2900790` |

Boshqa stansiya kodlarini saytda qidirib, DevTools Network tab da `depStationCode` yoki `arvStationCode` ni toping.

## Ishga tushirish

```bash
python src/main.py
```

## Telegram xabari namunasi

```
Chipta topildi!
Marshrut: Urganch - Toshkent
Sana: 2026-03-18

126F (Yo'lovchi)
  16:05 -> 05:23 (13:18)
  Vagonlar: kupe, platskarta
```

## Muhim eslatmalar

- `RefreshToken` 30 kunda bir yangilanishi kerak
- Token muddati tugaganda bot Telegram orqali ogohlantiradi
- Serverda doim ishlab turishi uchun `screen`, `tmux` yoki systemd service ishlating
