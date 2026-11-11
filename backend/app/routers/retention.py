import json
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import require_roles
from app.core.rate_limit import rate_limit_ai, rate_limit_sensitive
from app.database import get_db
from app.models.user import User, UserRole
from app.models.member import Member
from app.models.member_membership import MemberMembership, MembershipStatus
from app.models.prediction import Prediction
from app.models.processed_customer import ProcessedCustomer
from app.models.retention_strategy import RetentionStrategy
from app.models.notification import Notification
from app.schemas.retention import (
    RetentionStrategyResponse,
    DispatchOfferRequest,
)
from app.services.audit import record_audit_log
from app.services.retention_ai import generate_ai_retention_strategy
from app.services.churn_pipeline import refresh_member_churn_prediction
from app.services.sms_service import notify_retention_offer_sms

router = APIRouter(prefix="/api/retention", tags=["AI Retention Strategies"])


def _serialize_strategy(strat: RetentionStrategy) -> RetentionStrategyResponse:
    """Parse stored tactical steps JSON and serialize a RetentionStrategy row."""
    try:
        parsed_steps = json.loads(strat.tactical_action_steps)
        steps_list = parsed_steps if isinstance(parsed_steps, list) else []
    except (TypeError, ValueError, json.JSONDecodeError):
        steps_list = []

    return RetentionStrategyResponse(
        id=strat.id,
        member_id=strat.member_id,
        risk_tier=strat.risk_tier,
        churn_probability=strat.churn_probability,
        urgency=strat.urgency,
        strategy_title=strat.strategy_title,
        diagnosis_summary=strat.diagnosis_summary,
        tactical_action_steps=steps_list,
        offer_title=strat.offer_title,
        offer_message=strat.offer_message,
        offer_action_text=strat.offer_action_text,
        offer_action_url=strat.offer_action_url,
        status=strat.status,
        dispatched_at=strat.dispatched_at,
        created_at=strat.created_at,
    )


@router.post(
    "/generate/{member_id}",
    response_model=RetentionStrategyResponse,
    summary="Generate or re-generate an AI retention strategy for a member",
    dependencies=[Depends(rate_limit_ai)],
)
async def generate_strategy_endpoint(
    member_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.STAFF])),
):
    # 1. Fetch Member
    stmt_mem = (
        select(Member)
        .where(Member.id == member_id)
        .options(selectinload(Member.memberships).selectinload(MemberMembership.plan))
    )
    res_mem = await db.execute(stmt_mem)
    member = res_mem.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    # 2. Fetch or compute Churn Prediction
    stmt_pred = select(Prediction).where(Prediction.customer_id == member_id)
    pred = (await db.execute(stmt_pred)).scalar_one_or_none()
    if not pred:
        pred = await refresh_member_churn_prediction(db, member_id)

    if not pred:
        raise HTTPException(status_code=400, detail="Unable to calculate churn prediction for member")

    # 3. Fetch Processed Features
    stmt_proc = select(ProcessedCustomer).where(ProcessedCustomer.customer_id == member_id)
    proc = (await db.execute(stmt_proc)).scalar_one_or_none()

    # Active plan name
    active_plan_name = None
    if member.memberships:
        active_membership = next(
            (m for m in member.memberships if m.status == MembershipStatus.ACTIVE and m.plan),
            None,
        )
        chosen_membership = active_membership or next((m for m in member.memberships if m.plan), None)
        active_plan_name = chosen_membership.plan.name if chosen_membership else None

    # 4. Generate AI Strategy
    ai_result = await generate_ai_retention_strategy(
        member=member,
        prediction=pred,
        features=proc,
        active_plan_name=active_plan_name,
    )

    tactical_steps_json = json.dumps(ai_result.get("tactical_action_steps", []))

    # 5. Save or Update RetentionStrategy in DB
    stmt_strat = select(RetentionStrategy).where(RetentionStrategy.member_id == member_id)
    existing_strat = (await db.execute(stmt_strat)).scalar_one_or_none()

    if existing_strat:
        existing_strat.risk_tier = pred.risk_tier
        existing_strat.churn_probability = pred.churn_probability
        existing_strat.urgency = ai_result.get("urgency", "HIGH")
        existing_strat.strategy_title = ai_result.get("strategy_title", "Retention Playbook")
        existing_strat.diagnosis_summary = ai_result.get("diagnosis_summary", "")
        existing_strat.tactical_action_steps = tactical_steps_json
        existing_strat.offer_title = ai_result.get("offer_title", "Special Retention Perk")
        existing_strat.offer_message = ai_result.get("offer_message", "")
        existing_strat.offer_action_text = ai_result.get("offer_action_text", "Claim Offer")
        existing_strat.offer_action_url = ai_result.get("offer_action_url", "/membership")
        existing_strat.status = "generated"
        strat_record = existing_strat
    else:
        strat_record = RetentionStrategy(
            member_id=member_id,
            risk_tier=pred.risk_tier,
            churn_probability=pred.churn_probability,
            urgency=ai_result.get("urgency", "HIGH"),
            strategy_title=ai_result.get("strategy_title", "Retention Playbook"),
            diagnosis_summary=ai_result.get("diagnosis_summary", ""),
            tactical_action_steps=tactical_steps_json,
            offer_title=ai_result.get("offer_title", "Special Retention Perk"),
            offer_message=ai_result.get("offer_message", ""),
            offer_action_text=ai_result.get("offer_action_text", "Claim Offer"),
            offer_action_url=ai_result.get("offer_action_url", "/membership"),
            status="generated",
        )
        db.add(strat_record)

    await record_audit_log(
        db,
        action="AI_RETENTION_STRATEGY_GENERATED",
        outcome="SUCCESS",
        actor=current_user,
        target_type="member",
        target_id=member_id,
        request=request,
        details=f"Generated AI retention strategy for member #{member_id} (risk={pred.risk_tier}).",
    )
    await db.commit()
    await db.refresh(strat_record)

    return _serialize_strategy(strat_record)


