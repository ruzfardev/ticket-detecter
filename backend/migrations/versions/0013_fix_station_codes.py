"""stations: correct the codes against eticket's own handbook

9 of the 13 seeded rows carried the wrong code. The seed in 0007 came from a
stale source, and the errors were silent: searching "Buxoro" (2900700) actually
queried SAMARQAND, so results looked plausible — same departures, wrong
arrivals — and any subscription or auto-buy on it watched the wrong route
entirely.

Verified 2026-08-20 against POST /api/v1/handbook/stations/list, eticket's
authoritative name->code search:

    code     was labelled      actually is
    2900680  Samarqand         ANDIJON
    2900700  Buxoro            SAMARQAND
    2900720  Navoiy            JIZZAX
    2900780  Andijon           DENOV
    2900800  Xiva              BUXORO

Codes are NOT reassigned here: `subscriptions.dep_code/arr_code` are foreign
keys into this table, so each row is relabelled to what its code truly is and
the genuinely missing cities are inserted alongside. 2900730 / 2900740 /
2900760 / 2900770 could not be resolved (eticket offers no code->name lookup,
and no station name matches what we had); they are deactivated rather than
dropped, since deleting them would break any FK still pointing at them.

Note: eticket has no "Farg'ona" station under any spelling — the Fergana valley
is served by Margilon, Qo'qon, Pop, Namangan and Andijon.

Revision ID: 0013
Revises: 0012
Create Date: 2026-08-20
"""
from __future__ import annotations

from alembic import op

revision: str = "0013"
down_revision: str | None = "0012"
branch_labels = None
depends_on = None


def _q(v: str | None) -> str:
    if v is None:
        return "NULL"
    return "'" + v.replace("'", "''") + "'"


# (code, name_uz, name_ru, name_en, city) — eticket's authoritative mapping.
STATIONS: list[tuple[str, str, str, str, str]] = [
    ("2900000", "Toshkent",         "Ташкент",         "Tashkent",        "Toshkent"),
    ("2900001", "Toshkent Markaziy", "Ташкент Централ.", "Tashkent Central", "Toshkent"),
    ("2900002", "Toshkent Janubiy", "Ташкент Южный",   "Tashkent South",  "Toshkent"),
    ("2900700", "Samarqand",        "Самарканд",       "Samarkand",       "Samarqand"),
    ("2900800", "Buxoro",           "Бухара",          "Bukhara",         "Buxoro"),
    ("2900172", "Xiva",             "Хива",            "Khiva",           "Xorazm"),
    ("2900790", "Urganch",          "Ургенч",          "Urgench",         "Xorazm"),
    ("2900930", "Navoiy",           "Навои",           "Navoi",           "Navoiy"),
    ("2900750", "Qarshi",           "Карши",           "Karshi",          "Qashqadaryo"),
    ("2900255", "Termiz",           "Термез",          "Termez",          "Surxondaryo"),
    ("2900880", "Qo'qon",           "Коканд",          "Kokand",          "Farg'ona"),
    ("2900680", "Andijon",          "Андижан",         "Andijan",         "Andijon"),
    ("2900970", "Nukus",            "Нукус",           "Nukus",           "Qoraqalpog'iston"),
    ("2900720", "Jizzax",           "Джизак",          "Jizzakh",         "Jizzax"),
    ("2900850", "Guliston",         "Гулистан",        "Gulistan",        "Sirdaryo"),
    ("2900920", "Margilon",         "Маргилан",        "Margilan",        "Farg'ona"),
    ("2900693", "Pop",              "Пап",             "Pop",             "Namangan"),
    ("2900940", "Namangan",         "Наманган",        "Namangan",        "Namangan"),
    ("2900780", "Denov",            "Денау",           "Denov",           "Surxondaryo"),
]

# Codes whose true identity we could not establish. Kept (FKs) but hidden.
UNRESOLVED = ["2900730", "2900740", "2900760", "2900770"]


def upgrade() -> None:
    for code, uz, ru, en, city in STATIONS:
        op.execute(
            "INSERT INTO stations (code, name_uz, name_ru, name_en, city, is_active) "
            f"VALUES ({_q(code)}, {_q(uz)}, {_q(ru)}, {_q(en)}, {_q(city)}, TRUE) "
            "ON CONFLICT (code) DO UPDATE SET "
            "  name_uz = EXCLUDED.name_uz, name_ru = EXCLUDED.name_ru, "
            "  name_en = EXCLUDED.name_en, city = EXCLUDED.city, is_active = TRUE;"
        )
    codes = ", ".join(_q(c) for c in UNRESOLVED)
    op.execute(f"UPDATE stations SET is_active = FALSE WHERE code IN ({codes});")


def downgrade() -> None:
    # Restoring the wrong labels would re-break routing; only the newly added
    # rows are removed, and only when nothing references them.
    added = ["2900002", "2900172", "2900930", "2900255", "2900880",
             "2900970", "2900850", "2900920", "2900693", "2900940"]
    codes = ", ".join(_q(c) for c in added)
    op.execute(
        f"DELETE FROM stations WHERE code IN ({codes}) "
        "AND code NOT IN (SELECT dep_code FROM subscriptions "
        "                 UNION SELECT arr_code FROM subscriptions);"
    )
    unresolved = ", ".join(_q(c) for c in UNRESOLVED)
    op.execute(f"UPDATE stations SET is_active = TRUE WHERE code IN ({unresolved});")
