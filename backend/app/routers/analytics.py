import asyncio
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, HTTPException, Request
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import require_roles
from app.core.rate_limit import rate_limit_ai
from app.database import get_db
from app.models.user import User, UserRole
from app.models.member import Member, MemberStatus
from app.models.visit import Visit
from app.models.class_session import ClassSession, ClassEnrollment
from app.models.member_membership import MemberMembership, MembershipStatus
from app.models.processed_customer import ProcessedCustomer
from app.models.prediction import Prediction
from app.schemas.analytics import (
    AnalyticsOverviewResponse,
    HourlyCheckinStat,
    ClassPopularityStat,
    ChurnOverviewResponse,
    AtRiskMemberItem,
    MemberChurnDetailResponse,
)
from app.services.audit import record_audit_log
from app.services.churn_ml import train_baseline_model
from app.services.churn_pipeline import (
    refresh_all_predictions,
    refresh_member_churn_prediction,
)

router = APIRouter(tags=["Analytics & Churn"])

_MANILA_TZ = timezone(timedelta(hours=8))


def _as_utc(dt: datetime) -> datetime:
    """Normalize naive datetimes from SQLite to UTC-aware datetimes."""
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


def _resolve_active_plan_name(memberships: Optional[List[MemberMembership]]) -> Optional[str]:
    """Return the active membership's plan name, falling back to any loaded plan."""
    if not memberships:
        return None
    active = next(
        (m for m in memberships if m.status == MembershipStatus.ACTIVE and m.plan),
        None,
    )
    chosen = active or next((m for m in memberships if m.plan), None)
    return chosen.plan.name if chosen else None


# 1. GYM ATTENDANCE & OPERATIONS ANALYTICS

@router.get(
    "/api/analytics/overview",
    response_model=AnalyticsOverviewResponse,
    summary="Get high-level gym attendance trends and operational metrics",
)
async def get_analytics_overview(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.STAFF, UserRole.TRAINER])),
):
    now_manila = datetime.now(_MANILA_TZ)
    first_of_this_month_manila = datetime(now_manila.year, now_manila.month, 1, tzinfo=_MANILA_TZ)
    first_of_last_month_manila = (first_of_this_month_manila - timedelta(days=1)).replace(day=1)
    first_of_this_month = first_of_this_month_manila.astimezone(timezone.utc)
    first_of_last_month = first_of_last_month_manila.astimezone(timezone.utc)

    # 1. Total visits this month
    stmt_this_month = select(func.count(Visit.id)).where(Visit.checked_in_at >= first_of_this_month)
    visits_this_month = (await db.execute(stmt_this_month)).scalar() or 0

    # 2. Total visits last month
    stmt_last_month = select(func.count(Visit.id)).where(
        Visit.checked_in_at >= first_of_last_month,
        Visit.checked_in_at < first_of_this_month,
    )
    visits_last_month = (await db.execute(stmt_last_month)).scalar() or 0

    if visits_last_month > 0:
        attendance_growth = round(((visits_this_month - visits_last_month) / visits_last_month) * 100, 1)
    else:
        attendance_growth = 0.0

    # 3. Active members count
    stmt_active = select(func.count(Member.id)).where(Member.status == MemberStatus.ACTIVE)
    active_members_count = (await db.execute(stmt_active)).scalar() or 0

    # 4. Average dwell minutes from real checked-out visits (ordered by most recent)
    stmt_dwell = (
        select(Visit)
        .where(Visit.checked_out_at.isnot(None))
        .order_by(Visit.checked_in_at.desc())
        .limit(300)
    )
    checked_out_visits = (await db.execute(stmt_dwell)).scalars().all()
    if checked_out_visits:
        # Filter out sub-3-minute checkout glitches (e.g. quick test clicks) to get true workout dwell
        dwell_durations = []
        for v in checked_out_visits:
            checked_in_utc = _as_utc(v.checked_in_at)
            checked_out_utc = _as_utc(v.checked_out_at)
            seconds = (checked_out_utc - checked_in_utc).total_seconds()
            if seconds >= 180:
                dwell_durations.append(seconds / 60.0)
        avg_dwell = int(sum(dwell_durations) / len(dwell_durations)) if dwell_durations else 0
    else:
        avg_dwell = 0

    # 5. Hourly check-in distribution (6 AM to 9 PM) - dynamic realtime query
    all_visits_recent = (
        await db.execute(
            select(Visit.checked_in_at)
            .order_by(Visit.checked_in_at.desc())
            .limit(1000)
        )
    ).scalars().all()

    hour_counts = {h: 0 for h in range(6, 22)}
    for v_time in all_visits_recent:
        # Check-in datetimes are stored in UTC; convert to Philippine Standard Time (UTC+8)
        local_h = _as_utc(v_time).astimezone(_MANILA_TZ).hour
        if 6 <= local_h <= 21:
            hour_counts[local_h] += 1

    # Format hourly list and compute dynamic peak hour
    hourly_distribution: List[HourlyCheckinStat] = []
    peak_count = 0
    peak_h: Optional[int] = None
    for h in range(6, 22):
        label = f"{h if h <= 12 else h - 12} {'AM' if h < 12 else 'PM'}"
        count = hour_counts[h]
        if count > peak_count:
            peak_count = count
            peak_h = h
        hourly_distribution.append(
            HourlyCheckinStat(hour=h, hour_label=label, count=count)
        )

    peak_hour_str = (
        f"{peak_h if peak_h <= 12 else peak_h - 12}:00 {'AM' if peak_h < 12 else 'PM'}"
        if peak_h is not None
        else "N/A"
    )

    # 6. Popular classes
    stmt_classes = (
        select(
            ClassSession.name,
            ClassSession.class_type,
            func.count(ClassEnrollment.id).label("enrollments_count"),
        )
        .outerjoin(ClassEnrollment, ClassSession.id == ClassEnrollment.class_session_id)
        .group_by(ClassSession.id)
        .order_by(func.count(ClassEnrollment.id).desc())
        .limit(5)
    )
    class_rows = (await db.execute(stmt_classes)).all()
    popular_classes = [
        ClassPopularityStat(
            name=row[0],
            class_type=(row[1].value if hasattr(row[1], "value") else str(row[1] or "other")).replace("_", " ").title(),
            total_enrollments=row[2],
        )
        for row in class_rows
    ]

    return AnalyticsOverviewResponse(
        total_visits_this_month=visits_this_month,
        attendance_growth_pct=attendance_growth,
        active_members_count=active_members_count,
        average_dwell_minutes=avg_dwell,
        peak_hour=peak_hour_str,
        hourly_distribution=hourly_distribution,
        popular_classes=popular_classes,
    )


