"""Format a notification snapshot into HTML text for Telegram."""

from __future__ import annotations


_BERTH_LABEL = {"lower": "pastki", "upper": "tepa", "any": "har qanday"}


def format_alert(
    route_name: str,
    travel_date: str,
    train_number: str,
    train_brand: str,
    departure: str,
    arrival: str,
    time_on_way: str,
    snapshot: dict,
    *,
    lang: str = "uz",
) -> str:
    total = sum(
        len(c.get("lower", [])) + len(c.get("upper", [])) + len(c.get("places", []))
        for c in snapshot.values()
    )

    lines: list[str] = [
        f"🎉 <b>Bo'sh joy topildi — {total} ta</b>",
        _RULE,
        f"📍 <b>{_e(route_name)}</b>",
        f"📅 {travel_date}",
    ]

    head = f"🚂 <b>{_e(train_number)}</b>"
    if train_brand:
        head += f" · {_e(train_brand)}"
    lines.append(head)
    if departure and arrival:
        time_part = f"  ({time_on_way})" if time_on_way else ""
        lines.append(f"🕐 {_short(departure)} → {_short(arrival)}{time_part}")
    lines.append(_RULE)

    # Group cars by detected layout
    has_berth = any(("lower" in c or "upper" in c) for c in snapshot.values())
    if has_berth:
        for car_no, payload in snapshot.items():
            lower = payload.get("lower", [])
            upper = payload.get("upper", [])
            car_total = len(lower) + len(upper)
            if car_total == 0:
                continue
            lines.append(f"🚃 <b>Vagon {_e(car_no)}</b> — {car_total} ta")
            if lower:
                lines.append(f"   ⬇️ pastki ({len(lower)}): {_preview(lower)}")
            if upper:
                lines.append(f"   ⬆️ tepa ({len(upper)}): {_preview(upper)}")

    other_cars = {k: v for k, v in snapshot.items() if "places" in v}
    for car_no, payload in other_cars.items():
        places = payload.get("places", [])
        lines.append(
            f"🚃 <b>Vagon {_e(car_no)}</b> — {len(places)} ta: {_preview(places)}"
        )

    lines.append(_RULE)
    lines.append('🔗 <a href="https://eticket.railway.uz/uz/home">eticket.railway.uz\'da olish</a>')
    lines.append("<i>⚡️ Avto sotib olish yoqilgan bo'lsa, joy o'zi bron qilinadi.</i>")
    return "\n".join(lines)


_RULE = "━━━━━━━━━━━━━━━"


def _preview(seats: list, limit: int = 12) -> str:
    """Comma-joined seat numbers, truncated with a count of what's hidden."""
    shown = ", ".join(str(p) for p in seats[:limit])
    rest = len(seats) - limit
    return f"{shown} +{rest}" if rest > 0 else shown


def _e(text: str) -> str:
    """Escape minimum HTML to keep Telegram parser happy."""
    return (text.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;"))


def _short(iso_or_text: str) -> str:
    """Show 'HH:MM' if iso datetime, else as-is."""
    if "T" in iso_or_text and len(iso_or_text) >= 16:
        return iso_or_text[11:16]
    return iso_or_text
