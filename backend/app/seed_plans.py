"""
Seed official membership plans for The DGym Rosario, Batangas.
Rates sourced from the official TDGGYM client survey.
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
        "description": "Full gym access for one day. No commitment.",
        "duration_days": 1,
        "price_php": Decimal("400.00"),
        "sort_order": 1,
    },
    {
        "name": "Monthly",
        "slug": "monthly",
        "description": "Full 30-day unlimited access to all equipment and group classes.",
        "duration_days": 30,
        "price_php": Decimal("1999.00"),
        "sort_order": 2,
    },
    {
        "name": "Quarterly",
        "slug": "quarterly",
        "description": "3-month membership upfront. Best value per session.",
        "duration_days": 90,
        "price_php": Decimal("5400.00"),
        "sort_order": 3,
    },
    {
        "name": "Annual",
        "slug": "annual",
        "description": "Full-year unlimited access — best value for dedicated members.",
        "duration_days": 365,
        "price_php": Decimal("13000.00"),
        "sort_order": 4,
    },
    {
        "name": "Student Monthly",
        "slug": "student-monthly",
        "description": "Discounted monthly plan for students with valid school ID.",
        "duration_days": 30,
        "price_php": Decimal("1500.00"),
        "sort_order": 5,
    },
]


async def seed_plans(session: AsyncSession) -> None:
    """Seed default membership plans if missing, and upgrade legacy placeholder prices."""
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

    if mutated:
        await session.commit()
