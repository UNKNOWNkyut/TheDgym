from datetime import datetime, timedelta, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_current_user, require_roles
from app.database import get_db
from app.models.member import Member
from app.models.member_membership import MemberMembership, MembershipStatus
from app.models.member_progress import ClientProgressEntry, MemberTrainingPlan
from app.models.pt_session import PTSession, PTSessionStatus
from app.models.user import User, UserRole
from app.models.visit import Visit
from app.schemas.progress import (
    ClientProgressReportResponse,
    ProgressAttendanceSummary,
    ProgressEntryCreate,
    ProgressEntryResponse,
    TrainingPlanResponse,
    TrainingPlanUpsert,
)
from app.services.audit import record_audit_log

router = APIRouter(prefix="/api/progress", tags=["Client Progress & Plans"])


def _ensure_utc(dt: datetime) -> datetime:
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)


def _assert_member_view_access(current_user: User, member: Member) -> None:
    if current_user.role in (UserRole.ADMIN, UserRole.STAFF, UserRole.TRAINER):
        return
    normalized_member_email = (member.email or "").lower().strip()
    if normalized_member_email and normalized_member_email == current_user.email.lower().strip():
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You do not have permission to view or update this member's training data.",
    )


def _compute_week_streak(visit_dates: List[datetime], now: datetime) -> int:
    if not visit_dates:
        return 0
    visited_weeks = {(_ensure_utc(dt).isocalendar().year, _ensure_utc(dt).isocalendar().week) for dt in visit_dates}
    streak = 0
    cursor = now
    for _ in range(52):
        key = (cursor.isocalendar().year, cursor.isocalendar().week)
        if key not in visited_weeks:
            if streak == 0:
                cursor = cursor - timedelta(days=7)
                if (cursor.isocalendar().year, cursor.isocalendar().week) in visited_weeks:
                    streak += 1
                    cursor = cursor - timedelta(days=7)
                    continue
            break
        streak += 1
        cursor = cursor - timedelta(days=7)
    return streak


def _format_entry(entry: ClientProgressEntry) -> ProgressEntryResponse:
    return ProgressEntryResponse(
        id=entry.id,
        member_id=entry.member_id,
        recorded_by_user_id=entry.recorded_by_user_id,
        recorded_by_name=entry.recorded_by.full_name if entry.recorded_by else None,
        exercise_name=entry.exercise_name,
        weight_kg=entry.weight_kg,
        sets=entry.sets,
        reps=entry.reps,
        training_volume=entry.training_volume,
        rpe=entry.rpe,
        rir=entry.rir,
        rest_seconds=entry.rest_seconds,
        body_weight_kg=entry.body_weight_kg,
        waist_cm=entry.waist_cm,
        hips_cm=entry.hips_cm,
        chest_cm=entry.chest_cm,
        arms_cm=entry.arms_cm,
        thighs_cm=entry.thighs_cm,
        resting_heart_rate=entry.resting_heart_rate,
        notes=entry.notes,
        recorded_at=entry.recorded_at,
    )


