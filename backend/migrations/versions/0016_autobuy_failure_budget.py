"""subscriptions: consecutive auto-buy failure counter

Auto-buy retried forever: an order expires, the watcher finds the seat again,
creates a new order, the bank sends another SMS — roughly every 12 minutes,
indefinitely. That holds real seats away from other buyers in repeating blocks
and walks straight into the bank's OTP rate limits.

The counter lets auto-buy disable itself after a few consecutive failures and
tell the user why, degrading to plain notifications instead of looping. It is
reset on a successful purchase and whenever the user re-arms auto-buy.

Revision ID: 0016
Revises: 0015
Create Date: 2026-08-20
"""
from __future__ import annotations

from alembic import op

revision: str = "0016"
down_revision: str | None = "0015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE subscriptions "
        "ADD COLUMN IF NOT EXISTS autobuy_fail_count INT NOT NULL DEFAULT 0;"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE subscriptions DROP COLUMN IF EXISTS autobuy_fail_count;")
