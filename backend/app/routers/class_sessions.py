from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import Text, desc, func, insert, literal, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_current_user, require_roles
from app.database import get_db
from app.models.user import User, UserRole
from app.models.member import Member, MemberStatus
from app.models.member_membership import MemberMembership, MembershipStatus
from app.models.class_session import ClassSession, ClassEnrollment, ClassStatus
from app.schemas.training_and_visits import (
    ClassSessionCreate, ClassSessionUpdate, ClassSessionResponse,
    EnrollMemberCreate, EnrollmentResponse,
)
from app.services.membership_activation import expire_elapsed_memberships
from app.services.visit_sweeper import to_ph_time

router = APIRouter(prefix="/api/classes", tags=["Classes"])


class SelfEnrollCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    notes: Optional[str] = Field(None, max_length=500)


def _ensure_utc(dt: datetime) -> datetime:
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)


def _format_session(
    s: ClassSession,
    include_enrollments: bool = True,
    viewer_member_id: Optional[int] = None,
) -> dict:
    coach_name = s.coach.full_name if s.coach else None

    enrollments = []
    if include_enrollments or viewer_member_id is not None:
        for e in s.enrollments:
            if not include_enrollments and e.member_id != viewer_member_id:
                continue
            member_name = e.member.full_name if e.member else None
            member_code = e.member.member_code if e.member else None
            enrollments.append({
                "id": e.id,
                "member_id": e.member_id,
                "member_code": member_code,
                "member_name": member_name,
                "enrolled_at": e.enrolled_at,
            })

    return {
        "id": s.id,
        "name": s.name,
        "description": s.description,
        "coach_id": s.coach_id,
        "coach_name": coach_name,
        "class_type": s.class_type,
        "scheduled_at": s.scheduled_at,
        "duration_minutes": s.duration_minutes,
        "max_capacity": s.max_capacity,
        "enrolled_count": s.enrolled_count,
        "status": s.status,
        "location": s.location,
        "notes": s.notes,
        "created_at": s.created_at,
        "enrollments": enrollments,
    }


async def _load_session(session_id: int, db: AsyncSession) -> Optional[ClassSession]:
    stmt = (
        select(ClassSession)
        .where(ClassSession.id == session_id)
        .options(
            selectinload(ClassSession.coach),
            selectinload(ClassSession.enrollments).selectinload(ClassEnrollment.member),
        )
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def _resolve_member_for_user(
    user: User,
    db: AsyncSession,
    load_memberships: bool = False,
) -> Optional[Member]:
    normalized_email = (user.email or "").lower().strip()
    if not normalized_email:
        return None
    stmt = select(Member).where(func.lower(Member.email) == normalized_email)
    if load_memberships:
        stmt = stmt.options(selectinload(Member.memberships).selectinload(MemberMembership.plan))
    return (await db.execute(stmt)).scalar_one_or_none()


async def _require_active_member_for_class(user: User, db: AsyncSession) -> Member:
    if await expire_elapsed_memberships(db):
        await db.commit()
        await db.refresh(user)

    if user.role != UserRole.MEMBER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="An active gym membership is required to reserve group classes.",
        )

    member = await _resolve_member_for_user(user, db, load_memberships=True)
    if not member or not member.is_active or member.status == MemberStatus.SUSPENDED:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="An active gym membership is required to reserve group classes.",
        )

    now = datetime.now(timezone.utc)
    has_valid_pass = False
    for ms in member.memberships or []:
        if ms.status != MembershipStatus.ACTIVE:
            continue
        is_day_pass = bool(ms.plan and (ms.plan.duration_days or 0) == 1)
        end_cutoff = (
            _ensure_utc(ms.end_date)
            if is_day_pass
            else to_ph_time(ms.end_date)
            .replace(hour=23, minute=59, second=59, microsecond=999999)
            .astimezone(timezone.utc)
        )
        if _ensure_utc(ms.start_date) <= now <= end_cutoff:
            has_valid_pass = True
            break

    if not has_valid_pass:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="An active gym membership is required to reserve group classes.",
        )
    return member


