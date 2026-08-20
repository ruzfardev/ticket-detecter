"""subscriptions: how to handle a multi-passenger auto-buy with too few seats

`_maybe_autobuy` hard-coded all-or-nothing: unless one car had a seat for every
passenger, it returned silently and bought nothing. For a 2-passenger
subscription that meant watching a train where a single seat kept appearing and
never taking it.

Neither answer is right for everyone — a family travelling together does not
want one ticket, while someone booking for colleagues would rather secure what
is there — so it becomes a per-subscription choice:

    'all'     every passenger in one car, or nothing (default, unchanged)
    'partial' take as many adjacent seats as the best car offers, at least one

Default 'all' keeps existing subscriptions behaving exactly as before.

Revision ID: 0017
Revises: 0016
Create Date: 2026-08-20
"""
from __future__ import annotations

from alembic import op

revision: str = "0017"
down_revision: str | None = "0016"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE subscriptions
        ADD COLUMN IF NOT EXISTS autobuy_seat_strategy TEXT NOT NULL DEFAULT 'all';
    """)
    op.execute("""
        ALTER TABLE subscriptions
        DROP CONSTRAINT IF EXISTS subscriptions_autobuy_seat_strategy_check;
    """)
    op.execute("""
        ALTER TABLE subscriptions
        ADD CONSTRAINT subscriptions_autobuy_seat_strategy_check
        CHECK (autobuy_seat_strategy IN ('all', 'partial'));
    """)


def downgrade() -> None:
    op.execute("""
        ALTER TABLE subscriptions
        DROP CONSTRAINT IF EXISTS subscriptions_autobuy_seat_strategy_check;
    """)
    op.execute("""
        ALTER TABLE subscriptions
        DROP COLUMN IF EXISTS autobuy_seat_strategy;
    """)
