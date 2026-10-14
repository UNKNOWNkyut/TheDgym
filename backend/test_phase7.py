import json
import urllib.request
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = "http://localhost:8000/api"

def make_request(url, method="GET", data=None, token=None):
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    encoded_data = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(url, data=encoded_data, headers=headers, method=method)
    with urllib.request.urlopen(req) as resp:
        return resp.status, json.loads(resp.read().decode("utf-8"))

def test_phase7():
    print("=== STARTING PHASE 7 VERIFICATION SUITE ===")

    # 1. Login as Admin
    print("\n1. Logging in as Admin...")
    status, res = make_request(
        f"{BASE_URL}/auth/login",
        method="POST",
        data={"email": "admin@thedgym.com", "password": "admin12345"},
    )
    assert status == 200, f"Admin login failed: {res}"
    admin_token = res["access_token"]
    print("[OK] Admin login successful.")

    # 2. Login as Member
    print("\n2. Logging in as Member (Alex Cruz)...")
    status, res = make_request(
        f"{BASE_URL}/auth/login",
        method="POST",
        data={"email": "member@thedgym.com", "password": "member12345"},
    )
    assert status == 200, f"Member login failed: {res}"
    member_token = res["access_token"]
    member_user = res["user"]
    print(f"[OK] Member login successful: {member_user['full_name']}")

    # 3. Find a member ID to test
    print("\n3. Fetching at-risk members from Churn API...")
    status, churn_members = make_request(
        f"{BASE_URL}/churn/members?limit=5",
        method="GET",
        token=admin_token,
    )
    assert status == 200, f"Fetching churn members failed: {churn_members}"
    assert len(churn_members) > 0, "No members found in churn roster"
    target_member = churn_members[0]
    target_id = target_member["member_id"]
    print(f"[OK] Selected member: {target_member['full_name']} (ID: {target_id}, Risk: {target_member['risk_tier']})")

    # 4. Generate AI Retention Strategy
    print(f"\n4. Generating AI Retention Strategy for member {target_id}...")
    status, strategy = make_request(
        f"{BASE_URL}/retention/generate/{target_id}",
        method="POST",
        token=admin_token,
    )
    assert status == 200, f"Generate strategy failed: {strategy}"
    assert strategy["strategy_title"], "Missing strategy_title"
    assert strategy["diagnosis_summary"], "Missing diagnosis_summary"
    assert len(strategy["tactical_action_steps"]) > 0, "Missing tactical_action_steps"
    assert strategy["offer_title"], "Missing offer_title"
    print(f"[OK] Strategy Generated: '{strategy['strategy_title']}' [Urgency: {strategy['urgency']}]")
    print(f"[OK] Offer: '{strategy['offer_title']}'")

    # 5. Retrieve Generated Strategy
    print(f"\n5. Verifying strategy persistence via GET /api/retention/member/{target_id}...")
    status, retrieved = make_request(
        f"{BASE_URL}/retention/member/{target_id}",
        method="GET",
        token=admin_token,
    )
    assert status == 200, f"Retrieve strategy failed: {retrieved}"
    assert retrieved["id"] == strategy["id"], "ID mismatch in retrieved strategy"
    print("[OK] Strategy retrieved and persisted successfully.")

    # 6. Dispatch Offer to Member
    print(f"\n6. Dispatching retention offer to {target_member['full_name']}...")
    dispatch_payload = {
        "strategy_id": strategy["id"],
        "member_id": target_id,
        "title": strategy["offer_title"],
        "message": strategy["offer_message"],
        "action_text": strategy["offer_action_text"],
        "action_url": strategy["offer_action_url"],
    }
    status, dispatch_res = make_request(
        f"{BASE_URL}/retention/dispatch-offer",
        method="POST",
        data=dispatch_payload,
        token=admin_token,
    )
    assert status == 200, f"Dispatch offer failed: {dispatch_res}"
    notif_id = dispatch_res["notification_id"]
    print(f"[OK] Offer dispatched successfully! Notification ID: {notif_id}")

    # 7. Member receives notification
    print("\n7. Dispatching test notification to logged-in member (member@thedgym.com)...")
    status, all_members = make_request(
        f"{BASE_URL}/members?search=member@thedgym.com",
        method="GET",
        token=admin_token,
    )
    alex_id = all_members[0]["id"] if all_members else target_id
    status, alex_dispatch = make_request(
        f"{BASE_URL}/retention/dispatch-offer",
        method="POST",
        data={
            "member_id": alex_id,
            "title": "VIP Retention Offer: 20% OFF",
            "message": "Exclusive loyal athlete rate valid this week.",
            "action_text": "Claim Discount",
            "action_url": "/membership",
        },
        token=admin_token,
    )
    alex_notif_id = alex_dispatch["notification_id"]
    print(f"[OK] Dispatched to Alex Cruz (Notification ID: {alex_notif_id})")

    # 8. Check member's notifications
    print("\n8. Fetching notifications as Member (Alex Cruz)...")
    status, notifs = make_request(
        f"{BASE_URL}/notifications",
        method="GET",
        token=member_token,
    )
    assert status == 200, f"Fetching notifications failed: {notifs}"
    assert any(n["id"] == alex_notif_id for n in notifs), "Dispatched notification not found in member inbox"
    print(f"[OK] Member inbox contains {len(notifs)} notification(s). Dispatched notification found!")

    # 9. Mark notification as read
    print(f"\n9. Marking notification {alex_notif_id} as read...")
    status, mark_res = make_request(
        f"{BASE_URL}/notifications/{alex_notif_id}/read",
        method="PATCH",
        token=member_token,
    )
    assert status == 200, f"Mark read failed: {mark_res}"
    print("[OK] Notification marked as read successfully.")

    # 10. Mark all as read
    print("\n10. Testing mark all as read...")
    status, read_all_res = make_request(
        f"{BASE_URL}/notifications/read-all",
        method="POST",
        token=member_token,
    )
    assert status == 200, f"Mark all read failed: {read_all_res}"
    print(f"[OK] Read all executed successfully! Updated count: {read_all_res['updated_count']}")

    print("\n==========================================")
    print("ALL 10 PHASE 7 INTEGRATION TESTS PASSED!")
    print("==========================================")

if __name__ == "__main__":
    test_phase7()
