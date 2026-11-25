"""Clerk identity, admin user management, utilization, and billing sync."""
import asyncio
import base64
import hashlib
import hmac
import json
import time

from fastapi.testclient import TestClient

import clerk_service
import core
import jobs
import server
from test_p0_hardening import memdb  # noqa: F401  (fixture)

ADMIN = {"user_id": "admin1", "email": "admin@example.com", "name": "Admin", "role": "admin", "status": "active"}
USER = {"user_id": "u1", "email": "user@example.com", "name": "User", "role": "user", "status": "active"}


def _client(monkeypatch, who=ADMIN):
    monkeypatch.setenv("JWT_SECRET", "K8mN2pQ5rS9tV3wX7yZ1cB4fG6hJ0lM2")
    monkeypatch.setenv("VAULT_MASTER_KEY", "V1aB2cD3eF4gH5iJ6kL7mN8oP9qR0sT1")
    server.app.dependency_overrides[core.get_current_user] = lambda: dict(who)
    return TestClient(server.app)


def _seed(memdb):
    asyncio.run(memdb.users.insert_one({**ADMIN, "plan": "free", "billing_status": "free",
                                        "preferences": core.DEFAULT_PREFS, "created_at": "2026-11-01T00:00:00+00:00"}))
    asyncio.run(memdb.users.insert_one({**USER, "plan": "free", "billing_status": "free",
                                        "preferences": core.DEFAULT_PREFS, "created_at": "2026-11-02T00:00:00+00:00"}))
    asyncio.run(memdb.projects.insert_one({"id": "p1", "user_id": "u1", "is_deleted": False, "updated_at": "2026-11-25T00:00:00+00:00"}))
    asyncio.run(memdb.runs.insert_one({"id": "r1", "user_id": "u1", "status": "done", "kind": "record", "started_at": "2026-11-25T00:00:00+00:00", "seconds": 90}))
    asyncio.run(memdb.quota_reservations.insert_one({"id": "r1", "user_id": "u1", "month": jobs._month_key(), "seconds": 90, "status": "reserved"}))


def test_admin_can_view_users_and_utilization(memdb, monkeypatch):  # noqa: F811
    _seed(memdb)
    client = _client(monkeypatch)
    try:
        summary = client.get("/api/admin/summary")
        assert summary.status_code == 200
        assert summary.json()["users"] == 2
        assert summary.json()["projects"] == 1
        listing = client.get("/api/admin/users")
        assert listing.status_code == 200
        row = next(item for item in listing.json()["users"] if item["user_id"] == "u1")
        assert row["usage"]["projects"] == 1
        assert row["usage"]["runs"] == 1
        assert row["usage"]["recordings_this_month"] == 1
        assert row["usage"]["seconds_this_month"] == 90
    finally:
        server.app.dependency_overrides.clear()


def test_non_admin_cannot_use_admin_api(memdb, monkeypatch):  # noqa: F811
    _seed(memdb)
    client = _client(monkeypatch, USER)
    try:
        assert client.get("/api/admin/users").status_code == 403
    finally:
        server.app.dependency_overrides.clear()


def test_admin_suspend_reactivate_and_audit(memdb, monkeypatch):  # noqa: F811
    _seed(memdb)
    monkeypatch.delenv("CLERK_SECRET_KEY", raising=False)
    monkeypatch.delenv("CLERK_PUBLISHABLE_KEY", raising=False)
    monkeypatch.delenv("AUTH_PROVIDER", raising=False)
    client = _client(monkeypatch)
    try:
        assert client.post("/api/admin/users/u1/suspend").status_code == 200
        doc = asyncio.run(memdb.users.find_one({"user_id": "u1"}, {"_id": 0}))
        assert doc["status"] == "suspended"
        assert client.post("/api/admin/users/u1/reactivate").status_code == 200
        doc = asyncio.run(memdb.users.find_one({"user_id": "u1"}, {"_id": 0}))
        assert doc["status"] == "active"
        audit = client.get("/api/admin/audit").json()["entries"]
        assert [entry["action"] for entry in audit[:2]] == ["user.reactivate", "user.suspend"]
    finally:
        server.app.dependency_overrides.clear()


