"""Per-ticket status, as eticket's detail endpoint reports it.

Neither list endpoint carries a status: a returned ticket sits in the active
list under ORDER_COMPLETED_SUCCESSFULLY like any other, so the only way to
know is to ask for the detail of each leg. Shared by the tickets API and the
trip-reminder sweep.
"""

from __future__ import annotations

# eticket's own bundle spells it ReturnTicket; the live API says ReturnedTicket.
# The v3 order system speaks upper case (RETURNED, and REFUNDED once the money
# is back).
RETURNED = frozenset({"ReturnedTicket", "ReturnTicket",
                      "RETURNED", "RETURN_SUCCEEDED", "REFUNDED"})
# Paid and valid. The site's own check: ConfirmedTicket || PAID || CONFIRMED.
CONFIRMED = frozenset({"ConfirmedTicket", "PAID", "CONFIRMED"})
# Statuses that never change again — safe to remember for a long time.
TERMINAL = RETURNED | {"UsedTicket", "ExpiredTicket", "USED", "EXPIRED"}


def _v3_name(full: str) -> str:
    """v3 `"Rozmetov=Erkinbay=Xudayberganovich"` -> `"Erkinbay Rozmetov"`,
    the first-then-last order v2 names are shown in."""
    parts = [p.strip() for p in (full or "").split("=")]
    last, first = (parts + ["", ""])[:2]
    return " ".join(x for x in (first, last) if x)


def summarize_tickets(raw: dict) -> list[dict]:
    """Detail payload -> the per-ticket facts a list view needs.

    Reads both order systems: v2 tickets carry `ticketId`, a `passenger` and
    their own `status`; v3 tickets carry `id` and `passengerInfo`, and the
    status sits once on the item.
    """
    out: list[dict] = []
    item_status = raw.get("status")
    for t in (raw.get("tickets") or []):
        if "passengerInfo" in t:
            name = _v3_name(str((t.get("passengerInfo") or {}).get("fullName") or ""))
        else:
            p = t.get("passenger") or {}
            name = " ".join(
                str(x) for x in (p.get("firstname"), p.get("lastname")) if x
            ).strip()
        out.append({
            "ticket_id": str(t.get("ticketId") or t.get("id") or ""),
            "seat": str(t.get("seatNumber") or ""),
            "status": str(t.get("status") or item_status or ""),
            "passenger_name": name,
        })
    return out


def ticket_amount(t: dict) -> int:
    """Price of one ticket from a detail payload, v2 or v3."""
    tariff = t.get("tariff")
    if isinstance(tariff, dict):
        return int(float(tariff.get("amount") or 0))
    return int(float(t.get("tariffAmount") or 0))


def is_returned(tickets: list[dict]) -> bool:
    """A leg counts as returned once every ticket on it has been."""
    return bool(tickets) and all(t["status"] in RETURNED for t in tickets)


def is_confirmed(tickets: list[dict]) -> bool:
    """Paid and valid — the only kind of ticket worth a reminder.

    An unpaid reservation sits in the active list too (order
    RESERVATION_SUCCEEDED) with the literal status "None" on its tickets.
    """
    return bool(tickets) and all(t["status"] in CONFIRMED for t in tickets)
