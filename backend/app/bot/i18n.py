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
        "menu.notifs": "🔔 Xabarnomalarim",
        "menu.premium": "⭐ Premium",
        "menu.donate": "❤️ Qo'llab-quvvatlash",
        "menu.channel": "📢 Kanal",
        "menu.help": "ℹ️ Yordam",
        "menu.contact": "📞 Aloqa",
        "menu.status": "👤 Holatim",
        "menu.orders": "🎫 Buyurtmalarim",

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
            "🔔 <b>Xabarnomalarim</b> — aktiv qidiruvlaringiz ro'yxati.\n"
            "⭐ <b>Premium</b> — 3 ta xabarnoma + 3x tezroq tekshirish.\n"
            "❤️ <b>Qo'llab-quvvatlash</b> — botni qo'llab-quvvatlash.\n"
            "📢 <b>Kanal</b> — yangiliklar va maslahatlar (@railwayuzz).\n"
            "📞 <b>Aloqa</b> — savol/muammo bo'lsa."
        ),

        # Channel
        "channel.title": "📢 <b>Chiptachi kanali</b>",
        "channel.body": (
            "Temir yo'l chiptalari bo'yicha yangiliklar, maslahatlar va bo'sh "
            "joy e'lonlari.\n\n👉 @railwayuzz"
        ),

        # /contact
        "contact.title": "📞 <b>Aloqa</b>",
        "contact.body": (
            "💬 Savol yoki muammo bo'lsa, shu yerga — botga yozing. "
            "Admin imkon qadar tez javob beradi.\n\n"
            "📢 Yangiliklar va maslahatlar: @railwayuzz"
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
        "menu.notifs": "🔔 Мои уведомления",
        "menu.premium": "⭐ Premium",
        "menu.donate": "❤️ Поддержать",
        "menu.channel": "📢 Канал",
        "menu.help": "ℹ️ Помощь",
        "menu.contact": "📞 Контакты",
        "menu.status": "👤 Мой статус",
        "menu.orders": "🎫 Мои заказы",
        "my.title": "🔔 Ваши уведомления ({used}/{max}):",
        "my.empty": "📭 Пока нет уведомлений.\n\nНажмите <b>🔍 Найти поезд</b>.",
        "my.row": "{idx}. 🚂 <b>{route}</b>\n   📅 {date} · 🚆 {train}\n   🪑 {car_type} · {berth}",
        "my.full_premium_hint": "\n⭐ <b>Premium</b> — 3 уведомления + 3x быстрее.",
        "help.title": "ℹ️ <b>Помощь</b>",
        "help.body": (
            "🔍 <b>Найти поезд</b> — через Mini App выберите маршрут, дату, поезд, тип "
            "вагона и места.\n"
            "🔔 <b>Мои уведомления</b> — список активных поисков.\n"
            "⭐ <b>Premium</b> — 3 уведомления + 3x быстрее.\n"
            "❤️ <b>Поддержать</b> — поддержать проект.\n"
            "📢 <b>Канал</b> — новости и советы (@railwayuzz).\n"
            "📞 <b>Контакты</b> — связь с поддержкой."
        ),
        "channel.title": "📢 <b>Канал Chiptachi</b>",
        "channel.body": (
            "Новости, советы и объявления о свободных местах на ж/д билеты.\n\n"
            "👉 @railwayuzz"
        ),
        "contact.title": "📞 <b>Контакты</b>",
        "contact.body": (
            "💬 Есть вопрос или проблема? Напишите прямо сюда, в бот — "
            "админ ответит как можно скорее.\n\n"
            "📢 Новости и советы: @railwayuzz"
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
        "menu.notifs": "🔔 My notifications",
        "menu.premium": "⭐ Premium",
        "menu.donate": "❤️ Support",
        "menu.channel": "📢 Channel",
        "menu.help": "ℹ️ Help",
        "menu.contact": "📞 Contact",
        "menu.status": "👤 My status",
        "menu.orders": "🎫 My orders",
        "my.title": "🔔 Your notifications ({used}/{max}):",
        "my.empty": "📭 No notifications yet.\n\nTap <b>🔍 Search train</b>.",
        "my.row": "{idx}. 🚂 <b>{route}</b>\n   📅 {date} · 🚆 {train}\n   🪑 {car_type} · {berth}",
        "my.full_premium_hint": "\n⭐ <b>Premium</b> — 3 notifications + 3x faster.",
        "help.title": "ℹ️ <b>Help</b>",
        "help.body": (
            "🔍 <b>Search train</b> — via Mini App pick route, date, train, car type, "
            "and berth.\n"
            "🔔 <b>My notifications</b> — your active searches.\n"
            "⭐ <b>Premium</b> — 3 slots + 3x faster checking.\n"
            "❤️ <b>Support</b> — support the project.\n"
            "📢 <b>Channel</b> — news and tips (@railwayuzz).\n"
            "📞 <b>Contact</b> — support."
        ),
        "channel.title": "📢 <b>Chiptachi channel</b>",
        "channel.body": (
            "News, tips and free-seat alerts for railway tickets.\n\n"
            "👉 @railwayuzz"
        ),
        "contact.title": "📞 <b>Contact</b>",
        "contact.body": (
            "💬 Questions or issues? Just message this bot — the admin "
            "will reply as soon as possible.\n\n"
            "📢 News & tips: @railwayuzz"
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
