"""Per-ticket status, as eticket's detail endpoint reports it.

Neither list endpoint carries a status: a returned ticket sits in the active
list under ORDER_COMPLETED_SUCCESSFULLY like any other, so the only way to
know is to ask for the detail of each leg. Shared by the tickets API and the
trip-reminder sweep.
"""

from __future__ import annotations

# eticket's own bundle spells it ReturnTicket; the live API says ReturnedTicket.
RETURNED = frozenset({"ReturnedTicket", "ReturnTicket"})
# Statuses that never change again — safe to remember for a long time.
TERMINAL = RETURNED | {"UsedTicket", "ExpiredTicket"}


def summarize_tickets(raw: dict) -> list[dict]:
    """Detail payload -> the per-ticket facts a list view needs."""
    out: list[dict] = []
    for t in (raw.get("tickets") or []):
        p = t.get("passenger") or {}
        out.append({
            "ticket_id": str(t.get("ticketId") or ""),
            "seat": str(t.get("seatNumber") or ""),
            "status": str(t.get("status") or ""),
            "passenger_name": " ".join(
                str(x) for x in (p.get("firstname"), p.get("lastname")) if x
            ).strip(),
        })
    return out


def is_returned(tickets: list[dict]) -> bool:
    """A leg counts as returned once every ticket on it has been."""
    return bool(tickets) and all(t["status"] in RETURNED for t in tickets)


def is_confirmed(tickets: list[dict]) -> bool:
    """Paid and valid — the only kind of ticket worth a reminder.

    An unpaid reservation sits in the active list too (order
    RESERVATION_SUCCEEDED) with the literal status "None" on its tickets.
    """
    return bool(tickets) and all(t["status"] == "ConfirmedTicket" for t in tickets)
