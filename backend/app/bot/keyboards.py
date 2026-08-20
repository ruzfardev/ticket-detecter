"""Bot keyboards: persistent reply menu + auxiliary inline keyboards."""

from __future__ import annotations

from aiogram.types import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    KeyboardButton,
    ReplyKeyboardMarkup,
)

from app.bot.i18n import t

# Public Telegram channel for news, tips and free-seat alerts.
CHANNEL_USERNAME = "railwayuzz"
CHANNEL_URL = f"https://t.me/{CHANNEL_USERNAME}"


def main_menu(lang: str = "uz") -> ReplyKeyboardMarkup:
    """Bottom reply keyboard — persistent menu with a dedicated channel row."""
    return ReplyKeyboardMarkup(
        keyboard=[
            [
                KeyboardButton(text=t("menu.notifs", lang)),
                KeyboardButton(text=t("menu.orders", lang)),
            ],
            [
                KeyboardButton(text=t("menu.status", lang)),
                KeyboardButton(text=t("menu.premium", lang)),
            ],
            [
                KeyboardButton(text=t("menu.donate", lang)),
                KeyboardButton(text=t("menu.channel", lang)),
            ],
            [
                KeyboardButton(text=t("menu.help", lang)),
                KeyboardButton(text=t("menu.contact", lang)),
            ],
        ],
        resize_keyboard=True,
        # Not persistent: Telegram shows a keyboard-toggle icon in the input bar
        # so the user can collapse/expand this menu themselves.
        is_persistent=False,
    )


def channel_link(lang: str = "uz") -> InlineKeyboardMarkup:
    """Inline keyboard with a single button opening the public channel."""
    label = {"ru": "📢 Открыть канал", "en": "📢 Open channel"}.get(
        lang, "📢 Kanalga o'tish")
    return InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text=label, url=CHANNEL_URL),
    ]])


def language_picker() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="🇺🇿 O'zbekcha", callback_data="lang:uz"),
        InlineKeyboardButton(text="🇷🇺 Русский",    callback_data="lang:ru"),
        InlineKeyboardButton(text="🇬🇧 English",    callback_data="lang:en"),
    ]])
