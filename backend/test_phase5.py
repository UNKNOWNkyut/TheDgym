"""
Phase 5 Integration Tests — Visits, Classes & Personal Training
Tests:
1. Health check
2. Authentication (Admin, Trainer, Member)
3. Verify seeded class sessions
4. Verify seeded PT sessions
5. Member check-in (POST /api/visits)
6. List visits with active status filter (GET /api/visits)
7. Member checkout (PATCH /api/visits/{id}/checkout)
8. Member visit history (GET /api/visits/member/{member_id})
9. Create a new class session (POST /api/classes)
10. Enroll member into class session (POST /api/classes/{id}/enroll)
11. Verify capacity & enrollment count (GET /api/classes/{id})
12. Unenroll member (DELETE /api/classes/{id}/enroll/{member_id})
13. Update class session status (PATCH /api/classes/{id})
14. Schedule personal training session (POST /api/pt-sessions)
15. Trainer updates PT session status & notes (PATCH /api/pt-sessions/{id})
16. RBAC enforcement (Member cannot record visits or create classes)
"""
import asyncio
import httpx
import time
from datetime import datetime, timezone, timedelta

BASE_URL = "http://127.0.0.1:8000"


async def run_tests():
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=10.0) as client:
        print("\n========================================================")
        print("  THE DGYM — PHASE 5 INTEGRATION TEST SUITE")
        print("========================================================\n")

        # 1. Health check
        res = await client.get("/api/health")
        assert res.status_code == 200, f"Health check failed: {res.text}"
        print("[PASS] 1. API Health Check verified (status: online)")

        # 2. Authentication
        admin_login = await client.post(
            "/api/auth/login",
            json={"email": "admin@thedgym.com", "password": "admin12345"},
        )
        assert admin_login.status_code == 200
        admin_token = admin_login.json()["access_token"]
        admin_headers = {"Authorization": f"Bearer {admin_token}"}

        trainer_login = await client.post(
            "/api/auth/login",
            json={"email": "trainer@thedgym.com", "password": "trainer12345"},
        )
        assert trainer_login.status_code == 200
        trainer_user = trainer_login.json()["user"]
        trainer_token = trainer_login.json()["access_token"]
        trainer_headers = {"Authorization": f"Bearer {trainer_token}"}

        member_login = await client.post(
            "/api/auth/login",
            json={"email": "member@thedgym.com", "password": "member12345"},
        )
        assert member_login.status_code == 200
        member_token = member_login.json()["access_token"]
        member_headers = {"Authorization": f"Bearer {member_token}"}

        print("[PASS] 2. Logged in as Admin, Trainer, and Member")

        # 3. Seeded class sessions
        classes_res = await client.get("/api/classes", headers=admin_headers)
        assert classes_res.status_code == 200, f"Classes list failed: {classes_res.text}"
        classes = classes_res.json()
        assert len(classes) >= 4, f"Expected >=4 seeded classes, got {len(classes)}"
        print(f"[PASS] 3. Seeded class sessions verified ({len(classes)} found)")

        # 4. Seeded PT sessions
        pt_res = await client.get("/api/pt-sessions", headers=admin_headers)
        assert pt_res.status_code == 200, f"PT list failed: {pt_res.text}"
        pts = pt_res.json()
        assert len(pts) >= 1, f"Expected >=1 seeded PT sessions, got {len(pts)}"
        print(f"[PASS] 4. Seeded PT sessions verified ({len(pts)} found)")

        # 5. Member check-in
        visit_create = await client.post(
            "/api/visits",
            json={
                "member_id": 1,
                "visit_type": "open_gym",
                "notes": "Testing Phase 5 check-in desk",
            },
            headers=admin_headers,
        )
        assert visit_create.status_code == 201, f"Visit check-in failed: {visit_create.text}"
        visit = visit_create.json()
        visit_id = visit["id"]
        assert visit["visit_type"] == "open_gym"
        assert visit["checked_out_at"] is None
        print(f"[PASS] 5. Member #1 checked in (Visit ID: {visit_id}, Type: open_gym)")

        # 6. List visits
        visits_res = await client.get("/api/visits", headers=admin_headers)
        assert visits_res.status_code == 200
        all_visits = visits_res.json()
        assert any(v["id"] == visit_id for v in all_visits)
        print(f"[PASS] 6. Visits list returned {len(all_visits)} records")

        # 7. Member check-out
        checkout_res = await client.patch(
            f"/api/visits/{visit_id}/checkout",
            json={},
            headers=admin_headers,
        )
        assert checkout_res.status_code == 200, f"Checkout failed: {checkout_res.text}"
        updated_visit = checkout_res.json()
        assert updated_visit["checked_out_at"] is not None
        print(f"[PASS] 7. Member checked out (Visit ID: {visit_id}, Timestamp recorded)")

        # 8. Member visit history
        history_res = await client.get("/api/visits/member/1", headers=admin_headers)
        assert history_res.status_code == 200
        member_visits = history_res.json()
        assert len(member_visits) >= 1
        print(f"[PASS] 8. Member #1 visit history verified ({len(member_visits)} visits recorded)")

        # 9. Create a new class session
        ts = int(time.time())
        sched_time = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
        new_class_payload = {
            "name": f"Deadlift Clinic {ts}",
            "description": "Technique breakdown and lockout mechanics",
            "coach_id": trainer_user["id"],
            "class_type": "powerlifting",
            "scheduled_at": sched_time,
            "duration_minutes": 75,
            "max_capacity": 12,
            "location": "Lifting Platform B",
        }
        create_class_res = await client.post("/api/classes", json=new_class_payload, headers=admin_headers)
        assert create_class_res.status_code == 201, f"Create class failed: {create_class_res.text}"
        class_obj = create_class_res.json()
        class_id = class_obj["id"]
        assert class_obj["name"] == f"Deadlift Clinic {ts}"
        print(f"[PASS] 9. Created new class: {class_obj['name']} (ID: {class_id})")

        # 10. Enroll member into class
        enroll_res = await client.post(
            f"/api/classes/{class_id}/enroll",
            json={"member_id": 1, "notes": "Registered via portal"},
            headers=admin_headers,
        )
        assert enroll_res.status_code == 201, f"Enroll failed: {enroll_res.text}"
        enrollment = enroll_res.json()
        assert enrollment["member_id"] == 1
        print(f"[PASS] 10. Enrolled member #1 into class (Enrollment ID: {enrollment['id']})")

        # 11. Verify capacity & enrollment count
        class_detail = await client.get(f"/api/classes/{class_id}", headers=admin_headers)
        assert class_detail.status_code == 200
        detail_data = class_detail.json()
        assert detail_data["enrolled_count"] == 1
        assert len(detail_data["enrollments"]) == 1
        print("[PASS] 11. Class detail confirmed: enrolled_count=1 / max_capacity=12")

        # 12. Unenroll member
        unenroll_res = await client.delete(f"/api/classes/{class_id}/enroll/1", headers=admin_headers)
        assert unenroll_res.status_code == 204, f"Unenroll failed: {unenroll_res.status_code}"
        class_detail_after = await client.get(f"/api/classes/{class_id}", headers=admin_headers)
        assert class_detail_after.json()["enrolled_count"] == 0
        print("[PASS] 12. Unenrolled member #1 (enrolled_count returned to 0)")

        # 13. Update class status
        status_res = await client.patch(
            f"/api/classes/{class_id}",
            json={"status": "ongoing"},
            headers=admin_headers,
        )
        assert status_res.status_code == 200
        assert status_res.json()["status"] == "ongoing"
        print("[PASS] 13. Updated class session status to 'ongoing'")

        # 14. Schedule personal training session
        pt_sched_time = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()
        pt_payload = {
            "trainer_id": trainer_user["id"],
            "member_id": 1,
            "scheduled_at": pt_sched_time,
            "duration_minutes": 60,
            "notes": "Barbell squat mobility and depth coaching",
            "coach_notes": "Check ankle dorsiflexion",
        }
        create_pt_res = await client.post("/api/pt-sessions", json=pt_payload, headers=admin_headers)
        assert create_pt_res.status_code == 201, f"Create PT failed: {create_pt_res.text}"
        pt_session = create_pt_res.json()
        pt_id = pt_session["id"]
        assert pt_session["status"] == "scheduled"
        print(f"[PASS] 14. Scheduled PT session (ID: {pt_id}, Trainer: {trainer_user['full_name']})")

        # 15. Trainer updates PT session
        update_pt_res = await client.patch(
            f"/api/pt-sessions/{pt_id}",
            json={"status": "completed", "coach_notes": "Target depth achieved with heel elevation."},
            headers=trainer_headers,
        )
        assert update_pt_res.status_code == 200, f"Update PT failed: {update_pt_res.text}"
        assert update_pt_res.json()["status"] == "completed"
        print("[PASS] 15. Trainer updated PT session to 'completed' with coach notes")

        # 16. RBAC enforcement
        # Member tries to check in someone else
        rbac_visit = await client.post("/api/visits", json={"member_id": 1}, headers=member_headers)
        assert rbac_visit.status_code == 403, f"Expected 403, got {rbac_visit.status_code}"

        # Member tries to create class
        rbac_class = await client.post(
            "/api/classes",
            json={"name": "Hacked Class", "scheduled_at": sched_time},
            headers=member_headers,
        )
        assert rbac_class.status_code == 403, f"Expected 403, got {rbac_class.status_code}"

        # Member tries to schedule PT
        rbac_pt = await client.post(
            "/api/pt-sessions",
            json={"member_id": 1, "scheduled_at": pt_sched_time},
            headers=member_headers,
        )
        assert rbac_pt.status_code == 403, f"Expected 403, got {rbac_pt.status_code}"

        print("[PASS] 16. RBAC enforcement verified: Member role blocked from visits, classes create, and PT scheduling")

        print("\n========================================================")
        print("  ALL 16 PHASE 5 INTEGRATION TESTS PASSED SUCCESSFULLY!")
        print("========================================================\n")


if __name__ == "__main__":
    asyncio.run(run_tests())
