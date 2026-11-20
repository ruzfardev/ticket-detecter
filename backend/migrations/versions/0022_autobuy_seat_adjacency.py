"""subscriptions: whether a group's auto-buy seats must sit together

Auto-buy took the lowest-numbered free seats in one car, so two people could
end up at opposite ends of it (3 and 17). Seats in one compartment are what a
group means by "together", so it becomes a per-subscription choice:

    'any'       any seats in one car; a compartment is still preferred when
                one is free (default)
    'together'  only seats in one compartment — or neighbouring compartments
                for a group larger than one. Side berths never count.

Default 'any' keeps every existing subscription buying as before, except that
it now prefers a shared compartment when the same snapshot offers one.

Revision ID: 0022
Revises: 0021
Create Date: 2026-11-20
"""
from __future__ import annotations

from alembic import op

revision: str = "0022"
down_revision: str | None = "0021"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE subscriptions
        ADD COLUMN autobuy_seat_adjacency TEXT NOT NULL DEFAULT 'any'
        CONSTRAINT subscriptions_autobuy_seat_adjacency_check
        CHECK (autobuy_seat_adjacency IN ('any', 'together'));
    """)


def downgrade() -> None:
    op.execute("ALTER TABLE subscriptions DROP COLUMN autobuy_seat_adjacency")
