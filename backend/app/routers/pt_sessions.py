from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, desc, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_current_user, require_roles
from app.database import get_db
from app.models.user import User, UserRole
from app.models.member import Member, MemberStatus
from app.models.member_membership import MemberMembership, MembershipStatus
from app.models.pt_session import PTSession, PTSessionStatus
from app.services.membership_activation import expire_elapsed_memberships
from app.schemas.training_and_visits import (
    PTSessionCreate,
    PTSessionBookCreate,
    PTSessionApprove,
    PTSessionReject,
    PTSessionUpdate,
    PTSessionResponse,
    TrainerPublicResponse,
)

router = APIRouter(prefix="/api/pt-sessions", tags=["PT Sessions"])


# Helper Functions

def _format_pt_session(s: PTSession) -> dict:
    trainer_name = None
    if s.trainer:
        trainer_name = s.trainer.full_name

    member_name = None
    member_code = None
    if s.member:
        member_name = s.member.full_name
        member_code = s.member.member_code

    return {
        "id": s.id,
        "trainer_id": s.trainer_id,
        "trainer_name": trainer_name,
        "member_id": s.member_id,
        "member_code": member_code,
        "member_name": member_name,
        "scheduled_at": s.scheduled_at,
        "duration_minutes": s.duration_minutes,
        "status": s.status,
        "notes": s.notes,
        "coach_notes": s.coach_notes,
        "rejection_reason": s.rejection_reason,
        "created_at": s.created_at,
        "updated_at": s.updated_at,
    }


async def _load_pt_session(session_id: int, db: AsyncSession) -> Optional[PTSession]:
    stmt = (
        select(PTSession)
        .where(PTSession.id == session_id)
        .options(
            selectinload(PTSession.trainer),
            selectinload(PTSession.member),
        )
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def _require_active_member_for_pt(user: User, db: AsyncSession) -> Member:
    """Require an active 'member' account with a valid non-expired membership to book PT."""
    if await expire_elapsed_memberships(db):
        await db.commit()
        await db.refresh(user)

    if user.role != UserRole.MEMBER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="An active gym membership is required to book a personal trainer.",
        )

    normalized_email = (user.email or "").lower().strip()
    stmt = (
        select(Member)
        .where(func.lower(Member.email) == normalized_email)
        .options(selectinload(Member.memberships))
    )
    member = (await db.execute(stmt)).scalar_one_or_none()
    if not member or not member.is_active or member.status == MemberStatus.SUSPENDED:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your member account is currently suspended or deactivated. Please contact the gym desk.",
        )

    now = datetime.now(timezone.utc)
    has_active_plan = any(
        ms.status == MembershipStatus.ACTIVE
        and ms.end_date is not None
        and (ms.end_date.replace(tzinfo=timezone.utc) if ms.end_date.tzinfo is None else ms.end_date.astimezone(timezone.utc)) > now
        for ms in (member.memberships or [])
    )
    if not has_active_plan:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="An active gym membership is required to book a personal trainer.",
        )
    return member


# Public / Member Accessible Endpoints

