"""autobuy_orders: remember that an OTP was sent and that eticket accepted it

Order 62 (2026-08-21): the user entered a correct code, eticket answered the
usual "accepted" envelope, and then never settled the order — it sat in
ORDER_IN_PROCESS with no payment attached until the hold expired. Two things
made it worse on our side:

  * the worker's reconciler saw "paying + still in process" and rewrote the
    reason to "Kod qabul qilinmadi. Qaytadan kiriting." — a claim it could not
    back up. The user retyped the same code and eticket replied
    CONFIRMATION_PROCESSED ("already used"), which we again showed as a wrong
    code.
  * the expiry counted as a failure and disarmed auto-buy, even though the user
    had been sitting there typing codes.

Two columns fix both:

    otp_attempts      how many times a code was submitted for this order; an
                      expiry with attempts > 0 is not the user's absence and
                      does not spend the failure budget.
    otp_confirmed_at  set the moment eticket says CONFIRMATION_PROCESSED — the
                      only response that proves a code was accepted. Once set,
                      the reconciler stops bouncing the order back for retyping
                      and the UI says so honestly.

Revision ID: 0018
Revises: 0017
Create Date: 2026-08-21
"""
from __future__ import annotations

from alembic import op

revision: str = "0018"
down_revision: str | None = "0017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE autobuy_orders "
        "ADD COLUMN otp_attempts INTEGER NOT NULL DEFAULT 0, "
        "ADD COLUMN otp_confirmed_at TIMESTAMPTZ NULL"
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE autobuy_orders "
        "DROP COLUMN otp_confirmed_at, "
        "DROP COLUMN otp_attempts"
    )
