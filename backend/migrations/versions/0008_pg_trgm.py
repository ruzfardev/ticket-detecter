"""enable pg_trgm extension + fuzzy indexes on stations

Revision ID: 0008
Revises: 0007
Create Date: 2026-05-18
"""
from __future__ import annotations

from alembic import op

revision: str = "0008"
down_revision: str | None = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm;")
    op.execute("""
        CREATE INDEX idx_stations_name_uz_trgm ON stations
            USING gin (name_uz gin_trgm_ops);
    """)
    op.execute("""
        CREATE INDEX idx_stations_name_ru_trgm ON stations
            USING gin (name_ru gin_trgm_ops);
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_stations_name_uz_trgm;")
    op.execute("DROP INDEX IF EXISTS idx_stations_name_ru_trgm;")
    # Keep extension installed — other things may depend on it
