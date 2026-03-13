# Ticket Detector — eticket.railway.uz

Poyezd chiptalarini avtomatik tekshiradi va Telegram orqali xabar beradi.

---

## Talablar

- Python 3.10+
- Internet ulanishi (eticket.railway.uz va api.telegram.org ga kirish)

---

## 1. Loyihani yuklab oling

```bash
git clone https://github.com/your-username/ticket-detecter.git
cd ticket-detecter
```

---

## 2. Virtual muhit yarating va faollashtiring

**Linux / macOS:**
```bash
python3 -m venv .venv
source .venv/bin/activate
```

**Windows (CMD):**
```cmd
python -m venv .venv
.venv\Scripts\activate
```

**Windows (PowerShell):**
```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
```

**Windows (Git Bash):**
```bash
python -m venv .venv
source .venv/Scripts/activate
```

> Faollashtirilganda terminal chapda `(.venv)` ko'rinishi kerak.

---

## 3. Kerakli kutubxonalarni o'rnating

```bash
pip install -r requirements.txt
```

---

## 4. `.env` faylini sozlang

`.env.example` dan nusxa oling:

```bash
cp .env.example .env
```

`.env` faylini oching va to'ldiring:

```env
RAILWAY_USERNAME=sizning_emailingiz@gmail.com
RAILWAY_PASSWORD=sizning_parolingiz

TELEGRAM_BOT_TOKEN=1234567890:AAExxx...
TELEGRAM_CHAT_ID=970956519
```

**`TELEGRAM_CHAT_ID` ni qanday topish:**
1. Telegramda `@userinfobot` ga `/start` yuboring
2. Bot sizning `Id:` raqamingizni ko'rsatadi — shu raqamni yozing

---

## 5. `config.json` ni sozlang

```json
{
  "check_interval_minutes": 15,
  "heartbeat_time": "08:00",
  "routes": [
    {
      "name": "Urganch → Toshkent",
      "dep_station_code": "2900790",
      "arr_station_code": "2900000",
      "date_from": "2026-03-28",
      "date_to": "2026-04-05",
      "car_types": []
    },
    {
      "name": "Toshkent → Urganch",
      "dep_station_code": "2900000",
      "arr_station_code": "2900790",
      "date_from": "2026-04-05",
      "date_to": "2026-04-10",
      "car_types": []
    }
  ]
}
```

**Parametrlar:**

| Kalit | Izoh |
|-------|------|
| `check_interval_minutes` | Qancha daqiqada bir tekshirish (1–120) |
| `heartbeat_time` | Har kuni shu vaqtda "Bot ishlayapti" xabari yuboriladi |
| `name` | Marshrut nomi (Telegram xabarida ko'rinadi) |
| `dep_station_code` | Jo'nash stantsiyasi kodi |
| `arr_station_code` | Manzil stantsiyasi kodi |
| `date_from` | Tekshirish boshlanish sanasi (`YYYY-MM-DD`) |
| `date_to` | Tekshirish tugash sanasi (`YYYY-MM-DD`) |
| `car_types` | Vagon turi filtri. Bo'sh `[]` bo'lsa hammasi tekshiriladi |

**Ma'lum stantsiya kodlari:**

| Stantsiya | Kod |
|-----------|-----|
| Toshkent | `2900000` |
| Urganch | `2900790` |

Boshqa stantsiya kodlarini eticket.railway.uz da qidirib, F12 → Network tab dan `depStationCode` ni toping.

---

## 6. Ishga tushirish

```bash
python src/main.py
```

Bot ishga tushgach Telegram ga "Bot ishlayapti" xabari keladi va birinchi tekshiruv darhol boshlanadi.

---

## Telegram bot buyruqlari

Botga quyidagi buyruqlarni yuborish mumkin:

| Buyruq | Izoh |
|--------|------|
| `/routes` | Hozirgi marshrutlar va sanalarni ko'rish |
| `/checknow` | Darhol tekshirishni boshlash |
| `/interval 10` | Tekshirish intervalini 10 daqiqaga o'zgartirish |
| `/setdates 1 2026-04-01 2026-04-10` | 1-marshrut sanalarini yangilash |

> Faqat `.env` dagi `TELEGRAM_CHAT_ID` dan kelgan buyruqlar qabul qilinadi.

---

## Serverda doim ishlab turishi uchun

**`screen` orqali (Linux):**

```bash
screen -S ticket-bot
source .venv/bin/activate
python src/main.py
# Ctrl+A, keyin D — fonga o'tkazish
```

Qayta ulash:
```bash
screen -r ticket-bot
```

**`systemd` service (Linux):**

`/etc/systemd/system/ticket-bot.service` faylini yarating:

```ini
[Unit]
Description=Ticket Detector Bot
After=network.target

[Service]
WorkingDirectory=/path/to/ticket-detecter
ExecStart=/path/to/ticket-detecter/.venv/bin/python src/main.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Ishga tushirish:
```bash
sudo systemctl enable ticket-bot
sudo systemctl start ticket-bot
sudo systemctl status ticket-bot
```

---

## Telegram xabari namunasi

```
🎫 Chipta topildi! — Urganch → Toshkent
📅 2026-03-31

• 076Ж (Yo'lovchi)
  🕐 16:05 → 05:23 (13:18)
  🪑 Umumiy — 24 bo'sh o'rindiq
     Vagon 21: 2 joy (38, 44)
     Vagon 22: 5 joy (22, 40, 44, 48, 54)
```

---

## Loyiha tuzilmasi

```
ticket-detecter/
├── src/
│   ├── main.py       # Asosiy scheduler
│   ├── auth.py       # eticket.railway.uz login
│   ├── checker.py    # Chipta tekshirish
│   ├── notifier.py   # Telegram xabar formati
│   ├── state.py      # Takroriy xabar oldini olish
│   └── bot.py        # Telegram bot buyruqlari
├── data/
│   └── seen_trains.json  # Holat fayli (avtomatik yaratiladi)
├── config.json       # Marshrutlar va sozlamalar
├── .env              # Maxfiy ma'lumotlar (git ga qo'shilmaydi)
├── .env.example      # .env namunasi
└── requirements.txt
```
