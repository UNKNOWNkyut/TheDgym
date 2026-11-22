from datetime import datetime, timedelta, timezone
from decimal import Decimal
import logging
from typing import List, Optional, Union
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import delete, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import require_roles
from app.core.rate_limit import rate_limit_sensitive
from app.core.security import hash_password, persist_user_session_revocation, revoke_user_sessions
from app.database import get_db
from app.init_members import generate_member_code
from app.models.audit_log import AuditLog
from app.models.member import Member, MemberStatus
from app.models.member_membership import MemberMembership, MembershipStatus, PaymentMethod
from app.models.membership_plan import MembershipPlan
from app.models.notification import Notification
from app.models.user import User, UserRole
from app.models.user_biometric import UserBiometric
from app.models.user_profile import UserProfile
from app.schemas.auth import AuditLogResponse, UserCreateAdmin, UserResponse, UserUpdate
from app.services.audit import record_audit_log
from app.services.membership_activation import (
    activate_member_and_notify_on_payment,
    broadcast_admin_member_notification,
    detach_and_delete_member,
    expire_elapsed_memberships,
    has_other_active_membership,
    is_day_pass_plan,
)
from app.services.pagination import (
    PaginatedPage,
    make_cache_key,
    read_page_cache,
    slice_limit_plus_one,
)

logger = logging.getLogger("dgym.users")

router = APIRouter(prefix="/api/users", tags=["Users"])
audit_router = APIRouter(prefix="/api/audit-logs", tags=["Audit Logs"])


async def _query_audit_logs_page(
    db: AsyncSession,
    *,
    search: Optional[str] = None,
    action: Optional[str] = None,
    outcome: Optional[str] = None,
    actor_role: Optional[str] = None,
    skip: int = 0,
    limit: int = 25,
) -> PaginatedPage[AuditLogResponse]:
    norm_search = search.strip() if search and search.strip() else None
    norm_action = action.strip() if action and action.strip() else None
    norm_outcome = outcome.strip().upper() if outcome and outcome.strip() else None
    norm_role = actor_role.strip().lower() if actor_role and actor_role.strip() else None

    cache_key = make_cache_key(
        "audit_logs",
        search=norm_search,
        action=norm_action,
        outcome=norm_outcome,
        actor_role=norm_role,
        skip=skip,
        limit=limit,
    )
    cached = read_page_cache.get(cache_key)
    if cached is not None:
        return cached

    stmt = select(AuditLog)
    if norm_search:
        term = f"%{norm_search}%"
        stmt = stmt.where(
            or_(
                AuditLog.actor_email.ilike(term),
                AuditLog.action.ilike(term),
                AuditLog.target_type.ilike(term),
                AuditLog.target_id.ilike(term),
                AuditLog.details.ilike(term),
                AuditLog.ip_address.ilike(term),
            )
        )
    if norm_action:
        stmt = stmt.where(AuditLog.action.ilike(f"%{norm_action}%"))
    if norm_outcome:
        stmt = stmt.where(AuditLog.outcome == norm_outcome)
    if norm_role:
        stmt = stmt.where(AuditLog.actor_role == norm_role)

    stmt = (
        stmt.order_by(desc(AuditLog.created_at), desc(AuditLog.id))
        .offset(skip)
        .limit(limit + 1)
    )
    rows = (await db.execute(stmt)).scalars().all()
    page = slice_limit_plus_one(
        [AuditLogResponse.model_validate(item) for item in rows],
        skip=skip,
        limit=limit,
    )
    payload = PaginatedPage[AuditLogResponse](
        items=page.items,
        skip=skip,
        limit=limit,
        has_next=page.has_next,
        next_skip=page.next_skip,
    )
    return read_page_cache.set(cache_key, payload)


@router.get("", response_model=Union[PaginatedPage[UserResponse], List[UserResponse]])
async def list_users(
    search: Optional[str] = Query(None, max_length=120),
    role: Optional[UserRole] = Query(None),
    is_active: Optional[bool] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    paginated: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.STAFF])),
):
    """List registered gym users with deterministic `(created_at, id)` sorting and `limit + 1` pagination."""
    if await expire_elapsed_memberships(db):
        await db.commit()
        read_page_cache.invalidate_prefix("users:", "members:")

    norm_search = search.strip() if search and search.strip() else None
    cache_key = make_cache_key(
        "users",
        search=norm_search,
        role=role.value if role else None,
        is_active=is_active,
        skip=skip,
        limit=limit,
        paginated=paginated,
    )
    cached = read_page_cache.get(cache_key)
    if cached is not None:
        return cached

    stmt = select(User)
    if norm_search:
        term = f"%{norm_search}%"
        stmt = stmt.where(
            or_(
                User.full_name.ilike(term),
                User.email.ilike(term),
                User.phone.ilike(term),
            )
        )
    if role is not None:
        stmt = stmt.where(User.role == role)
    if is_active is not None:
        stmt = stmt.where(User.is_active.is_(is_active))

    stmt = (
        stmt.order_by(desc(User.created_at), desc(User.id))
        .offset(skip)
        .limit(limit + 1)
    )
    users = (await db.execute(stmt)).scalars().all()
    page = slice_limit_plus_one(
        [UserResponse.model_validate(u) for u in users],
        skip=skip,
        limit=limit,
    )
    result_payload: Union[PaginatedPage[UserResponse], List[UserResponse]] = (
        PaginatedPage[UserResponse](
            items=page.items,
            skip=skip,
            limit=limit,
            has_next=page.has_next,
            next_skip=page.next_skip,
        )
        if paginated
        else page.items
    )
    return read_page_cache.set(cache_key, result_payload)