@router.post("", response_model=ClassSessionResponse, status_code=status.HTTP_201_CREATED)
async def create_class_session(
    payload: ClassSessionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.STAFF])),
):
    """Create a new class session."""
    session = ClassSession(**payload.model_dump())
    db.add(session)
    await db.commit()

    loaded = await _load_session(session.id, db)
    return _format_session(loaded)


@router.get("", response_model=List[ClassSessionResponse])
async def list_class_sessions(
    status_filter: Optional[str] = Query(None, alias="status"),
    class_type: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List class sessions with optional filters (redacts other attendees' PII for regular members)."""
    stmt = (
        select(ClassSession)
        .options(
            selectinload(ClassSession.coach),
            selectinload(ClassSession.enrollments).selectinload(ClassEnrollment.member),
        )
        .order_by(desc(ClassSession.scheduled_at))
        .offset(skip)
        .limit(limit)
    )

    if status_filter:
        try:
            stmt = stmt.where(ClassSession.status == ClassStatus(status_filter))
        except ValueError:
            pass

    if class_type:
        stmt = stmt.where(ClassSession.class_type == class_type)

    result = await db.execute(stmt)
    sessions = result.scalars().all()
    include_roster = current_user.role in (UserRole.ADMIN, UserRole.STAFF, UserRole.TRAINER)
    viewer_member_id: Optional[int] = None
    if not include_roster:
        viewer_member = await _resolve_member_for_user(current_user, db)
        viewer_member_id = viewer_member.id if viewer_member else None
    return [
        _format_session(s, include_enrollments=include_roster, viewer_member_id=viewer_member_id)
        for s in sessions
    ]


@router.get("/{session_id}", response_model=ClassSessionResponse)
async def get_class_session(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a single class session (redacts other attendees' PII for regular members)."""
    session = await _load_session(session_id, db)
    if not session:
        raise HTTPException(status_code=404, detail="Class session not found.")
    include_roster = current_user.role in (UserRole.ADMIN, UserRole.STAFF, UserRole.TRAINER)
    viewer_member_id: Optional[int] = None
    if not include_roster:
        viewer_member = await _resolve_member_for_user(current_user, db)
        viewer_member_id = viewer_member.id if viewer_member else None
    return _format_session(session, include_enrollments=include_roster, viewer_member_id=viewer_member_id)


@router.patch("/{session_id}", response_model=ClassSessionResponse)
async def update_class_session(
    session_id: int,
    payload: ClassSessionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.STAFF])),
):
    """Update a class session."""
    session = await _load_session(session_id, db)
    if not session:
        raise HTTPException(status_code=404, detail="Class session not found.")

    update_data = payload.model_dump(exclude_unset=True)
    for key, val in update_data.items():
        setattr(session, key, val)

    await db.commit()
    if "coach_id" in update_data:
        session = await _load_session(session_id, db)
    return _format_session(session)


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_class_session(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN])),
):
    """Delete (hard delete) a class session — admin only."""
    session = await db.get(ClassSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Class session not found.")
    await db.delete(session)
    await db.commit()


async def _atomic_enroll_member(
    db: AsyncSession,
    session_id: int,
    member: Member,
    notes: Optional[str],
) -> dict:
    session_row = (
        await db.execute(
            select(ClassSession.id, ClassSession.status, ClassSession.max_capacity)
            .where(ClassSession.id == session_id)
            .with_for_update()
        )
    ).one_or_none()
    if not session_row:
        raise HTTPException(status_code=404, detail="Class session not found.")
    if session_row.status == ClassStatus.CANCELLED:
        raise HTTPException(status_code=400, detail="Cannot enroll in a cancelled class.")
    if session_row.status == ClassStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Cannot enroll in a completed class.")

    # Atomic conditional INSERT prevents concurrent over-capacity or duplicate enrollments
    now = datetime.now(timezone.utc)
    dup_exists = (
        select(ClassEnrollment.id)
        .where(
            ClassEnrollment.class_session_id == session_id,
            ClassEnrollment.member_id == member.id,
        )
        .exists()
    )
    enrolled_count_subq = (
        select(func.count(ClassEnrollment.id))
        .where(ClassEnrollment.class_session_id == session_id)
        .scalar_subquery()
    )
    insert_select = (
        select(
            literal(session_id),
            literal(member.id),
            literal(now),
            literal(notes, type_=Text),
        )
        .select_from(ClassSession)
        .where(
            ClassSession.id == session_id,
            ClassSession.status.not_in([ClassStatus.CANCELLED, ClassStatus.COMPLETED]),
            ~dup_exists,
            enrolled_count_subq < ClassSession.max_capacity,
        )
    )
    stmt_insert = (
        insert(ClassEnrollment)
        .from_select(
            ["class_session_id", "member_id", "enrolled_at", "notes"],
            insert_select,
        )
        .returning(ClassEnrollment.id, ClassEnrollment.enrolled_at)
    )
    inserted = (await db.execute(stmt_insert)).one_or_none()

    if inserted is None:
        latest_session = (
            await db.execute(
                select(ClassSession.status, ClassSession.max_capacity)
                .where(ClassSession.id == session_id)
            )
        ).one_or_none()
        if not latest_session:
            raise HTTPException(status_code=404, detail="Class session not found.")
        if latest_session.status == ClassStatus.CANCELLED:
            raise HTTPException(status_code=400, detail="Cannot enroll in a cancelled class.")
        if latest_session.status == ClassStatus.COMPLETED:
            raise HTTPException(status_code=400, detail="Cannot enroll in a completed class.")

        already_enrolled = (
            await db.execute(
                select(ClassEnrollment.id)
                .where(
                    ClassEnrollment.class_session_id == session_id,
                    ClassEnrollment.member_id == member.id,
                )
                .limit(1)
            )
        ).scalar_one_or_none()
        if already_enrolled is not None:
            raise HTTPException(status_code=409, detail="Member is already enrolled in this class.")

        raise HTTPException(status_code=400, detail="Class is at full capacity.")

    await db.commit()

    return {
        "id": inserted.id,
        "member_id": member.id,
        "member_code": member.member_code,
        "member_name": member.full_name,
        "enrolled_at": inserted.enrolled_at,
    }


@router.post("/{session_id}/enroll/self", response_model=EnrollmentResponse, status_code=status.HTTP_201_CREATED)
async def self_enroll_class(
    session_id: int,
    payload: Optional[SelfEnrollCreate] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Allow an active member to reserve a spot for themselves in a group class."""
    member = await _require_active_member_for_class(current_user, db)
    notes = payload.notes if payload else None
    return await _atomic_enroll_member(db, session_id, member, notes)


@router.post("/{session_id}/enroll", response_model=EnrollmentResponse, status_code=status.HTTP_201_CREATED)
async def enroll_member(
    session_id: int,
    payload: EnrollMemberCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.STAFF, UserRole.TRAINER])),
):
    """Enroll a member into a class session."""
    member = await db.get(Member, payload.member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found.")
    return await _atomic_enroll_member(db, session_id, member, payload.notes)


@router.delete("/{session_id}/enroll/self", status_code=status.HTTP_204_NO_CONTENT)
async def self_unenroll_class(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Allow a member to cancel their own group class reservation."""
    member = await _resolve_member_for_user(current_user, db)
    if not member:
        raise HTTPException(status_code=404, detail="Enrollment not found.")

    stmt = select(ClassEnrollment).where(
        ClassEnrollment.class_session_id == session_id,
        ClassEnrollment.member_id == member.id,
    )
    enrollment = (await db.execute(stmt)).scalar_one_or_none()
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found.")
    await db.delete(enrollment)
    await db.commit()


@router.delete("/{session_id}/enroll/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
async def unenroll_member(
    session_id: int,
    member_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.STAFF, UserRole.TRAINER])),
):
    """Remove a member from a class session."""
    stmt = select(ClassEnrollment).where(
        ClassEnrollment.class_session_id == session_id,
        ClassEnrollment.member_id == member_id,
    )
    result = await db.execute(stmt)
    enrollment = result.scalar_one_or_none()
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found.")
    await db.delete(enrollment)
    await db.commit()
