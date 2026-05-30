"""auto-buy orders + per-user stored cards

Revision ID: 0011
Revises: 0010
Create Date: 2026-05-31
"""
from __future__ import annotations

from alembic import op

revision: str = "0011"
down_revision: str | None = "0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE user_railway_cards (
            id            BIGSERIAL PRIMARY KEY,
            user_id       BIGINT NOT NULL UNIQUE
                          REFERENCES users(id) ON DELETE CASCADE,
            card_pan_enc  TEXT NOT NULL,
            card_exp_enc  TEXT NOT NULL,
            last4         CHAR(4) NOT NULL,
            holder_name   TEXT,
            created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
            last_used_at  TIMESTAMPTZ
        );
    """)

    op.execute("""
        CREATE TABLE autobuy_orders (
            id                      BIGSERIAL PRIMARY KEY,
            subscription_id         BIGINT NOT NULL
                                    REFERENCES subscriptions(id) ON DELETE CASCADE,
            user_id                 BIGINT NOT NULL
                                    REFERENCES users(id) ON DELETE CASCADE,
            railway_friend_cache_id BIGINT
                                    REFERENCES railway_friends_cache(id) ON DELETE SET NULL,
            railway_order_id        TEXT,
            payment_type            TEXT,
            payment_subid           TEXT,
            train_number            TEXT NOT NULL,
            car_number              TEXT NOT NULL,
            seat_number             INT NOT NULL,
            dep_code                TEXT NOT NULL,
            arr_code                TEXT NOT NULL,
            travel_date             DATE NOT NULL,
            amount_uzs              INT,
            status                  TEXT NOT NULL DEFAULT 'reserving'
                                    CHECK (status IN ('reserving','awaiting_otp',
                                                      'paying','paid','failed',
                                                      'expired','cancelled')),
            failure_reason          TEXT,
            hold_until              TIMESTAMPTZ,
            raw_create_resp         JSONB,
            raw_payment_resp        JSONB,
            trigger_source          TEXT NOT NULL DEFAULT 'auto'
                                    CHECK (trigger_source IN ('auto','manual')),
            notification_id         BIGINT,
            created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
        );
    """)

    # Race protection: at most one in-flight order per (sub, train, car, seat).
    op.execute("""
        CREATE UNIQUE INDEX idx_autobuy_orders_seat_inflight
            ON autobuy_orders (subscription_id, train_number, car_number, seat_number)
            WHERE status IN ('reserving','awaiting_otp','paying','paid');
    """)
    op.execute("""
        CREATE INDEX idx_autobuy_orders_user_active
            ON autobuy_orders (user_id)
            WHERE status IN ('reserving','awaiting_otp','paying');
    """)
    op.execute("""
        CREATE INDEX idx_autobuy_orders_expirer
            ON autobuy_orders (hold_until)
            WHERE status IN ('reserving','awaiting_otp','paying');
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS autobuy_orders CASCADE;")
    op.execute("DROP TABLE IF EXISTS user_railway_cards CASCADE;")
