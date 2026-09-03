"""autobuy: children under 5 ride on a lap, without a seat

eticket books such a child inside the accompanying adult's `children` list
with discount type CHILD_UNDER_5 and no seat of their own. They therefore do
not belong in `autobuy_friend_ids`, which is also the seat count; they get a
list of their own on the subscription, and the order remembers who rode along.

Revision ID: 0021
Revises: 0020
Create Date: 2026-09-03
"""
from __future__ import annotations

from alembic import op

revision: str = "0021"
down_revision: str | None = "0020"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE subscriptions "
        "ADD COLUMN autobuy_lap_child_ids BIGINT[] NOT NULL DEFAULT '{}'"
    )
    op.execute(
        "ALTER TABLE autobuy_orders "
        "ADD COLUMN lap_child_cache_ids BIGINT[] NOT NULL DEFAULT '{}'"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE autobuy_orders DROP COLUMN lap_child_cache_ids")
    op.execute("ALTER TABLE subscriptions DROP COLUMN autobuy_lap_child_ids")
