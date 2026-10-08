"""
Integration Test — Member Instructor Booking & Approval Workflow
Scenario:
1. Member logs in (Alex Cruz - member@thedgym.com).
2. Member retrieves list of available fitness instructors (GET /api/pt-sessions/trainers).
3. Member chooses an instructor (e.g. Head Coach Mark).
4. Member submits a booking request for a date & time (POST /api/pt-sessions/book).
5. Verify booking starts with status 'pending' and auto-links member record.
6. Member views their booking status in 'My Bookings' (GET /api/pt-sessions/my-bookings).
7. Instructor logs in (Head Coach Mark - trainer@thedgym.com).
8. Instructor approves the booking request (PATCH /api/pt-sessions/{id}/approve).
9. Verify booking status transitions to 'confirmed'.
10. Member submits a second booking request.
11. Instructor rejects the second booking with a reason (PATCH /api/pt-sessions/{id}/reject).
12. Verify booking status transitions to 'rejected' with the reason attached.
13. Member cancels a confirmed or pending booking (PATCH /api/pt-sessions/{id}/cancel).
14. Verify booking transitions to 'cancelled'.
"""
import asyncio
import httpx
from datetime import datetime, timezone, timedelta

BASE_URL = "http://127.0.0.1:8000"


async def run_tests():
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=10.0) as client:
        print("\n========================================================")
        print("  THE DGYM — MEMBER BOOKING & APPROVAL WORKFLOW TEST")
        print("========================================================\n")

        # 1. Member login
        member_login = await client.post(
            "/api/auth/login",
            json={"email": "member@thedgym.com", "password": "member12345"},
        )
        assert member_login.status_code == 200, f"Member login failed: {member_login.text}"
        member_token = member_login.json()["access_token"]
        member_headers = {"Authorization": f"Bearer {member_token}"}
        print("[PASS] 1. Member logged in (Alex Cruz)")

        # 2. Member views available instructors
        trainers_res = await client.get("/api/pt-sessions/trainers", headers=member_headers)
        assert trainers_res.status_code == 200, f"Trainers list failed: {trainers_res.text}"
        trainers = trainers_res.json()
        assert len(trainers) >= 1, "Expected at least 1 coach available"
        # Pick Head Coach Mark specifically
        coach = next((t for t in trainers if t["full_name"] == "Head Coach Mark"), trainers[0])
        print(f"[PASS] 2. Available instructors retrieved ({len(trainers)} found). Selected: {coach['full_name']}")

        # 3 & 4 & 5. Member selects date/time and submits booking
        target_date = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
        booking_payload = {
            "trainer_id": coach["id"],
            "scheduled_at": target_date,
            "duration_minutes": 60,
            "notes": "Powerlifting deadlift form coaching and hitch correction",
        }
        book_res = await client.post("/api/pt-sessions/book", json=booking_payload, headers=member_headers)
        assert book_res.status_code == 201, f"Booking request failed: {book_res.text}"
        booking = book_res.json()
        booking_id = booking["id"]
        assert booking["status"] == "pending", f"Expected 'pending' status, got {booking['status']}"
        assert booking["trainer_id"] == coach["id"]
        print(f"[PASS] 3-5. Member submitted booking #{booking_id}. Status: {booking['status'].upper()}")

        # 6. Member views booking status in My Bookings
        my_bookings_res = await client.get("/api/pt-sessions/my-bookings", headers=member_headers)
        assert my_bookings_res.status_code == 200
        my_bookings = my_bookings_res.json()
        assert any(b["id"] == booking_id and b["status"] == "pending" for b in my_bookings)
        print(f"[PASS] 6. Member verified booking #{booking_id} appears in 'My Bookings' as PENDING")

        # 7. Trainer login
        trainer_login = await client.post(
            "/api/auth/login",
            json={"email": "trainer@thedgym.com", "password": "trainer12345"},
        )
        assert trainer_login.status_code == 200
        trainer_token = trainer_login.json()["access_token"]
        trainer_headers = {"Authorization": f"Bearer {trainer_token}"}
        print("[PASS] 7. Instructor logged in (Head Coach Mark)")

        # 8 & 9. Instructor approves the booking
        approve_res = await client.patch(
            f"/api/pt-sessions/{booking_id}/approve",
            json={"coach_notes": "Confirmed. Bring lifting belt and flat shoes."},
            headers=trainer_headers,
        )
        assert approve_res.status_code == 200, f"Approve failed: {approve_res.text}"
        approved = approve_res.json()
        assert approved["status"] == "confirmed", f"Expected 'confirmed', got {approved['status']}"
        print(f"[PASS] 8-9. Instructor APPROVED booking #{booking_id}. Status now: {approved['status'].upper()}")

        # 10. Member submits second booking
        second_date = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()
        second_book_res = await client.post(
            "/api/pt-sessions/book",
            json={
                "trainer_id": coach["id"],
                "scheduled_at": second_date,
                "duration_minutes": 60,
                "notes": "Late evening squat session",
            },
            headers=member_headers,
        )
        assert second_book_res.status_code == 201
        second_booking_id = second_book_res.json()["id"]
        print(f"[PASS] 10. Member submitted second booking #{second_booking_id}")

        # 11 & 12. Instructor rejects second booking with reason
        reject_res = await client.patch(
            f"/api/pt-sessions/{second_booking_id}/reject",
            json={"reason": "Platform fully booked for Barbell Club during this evening slot."},
            headers=trainer_headers,
        )
        assert reject_res.status_code == 200, f"Reject failed: {reject_res.text}"
        rejected = reject_res.json()
        assert rejected["status"] == "rejected"
        assert "Barbell Club" in (rejected["rejection_reason"] or "")
        print(f"[PASS] 11-12. Instructor REJECTED booking #{second_booking_id}. Status: {rejected['status'].upper()} (Reason attached)")

        # 13 & 14. Member cancels first booking
        cancel_res = await client.patch(
            f"/api/pt-sessions/{booking_id}/cancel",
            json={},
            headers=member_headers,
        )
        assert cancel_res.status_code == 200
        cancelled = cancel_res.json()
        assert cancelled["status"] == "cancelled"
        print(f"[PASS] 13-14. Member CANCELLED booking #{booking_id}. Status: {cancelled['status'].upper()}")

        print("\n========================================================")
        print("  ALL BOOKING & APPROVAL WORKFLOW TESTS PASSED 100%!")
        print("========================================================\n")


if __name__ == "__main__":
    asyncio.run(run_tests())
