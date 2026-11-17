from datetime import datetime, timezone
from typing import List, Optional, Union
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select, desc
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_current_user, require_roles
from app.database import get_db
from app.models.user import User, UserRole
from app.models.member import Member, MemberStatus
from app.models.member_membership import MemberMembership, MembershipStatus
from app.models.visit import Visit
from app.schemas.training_and_visits import VisitCreate, VisitCheckOut, VisitResponse
from app.services.audit import record_audit_log
from app.services.pagination import (
    PaginatedPage,
    make_cache_key,
    read_page_cache,
    slice_limit_plus_one,
)
from app.services.visit_sweeper import notify_admins_on_checkin, sweep_overdue_open_visits, to_ph_time

router = APIRouter(prefix="/api/visits", tags=["Visits"])


def _ensure_utc(dt: datetime) -> datetime:
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)


def _require_active_membership(member: Member, now: datetime) -> MemberMembership:
    if not member.is_active or member.status == MemberStatus.INACTIVE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Member profile ({member.member_code}) is inactive.",
        )
    if member.status == MemberStatus.SUSPENDED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Member profile ({member.member_code}) is suspended.",
        )

    valid_active: List[MemberMembership] = []
    has_pending = False
    has_expired = False

    for ms in member.memberships:
        start_dt = _ensure_utc(ms.start_date)
        end_ph = to_ph_time(ms.end_date).replace(hour=23, minute=59, second=59, microsecond=999999)
        effective_end_utc = end_ph.astimezone(timezone.utc)

        if ms.status == MembershipStatus.ACTIVE:
            if effective_end_utc < now:
                has_expired = True
            elif start_dt <= now <= effective_end_utc:
                valid_active.append(ms)
        elif ms.status == MembershipStatus.PENDING:
            has_pending = True
        elif ms.status == MembershipStatus.EXPIRED:
            has_expired = True

    if not valid_active:
        if has_pending:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Membership payment is pending front-desk confirmation.",
            )
        if has_expired:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Member's subscription has expired. Please renew before checking in.",
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Member has no active membership plan.",
        )

    return max(valid_active, key=lambda m: _ensure_utc(m.end_date))


def _format_visit(v: Visit, member_override: Optional[Member] = None) -> dict:
    """Serialize a Visit ORM object to a dict matching VisitResponse."""
    mem = member_override if member_override is not None else v.member
    member_name = None
    member_code = None
    if mem:
        member_name = mem.full_name
        member_code = mem.member_code

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
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.STAFF, UserRole.TRAINER])),
):
    """Record a gym check-in for a member."""
    await sweep_overdue_open_visits(db)

    # Verify member exists
    stmt_member = (
        select(Member)
        .where(Member.id == payload.member_id)
        .options(selectinload(Member.memberships))
    )
    member = (await db.execute(stmt_member)).scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found.")

    now = datetime.now(timezone.utc)
    active_ms = _require_active_membership(member, now)

    member_label = f"{member.full_name} ({member.member_code})"
    open_visit_id = (
        await db.execute(
            select(Visit.id)
            .where(Visit.member_id == payload.member_id, Visit.checked_out_at.is_(None))
            .limit(1)
        )
    ).scalar_one_or_none()
    if open_visit_id is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"{member_label} is already checked in.",
        )

    visit = Visit(
        member_id=payload.member_id,
        visit_type=payload.visit_type,
        notes=payload.notes,
        recorded_by_user_id=current_user.id,
    )
    db.add(visit)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"{member_label} is already checked in.",
        )
    await notify_admins_on_checkin(
        db,
        member=member,
        plan_name=active_ms.plan.name if active_ms.plan else None,
        method_label="Manual Check-In",
        checkin_utc=visit.checked_in_at or now,
    )
    await record_audit_log(
        db,
        action="visit.checked_in",
        outcome="SUCCESS",
        actor=current_user,
        target_type="visit",
        target_id=visit.id,
        request=request,
        details=f"Manual check-in for {member_label}.",
    )
    await db.commit()
    read_page_cache.invalidate_prefix("visits:")
    await db.refresh(visit, attribute_names=["id", "checked_in_at", "checked_out_at", "created_at"])

    return _format_visit(visit, member_override=member)


@router.patch("/{visit_id}/checkout", response_model=VisitResponse)
async def check_out_member(
    visit_id: int,
    payload: VisitCheckOut,
    request: Request,
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
    await record_audit_log(
        db,
        action="visit.checked_out",
        outcome="SUCCESS",
        actor=current_user,
        target_type="visit",
        target_id=visit.id,
        request=request,
        details=f"Checked out visit #{visit.id} (member_id={visit.member_id}).",
    )
    await db.commit()
    read_page_cache.invalidate_prefix("visits:")
    await db.refresh(visit, attribute_names=["checked_out_at"])

    return _format_visit(visit)


@router.get("", response_model=Union[PaginatedPage[VisitResponse], List[VisitResponse]])
async def list_visits(
    member_id: Optional[int] = Query(None),
    date_from: Optional[str] = Query(None, description="ISO date string e.g. 2024-01-01"),
    date_to: Optional[str] = Query(None, description="ISO date string e.g. 2024-12-31"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    paginated: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.STAFF, UserRole.TRAINER])),
):
    """List gym visits with deterministic `(checked_in_at, id)` sorting and `limit + 1` pagination."""
    await sweep_overdue_open_visits(db)

    cache_key = make_cache_key(
        "visits",
        member_id=member_id,
        date_from=date_from,
        date_to=date_to,
        skip=skip,
        limit=limit,
        paginated=paginated,
    )
    cached = read_page_cache.get(cache_key)
    if cached is not None:
        return cached

    stmt = (
        select(Visit)
        .options(selectinload(Visit.member))
        .order_by(desc(Visit.checked_in_at), desc(Visit.id))
        .offset(skip)
        .limit(limit + 1)
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
    page = slice_limit_plus_one(
        [_format_visit(v) for v in visits],
        skip=skip,
        limit=limit,
    )
    response_payload: Union[PaginatedPage[VisitResponse], List[VisitResponse]] = (
        PaginatedPage[VisitResponse](
            items=page.items,
            skip=skip,
            limit=limit,
            has_next=page.has_next,
            next_skip=page.next_skip,
        )
        if paginated
        else page.items
    )
    return read_page_cache.set(cache_key, response_payload)


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
