import asyncio
import json
import random
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Sequence

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.class_session import ClassEnrollment
from app.models.member import Member, MemberStatus
from app.models.member_membership import MemberMembership, MembershipStatus, PaymentMethod
from app.models.membership_plan import MembershipPlan
from app.models.notification import Notification
from app.models.prediction import Prediction
from app.models.processed_customer import ProcessedCustomer
from app.models.pt_session import PTSession
from app.models.raw_transaction import RawTransaction
from app.models.retention_strategy import RetentionStrategy
from app.models.user import User
from app.models.visit import Visit, VisitType
from app.services.churn_ml import predict_churn_batch, train_baseline_model
from app.services.retention_ai import generate_heuristic_strategy
from app.services.sms_service import notify_retention_offer_sms


def _as_utc(dt: datetime | str) -> datetime:
    if isinstance(dt, str):
        dt = datetime.fromisoformat(dt.replace("Z", "+00:00"))
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


async def _compute_features_for_members(
    session: AsyncSession,
    member_ids: Optional[Sequence[int]] = None,
) -> Dict[int, Dict[str, float]]:
    now = datetime.now(timezone.utc)

    # 1. Member profile & tenure
    stmt_members = select(Member.id, Member.joined_at)
    if member_ids is not None:
        if not member_ids:
            return {}
        stmt_members = stmt_members.where(Member.id.in_(member_ids))

    member_rows = (await session.execute(stmt_members)).all()
    if not member_rows:
        return {}
    target_ids = [row[0] for row in member_rows]

    def _scope(stmt, col):
        return stmt.where(col.in_(target_ids)) if member_ids is not None else stmt

    # 2. Visits aggregation
    # Visits in last 30 days & 14 days
    d30, d14, d28 = now - timedelta(days=30), now - timedelta(days=14), now - timedelta(days=28)
    stmt_visits = _scope(
        select(
            Visit.member_id,
            func.max(Visit.checked_in_at),
            func.coalesce(func.sum(case((Visit.checked_in_at >= d30, 1), else_=0)), 0),
            func.coalesce(func.sum(case((Visit.checked_in_at >= d14, 1), else_=0)), 0),
            func.coalesce(func.sum(case(((Visit.checked_in_at < d14) & (Visit.checked_in_at >= d28), 1), else_=0)), 0),
        ).group_by(Visit.member_id),
        Visit.member_id,
    )
    visit_map = {row[0]: row[1:] for row in (await session.execute(stmt_visits)).all()}

    # 3. Class enrollments count
    stmt_classes = _scope(
        select(ClassEnrollment.member_id, func.count(ClassEnrollment.id)).group_by(ClassEnrollment.member_id),
        ClassEnrollment.member_id,
    )
    class_map = dict((await session.execute(stmt_classes)).all())

    # 4. PT sessions count
    stmt_pt = _scope(
        select(PTSession.member_id, func.count(PTSession.id)).group_by(PTSession.member_id),
        PTSession.member_id,
    )
    pt_map = dict((await session.execute(stmt_pt)).all())

    # 5. Total revenue lifetime
    stmt_rev = _scope(
        select(MemberMembership.member_id, func.coalesce(func.sum(MemberMembership.paid_amount), 0)).group_by(
            MemberMembership.member_id
        ),
        MemberMembership.member_id,
    )
    rev_map = dict((await session.execute(stmt_rev)).all())

    results: Dict[int, Dict[str, float]] = {}
    for mid, joined_at in member_rows:
        # Handle joined_at offset-naive vs aware
        tenure_days = max(1, (now - _as_utc(joined_at)).days)
        if mid in visit_map:
            last_visit_raw, visits_last_30d, visits_last_14d, visits_prev_14d = visit_map[mid]
            days_since_last_checkin = max(0, (now - _as_utc(last_visit_raw)).days)
        else:
            days_since_last_checkin = min(tenure_days, 60)
            visits_last_30d = visits_last_14d = visits_prev_14d = 0

        visit_frequency_weekly = round((visits_last_30d / 30.0) * 7.0, 2)

        # Recent activity momentum: ratio of recent 14d vs prior 14d
        if visits_prev_14d > 0:
            recent_activity_score = min(1.0, round(visits_last_14d / visits_prev_14d, 2))
        elif visits_last_14d > 0:
            recent_activity_score = 0.85
        else:
            recent_activity_score = 0.05

        results[mid] = {
            "visit_frequency_weekly": float(visit_frequency_weekly),
            "days_since_last_checkin": int(days_since_last_checkin),
            "total_visits_30d": int(visits_last_30d),
            "total_class_bookings": int(class_map.get(mid, 0)),
            "total_pt_sessions": int(pt_map.get(mid, 0)),
            "membership_tenure_days": int(tenure_days),
            "total_revenue_lifetime": float(rev_map.get(mid, 0.0) or 0.0),
            "recent_activity_score": float(recent_activity_score),
        }

    return results


