"""auto-buy: multiple passengers per subscription / order

Adds array columns so one auto-buy can book several passengers (1-4) in a
single eticket order (one payment, one OTP). The old single-value columns are
kept as the "primary/anchor" element for backward compatibility and for the
existing in-flight race-guard unique index (which is on seat_number).

Revision ID: 0012
Revises: 0011
Create Date: 2026-08-19
"""
from __future__ import annotations

from alembic import op

revision: str = "0012"
down_revision: str | None = "0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # subscriptions: friend_ids[] alongside the single autobuy_friend_id
    op.execute("""
        ALTER TABLE subscriptions
          ADD COLUMN IF NOT EXISTS autobuy_friend_ids BIGINT[] NOT NULL DEFAULT '{}';
    """)
    op.execute("""
        UPDATE subscriptions
           SET autobuy_friend_ids = ARRAY[autobuy_friend_id]
         WHERE autobuy_friend_id IS NOT NULL
           AND (autobuy_friend_ids IS NULL OR array_length(autobuy_friend_ids, 1) IS NULL);
    """)

    # autobuy_orders: seat_numbers[] + passenger_cache_ids[] alongside the singles
    op.execute("""
        ALTER TABLE autobuy_orders
          ADD COLUMN IF NOT EXISTS seat_numbers INT[] NOT NULL DEFAULT '{}';
    """)
    op.execute("""
        ALTER TABLE autobuy_orders
          ADD COLUMN IF NOT EXISTS passenger_cache_ids BIGINT[] NOT NULL DEFAULT '{}';
    """)
    op.execute("""
        UPDATE autobuy_orders
           SET seat_numbers = ARRAY[seat_number]
         WHERE seat_number IS NOT NULL
           AND (seat_numbers IS NULL OR array_length(seat_numbers, 1) IS NULL);
    """)
    op.execute("""
        UPDATE autobuy_orders
           SET passenger_cache_ids = ARRAY[railway_friend_cache_id]
         WHERE railway_friend_cache_id IS NOT NULL
           AND (passenger_cache_ids IS NULL OR array_length(passenger_cache_ids, 1) IS NULL);
    """)


def downgrade() -> None:
    op.execute("ALTER TABLE autobuy_orders DROP COLUMN IF EXISTS passenger_cache_ids;")
    op.execute("ALTER TABLE autobuy_orders DROP COLUMN IF EXISTS seat_numbers;")
    op.execute("ALTER TABLE subscriptions DROP COLUMN IF EXISTS autobuy_friend_ids;")
