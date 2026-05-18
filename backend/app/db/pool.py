"""
Module-level asyncpg connection pool.

Lifecycle is tied to the FastAPI app via lifespan event in `app.main`.
Worker process initializes its own pool from `app.worker.main`.
"""

from __future__ import annotations

import asyncpg

from app.core.config import settings
from app.core.logging import logger

_pool: asyncpg.Pool | None = None


async def init_pool(min_size: int = 2, max_size: int = 10) -> asyncpg.Pool:
    global _pool
    if _pool is not None:
        return _pool

    logger.info("db_pool_connecting", host=settings.postgres_host, db=settings.postgres_db)
    _pool = await asyncpg.create_pool(
        dsn=settings.database_url_asyncpg,
        min_size=min_size,
        max_size=max_size,
        command_timeout=30,
    )
    logger.info("db_pool_ready", min_size=min_size, max_size=max_size)
    return _pool


async def close_pool() -> None:
    global _pool
    if _pool is None:
        return
    await _pool.close()
    _pool = None
    logger.info("db_pool_closed")


def get_pool() -> asyncpg.Pool:
    if _pool is None:
        raise RuntimeError("Database pool not initialized — call init_pool() first")
    return _pool


async def ping() -> bool:
    """Liveness check — returns True if DB responds within 1 second."""
    try:
        pool = get_pool()
        async with pool.acquire(timeout=1.0) as conn:
            await conn.fetchval("SELECT 1")
        return True
    except Exception as e:
        logger.warning("db_ping_failed", error=str(e))
        return False
