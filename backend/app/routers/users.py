from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import require_roles
from app.core.rate_limit import rate_limit_sensitive
from app.core.security import hash_password, revoke_user_sessions
from app.database import get_db
from app.models.audit_log import AuditLog
from app.models.user import User, UserRole
from app.schemas.auth import AuditLogResponse, UserCreateAdmin, UserResponse, UserUpdate
from app.services.audit import record_audit_log

router = APIRouter(prefix="/api/users", tags=["Users"])


@router.get("", response_model=List[UserResponse])
async def list_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.STAFF])),
):
    """List all registered gym users. Requires Admin or Staff role."""
    stmt = select(User).order_by(User.created_at.desc())
    result = await db.execute(stmt)
    users = result.scalars().all()
    return [UserResponse.model_validate(u) for u in users]


@router.get("/audit-logs", response_model=List[AuditLogResponse])
async def list_audit_logs(
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN])),
):
    """List recent security audit log entries. Admin only (Check 42)."""
    stmt = select(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit)
    result = await db.execute(stmt)
    logs = result.scalars().all()
    return [AuditLogResponse.model_validate(item) for item in logs]


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
    """Create a user with a specific role (Admin, Staff, Trainer, Member). Requires Admin role."""
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
    await db.refresh(new_user)
    return UserResponse.model_validate(new_user)


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

    should_revoke_sessions = False
    if user_update.full_name is not None:
        user.full_name = user_update.full_name.strip()
    if user_update.phone is not None:
        user.phone = user_update.phone.strip() if user_update.phone else None
    if user_update.is_active is not None:
        if user.is_active and not user_update.is_active:
            should_revoke_sessions = True
        user.is_active = user_update.is_active
    if user_update.role is not None:
        if user.role != user_update.role:
            should_revoke_sessions = True
        user.role = user_update.role

    if should_revoke_sessions:
        revoke_user_sessions(user.id)

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
    """Delete a user account. Admin only."""
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

