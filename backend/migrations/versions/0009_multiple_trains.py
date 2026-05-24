"""subscriptions.train_number -> train_numbers TEXT[] (multi-train per watch)

Revision ID: 0009
Revises: 0008
Create Date: 2026-05-24
"""
from __future__ import annotations

from alembic import op

revision: str = "0009"
down_revision: str | None = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE subscriptions
            ADD COLUMN train_numbers TEXT[] NOT NULL DEFAULT '{}';
    """)
    # Migrate existing single values into the array (NULL = any -> empty array).
    op.execute("""
        UPDATE subscriptions
        SET train_numbers = ARRAY[train_number]
        WHERE train_number IS NOT NULL;
    """)
    op.execute("ALTER TABLE subscriptions DROP COLUMN train_number;")


def downgrade() -> None:
    op.execute("ALTER TABLE subscriptions ADD COLUMN train_number TEXT;")
    # Collapse the array back to a single value (first element, if any).
    op.execute("""
        UPDATE subscriptions
        SET train_number = train_numbers[1]
        WHERE array_length(train_numbers, 1) >= 1;
    """)
    op.execute("ALTER TABLE subscriptions DROP COLUMN train_numbers;")
