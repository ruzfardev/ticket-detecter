"""
CLI utility to add or list station codes outside of migrations.

The initial catalog is seeded by Alembic migration 0007. Use this script
when you discover a new station code from eticket.railway.uz (e.g., via
F12 → Network → station autocomplete) and want to add it without writing
a new migration.

Usage:
    python -m app.scripts.seed_stations list
    python -m app.scripts.seed_stations add CODE NAME_UZ NAME_RU [NAME_EN] [CITY]
    python -m app.scripts.seed_stations deactivate CODE
"""

from __future__ import annotations

import argparse
import asyncio
import sys

from app.core.logging import configure_logging, logger
from app.db import close_pool, get_pool, init_pool


async def cmd_list() -> None:
    pool = get_pool()
    rows = await pool.fetch(
        "SELECT code, name_uz, name_ru, is_active FROM stations ORDER BY name_uz"
    )
    print(f"{'CODE':<10} {'UZ':<20} {'RU':<20} ACTIVE")
    print("-" * 60)
    for r in rows:
        flag = "✓" if r["is_active"] else "✗"
        print(f"{r['code']:<10} {r['name_uz']:<20} {r['name_ru']:<20} {flag}")
    print(f"\nTotal: {len(rows)}")


async def cmd_add(code: str, name_uz: str, name_ru: str,
                  name_en: str | None, city: str | None) -> None:
    pool = get_pool()
    result = await pool.execute(
        """
        INSERT INTO stations (code, name_uz, name_ru, name_en, city)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (code) DO UPDATE
        SET name_uz = EXCLUDED.name_uz,
            name_ru = EXCLUDED.name_ru,
            name_en = COALESCE(EXCLUDED.name_en, stations.name_en),
            city    = COALESCE(EXCLUDED.city,    stations.city),
            is_active = TRUE
        """,
        code, name_uz, name_ru, name_en, city,
    )
    logger.info("station_added", code=code, name_uz=name_uz, result=result)


async def cmd_deactivate(code: str) -> None:
    pool = get_pool()
    result = await pool.execute(
        "UPDATE stations SET is_active = FALSE WHERE code = $1",
        code,
    )
    logger.info("station_deactivated", code=code, result=result)


async def main() -> int:
    configure_logging()
    parser = argparse.ArgumentParser(description="Manage stations catalog")
    sub = parser.add_subparsers(dest="cmd", required=True)

    sub.add_parser("list", help="List all stations")

    p_add = sub.add_parser("add", help="Add or update a station")
    p_add.add_argument("code")
    p_add.add_argument("name_uz")
    p_add.add_argument("name_ru")
    p_add.add_argument("name_en", nargs="?", default=None)
    p_add.add_argument("city", nargs="?", default=None)

    p_off = sub.add_parser("deactivate", help="Mark a station as inactive")
    p_off.add_argument("code")

    args = parser.parse_args()

    await init_pool(min_size=1, max_size=2)
    try:
        if args.cmd == "list":
            await cmd_list()
        elif args.cmd == "add":
            await cmd_add(args.code, args.name_uz, args.name_ru, args.name_en, args.city)
        elif args.cmd == "deactivate":
            await cmd_deactivate(args.code)
    finally:
        await close_pool()
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
