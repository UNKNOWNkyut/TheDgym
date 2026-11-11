"""
Members router — CRUD endpoints for gym member management.
Access: Admin and Staff only (read + create + update), Admin only (delete).
"""
import re
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select, func, or_, delete, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import require_roles
from app.core.rate_limit import rate_limit_sensitive
from app.core.security import revoke_user_sessions
from app.database import get_db
from app.models.member import Member, MemberStatus
from app.models.member_keycard import MemberKeycard
from app.models.keycard_tap_log import KeycardTapLog
from app.models.member_membership import MemberMembership
from app.models.visit import Visit
from app.models.pt_session import PTSession
from app.models.class_session import ClassEnrollment
from app.models.notification import Notification
from app.models.retention_strategy import RetentionStrategy
from app.models.prediction import Prediction
from app.models.processed_customer import ProcessedCustomer
from app.models.raw_transaction import RawTransaction
from app.models.user import User, UserRole
from app.schemas.gym import MemberCreate, MemberResponse, MemberUpdate
from app.seed_members import generate_member_code
from app.services.audit import record_audit_log
from app.services.overview_kpis import compute_overview_kpis

router = APIRouter(prefix="/api/members", tags=["Members"])

_EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")


async def _normalize_and_check_member_email(
    db: AsyncSession,
    raw_email: Optional[str],
    *,
    exclude_member_id: Optional[int] = None,
) -> Optional[str]:
    """Normalize optional email, validate format, and enforce case-insensitive uniqueness."""
    email_val = raw_email.lower().strip() if (raw_email and raw_email.strip()) else None
    if not email_val:
        return None
    if not _EMAIL_REGEX.match(email_val):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid email format. Please provide a valid email address.",
        )
    stmt = select(Member.id).where(func.lower(Member.email) == email_val)
    if exclude_member_id is not None:
        stmt = stmt.where(Member.id != exclude_member_id)
    if (await db.execute(stmt)).scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A member with this email already exists.",
        )
    return email_val


async def _find_linked_user_id(db: AsyncSession, email: Optional[str]) -> Optional[int]:
    """Find linked User.id matching Member.email case-insensitively."""
    normalized = email.lower().strip() if (email and email.strip()) else None
    if not normalized:
        return None
    u_res = await db.execute(select(User.id).where(func.lower(User.email) == normalized))
    return u_res.scalar_one_or_none()

# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def _member_to_response(member: Member) -> MemberResponse:
    """Convert Member ORM object to MemberResponse schema."""
    from app.schemas.gym import MembershipResponse
    memberships = []
    for ms in (member.memberships or []):
        plan_name = ms.plan.name if ms.plan else "Unknown"
        memberships.append(
            MembershipResponse(
                id=ms.id,
                member_id=ms.member_id,
                plan_id=ms.plan_id,
                plan_name=plan_name,
                start_date=ms.start_date,
                end_date=ms.end_date,
                status=ms.status,
                paid_amount=ms.paid_amount,
                payment_method=ms.payment_method,
                payment_reference=ms.payment_reference,
                notes=ms.notes,
                created_at=ms.created_at,
            )
        )
    return MemberResponse(
        id=member.id,
        member_code=member.member_code,
        first_name=member.first_name,
        last_name=member.last_name,
        full_name=member.full_name,
        email=member.email,
        phone=member.phone,
        date_of_birth=member.date_of_birth,
        gender=member.gender,
        address=member.address,
        emergency_contact_name=member.emergency_contact_name,
        emergency_contact_phone=member.emergency_contact_phone,
        status=member.status,
        is_active=member.is_active,
        notes=member.notes,
        joined_at=member.joined_at,
        created_at=member.created_at,
        updated_at=member.updated_at,
        admin_viewed_at=member.admin_viewed_at,
        memberships=memberships,
    )


# ─────────────────────────────────────────────────────────────────────────────
# ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────

