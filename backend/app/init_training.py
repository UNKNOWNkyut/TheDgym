"""
Phase 5 / Phase 9 seed data: official 6:00 PM group classes (TABATA & HIIT)
and personal training sessions with Coach Ivan, Coach Marta, and Coach Kresler.
"""
from datetime import datetime, timedelta, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.class_session import ClassSession, ClassStatus, ClassType
from app.models.member import Member
from app.models.pt_session import PTSession, PTSessionStatus
from app.models.user import User, UserRole

MANILA_TZ = timezone(timedelta(hours=8))

LEGACY_PLACEHOLDER_CLASS_NAMES = {
    "Barbell Club — Morning",
    "Barbell Club - Morning",
    "Conditioning Circuit",
    "Open Gym — Strength Day",
    "Open Gym - Strength Day",
    "Powerlifting Meet Prep",
}


def _next_six_pm_utc(days_ahead: int) -> datetime:
    """Return upcoming 6:00 PM Asia/Manila converted to UTC."""
    now_manila = datetime.now(MANILA_TZ)
    target_date = (now_manila + timedelta(days=days_ahead)).date()
    six_pm_manila = datetime(
        target_date.year,
        target_date.month,
        target_date.day,
        18,
        0,
        0,
        tzinfo=MANILA_TZ,
    )
    return six_pm_manila.astimezone(timezone.utc)


async def seed_phase5(session: AsyncSession) -> None:
    """Idempotently seed official 6:00 PM TABATA & HIIT group classes and PT sessions."""
    trainers_res = await session.execute(
        select(User).where(User.role == UserRole.TRAINER, User.is_active == True)
    )
    trainers = {u.full_name: u for u in trainers_res.scalars().all()}
    fallback_trainer = next(iter(trainers.values()), None)

    coach_ivan_id = trainers["Coach Ivan"].id if "Coach Ivan" in trainers else (fallback_trainer.id if fallback_trainer else None)
    coach_marta_id = trainers["Coach Marta"].id if "Coach Marta" in trainers else coach_ivan_id
    coach_kresler_id = trainers["Coach Kresler"].id if "Coach Kresler" in trainers else coach_ivan_id

    existing_classes = (await session.execute(select(ClassSession))).scalars().all()
    by_name = {c.name: c for c in existing_classes}

    mutated = False

    # Cancel un-enrolled legacy placeholder classes if still marked scheduled
    for cls in existing_classes:
        if (
            cls.name in LEGACY_PLACEHOLDER_CLASS_NAMES
            and cls.status == ClassStatus.SCHEDULED
            and len(cls.enrollments) == 0
        ):
            cls.status = ClassStatus.CANCELLED
            mutated = True

    official_classes = [
        {
            "name": "TABATA — 6:00 PM Evening Session",
            "description": "High-intensity interval conditioning led by Coach Marta. Free (₱0) with active membership.",
            "coach_id": coach_marta_id,
            "class_type": ClassType.TABATA,
            "scheduled_at": _next_six_pm_utc(1),
            "duration_minutes": 60,
            "max_capacity": 20,
            "status": ClassStatus.SCHEDULED,
            "location": "Turf & Conditioning Zone",
            "notes": "₱0 — Unlimited Free Access with Active Membership",
        },
        {
            "name": "HIIT — 6:00 PM Evening Session",
            "description": "Explosive metabolic conditioning and athletic footwork led by Coach Kresler. Free (₱0) with active membership.",
            "coach_id": coach_kresler_id,
            "class_type": ClassType.HIIT,
            "scheduled_at": _next_six_pm_utc(2),
            "duration_minutes": 60,
            "max_capacity": 20,
            "status": ClassStatus.SCHEDULED,
            "location": "Turf & Boxing Zone",
            "notes": "₱0 — Unlimited Free Access with Active Membership",
        },
    ]

    for cdata in official_classes:
        existing_cls = by_name.get(cdata["name"])
        if existing_cls is None:
            session.add(ClassSession(**cdata))
            mutated = True
        elif existing_cls.coach_id is None and cdata["coach_id"] is not None:
            existing_cls.coach_id = cdata["coach_id"]
            mutated = True

    await session.flush()

    # Seed initial PT sessions only if none exist yet
    pt_exists = (await session.execute(select(PTSession.id).limit(1))).scalar_one_or_none()
    if pt_exists is None:
        member = (await session.execute(select(Member).limit(1))).scalar_one_or_none()
        if member and coach_ivan_id:
            now = datetime.now(timezone.utc)
            pt_sessions = [
                PTSession(
                    trainer_id=coach_ivan_id,
                    member_id=member.id,
                    scheduled_at=now + timedelta(days=2, hours=2),
                    duration_minutes=60,
                    status=PTSessionStatus.SCHEDULED,
                    notes="[12 Sessions — Muscle Gain (₱8,000)] Progressive hypertrophy assessment.",
                ),
                PTSession(
                    trainer_id=coach_kresler_id or coach_ivan_id,
                    member_id=member.id,
                    scheduled_at=now + timedelta(days=4, hours=3),
                    duration_minutes=90,
                    status=PTSessionStatus.CONFIRMED,
                    notes="[12 Sessions — Boxing 1.5 HR (₱8,000)] Pad work, footwork, and conditioning.",
                ),
            ]
            session.add_all(pt_sessions)
            mutated = True

    if mutated:
        await session.commit()
