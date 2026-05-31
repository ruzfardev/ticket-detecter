"""Premium tariffs + Donate options (centralized pricing)."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class PremiumPlan:
    id: str
    days: int
    stars: int
    badge: str | None = None


@dataclass(frozen=True, slots=True)
class DonateOption:
    id: str
    stars: int
    emoji: str
    label_uz: str
    label_ru: str
    label_en: str


PREMIUM_PLANS: dict[str, PremiumPlan] = {
    p.id: p for p in [
        PremiumPlan("premium_1d",  1,  15),
        PremiumPlan("premium_3d",  3,  40),
        PremiumPlan("premium_5d",  5,  65),
        PremiumPlan("premium_10d", 10, 120),
        PremiumPlan("premium_30d", 30, 300, badge="💎"),
    ]
}


DONATE_OPTIONS: dict[str, DonateOption] = {
    d.id: d for d in [
        DonateOption("donate_25",  25,  "☕", "Kichik rahmat",    "Маленькое спасибо",  "Small thanks"),
        DonateOption("donate_50",  50,  "🍪", "O'rtacha rahmat",  "Среднее спасибо",    "Medium thanks"),
        DonateOption("donate_100", 100, "🍰", "Katta rahmat",     "Большое спасибо",    "Big thanks"),
        DonateOption("donate_500", 500, "🎁", "Generous",         "Щедро",              "Generous"),
    ]
}


DONATE_CUSTOM_MIN = 10
DONATE_CUSTOM_MAX = 5000


def all_plans_payload(lang: str = "uz") -> dict:
    def label_for(o: DonateOption) -> str:
        return {"uz": o.label_uz, "ru": o.label_ru, "en": o.label_en}.get(lang, o.label_uz)

    return {
        "premium": [
            {"id": p.id, "days": p.days, "stars": p.stars, "badge": p.badge}
            for p in PREMIUM_PLANS.values()
        ],
        "donate": [
            {"id": d.id, "stars": d.stars, "emoji": d.emoji, "label": label_for(d)}
            for d in DONATE_OPTIONS.values()
        ],
        "donate_custom_range": {"min": DONATE_CUSTOM_MIN, "max": DONATE_CUSTOM_MAX},
    }
