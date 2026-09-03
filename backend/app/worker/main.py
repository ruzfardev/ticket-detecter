"""
Worker process entrypoint.

Run with:
    python -m app.worker.main

It's a separate process from the web/bot — so a slow railway.uz call
can't block HTTP traffic.
"""

from __future__ import annotations

import asyncio
import signal
from datetime import datetime, timedelta, timezone

from app.core.config import settings
from app.core.logging import configure_logging, logger
from app.db import close_pool, init_pool
from app.railway.client import close_client
from app.worker.cycle import run_cycle

_stop = asyncio.Event()


_PREMIUM_SWEEP_EVERY = timedelta(hours=24)
_last_premium_sweep: datetime | None = None


async def _maybe_expire_premium(pool) -> None:
    """Downgrade lapsed premium users once a day.

    Lives here because nothing on the server ever scheduled the standalone
    task — no cron entry, no systemd timer — so premium simply never expired.
    """
    global _last_premium_sweep
    now = datetime.now(timezone.utc)
    if _last_premium_sweep and now - _last_premium_sweep < _PREMIUM_SWEEP_EVERY:
        return
    _last_premium_sweep = now
    from app.tasks import expire_premium
    n = await expire_premium.run(pool)
    if n:
        logger.info("premium_expiry_swept", count=n)


_last_run: dict[str, datetime] = {}


def _due(name: str, every_s: int) -> bool:
    """True once per `every_s` seconds for `name`, first call included."""
    now = datetime.now(timezone.utc)
    last = _last_run.get(name)
    if last and now - last < timedelta(seconds=every_s):
        return False
    _last_run[name] = now
    return True


async def _main_loop() -> None:
    from app.db import get_pool
    from app.services import autobuy_service, seat_stats
    from app.tasks import trip_reminders

    while not _stop.is_set():
        try:
            await run_cycle()
        except Exception as e:
            logger.exception("worker_cycle_unhandled", error=str(e))
        try:
            # Runs BEFORE the expirer: an order whose payment cleared late must
            # be recognised as paid, never cancelled out from under the user.
            n = await autobuy_service.reconcile_pending(get_pool())
            if n:
                logger.info("autobuy_reconciled", count=n)
        except Exception as e:
            logger.exception("autobuy_reconcile_unhandled", error=str(e))
        try:
            n = await autobuy_service.expire_stale(get_pool())
            if n:
                logger.info("autobuy_expirer_swept", count=n)
        except Exception as e:
            logger.exception("autobuy_expirer_unhandled", error=str(e))
        try:
            await _maybe_expire_premium(get_pool())
        except Exception as e:
            logger.exception("expire_premium_unhandled", error=str(e))
        try:
            if _due("trip_reminders", settings.trip_reminder_sweep_s):
                n = await trip_reminders.run(get_pool())
                if n:
                    logger.info("trip_reminders_sent", count=n)
        except Exception as e:
            logger.exception("trip_reminders_unhandled", error=str(e))
        try:
            if _due("seat_stats", settings.seat_stats_aggregate_every_s):
                await seat_stats.aggregate(get_pool())
        except Exception as e:
            logger.exception("seat_stats_unhandled", error=str(e))
        try:
            await asyncio.wait_for(_stop.wait(), timeout=settings.watcher_tick_seconds)
        except asyncio.TimeoutError:
            pass


async def amain() -> None:
    configure_logging()
    logger.info("worker_starting",
                tick=settings.watcher_tick_seconds,
                premium_interval=settings.watcher_premium_interval_s,
                free_interval=settings.watcher_free_interval_s)
    await init_pool(min_size=1, max_size=4)
    try:
        await _main_loop()
    finally:
        await close_client()
        await close_pool()
        logger.info("worker_stopped")


def main() -> None:
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    def _handle_signal(*_args):
        logger.info("worker_signal_received")
        _stop.set()

    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, _handle_signal)
        except NotImplementedError:
            # Windows doesn't support add_signal_handler — Ctrl+C still works
            pass

    try:
        loop.run_until_complete(amain())
    finally:
        loop.close()


if __name__ == "__main__":
    main()
