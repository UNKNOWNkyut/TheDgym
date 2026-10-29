import json
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import require_roles
from app.core.rate_limit import rate_limit_ai, rate_limit_sensitive
from app.database import get_db
from app.models.user import User, UserRole
from app.models.member import Member
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

router = APIRouter(prefix="/api/retention", tags=["AI Retention Strategies"])


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
        .options(selectinload(Member.memberships))
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
    if member.memberships and len(member.memberships) > 0:
        active_plan_name = member.memberships[0].plan.name if hasattr(member.memberships[0], "plan") and member.memberships[0].plan else None

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

    # Parse tactical steps back to list for response
    try:
        steps_list = json.loads(strat_record.tactical_action_steps)
    except Exception:
        steps_list = []

    return RetentionStrategyResponse(
        id=strat_record.id,
        member_id=strat_record.member_id,
        risk_tier=strat_record.risk_tier,
        churn_probability=strat_record.churn_probability,
        urgency=strat_record.urgency,
        strategy_title=strat_record.strategy_title,
        diagnosis_summary=strat_record.diagnosis_summary,
        tactical_action_steps=steps_list,
        offer_title=strat_record.offer_title,
        offer_message=strat_record.offer_message,
        offer_action_text=strat_record.offer_action_text,
        offer_action_url=strat_record.offer_action_url,
        status=strat_record.status,
        dispatched_at=strat_record.dispatched_at,
        created_at=strat_record.created_at,
    )


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

    try:
        steps_list = json.loads(strat.tactical_action_steps)
    except Exception:
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
        stmt_user = select(User).where(User.email == member.email.lower().strip())
        matched_user = (await db.execute(stmt_user)).scalar_one_or_none()
        if matched_user:
            user_id = matched_user.id

    # 3. Create Notification
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

    # 4. If strategy_id provided, update status
    if payload.strategy_id:
        stmt_strat = select(RetentionStrategy).where(RetentionStrategy.id == payload.strategy_id)
        strat = (await db.execute(stmt_strat)).scalar_one_or_none()
        if strat:
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

    return {
        "status": "success",
        "message": f"Retention offer successfully dispatched to {member.first_name}.",
        "notification_id": notif.id,
        "recipient_name": member.full_name,
        "recipient_email": member.email,
    }
