"""notification_log

Revision ID: 0003
Revises: 0002
Create Date: 2026-05-18
"""
from __future__ import annotations

from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE notification_log (
            id                BIGSERIAL PRIMARY KEY,
            subscription_id   BIGINT NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
            user_id           BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            train_number      TEXT NOT NULL,
            seats_snapshot    JSONB NOT NULL,
            snapshot_hash     TEXT NOT NULL,
            seats_count       INT NOT NULL,
            tg_message_id     BIGINT,
            sent_at           TIMESTAMPTZ NOT NULL DEFAULT now()
        );
    """)
    op.execute("""
        CREATE INDEX idx_notif_log_dedup ON notification_log
            (subscription_id, train_number, snapshot_hash, sent_at DESC);
    """)
    op.execute("""
        CREATE INDEX idx_notif_log_user_recent ON notification_log
            (user_id, sent_at DESC);
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS notification_log CASCADE;")
