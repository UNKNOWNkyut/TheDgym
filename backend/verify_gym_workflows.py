"""
Phase 9 Master QA & End-to-End Integration Suite for The DGym Rosario, Batangas.

Verifies in an isolated async SQLite database (zero side effects on dgym.db):
1. Idempotent client questionnaire seeders (7 plans, 3 coaches, 6:00 PM TABATA & HIIT, NFC keycards).
2. All 7 official membership rates & all 6 verified payment methods end-to-end.
3. Official coaches (Ivan, Marta, Kresler), 90-min Boxing PT booking + approval, and 6:00 PM class enrollment.
4. All 9 core business KPIs (profit & loss scenarios), centavo-for-centavo `/api/finance/summary` parity, and RBAC redaction.
5. All 6 NFC Smart Keycard tap verification flows + real-time WebSocket live-feed broadcasts & security audit trails.
6. Frontend source-of-truth constants & zero leftover `[PLACEHOLDER]` markers across Phase 9 public/portal pages.
"""

import asyncio
import os
import tempfile
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path

from httpx import ASGITransport, AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

import app.models  # noqa: F401 — ensure all declarative models are registered
from app.core.security import create_access_token
from app.database import Base, get_db
from app.main import app
from app.models.audit_log import AuditLog
from app.models.class_session import ClassSession, ClassStatus
from app.models.expense import Expense
from app.models.expense_category import ExpenseCategory
from app.models.member import Member, MemberStatus
from app.models.member_keycard import KeycardStatus, MemberKeycard, hash_card_uid, mask_card_uid
from app.models.member_membership import MemberMembership, MembershipStatus, PaymentMethod
from app.models.membership_plan import MembershipPlan
from app.models.user import User, UserRole
from app.models.visit import Visit
from app.init_users import seed_users
from app.init_keycards import seed_keycards
from app.init_training import seed_phase5
from app.init_plans import seed_plans
from app.services.access_service import live_feed_manager, runtime_state
from app.services.overview_kpis import get_manila_now

EXPECTED_PLANS = {
    "day-pass": Decimal("400.00"),
    "monthly": Decimal("1999.00"),
    "student-monthly": Decimal("1500.00"),
    "senior-pwd-monthly": Decimal("1500.00"),
    "quarterly": Decimal("5400.00"),
    "six-month": Decimal("8000.00"),
    "annual": Decimal("13000.00"),
}

OFFICIAL_PAYMENT_METHODS = [
    "cash",
    "gcash",
    "bank_transfer",
    "qr_payment",
    "credit_card",
    "debit_card",
]


class _WsRecorder:
    def __init__(self) -> None:
        self.events: list[dict] = []

    async def accept(self) -> None:
        pass

    async def send_json(self, message: dict) -> None:
        self.events.append(message)


def verify_frontend_constants_and_placeholders() -> None:
    repo_root = Path(__file__).resolve().parent.parent
    fe_src = repo_root / "frontend" / "src"

    gym_info = (fe_src / "constants" / "gymInfo.ts").read_text(encoding="utf-8")
    for expected in (
        "Carandang St., Brgy. Namuco, Rosario, Batangas",
        "0969 483 9896",
        "tdgymcustomerservice.825@gmail.com",
        "6:00 AM",
        "11:00 PM",
        "2:00 PM",
        "10:00 PM",
    ):
        assert expected in gym_info, f"Missing '{expected}' in gymInfo.ts"

    coaches_ts = (fe_src / "constants" / "coaches.ts").read_text(encoding="utf-8")
    for coach in ("Coach Ivan", "Coach Marta", "Coach Kresler", "TABATA", "HIIT", "8,000", "4,000"):
        assert coach in coaches_ts, f"Missing '{coach}' in coaches.ts"

    checked_pages = [
        "pages/ContactPage.tsx",
        "pages/AboutPage.tsx",
        "pages/FAQPage.tsx",
        "pages/TermsOfUsePage.tsx",
        "pages/PrivacyPolicyPage.tsx",
        "pages/MembershipPage.tsx",
        "pages/TrainersPage.tsx",
        "pages/ClassesPage.tsx",
        "components/layout/Footer.tsx",
        "components/manage/OverviewKpiGrid.tsx",
    ]
    for rel in checked_pages:
        content = (fe_src / rel).read_text(encoding="utf-8")
        assert "[PLACEHOLDER]" not in content, f"Leftover [PLACEHOLDER] found in {rel}"


