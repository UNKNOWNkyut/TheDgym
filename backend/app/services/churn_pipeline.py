import random
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.member import Member, MemberStatus, Gender
from app.models.visit import Visit, VisitType
from app.models.member_membership import MemberMembership, MembershipStatus, PaymentMethod
from app.models.membership_plan import MembershipPlan
from app.models.class_session import ClassSession, ClassEnrollment
from app.models.pt_session import PTSession
from app.models.processed_customer import ProcessedCustomer
from app.models.prediction import Prediction
from app.models.raw_transaction import RawTransaction
from app.services.churn_ml import predict_churn, train_baseline_model


async def compute_member_features(session: AsyncSession, member_id: int) -> Dict[str, float]:
    """
    Computes real-time behavioral features for a specific member by aggregating
    their visits, subscriptions, and class attendance.
    """
    now = datetime.now(timezone.utc)

    # 1. Member profile & tenure
    stmt_member = select(Member).where(Member.id == member_id)
    member = (await session.execute(stmt_member)).scalar_one_or_none()
    if not member:
        return {}

    # Handle joined_at offset-naive vs aware
    joined = member.joined_at
    if joined.tzinfo is None:
        joined = joined.replace(tzinfo=timezone.utc)
    tenure_days = max(1, (now - joined).days)

    # 2. Visits aggregation
    stmt_visits = select(Visit).where(Visit.member_id == member_id).order_by(Visit.checked_in_at.desc())
    visits = (await session.execute(stmt_visits)).scalars().all()

    total_visits = len(visits)
    if visits:
        last_visit_time = visits[0].checked_in_at
        if last_visit_time.tzinfo is None:
            last_visit_time = last_visit_time.replace(tzinfo=timezone.utc)
        days_since_last_checkin = max(0, (now - last_visit_time).days)
    else:
        days_since_last_checkin = min(tenure_days, 60)

    # Visits in last 30 days & 14 days
    date_30d_ago = now - timedelta(days=30)
    date_14d_ago = now - timedelta(days=14)
    date_28d_ago = now - timedelta(days=28)

    visits_last_30d = 0
    visits_last_14d = 0
    visits_prev_14d = 0

    for v in visits:
        v_time = v.checked_in_at
        if v_time.tzinfo is None:
            v_time = v_time.replace(tzinfo=timezone.utc)

        if v_time >= date_30d_ago:
            visits_last_30d += 1
        if v_time >= date_14d_ago:
            visits_last_14d += 1
        elif v_time >= date_28d_ago:
            visits_prev_14d += 1

    visit_frequency_weekly = round((visits_last_30d / 30.0) * 7.0, 2)

    # Recent activity momentum: ratio of recent 14d vs prior 14d
    if visits_prev_14d > 0:
        recent_activity_score = min(1.0, round(visits_last_14d / visits_prev_14d, 2))
    elif visits_last_14d > 0:
        recent_activity_score = 0.85
    else:
        recent_activity_score = 0.05

    # 3. Class enrollments count
    stmt_classes = select(func.count(ClassEnrollment.id)).where(ClassEnrollment.member_id == member_id)
    total_class_bookings = (await session.execute(stmt_classes)).scalar() or 0

    # 4. PT sessions count
    stmt_pt = select(func.count(PTSession.id)).where(PTSession.member_id == member_id)
    total_pt_sessions = (await session.execute(stmt_pt)).scalar() or 0

    # 5. Total revenue lifetime
    stmt_rev = select(func.coalesce(func.sum(MemberMembership.paid_amount), 0)).where(
        MemberMembership.member_id == member_id
    )
    total_revenue_lifetime = float((await session.execute(stmt_rev)).scalar() or 0.0)

    return {
        "visit_frequency_weekly": float(visit_frequency_weekly),
        "days_since_last_checkin": int(days_since_last_checkin),
        "total_visits_30d": int(visits_last_30d),
        "total_class_bookings": int(total_class_bookings),
        "total_pt_sessions": int(total_pt_sessions),
        "membership_tenure_days": int(tenure_days),
        "total_revenue_lifetime": float(total_revenue_lifetime),
        "recent_activity_score": float(recent_activity_score),
    }


