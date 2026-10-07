import asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.database import AsyncSessionLocal, engine, Base
from app.models.user import User, UserRole

INITIAL_USERS = [
    {
        "email": "admin@thedgym.com",
        "password": "admin12345",
        "full_name": "DGym Admin",
        "phone": "+63 917 100 0001",
        "role": UserRole.ADMIN,
    },
    {
        "email": "staff@thedgym.com",
        "password": "staff12345",
        "full_name": "DGym Staff",
        "phone": "+63 917 100 0002",
        "role": UserRole.STAFF,
    },
    {
        "email": "trainer@thedgym.com",
        "password": "trainer12345",
        "full_name": "Head Coach Mark",
        "phone": "+63 917 100 0003",
        "role": UserRole.TRAINER,
    },
    {
        "email": "member@thedgym.com",
        "password": "member12345",
        "full_name": "Alex Cruz",
        "phone": "+63 917 100 0004",
        "role": UserRole.MEMBER,
    },
]


async def seed_users(session: AsyncSession):
    """Seed initial accounts if not already present."""
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

    await session.commit()


async def init_db_and_seed():
    """Create all tables and seed data."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as session:
        await seed_users(session)


if __name__ == "__main__":
    asyncio.run(init_db_and_seed())