# 2. CHURN PREDICTION & RETENTION OVERVIEW

@router.get(
    "/api/churn/overview",
    response_model=ChurnOverviewResponse,
    summary="Get aggregated churn risk distributions and overall retention rate",
)
async def get_churn_overview(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.STAFF, UserRole.TRAINER])),
):
    # Total evaluated predictions
    stmt = select(Prediction.risk_tier, func.count(Prediction.id)).group_by(Prediction.risk_tier)
    counts = dict((await db.execute(stmt)).all())

    high_risk = counts.get("HIGH", 0)
    med_risk = counts.get("MEDIUM", 0)
    low_risk = counts.get("LOW", 0)
    total = high_risk + med_risk + low_risk

    if total > 0:
        retention_rate = round(((low_risk + med_risk * 0.5) / total) * 100, 1)
    else:
        retention_rate = 0.0

    return ChurnOverviewResponse(
        total_members_assessed=total,
        high_risk_count=high_risk,
        medium_risk_count=med_risk,
        low_risk_count=low_risk,
        overall_retention_rate_pct=retention_rate,
    )


# 3. AT-RISK MEMBERS ROSTER TABLE

@router.get(
    "/api/churn/members",
    response_model=List[AtRiskMemberItem],
    summary="Query members with churn probabilities and contributing factors",
)
async def list_churn_members(
    risk_tier: Optional[str] = Query(None, description="Filter: HIGH, MEDIUM, LOW"),
    search: Optional[str] = Query(None, description="Search name, email, or code"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.STAFF, UserRole.TRAINER])),
):
    is_trainer = current_user.role == UserRole.TRAINER
    query = (
        select(Prediction, Member, ProcessedCustomer)
        .join(Member, Prediction.customer_id == Member.id)
        .outerjoin(ProcessedCustomer, Prediction.customer_id == ProcessedCustomer.customer_id)
        .options(selectinload(Member.memberships).selectinload(MemberMembership.plan))
    )

    if risk_tier and risk_tier.upper() in ["HIGH", "MEDIUM", "LOW"]:
        query = query.where(Prediction.risk_tier == risk_tier.upper())

    if search:
        s = f"%{search}%"
        search_filters = [
            Member.first_name.ilike(s),
            Member.last_name.ilike(s),
            Member.member_code.ilike(s),
        ]
        if not is_trainer:
            search_filters.append(Member.email.ilike(s))
        query = query.where(or_(*search_filters))

    # Sort primarily by churn probability descending (most at-risk first)
    query = query.order_by(Prediction.churn_probability.desc()).offset(skip).limit(limit)
    rows = (await db.execute(query)).all()

    results: List[AtRiskMemberItem] = []
    for pred, mem, proc in rows:
        factors = []
        if pred.top_risk_factor_1:
            factors.append(pred.top_risk_factor_1)
        if pred.top_risk_factor_2:
            factors.append(pred.top_risk_factor_2)
        if pred.top_risk_factor_3:
            factors.append(pred.top_risk_factor_3)

        # Resolve active plan name
        active_plan = _resolve_active_plan_name(mem.memberships)

        days_rec = (proc.days_since_last_checkin or 0) if proc else 0
        freq = float(proc.visit_frequency_weekly or 0.0) if proc else 0.0

        results.append(
            AtRiskMemberItem(
                member_id=mem.id,
                member_code=mem.member_code,
                full_name=mem.full_name,
                email=None if is_trainer else mem.email,
                phone=None if is_trainer else mem.phone,
                active_plan_name=active_plan,
                days_since_last_checkin=days_rec,
                visit_frequency_weekly=freq,
                churn_probability=pred.churn_probability,
                risk_tier=pred.risk_tier,
                top_risk_factors=factors,
                predicted_at=pred.predicted_at,
            )
        )

    return results


