"""End-to-end API flow tests with role guards and billing."""

from __future__ import annotations

from datetime import date

from fastapi.testclient import TestClient


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_health_and_auth(client: TestClient):
    health = client.get("/api/health")
    assert health.status_code == 200
    assert health.json()["status"] == "ok"

    bad = client.post(
        "/api/auth/login", json={"username": "admin", "password": "nope"}
    )
    assert bad.status_code == 401

    response = client.post(
        "/api/auth/login", json={"username": "admin", "password": "admin123"}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["user"]["role"] == "admin"
    assert body["access_token"]

    me = client.get("/api/auth/me", headers=auth(body["access_token"]))
    assert me.status_code == 200
    assert me.json()["username"] == "admin"

    unauthorized = client.get("/api/children")
    assert unauthorized.status_code == 401


def test_role_guards(
    client: TestClient, admin_token: str, reception_token: str
):
    dashboard = client.get("/api/dashboard", headers=auth(reception_token))
    assert dashboard.status_code == 403

    admin_dashboard = client.get("/api/dashboard", headers=auth(admin_token))
    assert admin_dashboard.status_code == 200

    forbidden_settings = client.patch(
        "/api/settings",
        headers=auth(reception_token),
        json={"closing_time": "21:00"},
    )
    assert forbidden_settings.status_code == 403

    forbidden_plan = client.patch(
        "/api/plans/1",
        headers=auth(reception_token),
        json={"price": 999},
    )
    assert forbidden_plan.status_code == 403

    forbidden_demo = client.post(
        "/api/demo/fast-forward",
        headers=auth(reception_token),
        json={"minutes": 15},
    )
    assert forbidden_demo.status_code == 403


def test_registration_checkin_checkout_and_reports(
    client: TestClient, admin_token: str, reception_token: str
):
    headers = auth(reception_token)

    # Registration validation
    no_consent = client.post(
        "/api/children",
        headers=headers,
        json={
            "name": "No Consent",
            "age": 5,
            "parent_name": "Test Parent",
            "phone": "9000000009",
            "consent_given": False,
        },
    )
    assert no_consent.status_code == 422

    created = client.post(
        "/api/children",
        headers=headers,
        json={
            "name": "Test Kid",
            "age": 6,
            "parent_name": "Test Parent",
            "phone": "9000000001",
            "consent_given": True,
        },
    )
    assert created.status_code == 201, created.text
    child = created.json()
    assert child["phone"] == "9000000001"
    assert len(child["qr_code"]) == 36
    assert child["active_visit"] is None

    duplicated = client.post(
        "/api/children",
        headers=headers,
        json={
            "name": "Test Kid",
            "age": 6,
            "parent_name": "Test Parent",
            "phone": "9000000001",
            "consent_given": True,
        },
    )
    assert duplicated.status_code == 409

    by_qr = client.get(f"/api/children/qr/{child['qr_code']}", headers=headers)
    assert by_qr.status_code == 200
    assert by_qr.json()["id"] == child["id"]

    by_phone = client.get("/api/children", headers=headers, params={"phone": "9000000001"})
    assert by_phone.status_code == 200
    assert len(by_phone.json()) == 1

    # Plans
    plans = client.get("/api/plans", headers=headers)
    assert plans.status_code == 200
    plan = next(item for item in plans.json() if item["code"] == "play-30")

    # Check-in
    check_in = client.post(
        "/api/visits/check-in",
        headers=headers,
        json={"child_id": child["id"], "plan_id": plan["id"]},
    )
    assert check_in.status_code == 201, check_in.text
    visit = check_in.json()
    assert visit["alert"] in {"ok", "warning"}
    assert visit["booked_minutes"] == 30

    double = client.post(
        "/api/visits/check-in",
        headers=headers,
        json={"child_id": child["id"], "plan_id": plan["id"]},
    )
    assert double.status_code == 409

    live = client.get("/api/visits/active", headers=headers)
    assert live.status_code == 200
    live_body = live.json()
    assert any(item["id"] == visit["id"] for item in live_body["visits"])
    assert live_body["server_now"].endswith("+05:30")

    child_again = client.get(f"/api/children/{child['id']}", headers=headers)
    assert child_again.json()["active_visit"]["id"] == visit["id"]

    # Quote with an excessive flat discount is clamped to zero
    quote = client.get(
        f"/api/visits/{visit['id']}/quote",
        headers=headers,
        params={"discount_type": "flat", "discount_value": 1000},
    )
    assert quote.status_code == 200, quote.text
    quote_body = quote.json()
    assert quote_body["plan_price"] == 150.0
    assert quote_body["discount_amount"] == 150.0
    assert quote_body["total"] == 0.0

    # Checkout
    checkout = client.post(
        f"/api/visits/{visit['id']}/checkout",
        headers=headers,
        json={
            "payment_method": "cash",
            "discount_type": "flat",
            "discount_value": 1000,
        },
    )
    assert checkout.status_code == 200, checkout.text
    bill = checkout.json()
    assert bill["amount"] == 0.0
    assert bill["payment_method"] == "cash"
    assert bill["bill_number"].startswith("SB-")
    assert bill["plan_price"] == 150.0
    assert bill["staff_name"]

    second_checkout = client.post(
        f"/api/visits/{visit['id']}/checkout",
        headers=headers,
        json={"payment_method": "upi"},
    )
    assert second_checkout.status_code == 409

    bill_detail = client.get(f"/api/bills/{bill['id']}", headers=headers)
    assert bill_detail.status_code == 200
    assert bill_detail.json()["bill_number"] == bill["bill_number"]

    # Daily report (defaults to today in IST)
    report = client.get("/api/reports/daily", headers=headers)
    assert report.status_code == 200, report.text
    report_body = report.json()
    assert report_body["visits_count"] >= 1
    assert any(row["id"] == bill["id"] for row in report_body["bills"])
    assert report_body["collection"]["cash"] >= 0

    csv_response = client.get(
        "/api/reports/daily.csv",
        headers=headers,
        params={"date": date.today().isoformat()},
    )
    assert csv_response.status_code == 200
    assert "Bill No" in csv_response.text
    assert "text/csv" in csv_response.headers["content-type"]

    # Admin dashboard reflects the visit
    dashboard = client.get("/api/dashboard", headers=auth(admin_token))
    assert dashboard.status_code == 200
    dashboard_body = dashboard.json()
    assert dashboard_body["inside_now"] >= 0
    assert len(dashboard_body["week"]) == 7
    assert len(dashboard_body["plans"]) >= 3

    # Price snapshot: changing a plan must not alter the completed bill
    plan_update = client.patch(
        f"/api/plans/{plan['id']}",
        headers=auth(admin_token),
        json={"price": 175},
    )
    assert plan_update.status_code == 200
    assert plan_update.json()["price"] == 175.0

    bill_after = client.get(f"/api/bills/{bill['id']}", headers=headers).json()
    assert bill_after["plan_price"] == 150.0

    # Settings and demo clock (admin only)
    updated = client.patch(
        "/api/settings",
        headers=auth(admin_token),
        json={
            "closing_time": "21:00",
            "grace_minutes": 6,
            "overtime_rate": 60,
            "overtime_block_minutes": 15,
        },
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["closing_time"] == "21:00"
    assert updated.json()["grace_minutes"] == 6
    assert updated.json()["overtime_rate"] == 60.0

    invalid_time = client.patch(
        "/api/settings",
        headers=auth(admin_token),
        json={"closing_time": "25:00"},
    )
    assert invalid_time.status_code == 422

    fast_forward = client.post(
        "/api/demo/fast-forward",
        headers=auth(admin_token),
        json={"minutes": 15},
    )
    assert fast_forward.status_code == 200
    assert fast_forward.json()["offset_minutes"] == 15

    reset = client.post("/api/demo/reset-clock", headers=auth(admin_token))
    assert reset.status_code == 200
    assert reset.json()["offset_minutes"] == 0
