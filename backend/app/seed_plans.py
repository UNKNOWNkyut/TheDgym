"""
Seed official membership plans for The DGym Rosario, Batangas.
Rates and rules sourced from TDGGYM-QUESTIONNAIRES-1.
"""
from decimal import Decimal
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.membership_plan import MembershipPlan

LEGACY_PLACEHOLDER_PRICES = {
    "day-pass": Decimal("80.00"),
    "monthly": Decimal("600.00"),
    "quarterly": Decimal("1500.00"),
    "annual": Decimal("5000.00"),
    "student-monthly": Decimal("450.00"),
}

DEFAULT_PLANS = [
    {
        "name": "Day Pass",
        "slug": "day-pass",
        "description": "Full gym and locker access for one day. No sign-up required. Strictly non-refundable.",
        "duration_days": 1,
        "price_php": Decimal("400.00"),
        "sort_order": 1,
    },
    {
        "name": "Monthly",
        "slug": "monthly",
        "description": "30-day unlimited equipment, lounge, Wi-Fi, and free 6:00 PM group classes. Strictly non-refundable.",
        "duration_days": 30,
        "price_php": Decimal("1999.00"),
        "sort_order": 2,
    },
    {
        "name": "Student Monthly",
        "slug": "student-monthly",
        "description": "Discounted 30-day unlimited plan for students (Valid School ID required). Strictly non-refundable.",
        "duration_days": 30,
        "price_php": Decimal("1500.00"),
        "sort_order": 3,
    },
    {
        "name": "Senior / PWD Monthly",
        "slug": "senior-pwd-monthly",
        "description": "Discounted 30-day unlimited plan for seniors and PWDs (Valid Senior/PWD ID required). Strictly non-refundable.",
        "duration_days": 30,
        "price_php": Decimal("1500.00"),
        "sort_order": 4,
    },
    {
        "name": "Quarterly",
        "slug": "quarterly",
        "description": "3-month (90-day) unlimited equipment, lounge, Wi-Fi, and free group classes. Strictly non-refundable.",
        "duration_days": 90,
        "price_php": Decimal("5400.00"),
        "sort_order": 5,
    },
    {
        "name": "6-Month Package",
        "slug": "six-month",
        "description": "6-month (180-day) unlimited equipment, lounge, Wi-Fi, and free group classes. Strictly non-refundable.",
        "duration_days": 180,
        "price_php": Decimal("8000.00"),
        "sort_order": 6,
    },
    {
        "name": "Annual",
        "slug": "annual",
        "description": "1-year (365-day) unlimited access. Annual Membership Card renewal ₱1,000 (min. 3-month subscription). Strictly non-refundable.",
        "duration_days": 365,
        "price_php": Decimal("13000.00"),
        "sort_order": 7,
    },
]


async def seed_plans(session: AsyncSession) -> None:
    """Seed official membership plans if missing, and upgrade legacy placeholder prices/order."""
    existing_rows = (await session.execute(select(MembershipPlan))).scalars().all()
    by_slug = {plan.slug: plan for plan in existing_rows}

    mutated = False
    for plan_data in DEFAULT_PLANS:
        slug = plan_data["slug"]
        existing = by_slug.get(slug)
        if existing is None:
            session.add(MembershipPlan(**plan_data))
            mutated = True
            continue

        legacy_price = LEGACY_PLACEHOLDER_PRICES.get(slug)
        if legacy_price is not None and Decimal(str(existing.price_php)) == legacy_price:
            existing.price_php = plan_data["price_php"]
            existing.description = plan_data["description"]
            mutated = True

        if existing.sort_order != plan_data["sort_order"]:
            existing.sort_order = plan_data["sort_order"]
            mutated = True

    if mutated:
        await session.commit()