async def _refresh_predictions(
    session: AsyncSession,
    member_ids: Optional[Sequence[int]] = None,
) -> Dict[int, Prediction]:
    features_by_member = await _compute_features_for_members(session, member_ids)
    if not features_by_member:
        return {}

    ordered_ids = list(features_by_member.keys())
    ordered_features = [features_by_member[mid] for mid in ordered_ids]

    # Run XGBoost inference
    pred_results = await asyncio.to_thread(predict_churn_batch, ordered_features)

    stmt_proc = select(ProcessedCustomer)
    stmt_pred = select(Prediction)
    if member_ids is not None:
        stmt_proc = stmt_proc.where(ProcessedCustomer.customer_id.in_(ordered_ids))
        stmt_pred = stmt_pred.where(Prediction.customer_id.in_(ordered_ids))

    existing_proc = {row.customer_id: row for row in (await session.execute(stmt_proc)).scalars().all()}
    existing_preds = {row.customer_id: row for row in (await session.execute(stmt_pred)).scalars().all()}

    now = datetime.now(timezone.utc)
    updated_preds: Dict[int, Prediction] = {}
    for mid, features, pred_result in zip(ordered_ids, ordered_features, pred_results):
        # Upsert into processed_customers
        proc_cust = existing_proc.get(mid)
        if not proc_cust:
            proc_cust = ProcessedCustomer(customer_id=mid)
            session.add(proc_cust)

        proc_cust.visit_frequency_weekly = features["visit_frequency_weekly"]
        proc_cust.days_since_last_checkin = features["days_since_last_checkin"]
        proc_cust.total_visits_30d = features["total_visits_30d"]
        proc_cust.total_class_bookings = features["total_class_bookings"]
        proc_cust.total_pt_sessions = features["total_pt_sessions"]
        proc_cust.membership_tenure_days = features["membership_tenure_days"]
        proc_cust.total_revenue_lifetime = features["total_revenue_lifetime"]
        proc_cust.recent_activity_score = features["recent_activity_score"]
        proc_cust.feature_calculated_at = now

        # Upsert into predictions
        pred_obj = existing_preds.get(mid)
        if not pred_obj:
            pred_obj = Prediction(customer_id=mid)
            session.add(pred_obj)

        factors = pred_result["top_risk_factors"]
        pred_obj.churn_probability = pred_result["churn_probability"]
        pred_obj.risk_tier = pred_result["risk_tier"]
        pred_obj.top_risk_factor_1 = factors[0] if len(factors) > 0 else None
        pred_obj.top_risk_factor_2 = factors[1] if len(factors) > 1 else None
        pred_obj.top_risk_factor_3 = factors[2] if len(factors) > 2 else None
        pred_obj.model_version = pred_result["model_version"]
        pred_obj.predicted_at = now
        updated_preds[mid] = pred_obj

    await session.commit()
    return updated_preds


async def compute_member_features(session: AsyncSession, member_id: int) -> Dict[str, float]:
    """
    Computes real-time behavioral features for a specific member by aggregating
    their visits, subscriptions, and class attendance.
    """
    features_by_member = await _compute_features_for_members(session, [member_id])
    return features_by_member.get(member_id, {})


