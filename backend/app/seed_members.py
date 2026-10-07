"""
Seed placeholder members for The DGym (Phase 4 testing).
TODO: Remove or clear after real member data is gathered.
"""
from datetime import date
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.member import Member, MemberStatus, Gender


# ─────────────────────────────────────────────────────────────────────────────
# PLACEHOLDER MEMBERS — For development/testing only
# ─────────────────────────────────────────────────────────────────────────────
PLACEHOLDER_MEMBERS = [
    {
        "first_name": "Juan",
        "last_name": "Dela Cruz",
        "email": "juan.delacruz@example.com",
        "phone": "09171234567",
        "gender": Gender.MALE,
        "date_of_birth": date(1995, 3, 15),
        "address": "Rosario, Batangas",
        "emergency_contact_name": "Maria Dela Cruz",
        "emergency_contact_phone": "09187654321",
        "status": MemberStatus.ACTIVE,
    },
    {
        "first_name": "Maria",
        "last_name": "Santos",
        "email": "maria.santos@example.com",
        "phone": "09209876543",
        "gender": Gender.FEMALE,
        "date_of_birth": date(1998, 7, 22),
        "address": "Rosario, Batangas",
        "emergency_contact_name": "Pedro Santos",
        "emergency_contact_phone": "09171112222",
        "status": MemberStatus.ACTIVE,
    },
    {
        "first_name": "Carlo",
        "last_name": "Reyes",
        "email": "carlo.reyes@example.com",
        "phone": "09151234567",
        "gender": Gender.MALE,
        "date_of_birth": date(2001, 11, 8),
        "address": "Rosario, Batangas",
        "status": MemberStatus.ACTIVE,
    },
    {
        "first_name": "Ana",
        "last_name": "Garcia",
        "email": "ana.garcia@example.com",
        "phone": "09330001111",
        "gender": Gender.FEMALE,
        "date_of_birth": date(1990, 5, 1),
        "address": "Rosario, Batangas",
        "status": MemberStatus.EXPIRED,
    },
    {
        "first_name": "Rico",
        "last_name": "Bautista",
        "email": None,
        "phone": "09451234567",
        "gender": Gender.MALE,
        "date_of_birth": date(2003, 2, 18),
        "address": "Rosario, Batangas",
        "status": MemberStatus.ACTIVE,
    },
]


async def generate_member_code(session: AsyncSession) -> str:
    """Generate the next member code in sequence: DGM-0001, DGM-0002, ..."""
    result = await session.execute(select(func.count()).select_from(Member))
    count = result.scalar() or 0
    return f"DGM-{(count + 1):04d}"


async def seed_members(session: AsyncSession) -> None:
    """Seed placeholder members if none exist."""
    result = await session.execute(select(Member).limit(1))
    if result.scalar_one_or_none():
        return  # Members already seeded

    for member_data in PLACEHOLDER_MEMBERS:
        # Generate member code for each new member
        result = await session.execute(select(func.count()).select_from(Member))
        count = result.scalar() or 0
        member_code = f"DGM-{(count + 1):04d}"

        member = Member(member_code=member_code, **member_data)
        session.add(member)
        await session.flush()  # Flush to increment count for next iteration

    await session.commit()
    print("[SEED] Placeholder members seeded (for development — replace with real data).")