async def run_phase9_suite() -> None:
    test_db_url = os.getenv("TEST_DATABASE_URL", "").strip()
    db_file = None
    if test_db_url:
        engine = create_async_engine(test_db_url, echo=False, pool_pre_ping=True)
    else:
        fd, db_file = tempfile.mkstemp(suffix="_phase9_qa.db")
        os.close(fd)
        engine = create_async_engine(f"sqlite+aiosqlite:///{db_file}", echo=False)
    SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async def override_get_db():
        async with SessionLocal() as session:
            yield session

    ws_recorder = _WsRecorder()
    await live_feed_manager.connect(ws_recorder)
    runtime_state.clear_pairing()

    try:
        async with engine.begin() as conn:
            if test_db_url:
                await conn.run_sync(Base.metadata.drop_all)
            await conn.run_sync(Base.metadata.create_all)

        # Suite 1: Double-run Seeder Idempotency
        for _ in range(2):
            async with SessionLocal() as db:
                await seed_users(db)
                await seed_plans(db)
                await seed_phase5(db)
                await seed_keycards(db)

        async with SessionLocal() as db:
            plans = (
                await db.execute(select(MembershipPlan).where(MembershipPlan.is_active.is_(True)))
            ).scalars().all()
            plan_map = {p.slug: Decimal(str(p.price_php)) for p in plans}
            assert plan_map == EXPECTED_PLANS, f"Plan mismatch: {plan_map}"

            trainers = (
                await db.execute(
                    select(User)
                    .where(User.role == UserRole.TRAINER, User.is_active.is_(True))
                    .order_by(User.full_name)
                )
            ).scalars().all()
            assert [t.full_name for t in trainers] == [
                "Coach Ivan",
                "Coach Kresler",
                "Coach Marta",
            ]

            sched_classes = (
                await db.execute(
                    select(ClassSession).where(ClassSession.status == ClassStatus.SCHEDULED)
                )
            ).scalars().all()
            assert len(sched_classes) == 2
            assert {c.class_type.value for c in sched_classes} == {"tabata", "hiit"}
            assert all(c.scheduled_at.hour == 10 for c in sched_classes)  # 18:00 Asia/Manila

            admin = (await db.execute(select(User).where(User.email == "admin@thedgym.com"))).scalar_one()
            kresler = next(t for t in trainers if t.full_name == "Coach Kresler")
            marta = next(t for t in trainers if t.full_name == "Coach Marta")
            member_user = (
                await db.execute(select(User).where(User.email == "member@thedgym.com"))
            ).scalar_one()
            tabata_id = next(c.id for c in sched_classes if c.class_type.value == "tabata")

            admin_tok = create_access_token({"sub": str(admin.id), "role": admin.role.value})
            kresler_tok = create_access_token({"sub": str(kresler.id), "role": kresler.role.value})
            marta_tok = create_access_token({"sub": str(marta.id), "role": marta.role.value})
            member_tok = create_access_token({"sub": str(member_user.id), "role": member_user.role.value})
            kresler_id = kresler.id

        print("[PASS] 1. Client questionnaire seeders (7 plans, 3 coaches, 6PM TABATA/HIIT) idempotent")

        app.dependency_overrides[get_db] = override_get_db
        admin_hdrs = {"Authorization": f"Bearer {admin_tok}", "X-Requested-With": "XMLHttpRequest"}
        kresler_hdrs = {"Authorization": f"Bearer {kresler_tok}", "X-Requested-With": "XMLHttpRequest"}
        marta_hdrs = {"Authorization": f"Bearer {marta_tok}", "X-Requested-With": "XMLHttpRequest"}
        member_hdrs = {"Authorization": f"Bearer {member_tok}", "X-Requested-With": "XMLHttpRequest"}

        manila_now = get_manila_now()
        now_utc = manila_now.astimezone(timezone.utc)
        yr, mo = manila_now.year, manila_now.month
        today_manila = manila_now.date()

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            # Suite 2: All 7 Plans & All 6 Official Payment Methods
            r_plans = await ac.get("/api/plans")
            assert r_plans.status_code == 200
            api_plans = r_plans.json()
            assert len(api_plans) == 7

            created_member_ids: list[int] = []
            for idx, pm in enumerate(OFFICIAL_PAYMENT_METHODS):
                r_mem = await ac.post(
                    "/api/members",
                    headers=admin_hdrs,
                    json={
                        "first_name": f"Lifter{idx + 1}",
                        "last_name": "Rosario",
                        "email": f"lifter{idx + 1}@thedgym.ph",
                        "phone": f"0969483000{idx}",
                    },
                )
                assert r_mem.status_code == 201, r_mem.text
                m_id = r_mem.json()["id"]
                created_member_ids.append(m_id)

                target_plan = api_plans[idx % len(api_plans)]
                r_assign = await ac.post(
                    "/api/memberships",
                    headers=admin_hdrs,
                    json={
                        "member_id": m_id,
                        "plan_id": target_plan["id"],
                        "start_date": now_utc.isoformat(),
                        "payment_method": pm,
                        "payment_reference": f"REF-{pm.upper()}-{idx + 1}",
                    },
                )
                assert r_assign.status_code == 201, r_assign.text
                assert r_assign.json()["payment_method"] == pm

            print("[PASS] 2. All 7 official membership rates & 6 payment methods verified E2E")

            # Suite 3: Coaches, 90m Boxing PT Package & 6PM Class Enrollment
            r_tr = await ac.get("/api/pt-sessions/trainers", headers=member_hdrs)
            assert r_tr.status_code == 200
            tr_list = r_tr.json()
            assert [t["full_name"] for t in tr_list] == ["Coach Ivan", "Coach Kresler", "Coach Marta"]

            pt_dt = (now_utc + timedelta(days=3)).replace(hour=9, minute=0, second=0, microsecond=0)
            r_book = await ac.post(
                "/api/pt-sessions/book",
                headers=member_hdrs,
                json={
                    "trainer_id": kresler_id,
                    "scheduled_at": pt_dt.isoformat(),
                    "duration_minutes": 90,
                    "notes": "[12 Sessions — Boxing (1.5 HR) (₱8,000)] Mitt work & conditioning",
                },
            )
            assert r_book.status_code in (200, 201), r_book.text
            pt_id = r_book.json()["id"]
            booked_member_id = r_book.json()["member_id"]

            r_approve = await ac.patch(f"/api/pt-sessions/{pt_id}/approve", headers=kresler_hdrs, json={})
            assert r_approve.status_code == 200 and r_approve.json()["status"] == "confirmed"

            r_enroll = await ac.post(
                f"/api/classes/{tabata_id}/enroll",
                headers=marta_hdrs,
                json={"member_id": booked_member_id, "notes": "6:00 PM TABATA included w/ plan"},
            )
            assert r_enroll.status_code == 201, r_enroll.text
            r_tabata = await ac.get(f"/api/classes/{tabata_id}", headers=marta_hdrs)
            assert r_tabata.json()["enrolled_count"] == 1

            print("[PASS] 3. Coaches, 90-min Boxing PT booking/approval, and 6PM TABATA enrollment verified")

            # Suite 4: The 9 Core Business KPIs & Finance Summary Parity
            # Add a renewal (2nd paid plan for created_member_ids[0] expiring in 4 days -> upcoming_expirations_7d)
            monthly_plan = next(p for p in api_plans if p["slug"] == "monthly")
            async with SessionLocal() as db:
                db.add(
                    MemberMembership(
                        member_id=created_member_ids[0],
                        plan_id=monthly_plan["id"],
                        start_date=now_utc - timedelta(days=1),
                        end_date=now_utc + timedelta(days=4),
                        status=MembershipStatus.ACTIVE,
                        paid_amount=Decimal("1999.00"),
                        payment_method=PaymentMethod.GCASH,
                        created_at=now_utc,
                    )
                )
                cat = ExpenseCategory(name="Facility Operations", description="Power & Maintenance", is_active=True)
                db.add(cat)
                await db.flush()
                db.add(
                    Expense(
                        category_id=cat.id,
                        amount=Decimal("2450.75"),
                        expense_date=today_manila,
                        description="Monthly electricity & water",
                        recorded_by_user_id=admin.id,
                        is_archived=False,
                    )
                )
                cat_id = cat.id
                await db.commit()

            r_kpi = await ac.get("/api/members/stats", headers=admin_hdrs)
            assert r_kpi.status_code == 200
            kpi = r_kpi.json()
            r_fin = await ac.get(f"/api/finance/summary?year={yr}&month={mo}", headers=admin_hdrs)
            assert r_fin.status_code == 200
            fin = r_fin.json()

            assert kpi["active"] >= 6
            assert kpi["new_members_this_month"] >= 6
            assert kpi["renewals_this_month"] >= 1
            assert kpi["renewals_all_time"] >= 1
            assert kpi["upcoming_expirations_7d"] >= 1
            assert kpi["payments_this_month"] >= 7
            assert Decimal(kpi["monthly_income"]) == Decimal(str(fin["membership_revenue"]))
            assert Decimal(kpi["monthly_expenses"]) == Decimal(str(fin["total_expenses"])) == Decimal("2450.75")
            assert Decimal(kpi["profit_loss"]) == Decimal(str(fin["profit"]))

            # Verify net-loss scenario parity as well
            async with SessionLocal() as db:
                db.add(
                    Expense(
                        category_id=cat_id,
                        amount=Decimal("100000.00"),
                        expense_date=today_manila,
                        description="Commercial power rack expansion",
                        recorded_by_user_id=admin.id,
                        is_archived=False,
                    )
                )
                await db.commit()

            kpi_loss = (await ac.get("/api/members/stats", headers=admin_hdrs)).json()
            fin_loss = (await ac.get(f"/api/finance/summary?year={yr}&month={mo}", headers=admin_hdrs)).json()
            assert Decimal(kpi_loss["profit_loss"]) < Decimal("0.00")
            assert Decimal(kpi_loss["profit_loss"]) == Decimal(str(fin_loss["profit"]))

            # Verify Trainer RBAC redacts financial KPIs #6-#9
            kpi_trainer = (await ac.get("/api/members/stats", headers=kresler_hdrs)).json()
            assert kpi_trainer["active"] == kpi_loss["active"]
            assert kpi_trainer["payments_this_month"] is None
            assert kpi_trainer["monthly_income"] is None
            assert kpi_trainer["monthly_expenses"] is None
            assert kpi_trainer["profit_loss"] is None

            print("[PASS] 4. All 9 core business KPIs, profit/loss finance parity, and RBAC redaction verified")

            # Suite 5: All 6 NFC Smart Keycard Tap Flows + WebSocket Feed
            target_member_id = created_member_ids[1]
            async with SessionLocal() as db:
                m_pend = Member(member_code="DGM-9901", first_name="Pend", last_name="Gate", status=MemberStatus.ACTIVE, is_active=True)
                m_exp = Member(member_code="DGM-9902", first_name="Exp", last_name="Gate", status=MemberStatus.EXPIRED, is_active=True)
                m_susp = Member(member_code="DGM-9903", first_name="Susp", last_name="Gate", status=MemberStatus.SUSPENDED, is_active=True)
                db.add_all([m_pend, m_exp, m_susp])
                await db.flush()
                db.add_all([
                    MemberMembership(member_id=m_pend.id, plan_id=monthly_plan["id"], start_date=now_utc, end_date=now_utc + timedelta(days=30), status=MembershipStatus.PENDING, paid_amount=Decimal("0.00"), payment_method=PaymentMethod.CASH),
                    MemberMembership(member_id=m_exp.id, plan_id=monthly_plan["id"], start_date=now_utc - timedelta(days=40), end_date=now_utc - timedelta(days=10), status=MembershipStatus.EXPIRED, paid_amount=Decimal("1999.00"), payment_method=PaymentMethod.CASH),
                    MemberMembership(member_id=m_susp.id, plan_id=monthly_plan["id"], start_date=now_utc - timedelta(days=2), end_date=now_utc + timedelta(days=28), status=MembershipStatus.ACTIVE, paid_amount=Decimal("1999.00"), payment_method=PaymentMethod.CASH),
                    MemberKeycard(member_id=target_member_id, card_uid_hash=hash_card_uid("04PRIOR99001"), card_uid_masked=mask_card_uid("04PRIOR99001"), card_label="Prior Card", status=KeycardStatus.ACTIVE, issued_at=now_utc - timedelta(days=15)),
                    MemberKeycard(member_id=m_pend.id, card_uid_hash=hash_card_uid("04PEND990002"), card_uid_masked=mask_card_uid("04PEND990002"), card_label="Pending Card", status=KeycardStatus.ACTIVE, issued_at=now_utc),
                    MemberKeycard(member_id=m_exp.id, card_uid_hash=hash_card_uid("04EXP9900003"), card_uid_masked=mask_card_uid("04EXP9900003"), card_label="Expired Card", status=KeycardStatus.ACTIVE, issued_at=now_utc - timedelta(days=40)),
                    MemberKeycard(member_id=m_susp.id, card_uid_hash=hash_card_uid("04SUSP990004"), card_uid_masked=mask_card_uid("04SUSP990004"), card_label="Susp Card", status=KeycardStatus.ACTIVE, issued_at=now_utc),
                    MemberKeycard(member_id=created_member_ids[2], card_uid_hash=hash_card_uid("04HWTERM9905"), card_uid_masked=mask_card_uid("04HWTERM9905"), card_label="Turnstile Card", status=KeycardStatus.ACTIVE, issued_at=now_utc),
                ])
                denied_ids = [m_pend.id, m_exp.id, m_susp.id]
                await db.commit()

            # 5.1 Live pairing + auto-revoke prior card + conflict check
            await ac.post("/api/access/pairing-session", headers=admin_hdrs, json={"member_id": target_member_id, "card_label": "Replacement Card"})
            r_paired = await ac.post("/api/access/tap", headers=admin_hdrs, json={"card_uid": "04FRESH99001"})
            assert r_paired.status_code == 200 and r_paired.json()["decision"] == "paired_card"

            member_cards = (await ac.get(f"/api/members/{target_member_id}/keycards", headers=admin_hdrs)).json()
            card_by_label = {c["card_label"]: c for c in member_cards}
            assert card_by_label["Replacement Card"]["status"] == "active"
            assert card_by_label["Prior Card"]["status"] == "revoked"
            fresh_card_id = card_by_label["Replacement Card"]["id"]

            await ac.post("/api/access/pairing-session", headers=admin_hdrs, json={"member_id": created_member_ids[3], "card_label": "Conflict"})
            assert (await ac.post("/api/access/tap", headers=admin_hdrs, json={"card_uid": "04FRESH99001"})).status_code == 409
            await ac.delete("/api/access/pairing-session", headers=admin_hdrs)

            # 5.2 Check-in + 10-min cooldown
            assert (await ac.post("/api/access/tap", headers=admin_hdrs, json={"card_uid": "04FRESH99001"})).json()["decision"] == "granted_check_in"
            assert (await ac.post("/api/access/tap", headers=admin_hdrs, json={"card_uid": "04FRESH99001"})).json()["decision"] == "already_checked_in"

            # 5.3 Check-out after 50m workout + 5-min post-checkout guard
            async with SessionLocal() as db:
                visit_obj = (await db.execute(select(Visit).where(Visit.member_id == target_member_id))).scalar_one()
                visit_obj.checked_in_at = datetime.now(timezone.utc) - timedelta(minutes=50)
                await db.commit()
            r_out = await ac.post("/api/access/tap", headers=admin_hdrs, json={"card_uid": "04FRESH99001"})
            assert r_out.json()["decision"] == "granted_check_out" and "50 min" in r_out.json()["reason_message"]
            assert (await ac.post("/api/access/tap", headers=admin_hdrs, json={"card_uid": "04FRESH99001"})).json()["decision"] == "already_checked_out"

            # 5.4 Gate denials (PENDING PHP 0, EXPIRED, SUSPENDED, UNREGISTERED)
            assert (await ac.post("/api/access/tap", headers=admin_hdrs, json={"card_uid": "04PEND990002"})).json()["decision"] == "denied_payment_pending"
            assert (await ac.post("/api/access/tap", headers=admin_hdrs, json={"card_uid": "04EXP9900003"})).json()["decision"] == "denied_membership_expired"
            assert (await ac.post("/api/access/tap", headers=admin_hdrs, json={"card_uid": "04SUSP990004"})).json()["decision"] == "denied_member_suspended"
            assert (await ac.post("/api/access/tap", headers=admin_hdrs, json={"card_uid": "04UNREG99999"})).json()["decision"] == "denied_unregistered_card"

            async with SessionLocal() as db:
                assert (await db.scalar(select(func.count(Visit.id)).where(Visit.member_id.in_(denied_ids)))) == 0

            # 5.5 Revoked & Lost card denials + security audit log
            assert (await ac.post("/api/access/tap", headers=admin_hdrs, json={"card_uid": "04PRIOR99001"})).json()["decision"] == "denied_card_revoked"
            r_lost = await ac.patch(f"/api/keycards/{fresh_card_id}/status", headers=admin_hdrs, json={"status": "lost", "reason": "Lost keycard"})
            assert r_lost.status_code == 200
            assert (await ac.post("/api/access/tap", headers=admin_hdrs, json={"card_uid": "04FRESH99001"})).json()["decision"] == "denied_card_lost_or_stolen"

            async with SessionLocal() as db:
                audit_cnt = await db.scalar(select(func.count(AuditLog.id)).where(AuditLog.action == "KEYCARD_LOST_STOLEN_TAP_ATTEMPT"))
                assert audit_cnt == 1

            # 5.6 Hardware Scanner Webhook (valid key 200, spoofed key 401, missing key 401, GET 405)
            r_sc = await ac.post("/api/access/scanners", headers=admin_hdrs, json={"name": "Lobby Turnstile", "location": "2F Namuco Entrance", "tap_mode": "toggle_in_out"})
            assert r_sc.status_code == 201
            raw_key = r_sc.json()["raw_api_key"]

            r_wh = await ac.post("/api/access/webhook-tap", headers={"X-Scanner-API-Key": raw_key}, json={"serialNumber": "04:HW:TE:RM:99:05"})
            assert r_wh.status_code == 200 and r_wh.json()["decision"] == "granted_check_in"
            assert (await ac.post(f"/api/access/webhook-tap?api_key={raw_key}", json={"uid": "04HWTERM9905"})).status_code == 401
            assert (await ac.post("/api/access/webhook-tap", headers={"X-Scanner-API-Key": "dgym_scan_bad_key"}, json={"uid": "04HWTERM9905"})).status_code == 401
            assert (await ac.post("/api/access/webhook-tap", json={"uid": "04HWTERM9905"})).status_code == 401
            assert (await ac.get("/api/access/webhook-tap?uid=04HWTERM9905")).status_code == 405

            seen_events = {ev["event"] for ev in ws_recorder.events}
            assert {"pairing_mode_changed", "keycard_paired", "pairing_conflict", "keycard_tap"}.issubset(seen_events)
            print("[PASS] 5. All 6 NFC Smart Keycard tap flows, WebSocket broadcasts, and webhook auth verified")

        # Suite 6: Frontend Constants & Zero-Placeholder Integrity
        verify_frontend_constants_and_placeholders()
        print("[PASS] 6. Frontend constants & zero-[PLACEHOLDER] integrity verified")

        print("\n=== ALL 6 PHASE 9 QA & END-TO-END INTEGRATION SUITES PASSED ===")
    finally:
        await live_feed_manager.disconnect(ws_recorder)
        runtime_state.clear_pairing()
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


if __name__ == "__main__":
    asyncio.run(run_phase9_suite())
