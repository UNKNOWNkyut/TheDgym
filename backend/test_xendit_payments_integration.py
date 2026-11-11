"""
End-to-End Integration Tests for Xendit Online Payments Pipeline.
Verifies service configuration, Philippine payment channel mappings,
checkout creation with CSRF guards, and webhook idempotency.
"""
import asyncio
import os
import sys
import tempfile
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from unittest.mock import patch

from httpx import ASGITransport, AsyncClient
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

sys.path.insert(0, os.path.dirname(__file__))

import app.models  # noqa: F401
from app.core.security import create_access_token, hash_password
from app.database import Base, get_db
from app.main import app
from app.models.audit_log import AuditLog
from app.models.member import Member, MemberStatus
from app.models.member_membership import MemberMembership, MembershipStatus, PaymentMethod
from app.models.membership_plan import MembershipPlan
from app.models.notification import Notification
from app.models.user import User, UserRole
from app.services.xendit_service import (
    get_xendit_secret_key,
    map_xendit_payment_method,
    _get_auth_headers,
)


def test_service_config_and_mappings():
    key = get_xendit_secret_key()
    assert bool(key), "XENDIT_SECRET_KEY must be configured"
    assert key.startswith("xnd_development_"), "Key must be in test mode"

    headers = _get_auth_headers()
    assert "Authorization" in headers
    assert headers["Authorization"].startswith("Basic ")

    assert map_xendit_payment_method("GCASH") == PaymentMethod.GCASH
    assert map_xendit_payment_method("PAYMAYA") == PaymentMethod.MAYA
    assert map_xendit_payment_method("MAYA") == PaymentMethod.MAYA
    assert map_xendit_payment_method("QRPH") == PaymentMethod.QR_PAYMENT
    assert map_xendit_payment_method("DEBIT_CARD") == PaymentMethod.DEBIT_CARD
    assert map_xendit_payment_method("CREDIT_CARD") == PaymentMethod.CREDIT_CARD
    assert map_xendit_payment_method("BANK_TRANSFER") == PaymentMethod.BANK_TRANSFER
    assert map_xendit_payment_method("UNKNOWN") == PaymentMethod.OTHER
    print("[PASS] 1. Xendit service configuration and channel mappings verified")


async def run_integration_tests():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 1. Unauthenticated /api/payments/status returns 401
        r_unauth = await ac.get("/api/payments/status")
        assert r_unauth.status_code == 401
        print("[PASS] 2. Unauthenticated access rejected with 401")

        # 2. Member status check is forbidden (admin/staff only) -> 403
        mem_token = create_access_token(data={"sub": "15", "email": "dennisverano258@gmail.com", "role": "member"})
        mem_headers = {"Authorization": f"Bearer {mem_token}"}
        mem_cookies = {"access_token": mem_token}

        r_forbidden = await ac.get("/api/payments/status", headers=mem_headers)
        assert r_forbidden.status_code == 403
        print("[PASS] 3. Member access to gateway config forbidden with 403")

        # 3. Admin token returns full gateway config
        admin_token = create_access_token(data={"sub": "1", "email": "admin@thedgym.com", "role": "admin"})
        admin_headers = {"Authorization": f"Bearer {admin_token}"}

        r_status = await ac.get("/api/payments/status", headers=admin_headers)
        assert r_status.status_code == 200
        data = r_status.json()
        assert data["provider"] == "xendit"
        assert data["configured"] is True
        assert data["is_test_mode"] is True
        assert "GCash" in data["supported_channels"]
        print("[PASS] 4. Admin payment gateway status check verified")

        # 4. Ambient cookie CSRF protection on checkout endpoint (missing X-Requested-With -> 403)
        r_no_csrf = await ac.post("/api/payments/create-checkout", json={"plan_slug": "monthly"}, cookies=mem_cookies)
        assert r_no_csrf.status_code == 403
        assert "CSRF validation failed" in r_no_csrf.text
        print("[PASS] 5. Ambient cookie CSRF protection (missing X-Requested-With -> 403) verified")

        # 5. With CSRF -> 200 and live Xendit invoice URL
        checkout_headers = {
            "X-Requested-With": "XMLHttpRequest",
        }
        r_checkout = await ac.post(
            "/api/payments/create-checkout",
            json={"plan_slug": "monthly"},
            headers=checkout_headers,
            cookies=mem_cookies,
        )
        assert r_checkout.status_code == 200
        ch_data = r_checkout.json()
        assert ch_data["status"] == "success"
        assert ch_data["invoice_url"].startswith("https://checkout-staging.xendit.co/")
        print("[PASS] 6. Live Xendit hosted checkout session creation verified")

        # 6. Webhook idempotency and non-PAID ignore
        r_wh_ignored = await ac.post("/api/payments/webhook/xendit", json={"status": "PENDING", "external_id": "DGM-1-2-12345"})
        assert r_wh_ignored.status_code == 200
        assert r_wh_ignored.json()["status"] == "ignored"
        print("[PASS] 7. Webhook non-PAID events correctly ignored")