async def refresh_member_churn_prediction(session: AsyncSession, member_id: int) -> Optional[Prediction]:
    """
    Computes features, updates processed_customers, runs XGBoost model,
    and upserts prediction record for a member.
    """
    preds = await _refresh_predictions(session, [member_id])
    pred_obj = preds.get(member_id)
    if pred_obj is not None:
        await session.refresh(pred_obj)
    return pred_obj


async def auto_dispatch_high_risk_retention_sms(
    session: AsyncSession,
    member_id: int,
) -> Dict[str, Any]:
    """
    100% Automatic SMS dispatch for HIGH RISK members.
    Includes a 30-day anti-spam de-duplication guard so members are not repeatedly texted
    and SMS gateway credits are preserved.
    """
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=30)

    # 1. Anti-spam / duplicate check: skip if already dispatched within 30 days
    stmt_recent = select(RetentionStrategy).where(
        RetentionStrategy.member_id == member_id,
        RetentionStrategy.status == "dispatched",
        RetentionStrategy.dispatched_at >= cutoff,
    )
    recent = (await session.execute(stmt_recent)).scalar_one_or_none()
    if recent:
        return {
            "status": "skipped",
            "member_id": member_id,
            "reason": "already_dispatched_recently",
            "dispatched_at": recent.dispatched_at.isoformat() if recent.dispatched_at else None,
        }

    # 2. Fetch member and their prediction & features
    member = await session.get(Member, member_id)
    if not member:
        return {"status": "error", "member_id": member_id, "reason": "member_not_found"}

    stmt_pred = select(Prediction).where(Prediction.customer_id == member_id)
    pred = (await session.execute(stmt_pred)).scalar_one_or_none()
    if not pred or pred.risk_tier != "HIGH":
        return {"status": "skipped", "member_id": member_id, "reason": "not_high_risk"}

    stmt_proc = select(ProcessedCustomer).where(ProcessedCustomer.customer_id == member_id)
    proc = (await session.execute(stmt_proc)).scalar_one_or_none()

    # 3. Generate tailored retention playbook
    strat_data = generate_heuristic_strategy(member, pred, proc)

    # 4. Upsert RetentionStrategy record
    stmt_strat = select(RetentionStrategy).where(RetentionStrategy.member_id == member_id)
    strat_record = (await session.execute(stmt_strat)).scalar_one_or_none()
    if not strat_record:
        strat_record = RetentionStrategy(member_id=member_id)
        session.add(strat_record)

    strat_record.risk_tier = pred.risk_tier
    strat_record.churn_probability = pred.churn_probability or 0.0
    strat_record.urgency = strat_data.get("urgency", "CRITICAL")
    strat_record.strategy_title = strat_data.get("strategy_title", "Retention Intervention")
    strat_record.diagnosis_summary = strat_data.get("diagnosis_summary", "")
    strat_record.offer_title = strat_data.get("offer_title", "Special Retention Offer")
    strat_record.offer_message = strat_data.get("offer_message", "")
    strat_record.offer_action_text = strat_data.get("offer_action_text", "Claim Offer")
    strat_record.offer_action_url = strat_data.get("offer_action_url", "/membership")
    strat_record.tactical_action_steps = json.dumps(strat_data.get("tactical_action_steps", []))
    strat_record.status = "dispatched"
    strat_record.dispatched_at = now

    # 5. Create in-app Notification
    user_id = None
    if member.email:
        stmt_u = select(User.id).where(User.email == member.email.lower().strip())
        user_id = (await session.execute(stmt_u)).scalar_one_or_none()

    notif = Notification(
        user_id=user_id,
        member_id=member.id,
        title=strat_record.offer_title,
        message=strat_record.offer_message,
        type="retention",
        action_text=strat_record.offer_action_text,
        action_url=strat_record.offer_action_url,
        is_read=False,
    )
    session.add(notif)
    await session.commit()

    # 6. Send automatic SMS via TextBee Android Gateway
    sms_result: Dict[str, Any] = {"status": "skipped", "reason": "no_phone"}
    if member.phone:
        sms_result = await notify_retention_offer_sms(
            member_name=member.first_name,
            offer_title=strat_record.offer_title,
            offer_message=strat_record.offer_message,
            to_phone=member.phone,
        )

    return {
        "status": "dispatched",
        "member_id": member.id,
        "member_name": member.full_name,
        "phone": member.phone,
        "offer_title": strat_record.offer_title,
        "sms_result": sms_result,
    }


