"""
Biometric ID Scanner & 2-Step Face Verification Integration Suite.
Runs in-process against an isolated temporary SQLite database via ASGITransport.
"""
import asyncio
import math
import tempfile
from pathlib import Path

from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.security import hash_password
from app.database import Base, get_db
from app.main import app
from app.models.user import User, UserRole
from app.models.user_biometric import UserBiometric


def _make_unit_descriptor(seed: float, dim_shift: int = 0) -> list[float]:
    vec = [0.0] * 128
    for i in range(128):
        vec[i] = math.sin(seed + (i + dim_shift) * 0.13) * 0.25
    return vec


async def run_suite() -> None:
    tmp_dir = tempfile.TemporaryDirectory(prefix="dgym_bio_test_")
    db_path = Path(tmp_dir.name) / "bio_test.db"
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_path.as_posix()}")
    SessionLocal = async_sessionmaker(bind=engine, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async def _override_get_db():
        async with SessionLocal() as session:
            yield session

    app.dependency_overrides[get_db] = _override_get_db

    # Seed legacy/bootstrapped Admin without biometric record
    async with SessionLocal() as session:
        legacy_admin = User(
            email="legacy-admin@example.com",
            hashed_password=hash_password("AdminPass123!"),
            full_name="Legacy Admin",
            role=UserRole.ADMIN,
            is_active=True,
        )
        session.add(legacy_admin)
        await session.commit()

    csrf_headers = {"X-Requested-With": "XMLHttpRequest"}

    from app.config import settings
    from app.core.rate_limit import rate_limiter

    orig_keys = (settings.OCR_SPACE_API_KEY, settings.FACEPP_API_KEY, settings.FACEPP_API_SECRET)
    settings.OCR_SPACE_API_KEY = ""
    settings.FACEPP_API_KEY = ""
    settings.FACEPP_API_SECRET = ""
    rate_limiter._buckets.clear()

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            vec_alice = _make_unit_descriptor(1.0)
            vec_alice_near = [v + 0.01 for v in vec_alice]
            vec_impostor = _make_unit_descriptor(9.5, dim_shift=17)

            # 1. Registration fails closed without liveness or mismatched ID selfie
            r_no_live = await ac.post(
                "/api/auth/register",
                headers=csrf_headers,
                json={
                    "email": "alice@example.com",
                    "password": "Password123!",
                    "full_name": "Alice Santos",
                    "face_descriptor": vec_alice,
                    "liveness_passed": False,
                    "id_type": "philsys",
                    "id_face_match_score": 0.25,
                },
            )
            assert r_no_live.status_code == 400

            r_bad_match = await ac.post(
                "/api/auth/register",
                headers=csrf_headers,
                json={
                    "email": "alice@example.com",
                    "password": "Password123!",
                    "full_name": "Alice Santos",
                    "face_descriptor": vec_alice,
                    "liveness_passed": True,
                    "id_type": "philsys",
                    "id_face_match_score": 0.95,
                },
            )
            assert r_bad_match.status_code == 400
            print("[PASS] 1. Registration fails closed on missing liveness & ID/selfie mismatch")

            # 2. Valid Registration persists UserBiometric (masked/hashed ID) and issues session
            r_reg = await ac.post(
                "/api/auth/register",
                headers=csrf_headers,
                json={
                    "email": "alice@example.com",
                    "password": "Password123!",
                    "full_name": "Alice Santos",
                    "phone": "+639171234567",
                    "face_descriptor": vec_alice,
                    "liveness_passed": True,
                    "id_type": "philsys",
                    "id_number": "1234-5678-9012-3456",
                    "id_ocr_name": "ALICE SANTOS",
                    "id_face_match_score": 0.28,
                },
            )
            assert r_reg.status_code == 201, r_reg.text
            reg_body = r_reg.json()
            assert reg_body["user"]["face_enrolled"] is True
            assert "access_token" in r_reg.cookies

            async with SessionLocal() as session:
                bio = (
                    await session.execute(
                        select(UserBiometric).where(UserBiometric.user_id == reg_body["user"]["id"])
                    )
                ).scalar_one()
                assert bio.id_type == "philsys"
                assert bio.id_number_masked == "************3456"
                assert bio.id_number_hash and "1234567890123456" not in bio.id_number_hash
            await ac.post("/api/auth/logout", headers=csrf_headers)
            ac.cookies.clear()
            print("[PASS] 2. Registration creates masked/hashed biometric profile & issues session")

            # 3. Login Step 1 issues challenge_token ONLY (no session cookie), rejected by /me
            r_step1 = await ac.post(
                "/api/auth/login",
                headers=csrf_headers,
                json={"email": "alice@example.com", "password": "Password123!"},
            )
            assert r_step1.status_code == 200, r_step1.text
            step1_data = r_step1.json()
            assert step1_data["requires_face_verification"] is True
            assert step1_data["enrollment_required"] is False
            assert "access_token" not in r_step1.cookies
            challenge = step1_data["challenge_token"]

            r_bypass = await ac.get(
                "/api/auth/me",
                headers={"Authorization": f"Bearer {challenge}"},
            )
            assert r_bypass.status_code == 401

            r_wrong_purpose = await ac.post(
                "/api/auth/face/enroll",
                headers=csrf_headers,
                json={
                    "challenge_token": challenge,
                    "face_descriptor": vec_alice,
                    "liveness_passed": True,
                    "id_type": "philsys",
                    "id_face_match_score": 0.2,
                },
            )
            assert r_wrong_purpose.status_code == 401
            print("[PASS] 3. Step 1 challenge cannot bypass /me or cross-use /face/enroll")

            # 4. Step 2 face verify rejects impostor, succeeds on matching live descriptor, & revokes challenge
            r_impostor = await ac.post(
                "/api/auth/face/verify",
                headers=csrf_headers,
                json={
                    "challenge_token": challenge,
                    "face_descriptor": vec_impostor,
                    "liveness_passed": True,
                },
            )
            assert r_impostor.status_code == 401

            r_verify = await ac.post(
                "/api/auth/face/verify",
                headers=csrf_headers,
                json={
                    "challenge_token": challenge,
                    "face_descriptor": vec_alice_near,
                    "liveness_passed": True,
                },
            )
            assert r_verify.status_code == 200, r_verify.text
            assert r_verify.json()["user"]["email"] == "alice@example.com"
            assert "access_token" in r_verify.cookies

            r_me = await ac.get("/api/auth/me")
            assert r_me.status_code == 200

            r_replay = await ac.post(
                "/api/auth/face/verify",
                headers=csrf_headers,
                json={
                    "challenge_token": challenge,
                    "face_descriptor": vec_alice_near,
                    "liveness_passed": True,
                },
            )
            assert r_replay.status_code == 401
            await ac.post("/api/auth/logout", headers=csrf_headers)
            ac.cookies.clear()
            print("[PASS] 4. Face verify blocks impostor, accepts match, and enforces single-use challenge")

            # 5. Legacy/Admin first-login enrollment onboarding then subsequent verify-only
            r_admin1 = await ac.post(
                "/api/auth/login",
                headers=csrf_headers,
                json={"email": "legacy-admin@example.com", "password": "AdminPass123!"},
            )
            assert r_admin1.status_code == 200
            admin_step1 = r_admin1.json()
            assert admin_step1["enrollment_required"] is True

            vec_admin = _make_unit_descriptor(4.2, dim_shift=5)
            r_enroll = await ac.post(
                "/api/auth/face/enroll",
                headers=csrf_headers,
                json={
                    "challenge_token": admin_step1["challenge_token"],
                    "face_descriptor": vec_admin,
                    "liveness_passed": True,
                    "id_type": "drivers_license",
                    "id_number": "D01-12-345678",
                    "id_ocr_name": "LEGACY ADMIN",
                    "id_face_match_score": 0.31,
                },
            )
            assert r_enroll.status_code == 200, r_enroll.text
            assert r_enroll.json()["user"]["face_enrolled"] is True
            assert "access_token" in r_enroll.cookies
            await ac.post("/api/auth/logout", headers=csrf_headers)
            ac.cookies.clear()

            r_admin_next = await ac.post(
                "/api/auth/login",
                headers=csrf_headers,
                json={"email": "legacy-admin@example.com", "password": "AdminPass123!"},
            )
            assert r_admin_next.status_code == 200
            assert r_admin_next.json()["enrollment_required"] is False
            print("[PASS] 5. First-login ID+Face enrollment works for Admin/Staff/Trainers & enforces 2FA thereafter")

            # 6. External Vision API service + endpoints (OCR.space & Face++ MockTransport)
            import base64
            import httpx
            from unittest.mock import patch
            from app.config import settings
            from app.core.rate_limit import rate_limiter
            from app.services.external_vision import compare_faces_facepp, extract_id_text_ocr_space

            rate_limiter._buckets.clear()

            fake_jpeg_b64 = base64.b64encode(b"\xff\xd8\xff\xe0" + b"0" * 256).decode("ascii")
            fake_data_url = f"data:image/jpeg;base64,{fake_jpeg_b64}"

            r_prov_off = await ac.get("/api/auth/biometrics/providers")
            assert r_prov_off.status_code == 200
            assert "camera=(self)" in r_prov_off.headers.get("permissions-policy", "")
            assert r_prov_off.json()["ocr_api_configured"] is False
            assert r_prov_off.json()["face_api_configured"] is False

            def _ocr_handler(request: httpx.Request) -> httpx.Response:
                assert request.headers.get("apikey") == "test-ocr-key"
                return httpx.Response(
                    200,
                    json={
                        "OCRExitCode": 1,
                        "IsErroredOnProcessing": False,
                        "ParsedResults": [{"ParsedText": "PCN 1234-5678-9012-3456\nDELA CRUZ, JUAN"}],
                    },
                )

            async with httpx.AsyncClient(transport=httpx.MockTransport(_ocr_handler)) as mock_ocr_client:
                ocr_res = await extract_id_text_ocr_space(
                    fake_data_url, "test-ocr-key", client=mock_ocr_client
                )
                assert ocr_res.ok and "DELA CRUZ, JUAN" in ocr_res.raw_text

            def _face_handler_factory(confidence_val: float):
                def _handler(request: httpx.Request) -> httpx.Response:
                    body_text = request.content.decode("utf-8")
                    assert "api_key=test-fpp-key" in body_text
                    assert "api_secret=test-fpp-sec" in body_text
                    return httpx.Response(
                        200,
                        json={
                            "confidence": confidence_val,
                            "thresholds": {"1e-3": 62.3, "1e-4": 69.1, "1e-5": 75.4},
                        },
                    )
                return _handler

            async with httpx.AsyncClient(transport=httpx.MockTransport(_face_handler_factory(88.4))) as mock_fc:
                fc_ok = await compare_faces_facepp(
                    fake_data_url,
                    fake_data_url,
                    api_key="test-fpp-key",
                    api_secret="test-fpp-sec",
                    threshold_key="1e-4",
                    client=mock_fc,
                )
                assert fc_ok.ok and fc_ok.matched and fc_ok.confidence == 88.4

            async with httpx.AsyncClient(transport=httpx.MockTransport(_face_handler_factory(41.2))) as mock_fc_low:
                fc_low = await compare_faces_facepp(
                    fake_data_url,
                    fake_data_url,
                    api_key="test-fpp-key",
                    api_secret="test-fpp-sec",
                    threshold_key="1e-4",
                    client=mock_fc_low,
                )
                assert fc_low.ok and not fc_low.matched

            # Route-level integration with OCR.space + Face++ enabled via settings
            orig_keys = (settings.OCR_SPACE_API_KEY, settings.FACEPP_API_KEY, settings.FACEPP_API_SECRET)
            try:
                settings.OCR_SPACE_API_KEY = "test-ocr-key"
                settings.FACEPP_API_KEY = "test-fpp-key"
                settings.FACEPP_API_SECRET = "test-fpp-sec"

                r_prov_on = await ac.get("/api/auth/biometrics/providers")
                assert r_prov_on.status_code == 200
                assert r_prov_on.json()["ocr_api_configured"] is True
                assert r_prov_on.json()["face_api_configured"] is True
                assert r_prov_on.json()["ocr_provider"] == "ocr_space"
                assert r_prov_on.json()["face_provider"] == "facepp"

                with patch("app.routers.auth.extract_id_text_ocr_space", return_value=ocr_res):
                    r_ocr_ep = await ac.post(
                        "/api/auth/biometrics/ocr",
                        headers=csrf_headers,
                        json={"image_base64": fake_data_url},
                    )
                    assert r_ocr_ep.status_code == 200
                    assert r_ocr_ep.json()["used_external_api"] is True
                    assert "DELA CRUZ, JUAN" in r_ocr_ep.json()["raw_text"]

                cloud_vec = _make_unit_descriptor(3.5)
                cloud_close = _make_unit_descriptor(3.52)

                with patch("app.routers.auth.compare_faces_facepp", return_value=fc_low):
                    r_reg_fpp_reject = await ac.post(
                        "/api/auth/register",
                        headers=csrf_headers,
                        json={
                            "email": "cloud-reject@example.com",
                            "password": "Password123!",
                            "full_name": "Cloud Reject",
                            "face_descriptor": cloud_vec,
                            "liveness_passed": True,
                            "id_type": "philsys",
                            "id_face_match_score": 0.30,
                            "id_image_base64": fake_data_url,
                            "live_image_base64": fake_data_url,
                        },
                    )
                    assert r_reg_fpp_reject.status_code == 400
                    assert "Face++" in r_reg_fpp_reject.json()["detail"]

                with patch("app.routers.auth.compare_faces_facepp", return_value=fc_ok):
                    r_reg_fpp_ok = await ac.post(
                        "/api/auth/register",
                        headers=csrf_headers,
                        json={
                            "email": "cloud-pass@example.com",
                            "password": "Password123!",
                            "full_name": "Cloud Pass",
                            "face_descriptor": cloud_vec,
                            "liveness_passed": True,
                            "id_type": "philsys",
                            "id_face_match_score": 0.25,
                            "id_image_base64": fake_data_url,
                            "live_image_base64": fake_data_url,
                        },
                    )
                    assert r_reg_fpp_ok.status_code == 201
                    await ac.post("/api/auth/logout", headers=csrf_headers)
                    ac.cookies.clear()

                r_fpp_step1 = await ac.post(
                    "/api/auth/login",
                    headers=csrf_headers,
                    json={"email": "cloud-pass@example.com", "password": "Password123!"},
                )
                assert r_fpp_step1.status_code == 200
                fpp_token = r_fpp_step1.json()["challenge_token"]

                with patch("app.routers.auth.compare_faces_facepp", return_value=fc_ok):
                    r_fpp_verify = await ac.post(
                        "/api/auth/face/verify",
                        headers=csrf_headers,
                        json={
                            "challenge_token": fpp_token,
                            "face_descriptor": cloud_close,
                            "liveness_passed": True,
                            "live_image_base64": fake_data_url,
                        },
                    )
                    assert r_fpp_verify.status_code == 200
                    assert "access_token" in r_fpp_verify.cookies
            finally:
                (
                    settings.OCR_SPACE_API_KEY,
                    settings.FACEPP_API_KEY,
                    settings.FACEPP_API_SECRET,
                ) = orig_keys

            print("[PASS] 6. External OCR.space & Face++ REST integrations verified end-to-end")

    finally:
        (
            settings.OCR_SPACE_API_KEY,
            settings.FACEPP_API_KEY,
            settings.FACEPP_API_SECRET,
        ) = orig_keys
        app.dependency_overrides.clear()
        await engine.dispose()
        tmp_dir.cleanup()


if __name__ == "__main__":
    asyncio.run(run_suite())
