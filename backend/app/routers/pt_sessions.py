from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, desc, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_current_user, require_roles
from app.database import get_db
from app.models.user import User, UserRole
from app.models.member import Member, MemberStatus
from app.models.pt_session import PTSession, PTSessionStatus
from app.schemas.phase5 import (
    PTSessionCreate,
    PTSessionBookCreate,
    PTSessionApprove,
    PTSessionReject,
    PTSessionUpdate,
    PTSessionResponse,
    TrainerPublicResponse,
)

router = APIRouter(prefix="/api/pt-sessions", tags=["PT Sessions"])


# ──────────────────────────────────────────────────────────────────────────────
# Helper Functions
# ──────────────────────────────────────────────────────────────────────────────

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


async def _get_or_create_member_for_user(user: User, db: AsyncSession) -> Member:
    """Finds or creates a Member record linked to the authenticated user."""
    # Try finding by email
    stmt = select(Member).where(Member.email == user.email)
    result = await db.execute(stmt)
    member = result.scalar_one_or_none()
    if member:
        return member

    # Generate sequential member code
    count_stmt = select(func.count()).select_from(Member)
    count_res = await db.execute(count_stmt)
    count = count_res.scalar() or 0
    member_code = f"DGM-{(count + 1):04d}"

    parts = user.full_name.strip().split(" ", 1)
    first_name = parts[0]
    last_name = parts[1] if len(parts) > 1 else "Member"

    member = Member(
        member_code=member_code,
        first_name=first_name,
        last_name=last_name,
        email=user.email,
        phone=user.phone,
        status=MemberStatus.ACTIVE,
        notes=f"Auto-registered via portal account #{user.id}",
    )
    db.add(member)
    await db.commit()
    await db.refresh(member)
    return member


# ──────────────────────────────────────────────────────────────────────────────
# Public / Member Accessible Endpoints
# ──────────────────────────────────────────────────────────────────────────────

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
        .where(User.role.in_([UserRole.TRAINER, UserRole.ADMIN]))
        .where(User.is_active == True)
        .order_by(User.full_name)
    )
    result = await db.execute(stmt)
    trainers = result.scalars().all()

    # Pre-defined profiles for Rosario Batangas coaches
    trainer_profiles = {
        "Head Coach Mark": {
            "specialties": ["Powerlifting", "Barbell Mechanics", "Meet Preparation", "Strength Coaching"],
            "bio": "Competitive powerlifter and head coach at The DGym Rosario. Specializes in squat/bench/deadlift form optimization and peaking programs.",
        },
        "DGym Admin": {
            "specialties": ["Functional Fitness", "Athletic Conditioning", "Nutrition Guidance"],
            "bio": "Founding director & senior fitness instructor. Focused on lifestyle transformation and long-term athletic durability.",
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

    # Get or create member record for the logged-in user
    member = await _get_or_create_member_for_user(current_user, db)

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
    stmt = select(Member).where(Member.email == current_user.email)
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
        stmt = select(Member).where(Member.email == current_user.email)
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


# ──────────────────────────────────────────────────────────────────────────────
# Coach & Staff Approval / Management Endpoints
# ──────────────────────────────────────────────────────────────────────────────

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

    session.status = PTSessionStatus.REJECTED
    session.rejection_reason = payload.reason or "Trainer is unavailable at the requested time slot."

    await db.commit()
    loaded = await _load_pt_session(session_id, db)
    return _format_pt_session(loaded)


# ──────────────────────────────────────────────────────────────────────────────
# General Staff PT Session Management
# ──────────────────────────────────────────────────────────────────────────────

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
    """List PT sessions with optional filters."""
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

    if trainer_id is not None:
        stmt = stmt.where(PTSession.trainer_id == trainer_id)
    if member_id is not None:
        stmt = stmt.where(PTSession.member_id == member_id)
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
    """Get a single PT session."""
    session = await _load_pt_session(session_id, db)
    if not session:
        raise HTTPException(status_code=404, detail="PT session not found.")
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
