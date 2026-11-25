import asyncio
from datetime import datetime, timedelta, timezone
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import ensure_utc, hash_password
from app.database import AsyncSessionLocal, engine, Base
from app.init_members import generate_member_code
from app.init_plans import seed_plans
from app.models.member import Member, MemberStatus
from app.models.member_membership import MemberMembership, MembershipStatus, PaymentMethod
from app.models.membership_plan import MembershipPlan
from app.models.user import User, UserRole

INITIAL_USERS = [
    {
        "email": "admin@thedgym.com",
        "password": "admin12345",
        "full_name": "DGym Admin",
        "phone": "+63 969 483 9896",
        "role": UserRole.ADMIN,
    },
    {
        "email": "trainer@thedgym.com",
        "password": "trainer12345",
        "full_name": "Coach Ivan",
        "phone": "+63 969 483 9896",
        "role": UserRole.TRAINER,
    },
    {
        "email": "marta@thedgym.com",
        "password": "trainer12345",
        "full_name": "Coach Marta",
        "phone": "+63 969 483 9896",
        "role": UserRole.TRAINER,
    },
    {
        "email": "kresler@thedgym.com",
        "password": "trainer12345",
        "full_name": "Coach Kresler",
        "phone": "+63 969 483 9896",
        "role": UserRole.TRAINER,
    },
    {
        "email": "member@thedgym.com",
        "password": "member12345",
        "full_name": "Alex Cruz",
        "phone": "+63 917 100 0004",
        "role": UserRole.MEMBER,
    },
    {
        "email": "nicole.reyes@thedgym.com",
        "password": "member12345",
        "full_name": "Nicole Reyes",
        "phone": "+63 917 100 0011",
        "role": UserRole.MEMBER,
        "seed_plan_slug": "monthly",
    },
    {
        "email": "christian.bautista@thedgym.com",
        "password": "member12345",
        "full_name": "Christian Bautista",
        "phone": "+63 917 100 0012",
        "role": UserRole.MEMBER,
        "seed_plan_slug": "quarterly",
    },
    {
        "email": "jasmine.villanueva@thedgym.com",
        "password": "member12345",
        "full_name": "Jasmine Villanueva",
        "phone": "+63 917 100 0013",
        "role": UserRole.MEMBER,
        "seed_plan_slug": "monthly",
    },
]


async def _ensure_member_with_active_plan(
    session: AsyncSession,
    *,
    email: str,
    full_name: str,
    phone: str,
    plan_slug: str,
) -> None:
    """Idempotently create a linked Member record and active plan for seeded test accounts."""
    normalized_email = email.lower().strip()
    member = (
        await session.execute(select(Member).where(func.lower(Member.email) == normalized_email))
    ).scalar_one_or_none()
    if not member:
        parts = full_name.strip().split(None, 1)
        member = Member(
            member_code=await generate_member_code(session),
            first_name=parts[0],
            last_name=parts[1] if len(parts) > 1 else "Member",
            email=normalized_email,
            phone=phone,
            status=MemberStatus.ACTIVE,
            is_active=True,
        )
        session.add(member)
        await session.flush()

    plan = (
        await session.execute(select(MembershipPlan).where(MembershipPlan.slug == plan_slug))
    ).scalar_one_or_none()
    if not plan:
        return

    now = datetime.now(timezone.utc)
    active_memberships = (
        await session.execute(
            select(MemberMembership).where(
                MemberMembership.member_id == member.id,
                MemberMembership.status == MembershipStatus.ACTIVE,
            )
        )
    ).scalars().all()
    if any(ms.end_date and ensure_utc(ms.end_date) > now for ms in active_memberships):
        return

    session.add(
        MemberMembership(
            member_id=member.id,
            plan_id=plan.id,
            start_date=now,
            end_date=now + timedelta(days=plan.duration_days),
            status=MembershipStatus.ACTIVE,
            paid_amount=plan.price_php,
            payment_method=PaymentMethod.GCASH,
            payer_name_snapshot=full_name,
            plan_name_snapshot=plan.name,
            notes="Seeded local test member account",
        )
    )
    member.status = MemberStatus.ACTIVE


async def seed_users(session: AsyncSession):
    """Seed initial accounts and upgrade legacy placeholder coach names idempotently."""
    for user_data in INITIAL_USERS:
        stmt = select(User).where(User.email == user_data["email"])
        result = await session.execute(stmt)
        existing = result.scalar_one_or_none()
        if not existing:
            new_user = User(
                email=user_data["email"],
                hashed_password=hash_password(user_data["password"]),
                full_name=user_data["full_name"],
                phone=user_data["phone"],
                role=user_data["role"],
                is_active=True,
            )
            session.add(new_user)
            print(f"Seeded user: {user_data['email']} ({user_data['role'].value})")
        elif existing.full_name == "Head Coach Mark":
            existing.full_name = user_data["full_name"]
            existing.phone = user_data["phone"]

        plan_slug = user_data.get("seed_plan_slug")
        if plan_slug:
            await _ensure_member_with_active_plan(
                session,
                email=user_data["email"],
                full_name=user_data["full_name"],
                phone=user_data["phone"],
                plan_slug=plan_slug,
            )

    await session.commit()


async def init_db_and_seed():
    """Create all tables and seed data."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as session:
        await seed_plans(session)
        await seed_users(session)


if __name__ == "__main__":
    asyncio.run(init_db_and_seed())
