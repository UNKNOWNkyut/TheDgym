from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_current_user, require_roles
from app.database import get_db
from app.models.user import User, UserRole
from app.models.member import Member
from app.models.class_session import ClassSession, ClassEnrollment, ClassStatus
from app.schemas.phase5 import (
    ClassSessionCreate, ClassSessionUpdate, ClassSessionResponse,
    EnrollMemberCreate, EnrollmentResponse,
)

router = APIRouter(prefix="/api/classes", tags=["Classes"])


def _format_session(s: ClassSession) -> dict:
    coach_name = None
    if s.coach:
        coach_name = s.coach.full_name

    enrollments = []
    for e in s.enrollments:
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


async def _load_session(session_id: int, db: AsyncSession) -> ClassSession:
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
    await db.refresh(session)

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
    """List class sessions with optional filters."""
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
    return [_format_session(s) for s in sessions]


@router.get("/{session_id}", response_model=ClassSessionResponse)
async def get_class_session(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a single class session."""
    session = await _load_session(session_id, db)
    if not session:
        raise HTTPException(status_code=404, detail="Class session not found.")
    return _format_session(session)


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
    loaded = await _load_session(session_id, db)
    return _format_session(loaded)


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


@router.post("/{session_id}/enroll", response_model=EnrollmentResponse, status_code=status.HTTP_201_CREATED)
async def enroll_member(
    session_id: int,
    payload: EnrollMemberCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.STAFF, UserRole.TRAINER])),
):
    """Enroll a member into a class session."""
    session = await _load_session(session_id, db)
    if not session:
        raise HTTPException(status_code=404, detail="Class session not found.")
    if session.status == ClassStatus.CANCELLED:
        raise HTTPException(status_code=400, detail="Cannot enroll in a cancelled class.")
    if session.enrolled_count >= session.max_capacity:
        raise HTTPException(status_code=400, detail="Class is at full capacity.")

    # Check not already enrolled
    existing_stmt = select(ClassEnrollment).where(
        ClassEnrollment.class_session_id == session_id,
        ClassEnrollment.member_id == payload.member_id,
    )
    existing_result = await db.execute(existing_stmt)
    if existing_result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Member is already enrolled in this class.")

    member = await db.get(Member, payload.member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found.")

    enrollment = ClassEnrollment(
        class_session_id=session_id,
        member_id=payload.member_id,
        notes=payload.notes,
    )
    db.add(enrollment)
    await db.commit()
    await db.refresh(enrollment)

    return {
        "id": enrollment.id,
        "member_id": enrollment.member_id,
        "member_code": member.member_code,
        "member_name": member.full_name,
        "enrolled_at": enrollment.enrolled_at,
    }


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
