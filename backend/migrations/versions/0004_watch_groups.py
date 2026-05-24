"""watch_groups (materialized table, per-tier cadence)

Revision ID: 0004
Revises: 0003
Create Date: 2026-05-18
"""
from __future__ import annotations

from alembic import op

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE watch_groups (
            id               BIGSERIAL PRIMARY KEY,
            dep_code         TEXT NOT NULL REFERENCES stations(code),
            arr_code         TEXT NOT NULL REFERENCES stations(code),
            travel_date      DATE NOT NULL,
            has_premium      BOOLEAN NOT NULL DEFAULT FALSE,
            subscriber_count INT     NOT NULL DEFAULT 0,
            last_polled_at   TIMESTAMPTZ,
            next_poll_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
            cooldown_until   TIMESTAMPTZ,
            updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

            UNIQUE (dep_code, arr_code, travel_date)
        );
    """)
    # Partial-index predicates must be IMMUTABLE — now() is not allowed, so the
    # cooldown expiry is filtered at query time; the index covers no-cooldown rows.
    op.execute("""
        CREATE INDEX idx_wg_pollable ON watch_groups (next_poll_at)
            WHERE cooldown_until IS NULL;
    """)
    op.execute("""
        CREATE INDEX idx_wg_premium ON watch_groups (has_premium DESC, subscriber_count DESC);
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS watch_groups CASCADE;")
