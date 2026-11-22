"""
TDD Verification Suite for Finance Retention, Daily Pass Separation, Role Promotion/Cleanup,
User Deletion, and Trainer Visits RBAC.
Runs completely in-process against an isolated temporary SQLite DB via ASGITransport.
"""
import asyncio
import os
import shutil
import tempfile
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.rate_limit import reset_rate_limit_state
from app.core.security import create_access_token, hash_password
from app.database import Base, get_db
from app.main import app
from app.models.expense import Expense
from app.models.expense_category import ExpenseCategory
from app.models.member import Member, MemberStatus
from app.models.member_membership import MemberMembership, MembershipStatus, PaymentMethod
from app.models.membership_plan import MembershipPlan
from app.models.user import User, UserRole
from app.models.visit import Visit, VisitType
from app.services.overview_kpis import MANILA_TZ
from app.services.pagination import read_page_cache


async def _run_suite() -> None:
    tmp_dir = tempfile.mkdtemp(prefix="dgym_fin_roles_")
    db_file = os.path.join(tmp_dir, "test.db")
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_file}", connect_args={"timeout": 30})
    SessionLocal = async_sessionmaker(engine, expire_on_commit=False)

    async def override_get_db():
        async with SessionLocal() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    read_page_cache.clear()

    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        manila_now = datetime.now(MANILA_TZ)
        now_utc = manila_now.astimezone(timezone.utc)
        yr, mo = manila_now.year, manila_now.month

        async with SessionLocal() as db:
            admin = User(
                email="fin_admin@thedgym.ph",
                hashed_password=hash_password("AdminPass123!"),
                full_name="Finance Admin",
                role=UserRole.ADMIN,
                is_active=True,
            )
            user1 = User(
                email="payer1@thedgym.ph",
                hashed_password=hash_password("MemberPass123!"),
                full_name="Payer One",
                phone="09171110001",
                role=UserRole.MEMBER,
                is_active=True,
            )
            user2 = User(
                email="payer2@thedgym.ph",
                hashed_password=hash_password("MemberPass123!"),
                full_name="Payer Two",
                phone="09171110002",
                role=UserRole.MEMBER,
                is_active=True,
            )
            promo_user = User(
                email="promo_user@thedgym.ph",
                hashed_password=hash_password("UserPass123!"),
                full_name="Promo Candidate",
                phone="09171110003",
                role=UserRole.USER,
                is_active=True,
            )
            day_user = User(
                email="daypass_user@thedgym.ph",
                hashed_password=hash_password("UserPass123!"),
                full_name="Daypass Guest",
                phone="09171110004",
                role=UserRole.USER,
                is_active=True,
            )
            trainer_user = User(
                email="coach_test@thedgym.ph",
                hashed_password=hash_password("TrainerPass123!"),
                full_name="Coach Test",
                role=UserRole.TRAINER,
                is_active=True,
            )
            cat = ExpenseCategory(name="Operations", description="Gym utilities", is_active=True)
            day_plan = MembershipPlan(
                name="Day Pass",
                slug="day-pass",
                price_php=Decimal("400.00"),
                duration_days=1,
                is_active=True,
            )
            monthly_plan = MembershipPlan(
                name="Monthly Membership",
                slug="monthly",
                price_php=Decimal("1999.00"),
                duration_days=30,
                is_active=True,
            )
            db.add_all([admin, user1, user2, promo_user, day_user, trainer_user, cat, day_plan, monthly_plan])
            await db.flush()

            member1 = Member(
                member_code="DGYM-FIN-001",
                first_name="Payer",
                last_name="One",
                email=user1.email,
                phone="09171110001",
                status=MemberStatus.ACTIVE,
                is_active=True,
                joined_at=now_utc,
            )
            member2 = Member(
                member_code="DGYM-FIN-002",
                first_name="Payer",
                last_name="Two",
                email=user2.email,
                phone="09171110002",
                status=MemberStatus.ACTIVE,
                is_active=True,
                joined_at=now_utc,
            )
            day_member = Member(
                member_code="DGYM-DAY-001",
                first_name="Daypass",
                last_name="Guest",
                email=day_user.email,
                phone="09171110004",
                status=MemberStatus.INACTIVE,
                is_active=True,
                joined_at=now_utc,
            )
            keep_member = Member(
                member_code="DGYM-KEEP-001",
                first_name="Active",
                last_name="Keeper",
                email="keeper@thedgym.ph",
                phone="09171110009",
                status=MemberStatus.ACTIVE,
                is_active=True,
                joined_at=now_utc,
            )
            db.add_all([member1, member2, day_member, keep_member])
            await db.flush()

            # Two P400 payments for member1 (total P800) + P200 expense
            db.add_all([
                MemberMembership(
                    member_id=member1.id,
                    plan_id=day_plan.id,
                    start_date=now_utc - timedelta(days=2),
                    end_date=now_utc - timedelta(days=1),
                    status=MembershipStatus.EXPIRED,
                    paid_amount=Decimal("400.00"),
                    payment_method=PaymentMethod.CASH,
                ),
                MemberMembership(
                    member_id=member1.id,
                    plan_id=day_plan.id,
                    start_date=now_utc,
                    end_date=now_utc + timedelta(days=1),
                    status=MembershipStatus.ACTIVE,
                    paid_amount=Decimal("400.00"),
                    payment_method=PaymentMethod.GCASH,
                ),
                Expense(
                    category_id=cat.id,
                    amount=Decimal("200.00"),
                    expense_date=manila_now.date(),
                    description="Cleaning supplies",
                    recorded_by_user_id=admin.id,
                    is_archived=False,
                ),
                Visit(
                    member_id=keep_member.id,
                    visit_type=VisitType.OPEN_GYM,
                    checked_in_at=now_utc - timedelta(minutes=15),
                    recorded_by_user_id=admin.id,
                ),
            ])
            await db.commit()

            admin_id = admin.id
            user2_id = user2.id
            member1_id, member2_id, day_member_id, keep_member_id = (
                member1.id, member2.id, day_member.id, keep_member.id,
            )
            promo_user_id, day_user_id, trainer_id = promo_user.id, day_user.id, trainer_user.id
            day_plan_id, monthly_plan_id = day_plan.id, monthly_plan.id

        admin_hdrs = {
            "Authorization": f"Bearer {create_access_token({'sub': str(admin_id), 'role': 'admin'})}",
            "X-Requested-With": "XMLHttpRequest",
        }
        trainer_hdrs = {
            "Authorization": f"Bearer {create_access_token({'sub': str(trainer_id), 'role': 'trainer'})}",
            "X-Requested-With": "XMLHttpRequest",
        }

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            async def _clear_limits():
                async with SessionLocal() as rl_s:
                    await reset_rate_limit_state(rl_s)

            # SUITE 1: Permanent member delete must NOT wipe Finance revenue
            s_before = (await ac.get(f"/api/finance/summary?year={yr}&month={mo}", headers=admin_hdrs)).json()
            assert Decimal(str(s_before["membership_revenue"])) == Decimal("800.00")
            assert Decimal(str(s_before["profit"])) == Decimal("600.00")

            await _clear_limits()
            r_del_m = await ac.delete(f"/api/members/{member1_id}/permanent", headers=admin_hdrs)
            assert r_del_m.status_code == 204, r_del_m.text

            s_after_m = (await ac.get(f"/api/finance/summary?year={yr}&month={mo}", headers=admin_hdrs)).json()
            assert Decimal(str(s_after_m["membership_revenue"])) == Decimal("800.00"), (
                f"Member delete wiped revenue: {s_after_m}"
            )
            assert Decimal(str(s_after_m["profit"])) == Decimal("600.00")

            ann_after_m = (await ac.get(f"/api/finance/annual?year={yr}", headers=admin_hdrs)).json()
            mo_pt = next(p for p in ann_after_m if p["month"] == mo)
            assert Decimal(str(mo_pt["revenue"])) == Decimal("800.00")
            assert Decimal(str(mo_pt["net_income"])) == Decimal("600.00")

            kpi_after_m = (await ac.get("/api/members/stats", headers=admin_hdrs)).json()
            assert Decimal(kpi_after_m["monthly_income"]) == Decimal("800.00")
            m_list_1 = (await ac.get("/api/members", headers=admin_hdrs)).json()
            assert all(m["id"] != member1_id for m in m_list_1)
            print("[PASS] 1. Member permanent delete preserves Finance & Annual revenue")

            # SUITE 2: User delete cleans up linked member, preserves revenue, blocks self-delete
            async with SessionLocal() as db:
                db.add(
                    MemberMembership(
                        member_id=member2_id,
                        plan_id=day_plan_id,
                        start_date=now_utc,
                        end_date=now_utc + timedelta(days=1),
                        status=MembershipStatus.ACTIVE,
                        paid_amount=Decimal("800.00"),
                        payment_method=PaymentMethod.CASH,
                    )
                )
                await db.commit()

            await _clear_limits()
            r_self_del = await ac.delete(f"/api/users/{admin_id}", headers=admin_hdrs)
            assert r_self_del.status_code == 400

            r_del_u = await ac.delete(f"/api/users/{user2_id}", headers=admin_hdrs)
            assert r_del_u.status_code == 204, r_del_u.text

            s_after_u = (await ac.get(f"/api/finance/summary?year={yr}&month={mo}", headers=admin_hdrs)).json()
            assert Decimal(str(s_after_u["membership_revenue"])) == Decimal("1600.00"), (
                f"User delete failed to preserve P800 payment: {s_after_u}"
            )
            assert Decimal(str(s_after_u["profit"])) == Decimal("1400.00")
            m_list_2 = (await ac.get("/api/members", headers=admin_hdrs)).json()
            assert all(m["id"] != member2_id for m in m_list_2), "Linked member should be deleted on user delete"
            print("[PASS] 2. User delete blocks self-delete, removes member profile, preserves revenue")

            # SUITE 3: USER -> MEMBER promotion requires non-Day-Pass plan; MEMBER -> TRAINER cleans Member
            await _clear_limits()
            r_no_plan = await ac.patch(f"/api/users/{promo_user_id}", headers=admin_hdrs, json={"role": "member"})
            assert r_no_plan.status_code == 400, f"Expected 400 without plan_id, got {r_no_plan.status_code}"

            r_day_plan = await ac.patch(
                f"/api/users/{promo_user_id}",
                headers=admin_hdrs,
                json={"role": "member", "plan_id": day_plan_id},
            )
            assert r_day_plan.status_code == 400, f"Expected 400 for Day Pass promotion, got {r_day_plan.status_code}"

            r_promo = await ac.patch(
                f"/api/users/{promo_user_id}",
                headers=admin_hdrs,
                json={"role": "member", "plan_id": monthly_plan_id},
            )
            assert r_promo.status_code == 200, r_promo.text
            assert r_promo.json()["role"] == "member"

            m_list_3 = (await ac.get("/api/members", headers=admin_hdrs)).json()
            assert any(m["email"] == "promo_user@thedgym.ph" for m in m_list_3)
            s_after_promo = (await ac.get(f"/api/finance/summary?year={yr}&month={mo}", headers=admin_hdrs)).json()
            assert Decimal(str(s_after_promo["membership_revenue"])) == Decimal("3599.00")

            # Demote/reassign to Trainer -> remove stale Member row, keep revenue
            r_to_trainer = await ac.patch(
                f"/api/users/{promo_user_id}",
                headers=admin_hdrs,
                json={"role": "trainer"},
            )
            assert r_to_trainer.status_code == 200, r_to_trainer.text
            assert r_to_trainer.json()["role"] == "trainer"
            m_list_after_tr = (await ac.get("/api/members", headers=admin_hdrs)).json()
            assert all(m["email"] != "promo_user@thedgym.ph" for m in m_list_after_tr), (
                "Stale Member profile still shown after role changed to trainer"
            )
            s_after_tr = (await ac.get(f"/api/finance/summary?year={yr}&month={mo}", headers=admin_hdrs)).json()
            assert Decimal(str(s_after_tr["membership_revenue"])) == Decimal("3599.00")
            print("[PASS] 3. Role promotion w/ non-Day-Pass plan & Trainer cleanup verified")

            # SUITE 4: Daily Pass users stay USER role & stay hidden from /api/members + member count KPIs
            kpi_before_dp = (await ac.get("/api/members/stats", headers=admin_hdrs)).json()
            r_dp_assign = await ac.post(
                "/api/memberships",
                headers=admin_hdrs,
                json={
                    "member_id": day_member_id,
                    "plan_id": day_plan_id,
                    "start_date": now_utc.isoformat(),
                    "paid_amount": 400.0,
                    "payment_method": "cash",
                },
            )
            assert r_dp_assign.status_code == 201, r_dp_assign.text

            async with SessionLocal() as db:
                dp_u = await db.get(User, day_user_id)
                assert dp_u.role == UserRole.USER, f"Day Pass promoted user role to {dp_u.role}"

            m_list_4 = (await ac.get("/api/members", headers=admin_hdrs)).json()
            assert all(m["email"] != "daypass_user@thedgym.ph" for m in m_list_4), (
                "Day Pass user appeared in /api/members"
            )
            kpi_after_dp = (await ac.get("/api/members/stats", headers=admin_hdrs)).json()
            assert kpi_after_dp["active"] == kpi_before_dp["active"], (
                f"Day Pass inflated active member count: {kpi_before_dp['active']} -> {kpi_after_dp['active']}"
            )
            s_after_dp = (await ac.get(f"/api/finance/summary?year={yr}&month={mo}", headers=admin_hdrs)).json()
            assert Decimal(str(s_after_dp["membership_revenue"])) == Decimal("3999.00")
            print("[PASS] 4. Daily Pass keeps USER role, excluded from /api/members & KPIs, revenue counted")

            # SUITE 5: Trainer blocked from /api/visits endpoints
            v_list = (await ac.get("/api/visits", headers=admin_hdrs))
            assert v_list.status_code == 200
            visit_id = v_list.json()[0]["id"]

            assert (await ac.get("/api/visits", headers=trainer_hdrs)).status_code == 403
            assert (
                await ac.post("/api/visits", headers=trainer_hdrs, json={"member_id": keep_member_id})
            ).status_code == 403
            assert (
                await ac.patch(f"/api/visits/{visit_id}/checkout", headers=trainer_hdrs, json={})
            ).status_code == 403
            assert (
                await ac.get(f"/api/visits/member/{keep_member_id}", headers=trainer_hdrs)
            ).status_code == 403
            print("[PASS] 5. Trainer RBAC blocked on all /api/visits endpoints (403)")

        print("\n=== ALL 5 FINANCE, DAILY-PASS, USER-MANAGEMENT & VISITS RBAC SUITES PASSED ===")
    finally:
        app.dependency_overrides.clear()
        read_page_cache.clear()
        await engine.dispose()
        shutil.rmtree(tmp_dir, ignore_errors=True)


if __name__ == "__main__":
    asyncio.run(_run_suite())
