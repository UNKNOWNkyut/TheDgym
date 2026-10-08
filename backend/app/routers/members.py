"""
Members router — CRUD endpoints for gym member management.
Access: Admin and Staff only (read + create + update), Admin only (delete).
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, require_roles
from app.database import get_db
from app.models.member import Member, MemberStatus
from app.models.member_membership import MemberMembership
from app.models.user import User, UserRole
from app.schemas.gym import MemberCreate, MemberResponse, MemberUpdate
from app.seed_members import generate_member_code

router = APIRouter(prefix="/api/members", tags=["Members"])

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
        memberships=memberships,
    )


# ─────────────────────────────────────────────────────────────────────────────
# ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────

@router.get("", response_model=List[MemberResponse])
async def list_members(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.STAFF, UserRole.TRAINER])),
    search: Optional[str] = Query(None, description="Search by name, email, phone, or member code"),
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
    """Return aggregate member statistics for the admin dashboard."""
    total = await db.execute(select(func.count()).select_from(Member))
    active = await db.execute(select(func.count()).select_from(Member).where(Member.status == MemberStatus.ACTIVE))
    expired = await db.execute(select(func.count()).select_from(Member).where(Member.status == MemberStatus.EXPIRED))
    inactive = await db.execute(select(func.count()).select_from(Member).where(Member.status == MemberStatus.INACTIVE))
    suspended = await db.execute(select(func.count()).select_from(Member).where(Member.status == MemberStatus.SUSPENDED))

    return {
        "total": total.scalar(),
        "active": active.scalar(),
        "expired": expired.scalar(),
        "inactive": inactive.scalar(),
        "suspended": suspended.scalar(),
    }


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
    return _member_to_response(member)


@router.post("", response_model=MemberResponse, status_code=status.HTTP_201_CREATED)
async def create_member(
    member_in: MemberCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.STAFF])),
):
    """Register a new gym member. Admin and Staff only."""
    # Check for duplicate email if provided
    if member_in.email:
        existing = await db.execute(
            select(Member).where(Member.email == member_in.email.lower().strip())
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A member with this email already exists.",
            )

    # Generate unique member code
    member_code = await generate_member_code(db)

    new_member = Member(
        member_code=member_code,
        first_name=member_in.first_name.strip(),
        last_name=member_in.last_name.strip(),
        email=member_in.email.lower().strip() if member_in.email else None,
        phone=member_in.phone.strip() if member_in.phone else None,
        date_of_birth=member_in.date_of_birth,
        gender=member_in.gender,
        address=member_in.address,
        emergency_contact_name=member_in.emergency_contact_name,
        emergency_contact_phone=member_in.emergency_contact_phone,
        notes=member_in.notes,
        status=MemberStatus.ACTIVE,
    )
    db.add(new_member)
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
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.STAFF])),
):
    """Update member details. Admin and Staff only."""
    result = await db.execute(select(Member).where(Member.id == member_id))
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found.")

    update_data = member_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(member, field, value)

    await db.commit()

    stmt = (
        select(Member)
        .where(Member.id == member_id)
        .options(selectinload(Member.memberships).selectinload(MemberMembership.plan))
    )
    result2 = await db.execute(stmt)
    loaded_member = result2.scalar_one()
    return _member_to_response(loaded_member)


@router.delete("/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deactivate_member(
    member_id: int,
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
    await db.commit()