@router.get("/trainers", response_model=List[TrainerPublicResponse])
async def list_available_trainers(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns the list of available fitness instructors and coaches
    with their bios and specialties for member booking.
    """
    stmt = (
        select(User)
        .where(User.role == UserRole.TRAINER)
        .where(User.is_active == True)
        .order_by(User.full_name)
    )
    result = await db.execute(stmt)
    trainers = result.scalars().all()

    if not trainers:
        fallback_stmt = (
            select(User)
            .where(User.role == UserRole.ADMIN, User.is_active == True)
            .order_by(User.full_name)
        )
        trainers = (await db.execute(fallback_stmt)).scalars().all()

    # Verified profiles for official The DGym Rosario, Batangas coaches (TDGGYM-QUESTIONNAIRES-1)
    trainer_profiles = {
        "Coach Ivan": {
            "specialties": ["Muscle Gain", "Hypertrophy Programming", "Strength Progression"],
            "bio": "Certified Personal Trainer at The DGym Rosario, Batangas specializing in structured muscle gain, progressive overload, and strength mechanics.",
        },
        "Coach Marta": {
            "specialties": ["Muscle Gain", "TABATA (6:00 PM)", "Body Recomposition"],
            "bio": "Certified Personal Trainer for 1-on-1 muscle gain programs and lead instructor for the free 6:00 PM TABATA group sessions.",
        },
        "Coach Kresler": {
            "specialties": ["Boxing (1.5 HR)", "Cardio Boxing", "HIIT (6:00 PM)"],
            "bio": "Certified Boxing & Conditioning Coach leading 1.5-hour Boxing and Cardio Boxing PT packages plus the free 6:00 PM HIIT group classes.",
        },
    }

    out = []
    for t in trainers:
        profile = trainer_profiles.get(t.full_name, {
            "specialties": ["General Fitness", "Strength Training", "Body Recomposition"],
            "bio": "Certified fitness instructor at The DGym Rosario Batangas.",
        })
        out.append({
            "id": t.id,
            "full_name": t.full_name,
            "email": t.email,
            "phone": t.phone,
            "specialties": profile["specialties"],
            "bio": profile["bio"],
        })
    return out


@router.post("/book", response_model=PTSessionResponse, status_code=status.HTTP_201_CREATED)
async def book_pt_session(
    payload: PTSessionBookCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Member books a session with a fitness instructor.
    Status starts at 'pending' until approved by coach or admin.
    """
    # Verify instructor exists and is active
    trainer = await db.get(User, payload.trainer_id)
    if not trainer or not trainer.is_active or trainer.role not in [UserRole.TRAINER, UserRole.ADMIN]:
        raise HTTPException(status_code=404, detail="Fitness instructor not found or unavailable.")

    sched_utc = (
        payload.scheduled_at.astimezone(timezone.utc)
        if payload.scheduled_at.tzinfo is not None
        else payload.scheduled_at.replace(tzinfo=timezone.utc)
    )
    if sched_utc < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot book a personal training session in the past.",
        )

    # Require an active paid membership before allowing coach booking
    member = await _require_active_member_for_pt(current_user, db)

    pt = PTSession(
        trainer_id=payload.trainer_id,
        member_id=member.id,
        scheduled_at=payload.scheduled_at,
        duration_minutes=payload.duration_minutes,
        status=PTSessionStatus.PENDING,
        notes=payload.notes,
    )
    db.add(pt)
    await db.commit()
    await db.refresh(pt)

    loaded = await _load_pt_session(pt.id, db)
    return _format_pt_session(loaded)


@router.get("/my-bookings", response_model=List[PTSessionResponse])
async def list_my_bookings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns the list of PT bookings submitted by the current member."""
    # Find member for current user
    stmt = select(Member).where(func.lower(Member.email) == current_user.email.lower().strip())
    result = await db.execute(stmt)
    member = result.scalar_one_or_none()
    if not member:
        return []

    sessions_stmt = (
        select(PTSession)
        .where(PTSession.member_id == member.id)
        .options(
            selectinload(PTSession.trainer),
            selectinload(PTSession.member),
        )
        .order_by(desc(PTSession.scheduled_at))
    )
    sessions_result = await db.execute(sessions_stmt)
    sessions = sessions_result.scalars().all()
    return [_format_pt_session(s) for s in sessions]


@router.patch("/{session_id}/cancel", response_model=PTSessionResponse)
async def cancel_my_booking(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Allows a member (or staff/trainer) to cancel a session."""
    session = await _load_pt_session(session_id, db)
    if not session:
        raise HTTPException(status_code=404, detail="PT session not found.")

    # Verify ownership or staff privilege
    if current_user.role == UserRole.MEMBER:
        stmt = select(Member).where(func.lower(Member.email) == current_user.email.lower().strip())
        res = await db.execute(stmt)
        member = res.scalar_one_or_none()
        if not member or session.member_id != member.id:
            raise HTTPException(status_code=403, detail="You can only cancel your own bookings.")

    if session.status in [PTSessionStatus.COMPLETED, PTSessionStatus.CANCELLED]:
        raise HTTPException(status_code=400, detail=f"Cannot cancel a {session.status.value} session.")

    session.status = PTSessionStatus.CANCELLED
    await db.commit()
    loaded = await _load_pt_session(session_id, db)
    return _format_pt_session(loaded)


# Coach & Staff Approval / Management Endpoints

@router.patch("/{session_id}/approve", response_model=PTSessionResponse)
async def approve_pt_booking(
    session_id: int,
    payload: PTSessionApprove,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.STAFF, UserRole.TRAINER])),
):
    """
    Coach or Admin approves a pending PT booking request.
    Status moves from 'pending' to 'confirmed'.
    """
    session = await _load_pt_session(session_id, db)
    if not session:
        raise HTTPException(status_code=404, detail="PT booking request not found.")

    if current_user.role == UserRole.TRAINER and session.trainer_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only approve bookings assigned to you.")

    if session.status != PTSessionStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Only pending PT bookings can be approved (current status: {session.status.value}).",
        )
    session.status = PTSessionStatus.CONFIRMED
    if payload.coach_notes:
        session.coach_notes = payload.coach_notes
    session.rejection_reason = None

    await db.commit()
    loaded = await _load_pt_session(session_id, db)

    return _format_pt_session(loaded)


