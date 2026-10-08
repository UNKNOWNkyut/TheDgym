"""Phase 5 seed data: class sessions and PT sessions with placeholder data."""
from datetime import datetime, timezone, timedelta
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.class_session import ClassSession, ClassType, ClassStatus
from app.models.pt_session import PTSession, PTSessionStatus
from app.models.user import User, UserRole
from app.models.member import Member


async def seed_phase5(session: AsyncSession) -> None:
    """Seed placeholder class sessions and PT sessions if none exist."""
    existing = await session.execute(select(ClassSession).limit(1))
    if existing.scalar_one_or_none():
        return  # already seeded

    # Get trainer user if any
    trainer_stmt = select(User).where(User.role == UserRole.TRAINER).limit(1)
    trainer_result = await session.execute(trainer_stmt)
    trainer = trainer_result.scalar_one_or_none()
    trainer_id = trainer.id if trainer else None

    # Get first member for PT session seeding
    member_stmt = select(Member).limit(1)
    member_result = await session.execute(member_stmt)
    member = member_result.scalar_one_or_none()
    member_id = member.id if member else None

    now = datetime.now(timezone.utc)

    # Placeholder class sessions
    classes = [
        ClassSession(
            name="Barbell Club — Morning",
            description="Powerlifting and barbell technique session. Open to all skill levels.",
            coach_id=trainer_id,
            class_type=ClassType.BARBELL_CLUB,
            scheduled_at=now + timedelta(days=1, hours=6),
            duration_minutes=90,
            max_capacity=15,
            status=ClassStatus.SCHEDULED,
            location="Main Floor",
        ),
        ClassSession(
            name="Conditioning Circuit",
            description="High-intensity conditioning circuit for fat loss and endurance.",
            coach_id=trainer_id,
            class_type=ClassType.CONDITIONING,
            scheduled_at=now + timedelta(days=1, hours=17),
            duration_minutes=60,
            max_capacity=20,
            status=ClassStatus.SCHEDULED,
            location="Functional Area",
        ),
        ClassSession(
            name="Open Gym — Strength Day",
            description="Unsupervised open gym session. Focus on heavy compound lifts.",
            coach_id=None,
            class_type=ClassType.OPEN_GYM,
            scheduled_at=now + timedelta(days=2, hours=8),
            duration_minutes=120,
            max_capacity=30,
            status=ClassStatus.SCHEDULED,
            location="Main Floor",
        ),
        ClassSession(
            name="Powerlifting Meet Prep",
            description="Competition preparation — squat, bench, deadlift refinement.",
            coach_id=trainer_id,
            class_type=ClassType.POWERLIFTING,
            scheduled_at=now - timedelta(days=1, hours=8),
            duration_minutes=90,
            max_capacity=10,
            status=ClassStatus.COMPLETED,
            location="Platform Area",
        ),
    ]

    session.add_all(classes)
    await session.flush()

    # Placeholder PT sessions
    if member_id and trainer_id:
        pt_sessions = [
            PTSession(
                trainer_id=trainer_id,
                member_id=member_id,
                scheduled_at=now + timedelta(days=3, hours=9),
                duration_minutes=60,
                status=PTSessionStatus.SCHEDULED,
                notes="Initial assessment and program design session.",
            ),
            PTSession(
                trainer_id=trainer_id,
                member_id=member_id,
                scheduled_at=now - timedelta(days=3, hours=9),
                duration_minutes=60,
                status=PTSessionStatus.COMPLETED,
                notes="Squat technique correction.",
                coach_notes="Good progress on hip hinge. Continue with tempo squats.",
            ),
        ]
        session.add_all(pt_sessions)

    await session.commit()
    print(f"[OK] Phase 5 seed: {len(classes)} class sessions seeded.")
