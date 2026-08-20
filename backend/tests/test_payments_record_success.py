"""`record_success` must hand JSONB columns a string, not a dict.

No asyncpg json/jsonb codec is registered on this pool, so passing a dict raises
`DataError` before the INSERT runs. That failure was swallowed by the bot
handler, which still told the user their payment had been accepted — so real
Telegram Stars were taken and no premium was ever granted.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from app.services import payments


class FakeConn:
    """Records SQL + args, and rejects a dict bound to a JSONB placeholder the
    same way asyncpg does."""

    def __init__(self, premium_until=None):
        self.calls: list[tuple[str, tuple]] = []
        self._premium_until = premium_until

    def transaction(self):
        conn = self

        class _Tx:
            async def __aenter__(self): return conn
            async def __aexit__(self, *a): return False
        return _Tx()

    async def fetchval(self, sql, *args):
        self.calls.append((sql, args))
        if "SELECT id FROM payments" in sql:
            return None                      # not a replay
        if "INSERT INTO payments" in sql:
            self._assert_jsonb_is_text(sql, args)
            return 4242
        return None

    async def fetchrow(self, sql, *args):
        self.calls.append((sql, args))
        return {"premium_until": self._premium_until}

    async def execute(self, sql, *args):
        self.calls.append((sql, args))

    @staticmethod
    def _assert_jsonb_is_text(sql: str, args: tuple) -> None:
        for a in args:
            if isinstance(a, dict):
                raise AssertionError(
                    "dict bound to a JSONB column — asyncpg would raise "
                    f"DataError here. SQL: {sql.strip()[:80]}"
                )


class FakePool:
    def __init__(self, conn):
        self._conn = conn

    def acquire(self):
        conn = self._conn

        class _Acq:
            async def __aenter__(self): return conn
            async def __aexit__(self, *a): return False
        return _Acq()


RAW = {"currency": "XTR", "total_amount": 150, "nested": {"a": [1, 2]}}


@pytest.fixture(autouse=True)
def _no_group_refresh(monkeypatch):
    async def noop(conn, user_id): return None
    monkeypatch.setattr(payments, "_refresh_groups_for_user", noop)


async def test_premium_payment_serialises_raw():
    conn = FakeConn()
    result = await payments.record_success(
        FakePool(conn), tg_user_id=99,
        tg_payment_charge_id="chg_1", provider_charge_id=None,
        invoice_payload="premium_30d:7:x", stars_amount=150, raw=RAW,
    )
    assert result["type"] == "premium"
    assert result["payment_id"] == 4242

    insert = next(c for c in conn.calls if "INSERT INTO payments" in c[0])
    assert "::jsonb" in insert[0]
    assert isinstance(insert[1][-1], str)


async def test_donate_payment_serialises_raw():
    conn = FakeConn()
    result = await payments.record_success(
        FakePool(conn), tg_user_id=99,
        tg_payment_charge_id="chg_2", provider_charge_id="prov",
        invoice_payload="donate_50:7:x", stars_amount=50, raw=RAW,
    )
    assert result["type"] == "donate"

    insert = next(c for c in conn.calls if "INSERT INTO payments" in c[0])
    assert "::jsonb" in insert[0]
    assert isinstance(insert[1][-1], str)


async def test_premium_stacks_on_existing_expiry():
    """Buying while still premium must extend, never truncate."""
    future = datetime.now(timezone.utc) + timedelta(days=20)
    conn = FakeConn(premium_until=future)
    result = await payments.record_success(
        FakePool(conn), tg_user_id=99,
        tg_payment_charge_id="chg_3", provider_charge_id=None,
        invoice_payload="premium_30d:7:x", stars_amount=150, raw=RAW,
    )
    granted_until = datetime.fromisoformat(result["granted_until"])
    assert granted_until > future


async def test_replay_is_idempotent():
    conn = FakeConn()

    async def fetchval(sql, *args):
        conn.calls.append((sql, args))
        if "SELECT id FROM payments" in sql:
            return 11                    # already recorded
        raise AssertionError("must not INSERT on a replayed charge")

    conn.fetchval = fetchval
    result = await payments.record_success(
        FakePool(conn), tg_user_id=99,
        tg_payment_charge_id="chg_1", provider_charge_id=None,
        invoice_payload="premium_30d:7:x", stars_amount=150, raw=RAW,
    )
    assert result == {"already_processed": True, "payment_id": 11}
