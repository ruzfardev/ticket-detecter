"""
Per-user HTTP client for eticket.railway.uz.

Phase A only needs one endpoint:
  - POST /api/v1/users/friend/list  -> companions/hamrohlar

The eticket userId needed by `friend/list` is decoded locally from the
JWT 'id' claim (see `_auth_common.extract_railway_user_id`) — `/users/get`
returns 404 for regular accounts.

Phase B/C will extend this with universal-orders/create + payment flow.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import asyncpg
import httpx

from app.core.errors import RailwayUnavailable, RateLimited
from app.core.logging import logger
from app.railway._auth_common import BASE_URL
from app.railway.client import get_bucket  # shared TokenBucket (per IP, not per account)
from app.railway.user_auth import (
    RailwayAccountRequired,
    RailwayLoginFailed,
    get_or_refresh_for_user,
)


FRIEND_LIST_URL = f"{BASE_URL}/api/v1/users/friend/list"


@dataclass(slots=True)
class FriendRecord:
    friend_id: str
    firstname: str
    lastname: str
    midname: str | None
    sex: str | None              # 'M' | 'F'
    birth_day: str               # 'DD.MM.YYYY' as returned by eticket
    doc_type: str | None
    doc: str | None
    citizenship: str | None
    region_id: str | None
    your_self: bool


class RailwayUserClient:
    """Per-call HTTP client. Cheap to instantiate; reuses global TokenBucket."""

    def __init__(self, pool: asyncpg.Pool, user_id: int):
        self._pool = pool
        self._user_id = user_id

    async def _post(self, url: str, payload: dict[str, Any]) -> dict[str, Any]:
        await get_bucket().acquire()
        headers = (await get_or_refresh_for_user(self._pool, self._user_id)).as_headers()
        async with httpx.AsyncClient(timeout=20) as http:
            try:
                r = await http.post(url, json=payload, headers=headers)
            except httpx.HTTPError as e:
                raise RailwayUnavailable(f"{url} network error: {e}")
        await self._handle_status(r)
        try:
            return r.json()
        except ValueError:
            raise RailwayUnavailable(f"{url} returned non-JSON body")

    async def _handle_status(self, r: httpx.Response) -> None:
        if r.status_code == 429:
            raise RateLimited("railway.uz returned 429")
        if r.status_code == 401:
            # Force a re-login on next call by clearing tokens.
            await self._pool.execute(
                """
                UPDATE user_railway_accounts
                SET access_token = NULL, csrf_token = NULL, cookie_str = NULL,
                    token_exp_at = NULL
                WHERE user_id = $1
                """,
                self._user_id,
            )
            raise RailwayLoginFailed("eticket session invalid; will retry")
        if r.status_code >= 500:
            raise RailwayUnavailable(f"railway.uz {r.status_code}")
        if r.status_code != 200:
            logger.warning(
                "railway_user_unexpected_status",
                user_id=self._user_id,
                status=r.status_code,
                body=r.text[:200],
            )
            raise RailwayUnavailable(f"railway.uz {r.status_code}")

    async def list_friends(self, railway_user_id: str) -> list[FriendRecord]:
        data = await self._post(FRIEND_LIST_URL, {"userId": railway_user_id})
        # Eticket returns either a bare array or `{"data": [...]}` depending on
        # version; accept both.
        arr = data if isinstance(data, list) else (data.get("data") or [])
        out: list[FriendRecord] = []
        for f in arr:
            try:
                out.append(FriendRecord(
                    friend_id=str(f["friendId"]),
                    firstname=str(f.get("firstname") or "").strip(),
                    lastname=str(f.get("lastname") or "").strip(),
                    midname=(str(f.get("midname") or "").strip() or None),
                    sex=(str(f.get("sex") or "").strip()[:1] or None),
                    birth_day=str(f.get("birthDay") or "").strip(),
                    doc_type=(str(f.get("docType") or "").strip() or None),
                    doc=(str(f.get("doc") or "").strip() or None),
                    citizenship=(str(f.get("citizenship") or "").strip() or None),
                    region_id=(str(f.get("regionId") or "").strip() or None),
                    your_self=bool(f.get("yourSelf")),
                ))
            except KeyError:
                logger.warning("railway_friend_skipped", reason="missing_id", row=f)
                continue
        return out
