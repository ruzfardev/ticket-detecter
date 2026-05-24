"""Bot filters — admin gating for privileged commands."""

from __future__ import annotations

from aiogram.filters import BaseFilter
from aiogram.types import Message

from app.core.config import settings


def is_admin(tg_user_id: int | None) -> bool:
    """True if the given TG user id is configured in ADMIN_IDS."""
    return tg_user_id is not None and tg_user_id in settings.admin_id_set


class IsAdmin(BaseFilter):
    """Message filter: passes only for admins. Use on command handlers.

    Callback handlers should call `is_admin(cq.from_user.id)` inline instead.
    """

    async def __call__(self, message: Message) -> bool:
        return is_admin(message.from_user.id if message.from_user else None)
