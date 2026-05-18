"""
Seed railway_credentials row (encrypted password).

Run once after initial migration:
    python -m app.scripts.seed_credentials --username EMAIL --password PASS

Subsequent runs UPDATE the active row. RAILWAY_CRED_KEY must be set in
the environment.
"""

from __future__ import annotations

import argparse
import asyncio
import sys

from app.core.logging import configure_logging, logger
from app.db import close_pool, get_pool, init_pool
from app.railway.auth import _encrypt


async def main() -> int:
    configure_logging()
    parser = argparse.ArgumentParser()
    parser.add_argument("--username", required=True)
    parser.add_argument("--password", required=True)
    args = parser.parse_args()

    await init_pool(min_size=1, max_size=2)
    try:
        pool = get_pool()
        enc = _encrypt(args.password)
        existing = await pool.fetchval(
            "SELECT id FROM railway_credentials WHERE is_active LIMIT 1"
        )
        if existing:
            await pool.execute(
                """
                UPDATE railway_credentials
                SET username = $1, password_enc = $2,
                    access_token = NULL, refresh_token = NULL,
                    csrf_token = NULL, cookie_str = NULL,
                    token_exp_at = NULL
                WHERE id = $3
                """,
                args.username, enc, existing,
            )
            logger.info("railway_creds_updated", id=existing, username=args.username)
        else:
            new_id = await pool.fetchval(
                """
                INSERT INTO railway_credentials (username, password_enc, is_active)
                VALUES ($1, $2, TRUE)
                RETURNING id
                """,
                args.username, enc,
            )
            logger.info("railway_creds_seeded", id=new_id, username=args.username)
    finally:
        await close_pool()
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
