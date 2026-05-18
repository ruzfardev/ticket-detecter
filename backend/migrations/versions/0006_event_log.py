"""event_log (generic audit)

Revision ID: 0006
Revises: 0005
Create Date: 2026-05-18
"""
from __future__ import annotations

from alembic import op

revision: str = "0006"
down_revision: str | None = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE event_log (
            id          BIGSERIAL PRIMARY KEY,
            user_id     BIGINT REFERENCES users(id),
            type        TEXT NOT NULL,
            payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
        );
    """)
    op.execute("CREATE INDEX idx_event_log_type_ts ON event_log (type, created_at DESC);")
    op.execute("CREATE INDEX idx_event_log_user ON event_log (user_id, created_at DESC) WHERE user_id IS NOT NULL;")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS event_log CASCADE;")