async def run_isolated_security_and_activation_tests():
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmpdir:
        db_path = os.path.join(tmpdir, "xendit_security_regressions.db")
        engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}", echo=False)
        session_local = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

        try:
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)

            async with session_local() as db:
                plan = MembershipPlan(
                    name="Monthly Plan",
                    slug="monthly",
                    description="Test plan",
                    duration_days=30,
                    price_php=Decimal("2000.00"),
                    is_active=True,
                )
                db.add(plan)

                u1 = User(
                    email="nomember@test.local",
                    full_name="New Buyer",
                    hashed_password=hash_password("Pass1234!"),
                    role=UserRole.MEMBER,
                    is_active=True,
                )
                u2 = User(
                    email="other@test.local",
                    full_name="Other Buyer",
                    hashed_password=hash_password("Pass1234!"),
                    role=UserRole.MEMBER,
                    is_active=True,
                )
                admin_u = User(
                    email="admin@test.local",
                    full_name="Admin User",
                    hashed_password=hash_password("Pass1234!"),
                    role=UserRole.ADMIN,
                    is_active=True,
                )
                db.add_all([u1, u2, admin_u])
                await db.flush()

                m2 = Member(
                    member_code="DGM-TEST-0002",
                    first_name="Other",
                    last_name="Buyer",
                    email=u2.email,
                    phone="09170000002",
                    status=MemberStatus.INACTIVE,
                )
                db.add(m2)
                await db.commit()
                u1_id, u2_id, admin_id, plan_id, m2_id = u1.id, u2.id, admin_u.id, plan.id, m2.id

            # Verify partial unique index allows multiple NULL/empty refs while rejecting duplicate non-empty refs
            now = datetime.now(timezone.utc)
            async with session_local() as db:
                for ref in (None, None, "", ""):
                    db.add(
                        MemberMembership(
                            member_id=m2_id,
                            plan_id=plan_id,
                            start_date=now,
                            end_date=now + timedelta(days=30),
                            status=MembershipStatus.EXPIRED,
                            paid_amount=Decimal("2000.00"),
                            payment_method=PaymentMethod.CASH,
                            payment_reference=ref,
                        )
                    )
                await db.commit()

                db.add(
                    MemberMembership(
                        member_id=m2_id,
                        plan_id=plan_id,
                        start_date=now,
                        end_date=now + timedelta(days=30),
                        status=MembershipStatus.EXPIRED,
                        paid_amount=Decimal("2000.00"),
                        payment_method=PaymentMethod.GCASH,
                        payment_reference="XND-UNIQUE-CHECK",
                    )
                )
                await db.commit()

                db.add(
                    MemberMembership(
                        member_id=m2_id,
                        plan_id=plan_id,
                        start_date=now,
                        end_date=now + timedelta(days=30),
                        status=MembershipStatus.EXPIRED,
                        paid_amount=Decimal("2000.00"),
                        payment_method=PaymentMethod.GCASH,
                        payment_reference="XND-UNIQUE-CHECK",
                    )
                )
                dup_rejected = False
                try:
                    await db.commit()
                except IntegrityError:
                    await db.rollback()
                    dup_rejected = True
                assert dup_rejected, "Partial unique index must reject duplicate non-empty payment_reference"
            print("[PASS] 8. Partial unique index uq_member_memberships_payment_reference_nonempty verified")

            async def override_get_db():
                async with session_local() as session:
                    yield session

            app.dependency_overrides[get_db] = override_get_db

            t1 = create_access_token({"sub": str(u1_id), "email": "nomember@test.local", "role": "member"})
            t2 = create_access_token({"sub": str(u2_id), "email": "other@test.local", "role": "member"})
            ta = create_access_token({"sub": str(admin_id), "email": "admin@test.local", "role": "admin"})

            h1 = {"Authorization": f"Bearer {t1}", "X-Requested-With": "XMLHttpRequest"}
            h2 = {"Authorization": f"Bearer {t2}", "X-Requested-With": "XMLHttpRequest"}
            ha = {"Authorization": f"Bearer {ta}", "X-Requested-With": "XMLHttpRequest"}

            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                # Untrusted redirect URL rejected
                r_bad_url = await ac.post(
                    "/api/payments/create-checkout",
                    json={"plan_slug": "monthly", "success_url": "https://evil.com/steal"},
                    headers=h1,
                )
                assert r_bad_url.status_code == 400
                print("[PASS] 9. Untrusted checkout redirect URL rejected with 400")

                # Checkout auto-provisions INACTIVE member with generate_member_code + AuditLog
                captured_ext = {}

                async def fake_create_invoice(**kwargs):
                    captured_ext["external_id"] = kwargs["external_id"]
                    return {
                        "status": "success",
                        "invoice_id": "inv_test_1001",
                        "external_id": kwargs["external_id"],
                        "invoice_url": "https://checkout-staging.xendit.co/web/inv_test_1001",
                        "amount": kwargs["amount"],
                    }

                with patch("app.routers.payments.create_xendit_invoice", side_effect=fake_create_invoice):
                    r_ok = await ac.post(
                        "/api/payments/create-checkout",
                        json={"plan_slug": "monthly"},
                        headers=h1,
                    )
                assert r_ok.status_code == 200
                ext_id = captured_ext["external_id"]

                async with session_local() as db:
                    m1 = (await db.execute(select(Member).where(Member.email == "nomember@test.local"))).scalar_one()
                    assert m1.status == MemberStatus.INACTIVE
                    assert m1.member_code.startswith("DGM-")
                    audit = (await db.execute(select(AuditLog).where(AuditLog.action == "ONLINE_CHECKOUT_CREATED"))).scalar_one()
                    assert str(audit.target_id) == str(plan_id)
                    m1_id = m1.id
                print("[PASS] 10. Auto-provisioned INACTIVE member + ONLINE_CHECKOUT_CREATED audit log verified")

                # PAID webhook auth & underpaid rejections
                with patch("app.routers.payments.get_xendit_webhook_token", return_value=""):
                    r_503 = await ac.post(
                        "/api/payments/webhook/xendit",
                        json={"id": "inv_test_1001", "status": "PAID", "external_id": ext_id, "paid_amount": 2000},
                    )
                assert r_503.status_code == 503

                with patch("app.routers.payments.get_xendit_webhook_token", return_value="secret-tok-123"):
                    r_403 = await ac.post(
                        "/api/payments/webhook/xendit",
                        headers={"x-callback-token": "wrong-token"},
                        json={"id": "inv_test_1001", "status": "PAID", "external_id": ext_id, "paid_amount": 2000},
                    )
                    assert r_403.status_code == 403

                    r_under = await ac.post(
                        "/api/payments/webhook/xendit",
                        headers={"x-callback-token": "secret-tok-123"},
                        json={"id": "inv_test_1001", "status": "PAID", "external_id": ext_id, "amount": 2000, "paid_amount": 100},
                    )
                    assert r_under.status_code == 400
                print("[PASS] 11. Webhook unset token (503), invalid token (403), and underpaid amount (400) verified")

                # Signed PAID activation + duplicate replay idempotency
                with patch("app.routers.payments.get_xendit_webhook_token", return_value="secret-tok-123"):
                    r_act = await ac.post(
                        "/api/payments/webhook/xendit",
                        headers={"x-callback-token": "secret-tok-123"},
                        json={
                            "id": "inv_test_1001",
                            "status": "PAID",
                            "external_id": ext_id,
                            "paid_amount": 2000,
                            "payment_channel": "GCASH",
                        },
                    )
                    assert r_act.status_code == 200
                    assert r_act.json()["status"] == "success"

                    r_dup = await ac.post(
                        "/api/payments/webhook/xendit",
                        headers={"x-callback-token": "secret-tok-123"},
                        json={
                            "id": "inv_test_1001",
                            "status": "PAID",
                            "external_id": ext_id,
                            "paid_amount": 2000,
                            "payment_channel": "GCASH",
                        },
                    )
                    assert r_dup.status_code == 200
                    assert r_dup.json()["status"] == "already_processed"

                async with session_local() as db:
                    m1_after = (await db.execute(select(Member).where(Member.id == m1_id))).scalar_one()
                    assert m1_after.status == MemberStatus.ACTIVE
                    ms_count = (
                        await db.execute(
                            select(func.count(MemberMembership.id)).where(
                                MemberMembership.payment_reference == "XND-inv_test_1001"
                            )
                        )
                    ).scalar_one()
                    assert ms_count == 1
                    notif_count = (await db.execute(select(func.count(Notification.id)))).scalar_one()
                    assert notif_count >= 1
                print("[PASS] 12. Signed PAID webhook activation + idempotent duplicate replay verified")

                # Verify endpoint validation, ownership enforcement, and PAID sync
                r_inv_fmt = await ac.get("/api/payments/verify/bad!id@1", headers=h1)
                assert r_inv_fmt.status_code == 400

                ext_m2 = f"DGM-{m2_id}-{plan_id}-99999"

                async def fake_get_invoice(invoice_id: str):
                    if invoice_id == "inv_m2_owned":
                        return {
                            "status": "success",
                            "invoice_id": "inv_m2_owned",
                            "external_id": ext_m2,
                            "invoice_status": "PAID",
                            "amount": 2000,
                            "payment_channel": "PAYMAYA",
                            "payment_method": "EWALLET",
                        }
                    return {
                        "status": "success",
                        "invoice_id": invoice_id,
                        "external_id": ext_id,
                        "invoice_status": "PAID",
                        "amount": 2000,
                    }

                with patch("app.routers.payments.get_xendit_invoice", side_effect=fake_get_invoice):
                    r_forbidden = await ac.get("/api/payments/verify/inv_m2_owned", headers=h1)
                    assert r_forbidden.status_code == 403

                    r_owner = await ac.get("/api/payments/verify/inv_m2_owned", headers=h2)
                    assert r_owner.status_code == 200
                    assert r_owner.json()["membership_activated"] is True

                    r_admin = await ac.get("/api/payments/verify/inv_test_1001", headers=ha)
                    assert r_admin.status_code == 200
                    assert r_admin.json()["membership_activated"] is True

                async with session_local() as db:
                    m2_after = (await db.execute(select(Member).where(Member.id == m2_id))).scalar_one()
                    assert m2_after.status == MemberStatus.ACTIVE
                print("[PASS] 13. Verify endpoint format (400), cross-member ownership (403), and PAID sync verified")
        finally:
            app.dependency_overrides.pop(get_db, None)
            await engine.dispose()


async def run_all_suites():
    await run_integration_tests()
    await run_isolated_security_and_activation_tests()
    print("\n=== ALL XENDIT INTEGRATION SUITES PASSED ===")


def main():
    test_service_config_and_mappings()
    asyncio.run(run_all_suites())


if __name__ == "__main__":
    main()