async def refresh_all_predictions(
    session: AsyncSession,
    auto_dispatch_high_risk_sms: bool = False,
) -> int:
    """
    Refreshes churn predictions for all existing gym members.
    If auto_dispatch_high_risk_sms is True, automatically dispatches retention SMS
    to members entering HIGH risk tier.
    """
    updated_preds = await _refresh_predictions(session)
    if auto_dispatch_high_risk_sms:
        for mid, pred in updated_preds.items():
            if pred.risk_tier == "HIGH":
                await auto_dispatch_high_risk_retention_sms(session, mid)
    return len(updated_preds)


async def seed_simulated_gym_analytics(session: AsyncSession):
    """
    Seeds realistic attendance trajectories, visit logs, and memberships for members
    to create rich demonstration analytics.
    """
    # Check if we already have rich predictions
    stmt_check = select(func.count(Prediction.id))
    existing_preds = (await session.execute(stmt_check)).scalar() or 0
    if existing_preds >= 10:
        return  # Already populated

    # Ensure baseline XGBoost model is trained
    await asyncio.to_thread(train_baseline_model, True)

    # List of realistic member profiles representing different churn personas
    sample_members_data = [
        # --- LOW RISK (Consistent Lifters: High frequency, low recency) ---
        {"code": "DGM-1001", "first": "Carlos", "last": "Dimaandal", "email": "carlos.d@gmail.com", "tier": "LOW", "days_rec": 1, "freq": 4.5, "tenure": 180, "visits_30": 18},
        {"code": "DGM-1002", "first": "Bea", "last": "Villanueva", "email": "bea.v@gmail.com", "tier": "LOW", "days_rec": 2, "freq": 3.8, "tenure": 120, "visits_30": 15},
        {"code": "DGM-1003", "first": "Jayson", "last": "Macalalad", "email": "jayson.m@gmail.com", "tier": "LOW", "days_rec": 1, "freq": 5.0, "tenure": 240, "visits_30": 20},
        {"code": "DGM-1004", "first": "Patricia", "last": "Ilagan", "email": "patricia.i@gmail.com", "tier": "LOW", "days_rec": 3, "freq": 3.2, "tenure": 90, "visits_30": 13},
        {"code": "DGM-1005", "first": "Renz", "last": "Catapang", "email": "renz.c@gmail.com", "tier": "LOW", "days_rec": 2, "freq": 4.0, "tenure": 150, "visits_30": 16},

        # --- MEDIUM RISK (Casual / Inconsistent Lifters) ---
        {"code": "DGM-1006", "first": "Jerome", "last": "Cueto", "email": "jerome.c@gmail.com", "tier": "MEDIUM", "days_rec": 8, "freq": 1.8, "tenure": 65, "visits_30": 6},
        {"code": "DGM-1007", "first": "Maricar", "last": "Marasigan", "email": "maricar.m@gmail.com", "tier": "MEDIUM", "days_rec": 9, "freq": 1.5, "tenure": 80, "visits_30": 5},
        {"code": "DGM-1008", "first": "Aldrin", "last": "De Chavez", "email": "aldrin.dc@gmail.com", "tier": "MEDIUM", "days_rec": 10, "freq": 2.0, "tenure": 45, "visits_30": 7},
        {"code": "DGM-1009", "first": "Kristine", "last": "Perez", "email": "kristine.p@gmail.com", "tier": "MEDIUM", "days_rec": 7, "freq": 1.4, "tenure": 110, "visits_30": 5},

        # --- LOW / MEDIUM RISK (Active attendance) ---
        {"code": "DGM-1010", "first": "Eduardo", "last": "Batumbakal", "email": "eduardo.b@gmail.com", "tier": "LOW", "days_rec": 2, "freq": 3.8, "tenure": 120, "visits_30": 16},
        {"code": "DGM-1011", "first": "Camille", "last": "Bautista", "email": "camille.b@gmail.com", "tier": "MEDIUM", "days_rec": 6, "freq": 2.0, "tenure": 80, "visits_30": 8},
        {"code": "DGM-1012", "first": "Francis", "last": "Castillo", "email": "francis.c@gmail.com", "tier": "LOW", "days_rec": 3, "freq": 3.5, "tenure": 100, "visits_30": 15},
        {"code": "DGM-1013", "first": "Stephanie", "last": "Mercado", "email": "stephanie.m@gmail.com", "tier": "MEDIUM", "days_rec": 5, "freq": 2.2, "tenure": 90, "visits_30": 9},
        {"code": "DGM-1014", "first": "Danilo", "last": "Gutierrez", "email": "danilo.g@gmail.com", "tier": "LOW", "days_rec": 1, "freq": 4.1, "tenure": 110, "visits_30": 17},

        # --- THE ONLY HIGH RISK MEMBER (Dennis Verano for testing) ---
        {"code": "DGM-1015", "first": "Dennis", "last": "Verano", "email": "dennisverano258@gmail.com", "phone": "09628532768", "tier": "HIGH", "days_rec": 25, "freq": 0.2, "tenure": 85, "visits_30": 1},
    ]

    now = datetime.now(timezone.utc)

    # Fetch default membership plan
    stmt_plan = select(MembershipPlan).where(MembershipPlan.slug == "monthly")
    monthly_plan = (await session.execute(stmt_plan)).scalar_one_or_none()
    plan_id = monthly_plan.id if monthly_plan else 2

    # Check if member exists by code
    sample_codes = [item["code"] for item in sample_members_data]
    existing_codes = set(
        (await session.execute(select(Member.member_code).where(Member.member_code.in_(sample_codes)))).scalars().all()
    )

    for item in sample_members_data:
        if item["code"] not in existing_codes:
            joined_date = now - timedelta(days=item["tenure"])
            m_obj = Member(
                member_code=item["code"],
                first_name=item["first"],
                last_name=item["last"],
                email=item["email"],
                phone=f"+63 917 555 {random.randint(1000, 9999)}",
                status=MemberStatus.ACTIVE if item["tier"] != "HIGH" or item["days_rec"] < 30 else MemberStatus.EXPIRED,
                is_active=True,
                address="Rosario, Batangas",
                joined_at=joined_date,
            )
            session.add(m_obj)
            await session.flush()

            # Attach a membership
            membership = MemberMembership(
                member_id=m_obj.id,
                plan_id=plan_id,
                start_date=joined_date,
                end_date=joined_date + timedelta(days=30 if item["tier"] == "HIGH" else 90),
                status=MembershipStatus.ACTIVE if item["tier"] != "HIGH" else MembershipStatus.EXPIRED,
                paid_amount=600.00,
                payment_method=PaymentMethod.GCASH,
                payment_reference=f"GCASH-{item['code']}-REF",
            )
            session.add(membership)

            # Generate synthetic visits over past 30 days
            n_visits = item["visits_30"]
            if n_visits > 0:
                # Distribute visits
                visit_days = sorted(random.sample(range(item["days_rec"], min(30, item["tenure"])), min(n_visits, 28)))
                for d in visit_days:
                    v_time = now - timedelta(days=d, hours=random.choice([7, 8, 9, 16, 17, 18, 19]))
                    visit = Visit(
                        member_id=m_obj.id,
                        checked_in_at=v_time,
                        checked_out_at=v_time + timedelta(minutes=random.randint(45, 90)),
                        visit_type=VisitType.OPEN_GYM if random.random() > 0.3 else VisitType.CLASS,
                    )
                    session.add(visit)

                    # Also log raw transaction
                    raw_tx = RawTransaction(
                        customer_id=m_obj.id,
                        transaction_type="visit",
                        transaction_date=v_time,
                        amount=0.00,
                    )
                    session.add(raw_tx)

    await session.commit()

    # Calculate features and predictions for all members
    await refresh_all_predictions(session)
