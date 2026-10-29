from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_current_user, require_roles
from app.database import get_db
from app.models.user import User, UserRole
from app.models.member import Member
from app.models.visit import Visit
from app.schemas.phase5 import VisitCreate, VisitCheckOut, VisitResponse
from app.services.visit_sweeper import notify_admins_on_checkin, sweep_overdue_open_visits

router = APIRouter(prefix="/api/visits", tags=["Visits"])


def _format_visit(v: Visit) -> dict:
    """Serialize a Visit ORM object to a dict matching VisitResponse."""
    member_name = None
    member_code = None
    if v.member:
        member_name = v.member.full_name
        member_code = v.member.member_code

    entry_val = v.entry_method.value if hasattr(v.entry_method, "value") else (v.entry_method or "manual")

    return {
        "id": v.id,
        "member_id": v.member_id,
        "member_code": member_code,
        "member_name": member_name,
        "visit_type": v.visit_type,
        "entry_method": entry_val,
        "checked_in_at": v.checked_in_at,
        "checked_out_at": v.checked_out_at,
        "notes": v.notes,
        "recorded_by_user_id": v.recorded_by_user_id,
        "created_at": v.created_at,
    }


@router.post("", response_model=VisitResponse, status_code=status.HTTP_201_CREATED)
async def check_in_member(
    payload: VisitCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.STAFF, UserRole.TRAINER])),
):
    """Record a gym check-in for a member."""
    # Verify member exists
    member = await db.get(Member, payload.member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found.")

    visit = Visit(
        member_id=payload.member_id,
        visit_type=payload.visit_type,
        notes=payload.notes,
        recorded_by_user_id=current_user.id,
    )
    db.add(visit)
    await db.flush()
    await notify_admins_on_checkin(
        db,
        member=member,
        plan_name=None,
        method_label="Manual Check-In",
        checkin_utc=visit.checked_in_at or datetime.now(timezone.utc),
    )
    await db.commit()
    await db.refresh(visit)

    # Reload with selectinload
    stmt = select(Visit).where(Visit.id == visit.id).options(selectinload(Visit.member))
    result = await db.execute(stmt)
    visit = result.scalar_one()

    return _format_visit(visit)


@router.patch("/{visit_id}/checkout", response_model=VisitResponse)
async def check_out_member(
    visit_id: int,
    payload: VisitCheckOut,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.STAFF, UserRole.TRAINER])),
):
    """Mark a visit as checked out."""
    stmt = select(Visit).where(Visit.id == visit_id).options(selectinload(Visit.member))
    result = await db.execute(stmt)
    visit = result.scalar_one_or_none()
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found.")

    visit.checked_out_at = payload.checked_out_at or datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(visit)

    stmt = select(Visit).where(Visit.id == visit.id).options(selectinload(Visit.member))
    result = await db.execute(stmt)
    visit = result.scalar_one()

    return _format_visit(visit)


@router.get("", response_model=List[VisitResponse])
async def list_visits(
    member_id: Optional[int] = Query(None),
    date_from: Optional[str] = Query(None, description="ISO date string e.g. 2024-01-01"),
    date_to: Optional[str] = Query(None, description="ISO date string e.g. 2024-12-31"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.STAFF, UserRole.TRAINER])),
):
    """List all gym visits with optional filters."""
    await sweep_overdue_open_visits(db)
    stmt = (
        select(Visit)
        .options(selectinload(Visit.member))
        .order_by(desc(Visit.checked_in_at))
        .offset(skip)
        .limit(limit)
    )

    if member_id is not None:
        stmt = stmt.where(Visit.member_id == member_id)

    if date_from:
        try:
            dt_from = datetime.fromisoformat(date_from).replace(tzinfo=timezone.utc)
            stmt = stmt.where(Visit.checked_in_at >= dt_from)
        except ValueError:
            pass

    if date_to:
        try:
            dt_to = datetime.fromisoformat(date_to).replace(tzinfo=timezone.utc)
            stmt = stmt.where(Visit.checked_in_at <= dt_to)
        except ValueError:
            pass

    result = await db.execute(stmt)
    visits = result.scalars().all()
    return [_format_visit(v) for v in visits]


@router.get("/member/{member_id}", response_model=List[VisitResponse])
async def get_member_visits(
    member_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(30, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all visits for a specific member (with BOLA/ownership check for MEMBER role)."""
    member = await db.get(Member, member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found.")

    # Check 06 / Check 33: Members may only view their own visit history
    if current_user.role == UserRole.MEMBER:
        if not member.email or member.email.lower().strip() != current_user.email.lower().strip():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only view your own visit history.",
            )

    stmt = (
        select(Visit)
        .where(Visit.member_id == member_id)
        .options(selectinload(Visit.member))
        .order_by(desc(Visit.checked_in_at))
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(stmt)
    visits = result.scalars().all()
    return [_format_visit(v) for v in visits]
