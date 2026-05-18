"""railway_credentials (shared railway.uz account, encrypted)

Revision ID: 0005
Revises: 0004
Create Date: 2026-05-18
"""
from __future__ import annotations

from alembic import op

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE railway_credentials (
            id              SERIAL PRIMARY KEY,
            username        TEXT NOT NULL,
            password_enc    TEXT NOT NULL,
            access_token    TEXT,
            refresh_token   TEXT,
            csrf_token      TEXT,
            cookie_str      TEXT,
            token_exp_at    TIMESTAMPTZ,
            last_login_at   TIMESTAMPTZ,
            cooldown_until  TIMESTAMPTZ,
            is_active       BOOLEAN NOT NULL DEFAULT TRUE,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
        );
    """)
    # Partial unique: only one active row at a time
    op.execute("""
        CREATE UNIQUE INDEX idx_railway_cred_active ON railway_credentials (is_active)
            WHERE is_active;
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS railway_credentials CASCADE;")