def test_clerk_bearer_provisions_local_profile(memdb, monkeypatch):  # noqa: F811
    frontend_api = base64.b64encode(b"clerk.example.com$").decode()
    monkeypatch.setenv("AUTH_PROVIDER", "clerk")
    monkeypatch.setenv("CLERK_PUBLISHABLE_KEY", f"pk_test_{frontend_api}")
    monkeypatch.delenv("CLERK_SECRET_KEY", raising=False)
    monkeypatch.setattr(clerk_service, "_decode_token_sync", lambda token: {
        "sub": "user_clerk1", "email": "new@example.com", "name": "New User", "iss": "https://clerk.example.com",
        "exp": 9999999999, "iat": 1,
    })
    client = TestClient(server.app)
    response = client.get("/api/auth/me", headers={"Authorization": "Bearer fake-session"})
    assert response.status_code == 200
    assert response.json()["user_id"] == "user_clerk1"
    assert response.json()["auth_provider"] == "clerk"
    doc = asyncio.run(memdb.users.find_one({"user_id": "user_clerk1"}, {"_id": 0}))
    assert doc["email"] == "new@example.com"


def test_clerk_subscription_webhook_syncs_plan(memdb, monkeypatch):  # noqa: F811
    _seed(memdb)
    key = b"test-webhook-key"
    monkeypatch.setenv("CLERK_WEBHOOK_SIGNING_SECRET", "whsec_" + base64.b64encode(key).decode())
    payload = {"type": "subscription.updated", "data": {
        "id": "sub_1", "status": "active", "payer": {"user_id": "u1"},
        "items": [{"status": "active", "plan": {"slug": "pro"}}],
    }}
    raw = json.dumps(payload).encode()
    timestamp = str(int(time.time()))
    signed = f"msg_1.{timestamp}.".encode() + raw
    signature = base64.b64encode(hmac.new(key, signed, hashlib.sha256).digest()).decode()
    client = TestClient(server.app)
    response = client.post("/api/webhooks/clerk", content=raw, headers={
        "Content-Type": "application/json", "svix-id": "msg_1", "svix-timestamp": timestamp,
        "svix-signature": f"v1,{signature}",
    })
    assert response.status_code == 200
    doc = asyncio.run(memdb.users.find_one({"user_id": "u1"}, {"_id": 0}))
    assert doc["plan"] == "pro"
    assert doc["billing_status"] == "active"


def test_canceled_paid_plan_falls_back_to_free_limits(memdb, monkeypatch):  # noqa: F811
    _seed(memdb)
    asyncio.run(memdb.users.update_one({"user_id": "u1"}, {"$set": {"plan": "pro", "billing_status": "canceled"}}))
    client = _client(monkeypatch, {**USER, "plan": "pro", "billing_status": "canceled"})
    try:
        data = client.get("/api/settings").json()
        assert data["usage"]["plan_slug"] == "free"
        assert data["usage"]["limit"] == 20
    finally:
        server.app.dependency_overrides.clear()


def test_paid_plan_changes_settings_limits(memdb, monkeypatch):  # noqa: F811
    _seed(memdb)
    asyncio.run(memdb.users.update_one({"user_id": "u1"}, {"$set": {"plan": "pro", "billing_status": "active"}}))
    client = _client(monkeypatch, {**USER, "plan": "pro", "billing_status": "active"})
    try:
        data = client.get("/api/settings").json()
        assert data["usage"]["plan_slug"] == "pro"
        assert data["usage"]["limit"] == 500
        assert data["usage"]["seconds_limit"] == 60000
    finally:
        server.app.dependency_overrides.clear()
