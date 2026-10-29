import logging
from datetime import datetime, timedelta, timezone
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.member import Member
from app.models.notification import Notification
from app.models.user import User, UserRole
from app.models.visit import Visit

logger = logging.getLogger("dgym.visit_sweeper")

# Philippine Standard Time (UTC+8)
PH_TZ = timezone(timedelta(hours=8))


def to_ph_time(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(PH_TZ)


def get_scheduled_closing_ph(checkin_ph: datetime) -> datetime:
    """
    Official The DGym Operating Hours:
      - Monday–Friday (0..4): 6:00 AM – 11:00 PM (23:00 PH Time)
      - Saturday (5):         6:00 AM – 11:00 PM (23:00 PH Time)
      - Sunday (6):           2:00 PM – 10:00 PM (22:00 PH Time)
    """
    closing_hour = 22 if checkin_ph.weekday() == 6 else 23
    return checkin_ph.replace(hour=closing_hour, minute=0, second=0, microsecond=0)


async def sweep_overdue_open_visits(db: AsyncSession) -> int:
    """
    Auto-checkout any open gym visits whose scheduled gym closing time has passed.
    Safe against server restarts / offline PCs (catches up on next startup, read, or tap)
    and safe for late-night testing after closing hours.
    """
    now_utc = datetime.now(timezone.utc)
    now_ph = to_ph_time(now_utc)

    stmt = select(Visit).where(Visit.checked_out_at.is_(None))
    open_visits = (await db.execute(stmt)).scalars().all()
    if not open_visits:
        return 0

    closed_count = 0
    for visit in open_visits:
        checkin_ph = to_ph_time(visit.checked_in_at)
        closing_ph = get_scheduled_closing_ph(checkin_ph)

        if checkin_ph < closing_ph <= now_ph:
            # Member checked in during operating hours and closing time has now passed
            visit.checked_out_at = closing_ph.astimezone(timezone.utc)
            closing_label = closing_ph.strftime("%I:%M %p").lstrip("0")
            auto_note = f"Auto-checked out at gym closing time ({closing_label})"
            visit.notes = f"{visit.notes} • {auto_note}" if visit.notes else auto_note
            closed_count += 1
        elif checkin_ph.date() < now_ph.date():
            # Late-night after-hours entry from a previous calendar day
            end_of_day_ph = checkin_ph.replace(hour=23, minute=59, second=59, microsecond=0)
            visit.checked_out_at = end_of_day_ph.astimezone(timezone.utc)
            auto_note = "Auto-checked out at end of day"
            visit.notes = f"{visit.notes} • {auto_note}" if visit.notes else auto_note
            closed_count += 1

    if closed_count > 0:
        await db.commit()
        logger.info(f"[AUTO-CHECKOUT] Automatically checked out {closed_count} overdue visit(s).")

    return closed_count


async def notify_admins_on_checkin(
    db: AsyncSession,
    *,
    member: Member,
    plan_name: Optional[str],
    method_label: str,
    checkin_utc: datetime,
) -> None:
    """Create an in-app Notification for all active Admin accounts whenever a member checks in."""
    admins_stmt = select(User).where(
        User.role == UserRole.ADMIN,
        User.is_active.is_(True),
    )
    admins = (await db.execute(admins_stmt)).scalars().all()
    if not admins:
        return

    time_ph_str = to_ph_time(checkin_utc).strftime("%I:%M %p").lstrip("0")
    plan_suffix = f" • {plan_name}" if plan_name else ""

    for admin_user in admins:
        db.add(
            Notification(
                user_id=admin_user.id,
                member_id=member.id,
                title=f"✅ Member Check-In: {member.full_name}",
                message=(
                    f"{member.full_name} ({member.member_code}) checked in via "
                    f"{method_label} at {time_ph_str}{plan_suffix}."
                ),
                type="session_alert",
                action_text="View Gym Visits",
                action_url="/manage/visits",
                is_read=False,
            )
        )