@router.get(
    "/member/{member_id}",
    response_model=Optional[RetentionStrategyResponse],
    summary="Get existing retention strategy for a member",
)
async def get_member_strategy(
    member_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.STAFF, UserRole.TRAINER])),
):
    stmt = select(RetentionStrategy).where(RetentionStrategy.member_id == member_id)
    strat = (await db.execute(stmt)).scalar_one_or_none()
    if not strat:
        return None

    return _serialize_strategy(strat)


@router.post(
    "/dispatch-offer",
    summary="Dispatch a personalized retention offer to a member's in-app notification bell",
    dependencies=[Depends(rate_limit_sensitive)],
)
async def dispatch_retention_offer(
    payload: DispatchOfferRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.STAFF])),
):
    # 1. Fetch member
    stmt_mem = select(Member).where(Member.id == payload.member_id)
    member = (await db.execute(stmt_mem)).scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    # 2. Find associated User by email (if exists)
    user_id = None
    if member.email:
        stmt_user = select(User).where(func.lower(User.email) == member.email.lower().strip())
        matched_user = (await db.execute(stmt_user)).scalar_one_or_none()
        if matched_user:
            user_id = matched_user.id

    # 3. If strategy_id provided, verify ownership and prepare status update before mutating
    strat = None
    if payload.strategy_id is not None:
        stmt_strat = select(RetentionStrategy).where(
            RetentionStrategy.id == payload.strategy_id,
            RetentionStrategy.member_id == member.id,
        )
        strat = (await db.execute(stmt_strat)).scalar_one_or_none()
        if not strat:
            raise HTTPException(status_code=404, detail="Retention strategy not found for this member")

    # 4. Create Notification
    notif = Notification(
        user_id=user_id,
        member_id=member.id,
        title=payload.title,
        message=payload.message,
        type="retention",
        action_text=payload.action_text,
        action_url=payload.action_url,
        is_read=False,
    )
    db.add(notif)

    if strat is not None:
        strat.status = "dispatched"
        strat.dispatched_at = datetime.now(timezone.utc)

    await record_audit_log(
        db,
        action="RETENTION_OFFER_DISPATCHED",
        outcome="SUCCESS",
        actor=current_user,
        target_type="member",
        target_id=member.id,
        request=request,
        details=f"Dispatched retention offer '{payload.title}' to member #{member.id}.",
    )
    await db.commit()
    await db.refresh(notif)

    # Dispatch SMS to member if mobile number is present (non-blocking)
    sms_status = None
    if member.phone:
        sms_res = await notify_retention_offer_sms(
            member_name=member.first_name,
            offer_title=payload.title,
            offer_message=payload.message,
            to_phone=member.phone,
        )
        sms_status = sms_res.get("status")

    return {
        "status": "success",
        "message": f"Retention offer successfully dispatched to {member.first_name}.",
        "notification_id": notif.id,
        "recipient_name": member.full_name,
        "recipient_email": member.email,
        "sms_status": sms_status,
    }


@router.post(
    "/auto-dispatch-high-risk",
    summary="Automatically scan and dispatch personalized SMS retention offers to all HIGH RISK members",
    dependencies=[Depends(rate_limit_sensitive)],
)
async def auto_dispatch_high_risk_endpoint(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.STAFF])),
):
    """
    Scans for members currently categorized as HIGH RISK by the XGBoost churn model,
    generates tailored retention strategies, and automatically dispatches transactional
    SMS notifications via TextBee with a 30-day anti-duplication guard.
    """
    from app.services.churn_pipeline import auto_dispatch_high_risk_retention_sms

    stmt_high = (
        select(Prediction.customer_id)
        .where(Prediction.risk_tier == "HIGH")
    )
    high_member_ids = (await db.execute(stmt_high)).scalars().all()

    dispatched = []
    skipped = []
    for mid in high_member_ids:
        res = await auto_dispatch_high_risk_retention_sms(db, mid)
        if res.get("status") == "dispatched":
            dispatched.append(res)
        else:
            skipped.append(res)

    await record_audit_log(
        db,
        action="AUTO_RETENTION_HIGH_RISK_DISPATCH",
        outcome="SUCCESS",
        actor=current_user,
        target_type="batch",
        target_id=len(high_member_ids),
        request=request,
        details=f"Auto-dispatched retention offers to {len(dispatched)} HIGH risk members ({len(skipped)} skipped/recently sent).",
    )
    await db.commit()

    return {
        "status": "success",
        "total_high_risk": len(high_member_ids),
        "dispatched_count": len(dispatched),
        "skipped_count": len(skipped),
        "dispatched": dispatched,
        "skipped": skipped,
    }
