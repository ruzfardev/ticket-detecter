"""payments (premium + donate)

Revision ID: 0002
Revises: 0001
Create Date: 2026-05-18
"""
from __future__ import annotations

from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE payments (
            id                     BIGSERIAL PRIMARY KEY,
            user_id                BIGINT NOT NULL REFERENCES users(id),
            tg_payment_charge_id   TEXT NOT NULL UNIQUE,
            provider_charge_id     TEXT,
            stars_amount           INT NOT NULL CHECK (stars_amount > 0),
            currency               TEXT NOT NULL DEFAULT 'XTR',
            type                   TEXT NOT NULL CHECK (type IN ('premium', 'donate')),
            plan                   TEXT NOT NULL,
            granted_from           TIMESTAMPTZ NOT NULL,
            granted_until          TIMESTAMPTZ NOT NULL,
            refunded_at            TIMESTAMPTZ,
            raw                    JSONB NOT NULL,
            created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),

            CHECK (granted_until >= granted_from)
        );
    """)
    op.execute("CREATE INDEX idx_payments_user ON payments (user_id, created_at DESC);")
    op.execute("""
        CREATE INDEX idx_payments_premium_active ON payments (user_id, granted_until DESC)
            WHERE type = 'premium' AND refunded_at IS NULL;
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS payments CASCADE;")