async def refresh_member_churn_prediction(session: AsyncSession, member_id: int) -> Optional[Prediction]:
    """
    Computes features, updates processed_customers, runs XGBoost model,
    and upserts prediction record for a member.
    """
    features = await compute_member_features(session, member_id)
    if not features:
        return None

    # Upsert into processed_customers
    stmt_feat = select(ProcessedCustomer).where(ProcessedCustomer.customer_id == member_id)
    proc_cust = (await session.execute(stmt_feat)).scalar_one_or_none()

    now = datetime.now(timezone.utc)
    if not proc_cust:
        proc_cust = ProcessedCustomer(customer_id=member_id)
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

    # Run XGBoost inference
    pred_result = predict_churn(features)

    # Upsert into predictions
    stmt_pred = select(Prediction).where(Prediction.customer_id == member_id)
    pred_obj = (await session.execute(stmt_pred)).scalar_one_or_none()

    if not pred_obj:
        pred_obj = Prediction(customer_id=member_id)
        session.add(pred_obj)

    pred_obj.churn_probability = pred_result["churn_probability"]
    pred_obj.risk_tier = pred_result["risk_tier"]
    factors = pred_result["top_risk_factors"]
    pred_obj.top_risk_factor_1 = factors[0] if len(factors) > 0 else None
    pred_obj.top_risk_factor_2 = factors[1] if len(factors) > 1 else None
    pred_obj.top_risk_factor_3 = factors[2] if len(factors) > 2 else None
    pred_obj.model_version = pred_result["model_version"]
    pred_obj.predicted_at = now

    await session.commit()
    await session.refresh(pred_obj)
    return pred_obj


async def refresh_all_predictions(session: AsyncSession) -> int:
    """
    Refreshes churn predictions for all existing gym members.
    """
    stmt = select(Member.id)
    member_ids = (await session.execute(stmt)).scalars().all()
    count = 0
    for mid in member_ids:
        await refresh_member_churn_prediction(session, mid)
        count += 1
    return count


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
    train_baseline_model(save=True)

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

        # --- HIGH RISK (Fading / Dropped Out Lifters: High recency, steep drops) ---
        {"code": "DGM-1010", "first": "Eduardo", "last": "Batumbakal", "email": "eduardo.b@gmail.com", "tier": "HIGH", "days_rec": 22, "freq": 0.3, "tenure": 70, "visits_30": 1},
        {"code": "DGM-1011", "first": "Camille", "last": "Bautista", "email": "camille.b@gmail.com", "tier": "HIGH", "days_rec": 28, "freq": 0.2, "tenure": 50, "visits_30": 1},
        {"code": "DGM-1012", "first": "Francis", "last": "Castillo", "email": "francis.c@gmail.com", "tier": "HIGH", "days_rec": 34, "freq": 0.0, "tenure": 100, "visits_30": 0},
        {"code": "DGM-1013", "first": "Stephanie", "last": "Mercado", "email": "stephanie.m@gmail.com", "tier": "HIGH", "days_rec": 19, "freq": 0.5, "tenure": 40, "visits_30": 2},
        {"code": "DGM-1014", "first": "Danilo", "last": "Gutierrez", "email": "danilo.g@gmail.com", "tier": "HIGH", "days_rec": 25, "freq": 0.2, "tenure": 85, "visits_30": 1},
    ]

    now = datetime.now(timezone.utc)

    # Fetch default membership plan
    stmt_plan = select(MembershipPlan).where(MembershipPlan.slug == "monthly")
    monthly_plan = (await session.execute(stmt_plan)).scalar_one_or_none()
    plan_id = monthly_plan.id if monthly_plan else 2

    for item in sample_members_data:
        # Check if member exists by code
        stmt_m = select(Member).where(Member.member_code == item["code"])
        m_obj = (await session.execute(stmt_m)).scalar_one_or_none()
        if not m_obj:
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