@router.get("", response_model=List[MemberResponse])
async def list_members(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.STAFF, UserRole.TRAINER])),
    search: Optional[str] = Query(None, max_length=120, description="Search by name, email, phone, or member code"),
    status_filter: Optional[MemberStatus] = Query(None, alias="status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    """List all gym members with optional search and status filter. Admin, Staff, and Trainers."""
    stmt = (
        select(Member)
        .options(selectinload(Member.memberships).selectinload(MemberMembership.plan))
    )

    if search:
        search_term = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                Member.first_name.ilike(search_term),
                Member.last_name.ilike(search_term),
                Member.email.ilike(search_term),
                Member.phone.ilike(search_term),
                Member.member_code.ilike(search_term),
            )
        )

    if status_filter:
        stmt = stmt.where(Member.status == status_filter)

    stmt = stmt.order_by(Member.joined_at.desc()).offset(skip).limit(limit)
    result = await db.execute(stmt)
    members = result.scalars().all()
    return [_member_to_response(m) for m in members]


@router.get("/stats", tags=["Members"])
async def get_member_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.STAFF, UserRole.TRAINER])),
):
    """Return aggregate member and business KPI statistics for the management dashboard."""
    return await compute_overview_kpis(
        db,
        include_financials=(current_user.role == UserRole.ADMIN),
    )


@router.get("/{member_id}", response_model=MemberResponse)
async def get_member(
    member_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.STAFF, UserRole.TRAINER])),
):
    """Get a single member by ID. Admin, Staff, and Trainers."""
    stmt = (
        select(Member)
        .where(Member.id == member_id)
        .options(selectinload(Member.memberships).selectinload(MemberMembership.plan))
    )
    result = await db.execute(stmt)
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found.")

    if current_user.role == UserRole.ADMIN and member.admin_viewed_at is None:
        member.admin_viewed_at = datetime.now(timezone.utc)
        await db.commit()

    return _member_to_response(member)


@router.post("", response_model=MemberResponse, status_code=status.HTTP_201_CREATED)
async def create_member(
    member_in: MemberCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.STAFF])),
):
    """Register a new gym member. Admin and Staff only."""
    first_name = member_in.first_name.strip()
    last_name = member_in.last_name.strip()
    if not first_name or not last_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="First name and last name cannot be blank.",
        )

    email_val = await _normalize_and_check_member_email(db, member_in.email)

    # Generate unique member code without collisions
    member_code = await generate_member_code(db)

    new_member = Member(
        member_code=member_code,
        first_name=first_name,
        last_name=last_name,
        email=email_val,
        phone=member_in.phone.strip() if member_in.phone and member_in.phone.strip() else None,
        date_of_birth=member_in.date_of_birth,
        gender=member_in.gender,
        address=member_in.address,
        emergency_contact_name=member_in.emergency_contact_name,
        emergency_contact_phone=member_in.emergency_contact_phone,
        notes=member_in.notes,
        status=MemberStatus.ACTIVE,
    )
    db.add(new_member)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Could not create member due to a duplicate email or member code. Please retry.",
        )

    await record_audit_log(
        db,
        action="MEMBER_CREATED",
        outcome="SUCCESS",
        actor=current_user,
        target_type="member",
        target_id=new_member.id,
        request=request,
        details=f"Registered member {new_member.member_code} ({new_member.full_name}).",
    )
    await db.commit()

    # Re-fetch with relationships loaded
    stmt = (
        select(Member)
        .where(Member.id == new_member.id)
        .options(selectinload(Member.memberships).selectinload(MemberMembership.plan))
    )
    result = await db.execute(stmt)
    loaded_member = result.scalar_one()
    return _member_to_response(loaded_member)


@router.patch("/{member_id}", response_model=MemberResponse)
async def update_member(
    member_id: int,
    member_update: MemberUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.STAFF])),
):
    """Update member details. Admin and Staff only."""
    result = await db.execute(select(Member).where(Member.id == member_id))
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found.")

    update_data = member_update.model_dump(exclude_unset=True)
    if "first_name" in update_data and update_data["first_name"] is not None:
        first_name = update_data["first_name"].strip()
        if not first_name:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="First name cannot be blank.")
        update_data["first_name"] = first_name
    if "last_name" in update_data and update_data["last_name"] is not None:
        last_name = update_data["last_name"].strip()
        if not last_name:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Last name cannot be blank.")
        update_data["last_name"] = last_name
    if "phone" in update_data and update_data["phone"] is not None:
        update_data["phone"] = update_data["phone"].strip() or None
    if "email" in update_data:
        update_data["email"] = await _normalize_and_check_member_email(
            db,
            update_data["email"],
            exclude_member_id=member_id,
        )

    for field, value in update_data.items():
        setattr(member, field, value)

    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A member with this email already exists.",
        )

    await record_audit_log(
        db,
        action="MEMBER_UPDATED",
        outcome="SUCCESS",
        actor=current_user,
        target_type="member",
        target_id=member.id,
        request=request,
    )
    await db.commit()

    stmt = (
        select(Member)
        .where(Member.id == member_id)
        .options(selectinload(Member.memberships).selectinload(MemberMembership.plan))
    )
    result2 = await db.execute(stmt)
    loaded_member = result2.scalar_one()
    return _member_to_response(loaded_member)


@router.delete(
    "/{member_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(rate_limit_sensitive)],
)
async def deactivate_member(
    member_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN])),
):
    """Soft-delete (deactivate) a member. Admin only."""
    result = await db.execute(select(Member).where(Member.id == member_id))
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found.")

    member.is_active = False
    member.status = MemberStatus.INACTIVE

    # Find linked User account case-insensitively to revoke active sessions after commit (Check 25)
    linked_user_id = await _find_linked_user_id(db, member.email)

    await record_audit_log(
        db,
        action="MEMBER_DEACTIVATED",
        outcome="SUCCESS",
        actor=current_user,
        target_type="member",
        target_id=member.id,
        request=request,
        details=f"Deactivated member {member.member_code} ({member.full_name}).",
    )
    await db.commit()
    if linked_user_id is not None:
        revoke_user_sessions(linked_user_id)


@router.delete(
    "/{member_id}/permanent",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(rate_limit_sensitive)],
)
async def delete_member_permanent(
    member_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN])),
):
    """Hard-delete (permanently delete) a member. Admin only."""
    result = await db.execute(select(Member).where(Member.id == member_id))
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found.")

    member_code = member.member_code
    member_name = member.full_name
    linked_user_id = await _find_linked_user_id(db, member.email)

    # Detach immutable tap telemetry FKs cleanly so strict FK enforcement never fails
    member_card_ids = select(MemberKeycard.id).where(MemberKeycard.member_id == member_id)
    member_visit_ids = select(Visit.id).where(Visit.member_id == member_id)
    await db.execute(
        update(KeycardTapLog)
        .where(
            or_(
                KeycardTapLog.member_id == member_id,
                KeycardTapLog.keycard_id.in_(member_card_ids),
                KeycardTapLog.visit_id.in_(member_visit_ids),
            )
        )
        .values(member_id=None, keycard_id=None, visit_id=None)
    )
    await db.execute(
        update(Visit)
        .where(Visit.keycard_id.in_(member_card_ids))
        .values(keycard_id=None)
    )
    await db.execute(delete(MemberKeycard).where(MemberKeycard.member_id == member_id))

    # Delete referencing child records across dependent tables to ensure clean CASCADE deletion
    await db.execute(delete(Notification).where(Notification.member_id == member_id))
    await db.execute(delete(RetentionStrategy).where(RetentionStrategy.member_id == member_id))
    await db.execute(delete(Prediction).where(Prediction.customer_id == member_id))
    await db.execute(delete(ProcessedCustomer).where(ProcessedCustomer.customer_id == member_id))
    await db.execute(delete(RawTransaction).where(RawTransaction.customer_id == member_id))
    await db.execute(delete(PTSession).where(PTSession.member_id == member_id))
    await db.execute(delete(ClassEnrollment).where(ClassEnrollment.member_id == member_id))
    await db.execute(delete(Visit).where(Visit.member_id == member_id))
    await db.execute(delete(MemberMembership).where(MemberMembership.member_id == member_id))
    await db.execute(delete(Member).where(Member.id == member_id))

    await record_audit_log(
        db,
        action="MEMBER_DELETED_PERMANENT",
        outcome="SUCCESS",
        actor=current_user,
        target_type="member",
        target_id=member_id,
        request=request,
        details=f"Permanently deleted member {member_code} ({member_name}).",
    )
    await db.commit()
    if linked_user_id is not None:
        revoke_user_sessions(linked_user_id)


@router.post(
    "/{member_id}/reactivate",
    response_model=MemberResponse,
    dependencies=[Depends(rate_limit_sensitive)],
)
async def reactivate_member(
    member_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN])),
):
    """Reactivate a deactivated member. Admin only."""
    result = await db.execute(select(Member).where(Member.id == member_id))
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found.")

    member.is_active = True
    member.status = MemberStatus.ACTIVE

    await record_audit_log(
        db,
        action="MEMBER_REACTIVATED",
        outcome="SUCCESS",
        actor=current_user,
        target_type="member",
        target_id=member.id,
        request=request,
        details=f"Reactivated member {member.member_code} ({member.full_name}).",
    )
    await db.commit()

    stmt = (
        select(Member)
        .where(Member.id == member_id)
        .options(selectinload(Member.memberships).selectinload(MemberMembership.plan))
    )
    result2 = await db.execute(stmt)
    loaded_member = result2.scalar_one()
    return _member_to_response(loaded_member)


