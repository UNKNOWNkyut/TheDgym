"""
End-to-End Security & Scale Regression Suite (Steps 1–14)
Runs completely in-process against an isolated temporary SQLite database via ASGITransport
(zero network server required, zero mutation of dgym.db).

Verifies:
1. ANTIGRAV-02 (Option 1): Online /api/auth/avail-plan stays PENDING (PHP 0.00),
   is denied at both NFC keycard tap and manual check-in, and unlocks after staff activation.
2. ANTIGRAV-07 / 09 / 10: Cookie CSRF header enforcement (403 without X-Requested-With),
   GET /api/access/webhook-tap blocked (405), CSP/COOP/no-store headers, and JWT revocation on logout.
3. Step 12a / 12b: Duplicate manual check-in rejected (409), expired member check-in rejected (400),
   and 10-way concurrent class enrollment never exceeds max_capacity (3 admitted, 7 rejected, dup 409).
4. Step 6 & Step 11a/b: Single-pass /api/finance/annual matches 12 monthly /api/finance/summary totals,
   and JSON-only churn ML pipeline runs without .pkl files or pandas.
"""
import asyncio
import os
import tempfile
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path

from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.security import create_access_token, hash_password
from app.database import Base, get_db
from app.main import app
from app.models.expense import Expense
from app.models.expense_category import ExpenseCategory
from app.models.member import Member, MemberStatus
from app.models.member_membership import MemberMembership, MembershipStatus, PaymentMethod
from app.models.membership_plan import MembershipPlan
from app.models.user import User, UserRole
from app.services import churn_ml
from app.services.churn_pipeline import refresh_all_predictions


