"""
Telegram Mini App initData HMAC verification.

Reference: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
"""

from __future__ import annotations

import hashlib
import hmac
import json
import time
from dataclasses import dataclass
from urllib.parse import parse_qsl

from app.core.errors import ExpiredInitData, InvalidInitData


@dataclass(slots=True)
class TgUser:
    id: int
    first_name: str = ""
    last_name: str = ""
    username: str = ""
    language_code: str = "uz"
    is_premium: bool = False     # TG Premium (not our premium)


def verify_init_data(init_data: str, bot_token: str, max_age_seconds: int = 86400) -> TgUser:
    """
    Validate and parse Telegram WebApp initData.

    Args:
        init_data: raw query-string passed by Telegram (from `tg.initData`)
        bot_token: bot's token from BotFather
        max_age_seconds: reject initData older than this (default 24h)

    Returns:
        Parsed Telegram user.

    Raises:
        InvalidInitData: HMAC mismatch or malformed payload
        ExpiredInitData: auth_date too old
    """
    if not init_data:
        raise InvalidInitData("Empty initData")

    parsed = dict(parse_qsl(init_data, keep_blank_values=True))
    received_hash = parsed.pop("hash", None)
    if not received_hash:
        raise InvalidInitData("Missing hash")

    try:
        auth_date = int(parsed.get("auth_date", "0"))
    except ValueError:
        raise InvalidInitData("Invalid auth_date")

    if time.time() - auth_date > max_age_seconds:
        raise ExpiredInitData("initData older than allowed window")

    # Build the data_check_string: sorted key=value joined by \n
    data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(parsed.items()))

    secret_key = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
    calc_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()

    if not hmac.compare_digest(calc_hash, received_hash):
        raise InvalidInitData("HMAC mismatch")

    user_raw = parsed.get("user")
    if not user_raw:
        raise InvalidInitData("Missing user field")

    try:
        user_dict = json.loads(user_raw)
    except json.JSONDecodeError:
        raise InvalidInitData("Malformed user JSON")

    return TgUser(
        id=int(user_dict["id"]),
        first_name=user_dict.get("first_name", "") or "",
        last_name=user_dict.get("last_name", "") or "",
        username=user_dict.get("username", "") or "",
        language_code=(user_dict.get("language_code") or "uz")[:2],
        is_premium=bool(user_dict.get("is_premium", False)),
    )