@router.get("/audit-logs", response_model=Union[PaginatedPage[AuditLogResponse], List[AuditLogResponse]])
async def list_audit_logs(
    search: Optional[str] = Query(None, max_length=120),
    action: Optional[str] = Query(None, max_length=100),
    outcome: Optional[str] = Query(None, max_length=32),
    actor_role: Optional[str] = Query(None, max_length=32),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    paginated: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN])),
):
    """List recent security audit log entries. Admin only (Check 42)."""
    page = await _query_audit_logs_page(
        db,
        search=search,
        action=action,
        outcome=outcome,
        actor_role=actor_role,
        skip=skip,
        limit=limit,
    )
    return page if paginated else page.items


@audit_router.get("", response_model=PaginatedPage[AuditLogResponse])
async def list_audit_logs_paginated(
    search: Optional[str] = Query(None, max_length=120),
    action: Optional[str] = Query(None, max_length=100),
    outcome: Optional[str] = Query(None, max_length=32),
    actor_role: Optional[str] = Query(None, max_length=32),
    skip: int = Query(0, ge=0),
    limit: int = Query(25, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN])),
):
    """List audit logs with deterministic `(created_at DESC, id DESC)` and `limit + 1` pagination."""
    return await _query_audit_logs_page(
        db,
        search=search,
        action=action,
        outcome=outcome,
        actor_role=actor_role,
        skip=skip,
        limit=limit,
    )


@router.post(
    "",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(rate_limit_sensitive)],
)
async def create_user_by_admin(
    user_in: UserCreateAdmin,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN])),
):
    """Create a user with a specific role (Admin, Trainer, Member, User). Requires Admin role."""
    if user_in.role == UserRole.STAFF:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Staff role is disabled; Administrators handle front-desk operations.",
        )

    stmt = select(User).where(User.email == user_in.email.lower().strip())
    result = await db.execute(stmt)
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email already exists.",
        )

    new_user = User(
        email=user_in.email.lower().strip(),
        hashed_password=hash_password(user_in.password),
        full_name=user_in.full_name.strip(),
        phone=user_in.phone.strip() if user_in.phone else None,
        role=user_in.role,
        is_active=True,
    )
    db.add(new_user)
    await db.flush()

    await record_audit_log(
        db,
        action="ADMIN_USER_CREATED",
        outcome="SUCCESS",
        actor=current_user,
        target_type="user",
        target_id=new_user.id,
        request=request,
        details=f"Created user '{new_user.email}' with role '{new_user.role.value}'.",
    )
    await db.commit()
    read_page_cache.invalidate_prefix("users:")
    await db.refresh(new_user)
    return UserResponse.model_validate(new_user)


async def _find_member_by_email(db: AsyncSession, email: str) -> Optional[Member]:
    normalized = email.lower().strip()
    return (
        await db.execute(select(Member).where(func.lower(Member.email) == normalized))
    ).scalar_one_or_none()


