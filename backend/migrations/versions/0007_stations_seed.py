"""seed stations (data migration from legacy bot.py STATIONS dict)

Revision ID: 0007
Revises: 0006
Create Date: 2026-05-18
"""
from __future__ import annotations

from alembic import op

revision: str = "0007"
down_revision: str | None = "0006"
branch_labels = None
depends_on = None


# (code, name_uz, name_ru, name_en, city)
STATIONS: list[tuple[str, str, str, str | None, str]] = [
    ("2900000", "Toshkent",        "Ташкент",        "Tashkent",        "Toshkent"),
    ("2900001", "Toshkent-Pass.",  "Ташкент-Пасс.",  "Tashkent-Pass.",  "Toshkent"),
    ("2900680", "Samarqand",       "Самарканд",      "Samarkand",       "Samarqand"),
    ("2900700", "Buxoro",          "Бухара",         "Bukhara",         "Buxoro"),
    ("2900790", "Urganch",         "Ургенч",         "Urgench",         "Urganch"),
    ("2900800", "Xiva",            "Хива",           "Khiva",           "Xorazm"),
    ("2900720", "Navoiy",          "Навои",          "Navoi",           "Navoiy"),
    ("2900750", "Qarshi",          "Карши",          "Karshi",          "Qashqadaryo"),
    ("2900760", "Termiz",          "Термез",         "Termez",          "Surxondaryo"),
    ("2900770", "Qo'qon",          "Коканд",         "Kokand",          "Farg'ona"),
    ("2900780", "Andijon",         "Андижан",        "Andijan",         "Andijon"),
    ("2900730", "Nukus",           "Нукус",          "Nukus",           "Qoraqalpog'iston"),
    ("2900740", "Farg'ona",        "Фергана",        "Fergana",         "Farg'ona"),
]


def upgrade() -> None:
    op.execute("""
        CREATE TEMP TABLE _stations_seed (
            code TEXT, name_uz TEXT, name_ru TEXT, name_en TEXT, city TEXT
        ) ON COMMIT DROP;
    """)
    for code, name_uz, name_ru, name_en, city in STATIONS:
        op.execute(
            "INSERT INTO _stations_seed VALUES "
            f"({_q(code)}, {_q(name_uz)}, {_q(name_ru)}, {_q(name_en)}, {_q(city)});"
        )
    op.execute("""
        INSERT INTO stations (code, name_uz, name_ru, name_en, city)
        SELECT code, name_uz, name_ru, name_en, city FROM _stations_seed
        ON CONFLICT (code) DO NOTHING;
    """)


def downgrade() -> None:
    codes = ", ".join(_q(s[0]) for s in STATIONS)
    op.execute(f"DELETE FROM stations WHERE code IN ({codes});")


def _q(s: str | None) -> str:
    """SQL string literal with apostrophe escaping. NULL for None."""
    if s is None:
        return "NULL"
    return "'" + s.replace("'", "''") + "'"
