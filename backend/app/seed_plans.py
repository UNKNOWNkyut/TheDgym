"""
Seed placeholder membership plans for The DGym.
TODO: Replace prices and descriptions with real data from the company.
"""
from decimal import Decimal
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.membership_plan import MembershipPlan


# ─────────────────────────────────────────────────────────────────────────────
# PLACEHOLDER DATA — Replace with real company pricing once gathered
# ─────────────────────────────────────────────────────────────────────────────
DEFAULT_PLANS = [
    {
        "name": "Day Pass",
        "slug": "day-pass",
        "description": "Single-day access to all gym facilities. Perfect for drop-ins and visitors.",
        "duration_days": 1,
        "price_php": Decimal("80.00"),  # PLACEHOLDER
        "sort_order": 1,
    },
    {
        "name": "Monthly",
        "slug": "monthly",
        "description": "Full 30-day unlimited access to all equipment and open gym sessions.",
        "duration_days": 30,
        "price_php": Decimal("600.00"),  # PLACEHOLDER
        "sort_order": 2,
    },
    {
        "name": "Quarterly",
        "slug": "quarterly",
        "description": "3-month membership for serious athletes committed to consistent training.",
        "duration_days": 90,
        "price_php": Decimal("1500.00"),  # PLACEHOLDER
        "sort_order": 3,
    },
    {
        "name": "Annual",
        "slug": "annual",
        "description": "Full-year unlimited access — best value for dedicated members.",
        "duration_days": 365,
        "price_php": Decimal("5000.00"),  # PLACEHOLDER
        "sort_order": 4,
    },
    {
        "name": "Student Monthly",
        "slug": "student-monthly",
        "description": "Discounted monthly plan for students with valid school ID.",
        "duration_days": 30,
        "price_php": Decimal("450.00"),  # PLACEHOLDER
        "sort_order": 5,
    },
]


async def seed_plans(session: AsyncSession) -> None:
    """Seed default membership plans if none exist."""
    result = await session.execute(select(MembershipPlan).limit(1))
    if result.scalar_one_or_none():
        return  # Plans already seeded

    for plan_data in DEFAULT_PLANS:
        plan = MembershipPlan(**plan_data)
        session.add(plan)

    await session.commit()
    print("[SEED] Membership plans seeded (placeholder pricing — replace with real data).")
