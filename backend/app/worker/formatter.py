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
    lines: list[str] = [
        "🚂 <b>Chipta topildi!</b>",
        f"📍 Marshrut: <b>{_e(route_name)}</b>",
        f"📅 Sana: <b>{travel_date}</b>",
        "",
    ]

    total = sum(
        len(c.get("lower", [])) + len(c.get("upper", [])) + len(c.get("places", []))
        for c in snapshot.values()
    )

    head = f"• <b>{_e(train_number)}</b>"
    if train_brand:
        head += f" ({_e(train_brand)})"
    lines.append(head)
    if departure and arrival:
        time_part = f" ({time_on_way})" if time_on_way else ""
        lines.append(f"  🕐 {_short(departure)} → {_short(arrival)}{time_part}")
    lines.append(f"  💺 Jami: <b>{total} ta</b>")
    lines.append("")

    # Group cars by detected layout
    has_berth = any(("lower" in c or "upper" in c) for c in snapshot.values())
    if has_berth:
        lines.append("  🪑 <b>Plaskart / Kupe</b>:")
        for car_no, payload in snapshot.items():
            lower = payload.get("lower", [])
            upper = payload.get("upper", [])
            car_total = len(lower) + len(upper)
            if car_total == 0:
                continue
            lines.append(f"     Vagon {_e(car_no)} ({car_total} ta):")
            if lower:
                preview = ", ".join(str(p) for p in lower[:12])
                extra = " ..." if len(lower) > 12 else ""
                lines.append(f"        ⬇️ pastki ({len(lower)}): {preview}{extra}")
            if upper:
                preview = ", ".join(str(p) for p in upper[:12])
                extra = " ..." if len(upper) > 12 else ""
                lines.append(f"        ⬆️ tepa   ({len(upper)}): {preview}{extra}")

    other_cars = {k: v for k, v in snapshot.items() if "places" in v}
    if other_cars:
        lines.append("  🪑 <b>Boshqa vagonlar</b>:")
        for car_no, payload in other_cars.items():
            places = payload.get("places", [])
            preview = ", ".join(str(p) for p in places[:12])
            extra = " ..." if len(places) > 12 else ""
            lines.append(f"     Vagon {_e(car_no)} ({len(places)}): {preview}{extra}")

    lines.append("")
    lines.append('🔗 <a href="https://eticket.railway.uz/uz/home">Bilet olish</a>')
    return "\n".join(lines)


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
