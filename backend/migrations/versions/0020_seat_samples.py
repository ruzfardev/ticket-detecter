"""seat_samples + route_car_stats: keep what the watcher sees

The watcher polls every watched route every 10-30 s and, until now, threw the
answer away unless it triggered an alert. That answer — free seats and the
cheapest price per car type, per train, per travel date — is the only data
nobody else has. Kept at one row per car type per 10 minutes it is small, and
it feeds two things the picker can show:

  * the trend on THIS departure ("−12 seats in the last 24 h"), straight from
    seat_samples;
  * what usually happens on this route ("plaskart sells out ~3 days before
    departure"), aggregated into route_car_stats once the trip is over.

Revision ID: 0020
Revises: 0019
Create Date: 2026-09-03
"""
from __future__ import annotations

from alembic import op

revision: str = "0020"
down_revision: str | None = "0019"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE seat_samples (
            id            BIGSERIAL PRIMARY KEY,
            dep_code      TEXT NOT NULL,
            arr_code      TEXT NOT NULL,
            travel_date   DATE NOT NULL,
            train_number  TEXT NOT NULL,
            car_type      TEXT NOT NULL,
            free_seats    INTEGER NOT NULL,
            min_price_uzs INTEGER,
            days_before   INTEGER NOT NULL,
            bucket        TIMESTAMPTZ NOT NULL,
            observed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
            UNIQUE (dep_code, arr_code, travel_date, train_number, car_type, bucket)
        )
        """
    )
    op.execute(
        "CREATE INDEX idx_seat_samples_instance ON seat_samples "
        "(dep_code, arr_code, travel_date, train_number, car_type, observed_at DESC)"
    )
    op.execute("CREATE INDEX idx_seat_samples_observed ON seat_samples (observed_at)")
    op.execute(
        """
        CREATE TABLE route_car_stats (
            dep_code         TEXT NOT NULL,
            arr_code         TEXT NOT NULL,
            train_number     TEXT NOT NULL,
            car_type         TEXT NOT NULL,
            instances_n      INTEGER NOT NULL,
            sold_out_n       INTEGER NOT NULL,
            sellout_days_p50 REAL,
            updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
            PRIMARY KEY (dep_code, arr_code, train_number, car_type)
        )
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE route_car_stats")
    op.execute("DROP TABLE seat_samples")