@router.patch("/{session_id}/reject", response_model=PTSessionResponse)
async def reject_pt_booking(
    session_id: int,
    payload: PTSessionReject,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.STAFF, UserRole.TRAINER])),
):
    """
    Coach or Admin rejects a PT booking request with an optional reason.
    """
    session = await _load_pt_session(session_id, db)
    if not session:
        raise HTTPException(status_code=404, detail="PT booking request not found.")

    if current_user.role == UserRole.TRAINER and session.trainer_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only reject bookings assigned to you.")

    if session.status != PTSessionStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Only pending PT bookings can be rejected (current status: {session.status.value}).",
        )
    session.status = PTSessionStatus.REJECTED
    session.rejection_reason = payload.reason or "Trainer is unavailable at the requested time slot."

    await db.commit()
    loaded = await _load_pt_session(session_id, db)

    return _format_pt_session(loaded)


# General Staff PT Session Management

@router.post("", response_model=PTSessionResponse, status_code=status.HTTP_201_CREATED)
async def create_pt_session(
    payload: PTSessionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.STAFF, UserRole.TRAINER])),
):
    """Directly schedule a new personal training session (staff bypass)."""
    member = await db.get(Member, payload.member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found.")

    pt = PTSession(**payload.model_dump())
    db.add(pt)
    await db.commit()
    await db.refresh(pt)

    loaded = await _load_pt_session(pt.id, db)
    return _format_pt_session(loaded)


@router.get("", response_model=List[PTSessionResponse])
async def list_pt_sessions(
    trainer_id: Optional[int] = Query(None),
    member_id: Optional[int] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List PT sessions with optional filters (scoped to own bookings for MEMBER role)."""
    stmt = (
        select(PTSession)
        .options(
            selectinload(PTSession.trainer),
            selectinload(PTSession.member),
        )
        .order_by(desc(PTSession.scheduled_at))
        .offset(skip)
        .limit(limit)
    )

    # Check 06 / Check 33: Prevent horizontal privilege escalation by scoping MEMBER queries
    if current_user.role == UserRole.MEMBER:
        mem_res = await db.execute(
            select(Member).where(Member.email == current_user.email.lower().strip())
        )
        own_member = mem_res.scalar_one_or_none()
        if not own_member:
            return []
        stmt = stmt.where(PTSession.member_id == own_member.id)
    elif member_id is not None:
        stmt = stmt.where(PTSession.member_id == member_id)

    if trainer_id is not None:
        stmt = stmt.where(PTSession.trainer_id == trainer_id)
    if status_filter:
        stmt = stmt.where(PTSession.status == status_filter)

    result = await db.execute(stmt)
    sessions = result.scalars().all()
    return [_format_pt_session(s) for s in sessions]


@router.get("/{session_id}", response_model=PTSessionResponse)
async def get_pt_session(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a single PT session (verified for ownership when called by MEMBER)."""
    session = await _load_pt_session(session_id, db)
    if not session:
        raise HTTPException(status_code=404, detail="PT session not found.")

    if current_user.role == UserRole.MEMBER:
        if (
            not session.member
            or not session.member.email
            or session.member.email.lower().strip() != current_user.email.lower().strip()
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only view your own PT sessions.",
            )

    return _format_pt_session(session)


@router.patch("/{session_id}", response_model=PTSessionResponse)
async def update_pt_session(
    session_id: int,
    payload: PTSessionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.STAFF, UserRole.TRAINER])),
):
    """Update a PT session (reschedule, complete, cancel, add notes)."""
    session = await _load_pt_session(session_id, db)
    if not session:
        raise HTTPException(status_code=404, detail="PT session not found.")

    if current_user.role == UserRole.TRAINER and session.trainer_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only update your own PT sessions.")

    update_data = payload.model_dump(exclude_unset=True)
    for key, val in update_data.items():
        setattr(session, key, val)

    await db.commit()
    loaded = await _load_pt_session(session_id, db)
    return _format_pt_session(loaded)


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_pt_session(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.STAFF])),
):
    """Delete a PT session — admin/staff only."""
    session = await db.get(PTSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="PT session not found.")
    await db.delete(session)
    await db.commit()
