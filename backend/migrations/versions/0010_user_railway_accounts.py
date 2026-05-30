"""per-user railway accounts + cached friends + subscription auto-buy columns

Revision ID: 0010
Revises: 0009
Create Date: 2026-05-30
"""
from __future__ import annotations

from alembic import op

revision: str = "0010"
down_revision: str | None = "0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE user_railway_accounts (
            id                BIGSERIAL PRIMARY KEY,
            user_id           BIGINT NOT NULL UNIQUE
                              REFERENCES users(id) ON DELETE CASCADE,
            username          TEXT NOT NULL,
            password_enc      TEXT NOT NULL,
            railway_user_id   TEXT,
            access_token      TEXT,
            refresh_token     TEXT,
            csrf_token        TEXT,
            cookie_str        TEXT,
            token_exp_at      TIMESTAMPTZ,
            last_login_at     TIMESTAMPTZ,
            last_sync_at      TIMESTAMPTZ,
            cooldown_until    TIMESTAMPTZ,
            link_status       TEXT NOT NULL DEFAULT 'active'
                              CHECK (link_status IN ('active','login_failed','revoked')),
            created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
        );
    """)
    op.execute("""
        CREATE INDEX idx_user_railway_accounts_active
            ON user_railway_accounts (user_id)
            WHERE link_status = 'active';
    """)

    op.execute("""
        CREATE TABLE railway_friends_cache (
            id                  BIGSERIAL PRIMARY KEY,
            user_id             BIGINT NOT NULL
                                REFERENCES users(id) ON DELETE CASCADE,
            railway_friend_id   TEXT NOT NULL,
            firstname           TEXT NOT NULL,
            lastname            TEXT NOT NULL,
            midname             TEXT,
            sex                 CHAR(1),
            birth_day           DATE NOT NULL,
            doc_type            TEXT,
            doc_enc             TEXT,
            citizenship         TEXT,
            region_id           TEXT,
            is_self             BOOLEAN NOT NULL DEFAULT FALSE,
            synced_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
            UNIQUE (user_id, railway_friend_id)
        );
    """)
    op.execute("""
        CREATE INDEX idx_railway_friends_cache_user
            ON railway_friends_cache (user_id);
    """)

    op.execute("""
        ALTER TABLE subscriptions
            ADD COLUMN autobuy_enabled BOOLEAN NOT NULL DEFAULT FALSE,
            ADD COLUMN autobuy_friend_id BIGINT
                REFERENCES railway_friends_cache(id) ON DELETE SET NULL,
            ADD COLUMN autobuy_payment_method TEXT
                CHECK (autobuy_payment_method IS NULL OR autobuy_payment_method IN
                       ('payme','click','hamkorbank','kapitalbank'));
    """)


def downgrade() -> None:
    op.execute("""
        ALTER TABLE subscriptions
            DROP COLUMN IF EXISTS autobuy_payment_method,
            DROP COLUMN IF EXISTS autobuy_friend_id,
            DROP COLUMN IF EXISTS autobuy_enabled;
    """)
    op.execute("DROP TABLE IF EXISTS railway_friends_cache CASCADE;")
    op.execute("DROP TABLE IF EXISTS user_railway_accounts CASCADE;")