@router.get("/member/{member_id}", response_model=ClientProgressReportResponse)
async def get_member_progress_report(
    member_id: int,
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Fetch assigned workout/meal plan, fitness metrics history, and attendance streak for a member."""
    member = (
        await db.execute(
            select(Member)
            .where(Member.id == member_id)
            .options(selectinload(Member.memberships).selectinload(MemberMembership.plan))
        )
    ).scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found.")

    _assert_member_view_access(current_user, member)

    now = datetime.now(timezone.utc)
    active_ms = next(
        (
            ms
            for ms in (member.memberships or [])
            if ms.status == MembershipStatus.ACTIVE and ms.end_date and _ensure_utc(ms.end_date) > now
        ),
        None,
    )
    active_plan_name = active_ms.plan.name if active_ms and active_ms.plan else None

    plan_row = (
        await db.execute(select(MemberTrainingPlan).where(MemberTrainingPlan.member_id == member_id))
    ).scalar_one_or_none()

    entries = (
        await db.execute(
            select(ClientProgressEntry)
            .where(ClientProgressEntry.member_id == member_id)
            .options(selectinload(ClientProgressEntry.recorded_by))
            .order_by(desc(ClientProgressEntry.recorded_at), desc(ClientProgressEntry.id))
            .limit(limit)
        )
    ).scalars().all()

    visit_times = (
        await db.execute(
            select(Visit.checked_in_at)
            .where(Visit.member_id == member_id)
            .order_by(desc(Visit.checked_in_at))
        )
    ).scalars().all()

    cutoff_30d = now - timedelta(days=30)
    visits_30d = sum(1 for dt in visit_times if _ensure_utc(dt) >= cutoff_30d)
    last_visit_at = visit_times[0] if visit_times else None
    streak_weeks = _compute_week_streak(list(visit_times), now)

    pt_rows = (
        await db.execute(
            select(PTSession)
            .where(PTSession.member_id == member_id)
            .order_by(desc(PTSession.scheduled_at), desc(PTSession.id))
            .limit(20)
        )
    ).scalars().all()
    completed_pt_count = sum(1 for pt in pt_rows if pt.status == PTSessionStatus.COMPLETED)
    coach_notes = [pt.coach_notes.strip() for pt in pt_rows if pt.coach_notes and pt.coach_notes.strip()][:5]

    latest_rhr = next((e.resting_heart_rate for e in entries if e.resting_heart_rate is not None), None)

    return ClientProgressReportResponse(
        member_id=member.id,
        member_code=member.member_code,
        member_name=member.full_name,
        member_status=member.status.value if hasattr(member.status, "value") else str(member.status),
        active_plan_name=active_plan_name,
        assigned_plan=TrainingPlanResponse.model_validate(plan_row) if plan_row else None,
        attendance=ProgressAttendanceSummary(
            visits_last_30_days=visits_30d,
            total_visits=len(visit_times),
            completed_pt_sessions=completed_pt_count,
            active_week_streak=streak_weeks,
            last_visit_at=last_visit_at,
            latest_resting_heart_rate=latest_rhr,
        ),
        entries=[_format_entry(e) for e in entries],
        recent_coach_notes=coach_notes,
    )


@router.post("/member/{member_id}/entries", response_model=ProgressEntryResponse, status_code=status.HTTP_201_CREATED)
async def create_member_progress_entry(
    member_id: int,
    payload: ProgressEntryCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.STAFF, UserRole.TRAINER])),
):
    """Record a client strength, body composition, or cardio recovery progress snapshot."""
    member = await db.get(Member, member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found.")

    data = payload.model_dump(exclude_unset=True)
    has_any_metric = any(
        data.get(k) is not None
        for k in (
            "exercise_name",
            "weight_kg",
            "body_weight_kg",
            "waist_cm",
            "chest_cm",
            "hips_cm",
            "arms_cm",
            "thighs_cm",
            "resting_heart_rate",
            "notes",
        )
    )
    if not has_any_metric:
        raise HTTPException(status_code=400, detail="Enter at least one metric or coaching note.")

    computed_volume: Optional[float] = None
    if payload.weight_kg is not None and payload.sets is not None and payload.reps is not None:
        computed_volume = round(float(payload.weight_kg) * payload.sets * payload.reps, 2)

    entry = ClientProgressEntry(
        member_id=member_id,
        recorded_by_user_id=current_user.id,
        exercise_name=payload.exercise_name.strip() if payload.exercise_name else None,
        weight_kg=payload.weight_kg,
        sets=payload.sets,
        reps=payload.reps,
        training_volume=computed_volume,
        rpe=payload.rpe,
        rir=payload.rir,
        rest_seconds=payload.rest_seconds,
        body_weight_kg=payload.body_weight_kg,
        waist_cm=payload.waist_cm,
        hips_cm=payload.hips_cm,
        chest_cm=payload.chest_cm,
        arms_cm=payload.arms_cm,
        thighs_cm=payload.thighs_cm,
        resting_heart_rate=payload.resting_heart_rate,
        notes=payload.notes.strip() if payload.notes else None,
        recorded_at=payload.recorded_at or datetime.now(timezone.utc),
    )
    db.add(entry)
    await db.flush()

    await record_audit_log(
        db,
        action="progress.entry.logged",
        outcome="SUCCESS",
        actor=current_user,
        target_type="member",
        target_id=str(member.id),
        request=request,
        details=f"Logged fitness progress for {member.full_name} ({member.member_code}).",
    )
    await db.commit()
    await db.refresh(entry)
    return _format_entry(entry)


@router.put("/me/plan", response_model=TrainingPlanResponse)
async def upsert_my_training_plan(
    payload: TrainingPlanUpsert,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Sync the logged-in member's own workout split and meal plan to the database."""
    normalized_email = (current_user.email or "").lower().strip()
    member = (
        await db.execute(select(Member).where(Member.email == normalized_email))
    ).scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member profile not found.")
    return await upsert_member_training_plan(member.id, payload, request, db, current_user)


@router.put("/member/{member_id}/plan", response_model=TrainingPlanResponse)
async def upsert_member_training_plan(
    member_id: int,
    payload: TrainingPlanUpsert,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Save or update a member's active workout split & meal plan blueprint."""
    member = await db.get(Member, member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found.")

    _assert_member_view_access(current_user, member)

    plan_row = (
        await db.execute(select(MemberTrainingPlan).where(MemberTrainingPlan.member_id == member_id))
    ).scalar_one_or_none()
    if not plan_row:
        plan_row = MemberTrainingPlan(member_id=member_id)
        db.add(plan_row)

    plan_row.updated_by_user_id = current_user.id
    for field in (
        "goal_focus",
        "workout_plan_summary",
        "workout_split_json",
        "meal_plan_summary",
        "meal_plan_json",
    ):
        val = getattr(payload, field)
        if val is not None:
            setattr(plan_row, field, val)

    await db.flush()
    await record_audit_log(
        db,
        action="progress.plan.updated",
        outcome="SUCCESS",
        actor=current_user,
        target_type="member",
        target_id=str(member.id),
        request=request,
        details=f"Updated training/meal blueprint for {member.full_name} ({member.member_code}).",
    )
    await db.commit()
    await db.refresh(plan_row)
    return TrainingPlanResponse.model_validate(plan_row)
