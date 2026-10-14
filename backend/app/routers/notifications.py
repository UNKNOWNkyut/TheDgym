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
    # Find matching member if exists
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
