import asyncio
import httpx

BASE_URL = "http://127.0.0.1:8000"

async def run_phase6_tests():
    print("\n" + "=" * 60)
    print("  THE DGYM — PHASE 6 ANALYTICS & CHURN PREDICTION TEST SUITE")
    print("=" * 60 + "\n")

    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30.0) as client:
        # 1. Health check
        res = await client.get("/api/health")
        assert res.status_code == 200, f"Health check failed: {res.text}"
        print("[PASS] 1. API Health Check verified (status: online)")

        # 2. Login as Admin
        res = await client.post("/api/auth/login", json={
            "email": "admin@thedgym.com",
            "password": "admin12345"
        })
        assert res.status_code == 200, f"Admin login failed: {res.text}"
        token = res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print("[PASS] 2. Admin logged in and JWT token acquired")

        # 3. Analytics Overview
        res = await client.get("/api/analytics/overview", headers=headers)
        assert res.status_code == 200, f"Analytics overview failed: {res.text}"
        overview = res.json()
        assert "total_visits_this_month" in overview
        assert "hourly_distribution" in overview
        assert "peak_hour" in overview
        print(f"[PASS] 3. Analytics Overview: Visits={overview['total_visits_this_month']}, Peak Hour={overview['peak_hour']}, Avg Dwell={overview['average_dwell_minutes']} mins")

        # 4. Churn Overview
        res = await client.get("/api/churn/overview", headers=headers)
        assert res.status_code == 200, f"Churn overview failed: {res.text}"
        churn_ov = res.json()
        assert "high_risk_count" in churn_ov
        assert "overall_retention_rate_pct" in churn_ov
        print(f"[PASS] 4. Churn Overview: Assessed={churn_ov['total_members_assessed']}, High Risk={churn_ov['high_risk_count']}, Med={churn_ov['medium_risk_count']}, Low={churn_ov['low_risk_count']}, Retention={churn_ov['overall_retention_rate_pct']}%")

        # 5. List at-risk members
        res = await client.get("/api/churn/members", headers=headers)
        assert res.status_code == 200, f"Churn members roster failed: {res.text}"
        members_list = res.json()
        assert len(members_list) > 0, "No members returned in churn roster"
        top_at_risk = members_list[0]
        print(f"[PASS] 5. At-Risk Members: {len(members_list)} assessed members returned. Top at-risk: {top_at_risk['full_name']} (Prob: {top_at_risk['churn_probability'] * 100:.1f}%, Tier: {top_at_risk['risk_tier']})")

        # 6. Filter by HIGH risk tier
        res = await client.get("/api/churn/members?risk_tier=HIGH", headers=headers)
        assert res.status_code == 200, f"High risk filter failed: {res.text}"
        high_risk_list = res.json()
        for m in high_risk_list:
            assert m["risk_tier"] == "HIGH", f"Expected HIGH tier, got {m['risk_tier']}"
        print(f"[PASS] 6. Filter by HIGH Risk: Found {len(high_risk_list)} members in HIGH risk tier")

        # 7. Get single member churn diagnosis
        sample_id = top_at_risk["member_id"]
        res = await client.get(f"/api/churn/member/{sample_id}", headers=headers)
        assert res.status_code == 200, f"Member churn diagnosis failed: {res.text}"
        detail = res.json()
        assert "features" in detail
        assert "top_risk_factors" in detail
        print(f"[PASS] 7. Member Churn Diagnosis for #{sample_id} ({detail['full_name']}):")
        print(f"       Risk Tier: {detail['risk_tier']} | Probability: {detail['churn_probability'] * 100:.1f}%")
        print(f"       Factors: {detail['top_risk_factors']}")

        # 8. Trigger XGBoost Retrain Pipeline
        res = await client.post("/api/churn/retrain", headers=headers)
        assert res.status_code == 200, f"Retrain endpoint failed: {res.text}"
        retrain_res = res.json()
        assert retrain_res["status"] == "success"
        print(f"[PASS] 8. XGBoost Retrain Pipeline triggered successfully (Model Accuracy: {retrain_res.get('model_accuracy', 1.0) * 100:.1f}%)")

        # 9. RBAC Enforcement: Unauthorized user cannot retrain
        member_res = await client.post("/api/auth/login", json={
            "email": "member@thedgym.com",
            "password": "member12345"
        })
        member_token = member_res.json()["access_token"]
        member_headers = {"Authorization": f"Bearer {member_token}"}
        res_blocked = await client.post("/api/churn/retrain", headers=member_headers)
        assert res_blocked.status_code == 403, f"Member should be blocked with 403, got {res_blocked.status_code}"
        print("[PASS] 9. RBAC Security: Non-admin role blocked from retrain endpoint (403 Forbidden)")

    print("\n" + "=" * 60)
    print("  ALL 9 PHASE 6 INTEGRATION TESTS PASSED SUCCESSFULLY!")
    print("=" * 60 + "\n")

if __name__ == "__main__":
    asyncio.run(run_phase6_tests())