async def run_regression_suite() -> None:
    test_db_url = os.getenv("TEST_DATABASE_URL", "").strip()
    tmp_dir = None
    db_file = None
    if test_db_url:
        engine = create_async_engine(test_db_url, pool_pre_ping=True)
    else:
        tmp_dir = tempfile.mkdtemp(prefix="dgym_reg_")
        db_file = os.path.join(tmp_dir, "regression.db")
        engine = create_async_engine(f"sqlite+aiosqlite:///{db_file}", connect_args={"timeout": 30})

    async with engine.begin() as conn:
        if test_db_url:
            await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    SessionLocal = async_sessionmaker(engine, expire_on_commit=False)

    async def override_get_db():
        async with SessionLocal() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db

    try:
        today_dt = datetime.now(timezone(timedelta(hours=8)))
        async with SessionLocal() as s:
            admin = User(
                email="admin@thedgym.ph",
                hashed_password=hash_password("AdminPass123!"),
                full_name="Reg Admin",
                role=UserRole.ADMIN,
                is_active=True,
            )
            signup_user = User(
                email="pending@thedgym.ph",
                hashed_password=hash_password("MemberPass123!"),
                full_name="Pending Buyer",
                role=UserRole.MEMBER,
                is_active=True,
            )
            plan = MembershipPlan(
                name="Monthly Pass",
                slug="monthly-pass",
                price_php=Decimal("1999.00"),
                duration_days=30,
                is_active=True,
            )
            exp_member = Member(
                member_code="DGYM-REG-EXP",
                first_name="Expired",
                last_name="Member",
                email="expired@thedgym.ph",
                phone="09170000099",
                status=MemberStatus.ACTIVE,
                is_active=True,
            )
            pool_members = [
                Member(
                    member_code=f"DGYM-REG-{i:03d}",
                    first_name=f"Runner{i}",
                    last_name="Pool",
                    email=f"runner{i}@thedgym.ph",
                    phone=f"091700001{i:02d}",
                    status=MemberStatus.ACTIVE,
                    is_active=True,
                )
                for i in range(10)
            ]
            cat = ExpenseCategory(name="Utilities", description="Power & Water", is_active=True)
            s.add_all([admin, signup_user, plan, exp_member, *pool_members, cat])
            await s.flush()

            # Expired membership for manual check-in rejection test + historical 2025 revenue/expense
            s.add(
                MemberMembership(
                    member_id=exp_member.id,
                    plan_id=plan.id,
                    start_date=datetime(2025, 3, 10, 0, 0, tzinfo=timezone.utc),
                    end_date=datetime(2025, 4, 9, 0, 0, tzinfo=timezone.utc),
                    status=MembershipStatus.EXPIRED,
                    paid_amount=Decimal("1999.00"),
                    payment_method=PaymentMethod.CASH,
                    created_at=datetime(2025, 3, 10, 9, 0, tzinfo=timezone.utc),
                )
            )
            for m in pool_members:
                s.add(
                    MemberMembership(
                        member_id=m.id,
                        plan_id=plan.id,
                        start_date=today_dt - timedelta(days=5),
                        end_date=today_dt + timedelta(days=25),
                        status=MembershipStatus.ACTIVE,
                        paid_amount=Decimal("1999.00"),
                        payment_method=PaymentMethod.GCASH,
                    )
                )
            s.add(
                Expense(
                    category_id=cat.id,
                    amount=Decimal("750.50"),
                    expense_date=date(2025, 3, 15),
                    description="March electric bill",
                    recorded_by_user_id=admin.id,
                )
            )
            await s.commit()

            admin_id = admin.id
            signup_user_id = signup_user.id
            exp_member_id = exp_member.id
            pool_ids = [m.id for m in pool_members]

        admin_tok = create_access_token({"sub": str(admin_id), "role": "admin"})
        user_tok = create_access_token({"sub": str(signup_user_id), "role": "member"})
        admin_hdrs = {"Authorization": f"Bearer {admin_tok}"}
        user_hdrs = {"Authorization": f"Bearer {user_tok}"}

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            # 1. Online avail-plan creates PENDING PHP 0.00 membership
            r_avail = await ac.post(
                "/api/auth/avail-plan",
                json={"plan_slug": "monthly-pass"},
                headers=user_hdrs,
            )
            assert r_avail.status_code == 200, r_avail.text
            assert r_avail.json()["has_active_membership"] is False

            async with SessionLocal() as s:
                pending_mem = (
                    await s.execute(select(Member).where(Member.email == "pending@thedgym.ph"))
                ).scalar_one()
                pending_ms = (
                    await s.execute(
                        select(MemberMembership).where(MemberMembership.member_id == pending_mem.id)
                    )
                ).scalar_one()
                assert pending_ms.status == MembershipStatus.PENDING
                assert Decimal(str(pending_ms.paid_amount)) == Decimal("0.00")
                assert pending_ms.payment_method is None
                pending_mem_id = pending_mem.id
                pending_ms_id = pending_ms.id

            # Pair keycard to pending member, then verify BOTH NFC tap and manual visit deny entry
            r_pair = await ac.post(
                f"/api/members/{pending_mem_id}/keycards",
                json={"card_uid": "AA:BB:CC:DD", "card_label": "Pending Card"},
                headers=admin_hdrs,
            )
            assert r_pair.status_code == 201, r_pair.text

            r_tap_denied = await ac.post(
                "/api/access/tap",
                json={"card_uid": "AA:BB:CC:DD"},
                headers=admin_hdrs,
            )
            assert r_tap_denied.status_code == 200
            assert r_tap_denied.json()["decision"].startswith("denied_"), r_tap_denied.json()

            r_visit_denied = await ac.post(
                "/api/visits",
                json={"member_id": pending_mem_id, "notes": "Desk attempt while unpaid"},
                headers=admin_hdrs,
            )
            assert r_visit_denied.status_code == 400

            # Staff activates & verifies payment -> NFC tap now grants check-in
            r_activate = await ac.patch(
                f"/api/memberships/{pending_ms_id}",
                json={
                    "status": "active",
                    "paid_amount": "1999.00",
                    "payment_method": "cash",
                },
                headers=admin_hdrs,
            )
            assert r_activate.status_code == 200, r_activate.text

            r_tap_ok = await ac.post(
                "/api/access/tap",
                json={"card_uid": "AA:BB:CC:DD"},
                headers=admin_hdrs,
            )
            assert r_tap_ok.status_code == 200
            assert r_tap_ok.json()["decision"] == "granted_check_in"
            print("[PASS] 1. ANTIGRAV-02 PENDING signup gate + NFC & manual check-in enforcement verified")

            # 2. Step 12a: Duplicate active visit -> 409; Expired member -> 400
            r_dup_visit = await ac.post(
                "/api/visits",
                json={"member_id": pending_mem_id},
                headers=admin_hdrs,
            )
            assert r_dup_visit.status_code == 409

            r_exp_visit = await ac.post(
                "/api/visits",
                json={"member_id": exp_member_id},
                headers=admin_hdrs,
            )
            assert r_exp_visit.status_code == 400
            print("[PASS] 2. Step 12a duplicate check-in (409) & expired check-in (400) guards verified")

            # 10-way concurrent class enrollment on max_capacity=3 + duplicate 409
            r_cls = await ac.post(
                "/api/classes",
                json={
                    "name": "HIIT Sprint",
                    "scheduled_at": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
                    "duration_minutes": 60,
                    "max_capacity": 3,
                },
                headers=admin_hdrs,
            )
            assert r_cls.status_code == 201, r_cls.text
            cls_id = r_cls.json()["id"]

            enroll_results = await asyncio.gather(
                *[
                    ac.post(
                        f"/api/classes/{cls_id}/enroll",
                        json={"member_id": mid},
                        headers=admin_hdrs,
                    )
                    for mid in pool_ids
                ]
            )
            codes = [r.status_code for r in enroll_results]
            assert codes.count(201) == 3, f"Expected 3 enrollments, got {codes}"
            assert codes.count(400) == 7, f"Expected 7 capacity rejections, got {codes}"

            admitted_mid = pool_ids[codes.index(201)]
            r_dup_enroll = await ac.post(
                f"/api/classes/{cls_id}/enroll",
                json={"member_id": admitted_mid},
                headers=admin_hdrs,
            )
            assert r_dup_enroll.status_code == 409

            # 4. ANTIGRAV-07 / 09 / 10: GET webhook-tap 405, Cookie CSRF 403, Security headers, Logout JTI revoke
            r_get_webhook = await ac.get("/api/access/webhook-tap?uid=AA:BB:CC:DD")
            assert r_get_webhook.status_code == 405

            ac.cookies.set("access_token", user_tok)
            r_csrf_block = await ac.post("/api/auth/logout")
            assert r_csrf_block.status_code == 403

            r_logout_ok = await ac.post(
                "/api/auth/logout",
                headers={"X-Requested-With": "XMLHttpRequest"},
            )
            assert r_logout_ok.status_code == 200
            assert "no-store" in r_logout_ok.headers.get("cache-control", "")
            assert "default-src" in r_logout_ok.headers.get("content-security-policy", "")
            assert r_logout_ok.headers.get("cross-origin-opener-policy") == "same-origin-allow-popups"
            ac.cookies.clear()

            r_revoked = await ac.get("/api/auth/me", headers=user_hdrs)
            assert r_revoked.status_code == 401
            print("[PASS] 4. ANTIGRAV-07/09/10 CSRF 403, GET webhook 405, headers, and JTI logout revocation verified")

            # 5. Step 6: Single-pass annual finance parity vs 12 monthly summaries
            r_annual = await ac.get("/api/finance/annual?year=2025", headers=admin_hdrs)
            assert r_annual.status_code == 200
            annual_pts = r_annual.json()
            assert len(annual_pts) == 12
            for pt in annual_pts:
                m_idx = pt["month"]
                r_m = await ac.get(f"/api/finance/summary?year=2025&month={m_idx}", headers=admin_hdrs)
                assert r_m.status_code == 200
                msum = r_m.json()
                assert Decimal(str(pt["revenue"])) == Decimal(str(msum["membership_revenue"]))
                assert Decimal(str(pt["expenses"])) == Decimal(str(msum["total_expenses"]))
                assert Decimal(str(pt["net_income"])) == Decimal(str(msum["profit"]))
            assert Decimal(str(annual_pts[2]["revenue"])) == Decimal("1999.00")
            assert Decimal(str(annual_pts[2]["expenses"])) == Decimal("750.50")
            print("[PASS] 5. Step 6 single-pass annual finance breakdown 12/12 month parity verified")

        # 6. Step 11a / 11b: JSON-only ML artifacts + batch churn refresh
        ml_dir = Path(churn_ml.__file__).resolve().parent.parent / "ml"
        assert not list(ml_dir.glob("*.pkl")), "Unsafe .pkl artifacts must not exist"
        assert (ml_dir / "churn_model.json").exists() and (ml_dir / "scaler.json").exists()
        async with SessionLocal() as s:
            updated = await refresh_all_predictions(s)
            assert updated == 12
        print("[PASS] 6. Step 11a/11b JSON-only XGBoost artifacts & batch churn pipeline verified")

        print("\n=== ALL 6 END-TO-END SECURITY & SCALE REGRESSION SUITES PASSED ===")
    finally:
        app.dependency_overrides.clear()
        if test_db_url:
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.drop_all)
        await engine.dispose()
        if db_file:
            for ext in ("", "-wal", "-shm"):
                p = db_file + ext
                if os.path.exists(p):
                    try:
                        os.remove(p)
                    except OSError:
                        pass
        if tmp_dir:
            try:
                os.rmdir(tmp_dir)
            except OSError:
                pass


if __name__ == "__main__":
    asyncio.run(run_regression_suite())
