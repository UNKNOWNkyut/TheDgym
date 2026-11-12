from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import and_, delete, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, require_roles
from app.core.rate_limit import require_rate_limit
from app.database import get_db
from app.models.user import User, UserRole
from app.models.member import Member
from app.models.notification import Notification
from app.schemas.retention import NotificationResponse
from app.services.sms_service import get_sms_account_status, send_sms

router = APIRouter(prefix="/api/notifications", tags=["In-App Notifications"])
rate_limit_sms = require_rate_limit("sms_send", max_requests=10, window_seconds=60)

_STAFF_ROLES = (UserRole.ADMIN, UserRole.STAFF, UserRole.TRAINER)


async def _get_linked_member_id(db: AsyncSession, current_user: User) -> Optional[int]:
    """Resolve Member.id matching current_user.email case-insensitively."""
    normalized_email = (current_user.email or "").lower().strip()
    if not normalized_email:
        return None
    stmt_mem = select(Member.id).where(func.lower(Member.email) == normalized_email)
    return (await db.execute(stmt_mem)).scalar_one_or_none()


async def _notification_scope_for_user(db: AsyncSession, current_user: User):
    """Build SQLAlchemy WHERE clause scoping notifications to current_user safely."""
    if current_user.role in _STAFF_ROLES:
        return and_(
            Notification.user_id == current_user.id,
            Notification.type.notin_(["retention", "offer"]),
        )

    mem_id = await _get_linked_member_id(db, current_user)
    if mem_id is not None:
        return or_(
            Notification.user_id == current_user.id,
            and_(Notification.member_id == mem_id, Notification.user_id.is_(None)),
        )
    return Notification.user_id == current_user.id


async def _user_owns_notification(
    db: AsyncSession,
    notif: Notification,
    current_user: User,
) -> bool:
    """Verify current_user owns an individual notification without leaking user-targeted staff alerts."""
    if notif.user_id == current_user.id:
        return True
    if current_user.role in _STAFF_ROLES or notif.user_id is not None or notif.member_id is None:
        return False
    mem_id = await _get_linked_member_id(db, current_user)
    return mem_id is not None and notif.member_id == mem_id


@router.get(
    "",
    response_model=List[NotificationResponse],
    summary="Get notifications for the current authenticated user",
)
async def get_my_notifications(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    scope = await _notification_scope_for_user(db, current_user)
    stmt = (
        select(Notification)
        .where(scope)
        .order_by(Notification.created_at.desc())
        .limit(50)
    )
    rows = (await db.execute(stmt)).scalars().all()
    return rows


@router.delete(
    "/clear-all",
    summary="Permanently dismiss and delete all notifications for current user",
)
async def clear_all_notifications(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    scope = await _notification_scope_for_user(db, current_user)
    stmt = delete(Notification).where(scope)
    result = await db.execute(stmt)
    await db.commit()
    return {"status": "cleared", "deleted_count": result.rowcount or 0}


@router.delete(
    "/{notification_id}",
    summary="Permanently dismiss and delete a single notification",
)
async def delete_notification(
    notification_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(Notification).where(Notification.id == notification_id)
    notif = (await db.execute(stmt)).scalar_one_or_none()
    if not notif:
        return {"status": "deleted", "id": notification_id}

    if not await _user_owns_notification(db, notif, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to delete this notification.",
        )

    await db.delete(notif)
    await db.commit()
    return {"status": "deleted", "id": notification_id}


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

    # Check 06 / Check 33: Verify notification belongs to current_user or their unaddressed linked Member alert
    if not await _user_owns_notification(db, notif, current_user):
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
    scope = await _notification_scope_for_user(db, current_user)
    stmt = (
        update(Notification)
        .where(scope, Notification.is_read.is_(False))
        .values(is_read=True)
    )
    result = await db.execute(stmt)
    await db.commit()

    return {"status": "success", "updated_count": result.rowcount or 0}


# ──────────────────────────────────────────────────────────────────────────────
# SMS Notification Endpoints (Admin & Staff via TextBee Android Gateway)
# ──────────────────────────────────────────────────────────────────────────────

class TestSmsRequest(BaseModel):
    phone: str = Field(..., description="Philippine mobile number (e.g. 09171234567, +639171234567)")
    message: str = Field(..., min_length=1, max_length=480, description="SMS text content")


@router.get(
    "/sms/status",
    summary="Get TextBee Android Gateway device status and connectivity",
)
async def get_sms_status(
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.STAFF])),
):
    """Fetches real-time TextBee Android Gateway device status (battery, online state)."""
    return await get_sms_account_status()


@router.post(
    "/sms/send-test",
    summary="Send a test SMS message via TextBee Android Gateway",
    dependencies=[Depends(rate_limit_sms)],
)
async def send_test_sms(
    payload: TestSmsRequest,
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.STAFF])),
):
    """Sends a transactional SMS to a single recipient."""
    return await send_sms(payload.phone, payload.message)
