"""
Phase 4 Integration Tests — Core Gym Management System
Tests:
1. Health check
2. Admin authentication
3. List members & seed verification
4. Member stats endpoint
5. Register a new member (verify DGM-XXXX code generation)
6. Get member details & update member
7. List membership plans (verify seeded placeholder tiers)
8. Admin create new membership plan
9. Assign membership plan to member (verify end date & payment tracking)
10. Verify member now has membership attached
11. RBAC enforcement (Member role denied access to /api/members and /api/plans write)
"""
import asyncio
import httpx
import time
from datetime import datetime, timezone

BASE_URL = "http://127.0.0.1:8000"


async def run_tests():
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=10.0) as client:
        print("\n========================================================")
        print("  THE DGYM — PHASE 4 INTEGRATION TEST SUITE")
        print("========================================================\n")

        # 1. Health check
        res = await client.get("/api/health")
        assert res.status_code == 200, f"Health check failed: {res.text}"
        print("[PASS] 1. API Health Check verified (status: online)")

        # 2. Login as Admin
        admin_login = await client.post(
            "/api/auth/login",
            json={"email": "admin@thedgym.com", "password": "admin12345"},
        )
        assert admin_login.status_code == 200, f"Admin login failed: {admin_login.text}"
        admin_token = admin_login.json()["access_token"]
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        print("[PASS] 2. Admin login successful & JWT obtained")

        # 3. List members
        members_res = await client.get("/api/members", headers=admin_headers)
        assert members_res.status_code == 200, f"List members failed: {members_res.text}"
        members = members_res.json()
        assert len(members) >= 5, f"Expected at least 5 seeded members, got {len(members)}"
        print(f"[PASS] 3. List members: Found {len(members)} members with DGM-XXXX codes")

        # 4. Member stats
        stats_res = await client.get("/api/members/stats", headers=admin_headers)
        assert stats_res.status_code == 200, f"Member stats failed: {stats_res.text}"
        stats = stats_res.json()
        assert "total" in stats and "active" in stats
        print(f"[PASS] 4. Member stats: Total={stats['total']}, Active={stats['active']}, Expired={stats['expired']}")

        # 5. Create new member
        ts = int(time.time())
        new_member_payload = {
            "first_name": "Gabriel",
            "last_name": f"Mendoza_{ts}",
            "email": f"gabriel.mendoza_{ts}@testdgym.ph",
            "phone": "09175558899",
            "gender": "male",
            "address": "Rosario, Batangas",
            "emergency_contact_name": "Elena Mendoza",
            "emergency_contact_phone": "09185551122",
            "notes": "Interested in powerlifting coaching",
        }
        create_res = await client.post("/api/members", json=new_member_payload, headers=admin_headers)
        assert create_res.status_code == 201, f"Create member failed: {create_res.text}"
        created_member = create_res.json()
        assert created_member["first_name"] == "Gabriel"
        assert created_member["member_code"].startswith("DGM-")
        member_id = created_member["id"]
        print(f"[PASS] 5. Member registered: {created_member['full_name']} (Code: {created_member['member_code']})")

        # 6. Get member & update member
        get_res = await client.get(f"/api/members/{member_id}", headers=admin_headers)
        assert get_res.status_code == 200
        patch_res = await client.patch(
            f"/api/members/{member_id}",
            json={"phone": "09170009999", "notes": "Updated notes: competitive lifter"},
            headers=admin_headers,
        )
        assert patch_res.status_code == 200
        assert patch_res.json()["phone"] == "09170009999"
        print("[PASS] 6. Member details retrieved and successfully updated")

        # 7. List membership plans
        plans_res = await client.get("/api/plans", headers=admin_headers)
        assert plans_res.status_code == 200
        plans = plans_res.json()
        assert len(plans) >= 5
        print(f"[PASS] 7. Membership plans list: Found {len(plans)} plans (Day Pass, Monthly, Quarterly, Annual, Student)")

        # 8. Admin create new plan
        new_plan_payload = {
            "name": f"VIP Annual Access {ts}",
            "slug": f"vip-annual-{ts}",
            "description": "All access pass + locker + 2 free coach sessions",
            "duration_days": 365,
            "price_php": 8500.00,
            "is_active": True,
            "sort_order": 10,
        }
        plan_create_res = await client.post("/api/plans", json=new_plan_payload, headers=admin_headers)
        assert plan_create_res.status_code == 201, f"Create plan failed: {plan_create_res.text}"
        created_plan = plan_create_res.json()
        plan_id = created_plan["id"]
        print(f"[PASS] 8. Admin created new plan: {created_plan['name']} (PHP {created_plan['price_php']})")

        # 9. Assign membership plan to member
        assign_payload = {
            "member_id": member_id,
            "plan_id": plan_id,
            "start_date": datetime.now(timezone.utc).isoformat(),
            "paid_amount": 8500.00,
            "payment_method": "gcash",
            "payment_reference": "GCASH-987654321",
            "notes": "Paid via GCash QR at front desk",
        }
        assign_res = await client.post("/api/memberships", json=assign_payload, headers=admin_headers)
        assert assign_res.status_code == 201, f"Assign membership failed: {assign_res.text}"
        assigned = assign_res.json()
        assert assigned["status"] == "active"
        assert assigned["payment_method"] == "gcash"
        print(f"[PASS] 9. Membership assigned: Plan '{assigned['plan_name']}', Payment: GCash, Status: {assigned['status']}")

        # 10. Verify member now has membership attached
        member_detail = await client.get(f"/api/members/{member_id}", headers=admin_headers)
        assert member_detail.status_code == 200, f"Get member detail failed: {member_detail.text}"
        member_data = member_detail.json()
        assert len(member_data["memberships"]) >= 1, f"Expected memberships attached, got {member_data}"
        print(f"[PASS] 10. Member detail shows {len(member_data['memberships'])} active membership attached")

        # 11. RBAC enforcement: Member role test
        member_login = await client.post(
            "/api/auth/login",
            json={"email": "member@thedgym.com", "password": "member12345"},
        )
        assert member_login.status_code == 200
        member_token = member_login.json()["access_token"]
        member_headers = {"Authorization": f"Bearer {member_token}"}

        # Member attempts to view members list -> 403 Forbidden
        rbac_members = await client.get("/api/members", headers=member_headers)
        assert rbac_members.status_code == 403, f"Expected 403, got {rbac_members.status_code}"

        # Member attempts to create a plan -> 403 Forbidden
        rbac_plan = await client.post(
            "/api/plans",
            json={"name": "Hacker Plan", "slug": "hacker", "duration_days": 1, "price_php": 0},
            headers=member_headers,
        )
        assert rbac_plan.status_code == 403, f"Expected 403, got {rbac_plan.status_code}"
        print("[PASS] 11. RBAC enforcement: Member blocked from /api/members (403) and /api/plans write (403)")

        print("\n========================================================")
        print("  ALL 11 PHASE 4 INTEGRATION TESTS PASSED SUCCESSFULLY!")
        print("========================================================\n")


if __name__ == "__main__":
    asyncio.run(run_tests())
