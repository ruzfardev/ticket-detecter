"""autobuy: at most one in-flight order per subscription

The existing guard was unique on (subscription_id, train_number, car_number,
seat_number), so it only stopped a duplicate claim on the *same seat*. When the
watcher ticked again and picked a seat in a different car, a second order sailed
through and held a second seat — observed live: orders 23 and 24 on
subscription 49, 25 seconds apart, one routed to HamkorbankHold and the other to
Payme, so the user had two reservations and two payment flows for one trip.

A subscription is one intent to travel, so the correct unit of exclusion is the
subscription, not the seat. 'paid' is deliberately excluded from the predicate:
a completed purchase deactivates the subscription anyway, and including it would
permanently block the user from ever re-arming that subscription.

Revision ID: 0014
Revises: 0013
Create Date: 2026-08-20
"""
from __future__ import annotations

from alembic import op

revision: str = "0014"
down_revision: str | None = "0013"
branch_labels = None
depends_on = None

INFLIGHT = "('reserving','awaiting_otp','paying')"


def upgrade() -> None:
    # Any existing duplicates would block the index. Keep the newest in-flight
    # order per subscription and release the rest; they are stale claims that
    # would have expired on their own anyway.
    op.execute(f"""
        UPDATE autobuy_orders SET
            status = 'cancelled',
            failure_reason = COALESCE(failure_reason,
                'Bir obuna uchun bir vaqtda bitta buyurtma (0014)'),
            updated_at = now()
        WHERE id IN (
            SELECT id FROM (
                SELECT id, row_number() OVER (
                           PARTITION BY subscription_id ORDER BY id DESC
                       ) AS rn
                FROM autobuy_orders
                WHERE status IN {INFLIGHT}
            ) ranked
            WHERE rn > 1
        );
    """)
    op.execute(f"""
        CREATE UNIQUE INDEX idx_autobuy_orders_sub_inflight
            ON autobuy_orders (subscription_id)
            WHERE status IN {INFLIGHT};
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_autobuy_orders_sub_inflight;")