# 4. SINGLE MEMBER CHURN DIAGNOSIS

@router.get(
    "/api/churn/member/{member_id}",
    response_model=MemberChurnDetailResponse,
    summary="Get individual member churn breakdown and feature metrics",
)
async def get_member_churn_detail(
    member_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.STAFF, UserRole.TRAINER])),
):
    is_trainer = current_user.role == UserRole.TRAINER
    stmt = (
        select(Prediction, Member, ProcessedCustomer)
        .join(Member, Prediction.customer_id == Member.id)
        .outerjoin(ProcessedCustomer, Prediction.customer_id == ProcessedCustomer.customer_id)
        .where(Member.id == member_id)
    )
    row = (await db.execute(stmt)).first()
    if not row:
        # If not evaluated, calculate on the fly
        pred = await refresh_member_churn_prediction(db, member_id)
        if not pred:
            raise HTTPException(status_code=404, detail="Member not found")
        row = (await db.execute(stmt)).first()
        if not row:
            raise HTTPException(status_code=404, detail="Member not found")

    pred, mem, proc = row
    factors = [f for f in [pred.top_risk_factor_1, pred.top_risk_factor_2, pred.top_risk_factor_3] if f]

    features_dict = {
        "visit_frequency_weekly": float(proc.visit_frequency_weekly or 0.0) if proc else 0.0,
        "days_since_last_checkin": (proc.days_since_last_checkin or 0) if proc else 0,
        "total_visits_30d": (proc.total_visits_30d or 0) if proc else 0,
        "total_class_bookings": (proc.total_class_bookings or 0) if proc else 0,
        "total_pt_sessions": (proc.total_pt_sessions or 0) if proc else 0,
        "membership_tenure_days": (proc.membership_tenure_days or 0) if proc else 0,
        "total_revenue_lifetime": None if is_trainer else (float(proc.total_revenue_lifetime or 0.0) if proc else 0.0),
        "recent_activity_score": float(proc.recent_activity_score or 0.0) if proc else 0.0,
    }

    return MemberChurnDetailResponse(
        member_id=mem.id,
        member_code=mem.member_code,
        full_name=mem.full_name,
        email=None if is_trainer else mem.email,
        phone=None if is_trainer else mem.phone,
        status=mem.status.value if hasattr(mem.status, "value") else str(mem.status),
        churn_probability=pred.churn_probability,
        risk_tier=pred.risk_tier,
        top_risk_factors=factors,
        features=features_dict,
        predicted_at=pred.predicted_at,
    )


# 5. RETRAIN & REFRESH PIPELINE

@router.post(
    "/api/churn/retrain",
    summary="Retrain XGBoost churn model and recalculate all member risk scores",
    dependencies=[Depends(rate_limit_ai)],
)
async def retrain_churn_pipeline(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN])),
):
    train_stats = await asyncio.to_thread(train_baseline_model, save=True)
    count = await refresh_all_predictions(db)
    await record_audit_log(
        db,
        action="CHURN_MODEL_RETRAINED",
        outcome="SUCCESS",
        actor=current_user,
        target_type="ml_model",
        request=request,
        details=f"Retrained XGBoost churn model (accuracy={train_stats.get('accuracy')}, updated={count} members).",
    )
    await db.commit()
    return {
        "status": "success",
        "message": f"XGBoost model retrained successfully and {count} member predictions updated.",
        "model_accuracy": train_stats.get("accuracy"),
        "total_members_updated": count,
    }
