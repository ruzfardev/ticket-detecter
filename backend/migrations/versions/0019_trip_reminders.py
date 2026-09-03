"""trip_reminders: one row per (user, ticket leg, kind) reminder ever sent

The worker reminds a traveller 24 h and 2 h before departure, with the PDF
attached. The unique key is the dedup: the sweep claims the row with
INSERT ... ON CONFLICT DO NOTHING before it sends anything, so a restart in the
middle of a sweep can never fire the same reminder twice.

Revision ID: 0019
Revises: 0018
Create Date: 2026-09-03
"""
from __future__ import annotations

from alembic import op

revision: str = "0019"
down_revision: str | None = "0018"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE trip_reminders (
            id            BIGSERIAL PRIMARY KEY,
            user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            order_item_id TEXT   NOT NULL,
            kind          TEXT   NOT NULL CHECK (kind IN ('t24', 't2')),
            dep_at        TIMESTAMPTZ NOT NULL,
            status        TEXT   NOT NULL DEFAULT 'sent'
                          CHECK (status IN ('sent', 'skipped_returned')),
            pdf_sent      BOOLEAN NOT NULL DEFAULT FALSE,
            sent_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
            UNIQUE (user_id, order_item_id, kind)
        )
        """
    )
    op.execute(
        "CREATE INDEX idx_trip_reminders_recent ON trip_reminders (user_id, sent_at DESC)"
    )


def downgrade() -> None:
    op.execute("DROP TABLE trip_reminders")
