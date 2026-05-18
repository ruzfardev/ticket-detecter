"""
Simple in-code i18n. Keys are dot-paths, values are format-strings.

Kept as Python dict (not .toml) for MVP — moving to files is a future
refactor when the dictionary grows beyond ~200 entries.
"""

from __future__ import annotations

from typing import Any

# ---- Translations -----------------------------------------------------------

_DICT: dict[str, dict[str, str]] = {
    "uz": {
        # /start
        "start.greeting": "👋 Assalomu alaykum, {name}!",
        "start.intro": (
            "Men eticket.railway.uz saytida poyezd chiptasi bo'sh joy paydo "
            "bo'lganda sizga darhol xabar beraman.\n\n"
            "Boshlash uchun pastdagi <b>🔍 Poyezd qidirish</b> tugmasini bosing."
        ),

        # Reply keyboard labels
        "menu.search": "🔍 Poyezd qidirish",
        "menu.notifs": "🔔 Xabarnomalar",
        "menu.premium": "⭐ Premium",
        "menu.donate": "❤️ Donate",
        "menu.help": "ℹ️ Yordam",
        "menu.contact": "📞 Aloqa",

        # /my
        "my.title": "🔔 Sizning xabarnomalaringiz ({used}/{max}):",
        "my.empty": "📭 Hozircha xabarnoma yo'q.\n\nPastdagi <b>🔍 Poyezd qidirish</b> tugmasini bosib yarating.",
        "my.row": "{idx}. 🚂 <b>{route}</b>\n   📅 {date} · 🚆 {train}\n   🪑 {car_type} · {berth}",
        "my.full_premium_hint": "\n⭐ <b>Premium</b> oling — 3 ta xabarnoma + 3x tezroq topish.",

        # /help
        "help.title": "ℹ️ <b>Yordam</b>",
        "help.body": (
            "🔍 <b>Poyezd qidirish</b> — Mini App orqali marshrut, sana, poyezd, "
            "vagon turi va joy turini tanlang. Bo'sh joy paydo bo'lganda darhol "
            "xabar olasiz.\n\n"
            "🔔 <b>Xabarnomalar</b> — aktiv qidiruvlaringiz ro'yxati.\n"
            "⭐ <b>Premium</b> — 3 ta xabarnoma + 3x tezroq tekshirish.\n"
            "❤️ <b>Donate</b> — botni qo'llab-quvvatlash.\n"
            "📞 <b>Aloqa</b> — savol/muammo bo'lsa."
        ),

        # /contact
        "contact.title": "📞 <b>Aloqa</b>",
        "contact.body": (
            "Texnik yordam: @TicketDetectorSupport\n"
            "Telegram kanal: @TicketTips\n\n"
            "Yoki shu chat'ga xabar yozing — admin 24 soat ichida javob beradi."
        ),

        # Language picker
        "lang.choose": "🌐 Tilni tanlang:",
        "lang.changed": "✅ Til o'zgartirildi.",

        # Unknown / fallback
        "fallback.unknown": "🤔 Tushunmadim. Pastdagi tugmalardan foydalaning yoki /help.",
        "fallback.error": "⚠️ Xato yuz berdi. Iltimos, qayta urinib ko'ring.",
    },
    "ru": {
        "start.greeting": "👋 Здравствуйте, {name}!",
        "start.intro": (
            "Я слежу за билетами на eticket.railway.uz и сразу пришлю уведомление, "
            "когда появятся свободные места.\n\n"
            "Чтобы начать, нажмите <b>🔍 Найти поезд</b>."
        ),
        "menu.search": "🔍 Найти поезд",
        "menu.notifs": "🔔 Уведомления",
        "menu.premium": "⭐ Premium",
        "menu.donate": "❤️ Donate",
        "menu.help": "ℹ️ Помощь",
        "menu.contact": "📞 Контакты",
        "my.title": "🔔 Ваши уведомления ({used}/{max}):",
        "my.empty": "📭 Пока нет уведомлений.\n\nНажмите <b>🔍 Найти поезд</b>.",
        "my.row": "{idx}. 🚂 <b>{route}</b>\n   📅 {date} · 🚆 {train}\n   🪑 {car_type} · {berth}",
        "my.full_premium_hint": "\n⭐ <b>Premium</b> — 3 уведомления + 3x быстрее.",
        "help.title": "ℹ️ <b>Помощь</b>",
        "help.body": (
            "🔍 <b>Найти поезд</b> — через Mini App выберите маршрут, дату, поезд, тип "
            "вагона и места.\n"
            "🔔 <b>Уведомления</b> — список активных поисков.\n"
            "⭐ <b>Premium</b> — 3 уведомления + 3x быстрее.\n"
            "❤️ <b>Donate</b> — поддержать проект.\n"
            "📞 <b>Контакты</b> — связь с поддержкой."
        ),
        "contact.title": "📞 <b>Контакты</b>",
        "contact.body": (
            "Поддержка: @TicketDetectorSupport\n"
            "Канал: @TicketTips\n\n"
            "Или напишите в этот чат — ответим в течение 24 часов."
        ),
        "lang.choose": "🌐 Выберите язык:",
        "lang.changed": "✅ Язык изменён.",
        "fallback.unknown": "🤔 Не понял. Используйте кнопки или /help.",
        "fallback.error": "⚠️ Произошла ошибка. Попробуйте ещё раз.",
    },
    "en": {
        "start.greeting": "👋 Hello, {name}!",
        "start.intro": (
            "I monitor eticket.railway.uz tickets and notify you instantly when "
            "seats become available.\n\n"
            "Tap <b>🔍 Search train</b> below to start."
        ),
        "menu.search": "🔍 Search train",
        "menu.notifs": "🔔 Notifications",
        "menu.premium": "⭐ Premium",
        "menu.donate": "❤️ Donate",
        "menu.help": "ℹ️ Help",
        "menu.contact": "📞 Contact",
        "my.title": "🔔 Your notifications ({used}/{max}):",
        "my.empty": "📭 No notifications yet.\n\nTap <b>🔍 Search train</b>.",
        "my.row": "{idx}. 🚂 <b>{route}</b>\n   📅 {date} · 🚆 {train}\n   🪑 {car_type} · {berth}",
        "my.full_premium_hint": "\n⭐ <b>Premium</b> — 3 notifications + 3x faster.",
        "help.title": "ℹ️ <b>Help</b>",
        "help.body": (
            "🔍 <b>Search train</b> — via Mini App pick route, date, train, car type, "
            "and berth.\n"
            "🔔 <b>Notifications</b> — your active searches.\n"
            "⭐ <b>Premium</b> — 3 slots + 3x faster checking.\n"
            "❤️ <b>Donate</b> — support the project.\n"
            "📞 <b>Contact</b> — support."
        ),
        "contact.title": "📞 <b>Contact</b>",
        "contact.body": (
            "Support: @TicketDetectorSupport\n"
            "Channel: @TicketTips\n\n"
            "Or message this chat — admin replies within 24 hours."
        ),
        "lang.choose": "🌐 Choose language:",
        "lang.changed": "✅ Language updated.",
        "fallback.unknown": "🤔 Didn't get that. Use the buttons or /help.",
        "fallback.error": "⚠️ Something went wrong. Try again.",
    },
}


def t(key: str, lang: str = "uz", **kwargs: Any) -> str:
    """Translate `key` to `lang`. Falls back to uz, then to the raw key."""
    table = _DICT.get(lang) or _DICT["uz"]
    template = table.get(key) or _DICT["uz"].get(key) or key
    try:
        return template.format(**kwargs) if kwargs else template
    except (KeyError, IndexError):
        return template
