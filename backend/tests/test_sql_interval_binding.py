"""Never bind a Python *string* to a SQL interval parameter.

asyncpg maps `$n::interval` to a `timedelta`, so binding the string "7 days"
raises `DataError: 'str' object has no attribute 'days'` — and it raises while
binding arguments, before the WHERE clause is evaluated. That turned what should
have been a no-op UPDATE (every existing user already had `trial_granted_at`)
into a hard failure on the whole auth path: nobody could open the mini-app.

Two shapes are fine and both are in use:
  * `$n::interval` with a real `timedelta` argument   (worker/cycle.py)
  * `($n || ' days')::interval` with a numeric string (user_service, admin_service)

What is never fine is a string like f"{days} days" handed to a query.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

BACKEND = Path(__file__).resolve().parent.parent
SOURCES = sorted((BACKEND / "app").rglob("*.py"))

# The exact shape of the bug: an f-string whose whole value is a duration,
# e.g. f"{TRIAL_DAYS} days" — only ever written to feed an interval parameter.
DURATION_FSTRING = re.compile(
    r'f"\{[^"}]+\}\s*(day|days|hour|hours|minute|minutes|second|seconds)"'
)


@pytest.mark.parametrize("path", SOURCES, ids=lambda p: str(p.relative_to(BACKEND)))
def test_no_duration_fstring_is_passed_to_sql(path: Path):
    hits = DURATION_FSTRING.findall(path.read_text(encoding="utf-8"))
    assert not hits, (
        f"{path.relative_to(BACKEND)} builds a duration string for SQL. asyncpg "
        f"needs a timedelta for ::interval; pass a number and concatenate in "
        f"SQL instead: ($n || ' days')::interval."
    )


def test_trial_grant_uses_the_safe_form():
    src = (BACKEND / "app" / "services" / "user_service.py").read_text()
    assert "($2 || ' days')::interval" in src
    assert "str(TRIAL_DAYS)" in src


def test_admin_grant_uses_the_safe_form():
    src = (BACKEND / "app" / "services" / "admin_service.py").read_text()
    assert "($2 || ' days')::interval" in src
