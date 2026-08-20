"""users: one-week free trial, granted on signup and backfilled

Every new user now starts with 7 days of premium. `trial_granted_at` records
when it was given so the grant is auditable and can only ever happen once per
account — signup detection alone would re-fire if a row were ever recreated.

Existing users are backfilled with the same 7 days. The backfill uses GREATEST
so it can only ever extend: an admin holding permanent premium (2099) keeps it,
and anyone who already paid keeps the longer of the two.

Revision ID: 0015
Revises: 0014
Create Date: 2026-08-20
"""
from __future__ import annotations

from alembic import op

revision: str = "0015"
down_revision: str | None = "0014"
branch_labels = None
depends_on = None

TRIAL_DAYS = 7


def upgrade() -> None:
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_granted_at TIMESTAMPTZ;")

    # Backfill: give every existing account the trial. GREATEST() guarantees we
    # never shorten someone's existing entitlement.
    op.execute(f"""
        UPDATE users
        SET tier = 'premium',
            premium_until = GREATEST(
                COALESCE(premium_until, now()),
                now() + interval '{TRIAL_DAYS} days'
            ),
            trial_granted_at = COALESCE(trial_granted_at, now())
        WHERE trial_granted_at IS NULL;
    """)

    # Premium status feeds watch_groups.has_premium (it drives poll cadence),
    # so recompute it for every active group.
    op.execute("""
        INSERT INTO watch_groups (dep_code, arr_code, travel_date, has_premium, subscriber_count)
        SELECT s.dep_code, s.arr_code, s.travel_date,
               bool_or(u.tier = 'premium'),
               COUNT(*)
        FROM subscriptions s
        JOIN users u ON u.id = s.user_id
        WHERE s.is_active AND s.travel_date >= CURRENT_DATE
        GROUP BY s.dep_code, s.arr_code, s.travel_date
        ON CONFLICT (dep_code, arr_code, travel_date) DO UPDATE
        SET has_premium = EXCLUDED.has_premium,
            subscriber_count = EXCLUDED.subscriber_count,
            updated_at = now();
    """)


def downgrade() -> None:
    # Only strip entitlements this migration itself created: accounts whose
    # premium came from the trial and nothing else (no recorded payment).
    op.execute("""
        UPDATE users u
        SET tier = 'free', premium_until = NULL
        WHERE u.trial_granted_at IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.user_id = u.id)
          AND u.premium_until < TIMESTAMPTZ '2099-01-01';
    """)
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS trial_granted_at;")
