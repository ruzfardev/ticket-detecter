"""initial: users, stations, subscriptions

Revision ID: 0001
Revises:
Create Date: 2026-05-18
"""
from __future__ import annotations

from alembic import op

revision: str = "0001"
down_revision: str | None = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ---- users (minimal — we only store what Telegram doesn't give us each call) ----
    op.execute("""
        CREATE TABLE users (
            id              BIGSERIAL PRIMARY KEY,
            tg_user_id      BIGINT NOT NULL UNIQUE,
            lang            TEXT NOT NULL DEFAULT 'uz'
                            CHECK (lang IN ('uz', 'ru', 'en')),
            tier            TEXT NOT NULL DEFAULT 'free'
                            CHECK (tier IN ('free', 'premium')),
            premium_until   TIMESTAMPTZ,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
        );
    """)
    op.execute("""
        CREATE INDEX idx_users_premium_until ON users (premium_until)
            WHERE tier = 'premium';
    """)

    # ---- stations ----
    op.execute("""
        CREATE TABLE stations (
            code        TEXT PRIMARY KEY,
            name_uz     TEXT NOT NULL,
            name_ru     TEXT NOT NULL,
            name_en     TEXT,
            city        TEXT,
            is_active   BOOLEAN NOT NULL DEFAULT TRUE,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
        );
    """)
    op.execute("""
        CREATE INDEX idx_stations_active ON stations (is_active) WHERE is_active;
    """)

    # ---- subscriptions ----
    op.execute("""
        CREATE TABLE subscriptions (
            id              BIGSERIAL PRIMARY KEY,
            user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            dep_code        TEXT NOT NULL REFERENCES stations(code),
            arr_code        TEXT NOT NULL REFERENCES stations(code),
            travel_date     DATE NOT NULL,
            train_number    TEXT,
            car_types       TEXT[] NOT NULL DEFAULT '{}',
            berth           TEXT NOT NULL DEFAULT 'any'
                            CHECK (berth IN ('lower', 'upper', 'any')),
            is_active       BOOLEAN NOT NULL DEFAULT TRUE,
            paused_at       TIMESTAMPTZ,
            muted_until     TIMESTAMPTZ,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

            CHECK (dep_code <> arr_code),
            CHECK (travel_date >= '2020-01-01')
        );
    """)
    op.execute("CREATE INDEX idx_subs_user_active   ON subscriptions (user_id) WHERE is_active;")
    op.execute("CREATE INDEX idx_subs_route_date    ON subscriptions (dep_code, arr_code, travel_date) WHERE is_active;")
    op.execute("CREATE INDEX idx_subs_travel_date   ON subscriptions (travel_date) WHERE is_active;")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS subscriptions CASCADE;")
    op.execute("DROP TABLE IF EXISTS stations CASCADE;")
    op.execute("DROP TABLE IF EXISTS users CASCADE;")