async def _promote_user_with_plan(
    db: AsyncSession,
    *,
    user: User,
    plan_id: Optional[int],
    actor: User,
) -> bool:
    """Assign a selected non-Day-Pass membership plan when promoting USER -> MEMBER."""
    if plan_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please select a membership plan before promoting a user to Member.",
        )

    plan = (
        await db.execute(select(MembershipPlan).where(MembershipPlan.id == plan_id))
    ).scalar_one_or_none()
    if not plan or not plan.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Selected membership plan does not exist or is inactive.",
        )
    if is_day_pass_plan(plan):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Daily Pass cannot be used to promote a user to Member.",
        )

    member = await _find_member_by_email(db, user.email)
    if not member:
        name_parts = user.full_name.strip().split(" ", 1)
        first_name = name_parts[0] if name_parts else "Member"
        last_name = name_parts[1] if len(name_parts) > 1 and name_parts[1].strip() else first_name
        member = Member(
            member_code=await generate_member_code(db),
            first_name=first_name,
            last_name=last_name,
            email=user.email.lower().strip(),
            phone=user.phone,
            status=MemberStatus.ACTIVE,
            is_active=True,
        )
        db.add(member)
        await db.flush()

    now = datetime.now(timezone.utc)
    paid = Decimal(str(plan.price_php))
    new_ms = MemberMembership(
        member_id=member.id,
        plan_id=plan.id,
        start_date=now,
        end_date=now + timedelta(days=plan.duration_days),
        status=MembershipStatus.ACTIVE,
        paid_amount=paid,
        payment_method=PaymentMethod.CASH,
        created_by_user_id=actor.id,
        payer_name_snapshot=member.full_name,
        plan_name_snapshot=plan.name,
        notes=f"Assigned during role promotion ({plan.name}).",
    )
    db.add(new_ms)
    await db.flush()

    had_active_before = await has_other_active_membership(
        db, member_id=member.id, exclude_membership_id=new_ms.id
    )
    user.role = UserRole.MEMBER
    return await activate_member_and_notify_on_payment(
        db,
        membership=new_ms,
        member=member,
        plan=plan,
        paid_amount=paid,
        payment_method=PaymentMethod.CASH,
        is_new_member_activation=(not had_active_before),
    )


@router.patch(
    "/{user_id}",
    response_model=UserResponse,
    dependencies=[Depends(rate_limit_sensitive)],
)
async def update_user(
    user_id: int,
    user_update: UserUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN])),
):
    """Update user role, active status, or details. Requires Admin role."""
    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    if current_user.id == user_id:
        if user_update.is_active is False:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot disable your own active admin account.",
            )
        if user_update.role is not None and user_update.role != user.role:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot change your own admin role.",
            )

    should_revoke_sessions = False
    previous_role = user.role
    if user_update.full_name is not None:
        trimmed_name = user_update.full_name.strip()
        if len(trimmed_name) < 2:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Full name must be at least 2 characters.",
            )
        user.full_name = trimmed_name
    if user_update.phone is not None:
        user.phone = user_update.phone.strip() or None
    if user_update.is_active is not None:
        if user.is_active and not user_update.is_active:
            should_revoke_sessions = True
        user.is_active = user_update.is_active

    admin_notified = False
    promoted_member: Optional[Member] = None
    if user_update.role is not None:
        if user.role != user_update.role:
            should_revoke_sessions = True
        if previous_role == UserRole.USER and user_update.role == UserRole.MEMBER:
            admin_notified = await _promote_user_with_plan(
                db, user=user, plan_id=user_update.plan_id, actor=current_user
            )
            if admin_notified:
                promoted_member = await _find_member_by_email(db, user.email)
        else:
            user.role = user_update.role
            if user_update.role != previous_role and user_update.role in (
                UserRole.TRAINER,
                UserRole.ADMIN,
            ):
                linked_member = await _find_member_by_email(db, user.email)
                if linked_member is not None:
                    await detach_and_delete_member(db, linked_member)

    if should_revoke_sessions:
        await persist_user_session_revocation(db, user.id)

    await record_audit_log(
        db,
        action="ADMIN_USER_UPDATED",
        outcome="SUCCESS",
        actor=current_user,
        target_type="user",
        target_id=user.id,
        request=request,
        details=f"Updated user '{user.email}' (role={user.role.value}, is_active={user.is_active}).",
    )
    await db.commit()
    read_page_cache.invalidate_prefix("users:", "members:", "visits:", "tap_logs:")
    if admin_notified and promoted_member is not None:
        try:
            await broadcast_admin_member_notification(promoted_member)
        except Exception as exc:
            logger.warning("Non-fatal WS admin broadcast error after promotion: %s", exc)
    await db.refresh(user)
    return UserResponse.model_validate(user)


@router.delete(
    "/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(rate_limit_sensitive)],
)
async def delete_user(
    user_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN])),
):
    """Delete a user account while preserving paid financial history. Admin only."""
    if current_user.id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own active admin account.",
        )
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    deleted_email = user.email
    revoke_user_sessions(user.id)

    linked_member = await _find_member_by_email(db, user.email)
    if linked_member is not None:
        await detach_and_delete_member(db, linked_member)

    await db.execute(delete(UserBiometric).where(UserBiometric.user_id == user.id))
    await db.execute(delete(UserProfile).where(UserProfile.user_id == user.id))
    await db.execute(delete(Notification).where(Notification.user_id == user.id))
    await db.delete(user)

    await record_audit_log(
        db,
        action="ADMIN_USER_DELETED",
        outcome="SUCCESS",
        actor=current_user,
        target_type="user",
        target_id=user_id,
        request=request,
        details=f"Deleted user account '{deleted_email}'.",
    )
    await db.commit()
    read_page_cache.invalidate_prefix("users:", "members:", "visits:", "tap_logs:")

