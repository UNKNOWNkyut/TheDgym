from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, update, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.database import get_db
from app.models.user import User
from app.models.member import Member
from app.models.notification import Notification
from app.schemas.retention import NotificationResponse

router = APIRouter(prefix="/api/notifications", tags=["In-App Notifications"])


@router.get(
    "",
    response_model=List[NotificationResponse],
    summary="Get notifications for the current authenticated user",
)
async def get_my_notifications(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # 1. Admin Role Notifications
    if current_user.role == "admin":
        stmt = (
            select(Notification)
            .where(
                Notification.user_id == current_user.id,
                Notification.type.notin_(["retention", "offer"]),
            )
            .order_by(Notification.created_at.desc())
            .limit(50)
        )
        rows = (await db.execute(stmt)).scalars().all()

        # If no notifications exist yet for admin, seed default admin alerts
        if not rows:
            default_admin_notifs = [
                Notification(
                    user_id=current_user.id,
                    title="⚠️ High Churn Risk Alert: Action Needed",
                    message="AI Model flagged Juan Dela Cruz (Recency: Today, Risk: 88%) with high cancellation velocity. Immediate retention strategy required.",
                    type="churn_alert",
                    action_text="Review AI Strategy",
                    action_url="/manage/analytics",
                    is_read=False,
                ),
                Notification(
                    user_id=current_user.id,
                    title="🎉 New Member Enrollment",
                    message="Alex Cruz enrolled in 1-Month Unlimited Plan (₱1,500). Payment confirmed via GCash.",
                    type="enrollment",
                    action_text="View Members",
                    action_url="/manage/members",
                    is_read=False,
                ),
                Notification(
                    user_id=current_user.id,
                    title="👤 New User Registered",
                    message="Jordan Ramos created a DGym account via mobile onboarding. Awaiting membership plan selection.",
                    type="registration",
                    action_text="View Users",
                    action_url="/manage/users",
                    is_read=True,
                ),
            ]
            for n in default_admin_notifs:
                db.add(n)
            await db.commit()

            stmt = (
                select(Notification)
                .where(
                    Notification.user_id == current_user.id,
                    Notification.type.notin_(["retention", "offer"]),
                )
                .order_by(Notification.created_at.desc())
                .limit(50)
            )
            rows = (await db.execute(stmt)).scalars().all()

        return rows

    # 2. Trainer Role Notifications
    if current_user.role == "trainer":
        stmt = (
            select(Notification)
            .where(
                Notification.user_id == current_user.id,
                Notification.type.notin_(["retention", "offer"]),
            )
            .order_by(Notification.created_at.desc())
            .limit(50)
        )
        rows = (await db.execute(stmt)).scalars().all()

        # If no notifications exist yet for trainer, seed default trainer alerts
        if not rows:
            default_trainer_notifs = [
                Notification(
                    user_id=current_user.id,
                    title="🏋️ New 1-on-1 PT Session Booking",
                    message="Alex Cruz enrolled and booked a 1-on-1 Powerlifting Assessment session with you for Saturday 9:00 AM.",
                    type="pt_booking",
                    action_text="View PT Sessions",
                    action_url="/manage/pt-sessions",
                    is_read=False,
                ),
                Notification(
                    user_id=current_user.id,
                    title="📅 PT Client Check-In",
                    message="Marcus Vance checked in for today's 4:00 PM Strength & Hypertrophy session.",
                    type="session_alert",
                    action_text="Open PT Schedule",
                    action_url="/manage/pt-sessions",
                    is_read=True,
                ),
            ]
            for n in default_trainer_notifs:
                db.add(n)
            await db.commit()

            stmt = (
                select(Notification)
                .where(
                    Notification.user_id == current_user.id,
                    Notification.type.notin_(["retention", "offer"]),
                )
                .order_by(Notification.created_at.desc())
                .limit(50)
            )
            rows = (await db.execute(stmt)).scalars().all()

        return rows

    # 3. Member / User Notifications (Account offers, personal retention, bookings)
    stmt_mem = select(Member.id).where(Member.email == current_user.email.lower().strip())
    mem_id = (await db.execute(stmt_mem)).scalar_one_or_none()

    conditions = [Notification.user_id == current_user.id]
    if mem_id:
        conditions.append(Notification.member_id == mem_id)

    stmt = (
        select(Notification)
        .where(or_(*conditions))
        .order_by(Notification.created_at.desc())
        .limit(50)
    )
    rows = (await db.execute(stmt)).scalars().all()
    return rows


@router.patch(
    "/{notification_id}/read",
    summary="Mark a specific notification as read",
)
async def mark_notification_read(
    notification_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(Notification).where(Notification.id == notification_id)
    notif = (await db.execute(stmt)).scalar_one_or_none()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")

    # Check 06 / Check 33: Verify notification belongs to current_user or their linked Member
    stmt_mem = select(Member.id).where(Member.email == current_user.email.lower().strip())
    mem_id = (await db.execute(stmt_mem)).scalar_one_or_none()

    owns_notification = (notif.user_id == current_user.id) or (
        mem_id is not None and notif.member_id == mem_id
    )
    if not owns_notification:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to modify this notification.",
        )

    notif.is_read = True
    await db.commit()

    return {"status": "success", "id": notification_id, "is_read": True}


@router.post(
    "/read-all",
    summary="Mark all unread notifications as read for current user",
)
async def mark_all_notifications_read(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt_mem = select(Member.id).where(Member.email == current_user.email.lower().strip())
    mem_id = (await db.execute(stmt_mem)).scalar_one_or_none()

    conditions = [Notification.user_id == current_user.id]
    if mem_id:
        conditions.append(Notification.member_id == mem_id)

    stmt = (
        update(Notification)
        .where(or_(*conditions), Notification.is_read == False)
        .values(is_read=True)
    )
    result = await db.execute(stmt)
    await db.commit()

    return {"status": "success", "updated_count": result.rowcount}
