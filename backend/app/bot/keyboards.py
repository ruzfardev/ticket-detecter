"""Bot keyboards: persistent reply menu + auxiliary inline keyboards."""

from __future__ import annotations

from aiogram.types import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    KeyboardButton,
    ReplyKeyboardMarkup,
    WebAppInfo,
)

from app.bot.i18n import t
from app.core.config import settings


def main_menu(lang: str = "uz", mini_app_url: str = "") -> ReplyKeyboardMarkup:
    """Bottom reply keyboard — persistent, three rows of two."""
    url = mini_app_url or _default_mini_app_url()
    return ReplyKeyboardMarkup(
        keyboard=[
            [
                KeyboardButton(text=t("menu.search", lang),
                               web_app=WebAppInfo(url=url) if url else None),
                KeyboardButton(text=t("menu.notifs", lang)),
            ],
            [
                KeyboardButton(text=t("menu.premium", lang)),
                KeyboardButton(text=t("menu.donate", lang)),
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


def language_picker() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="🇺🇿 O'zbekcha", callback_data="lang:uz"),
        InlineKeyboardButton(text="🇷🇺 Русский",    callback_data="lang:ru"),
        InlineKeyboardButton(text="🇬🇧 English",    callback_data="lang:en"),
    ]])


def _default_mini_app_url() -> str:
    # Production URL is set elsewhere; dev keeps it empty so the button
    # falls back to a regular text button (no WebApp).
    return ""
