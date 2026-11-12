# Flowcast backend regression tests: auth, projects CRUD, steps, history, sharing/public, analytics, settings, guards
import os
import uuid

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN = {"email": "admin@flowcast.app", "password": "admin123"}


def _session(creds=ADMIN):
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json=creds)
    if r.status_code != 200:
        pytest.skip(f"login failed {r.status_code} {r.text}")
    return s


@pytest.fixture(scope="module")
def admin():
    return _session()


@pytest.fixture(scope="module")
def created(admin):
    ids = []
    yield ids
    for pid in ids:
        admin.delete(f"{BASE_URL}/api/projects/{pid}")


def _mk(admin, created, name="TEST_proj", **kw):
    r = admin.post(f"{BASE_URL}/api/projects", json={"name": name, "draft": kw.get("draft", "TEST draft text here"),
                                                        "target_url": kw.get("url", "https://example.com")})
    assert r.status_code == 200, r.text
    p = r.json()
    created.append(p["id"])
    return p


STEPS = [
    {"action": "goto", "url": "https://example.com", "caption": "Open", "voiceover": "Open site"},
    {"action": "click", "selector": "a", "fallback_selectors": ["text=More"], "caption": "Click link"},
    {"action": "type", "selector": "input", "text": "secret", "sensitive": True, "caption": "Type"},
]


# --- auth ---
class TestAuth:
    def test_login_sets_httponly_cookies(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN)
        assert r.status_code == 200
        d = r.json()
        assert d["email"] == ADMIN["email"] and "password_hash" not in d and "_id" not in d
        sc = r.headers.get("set-cookie", "").lower()
        assert "access_token" in sc and "httponly" in sc and "samesite=none" in sc and "secure" in sc

    def test_login_invalid(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN["email"], "password": "wrongpw"})
        assert r.status_code == 401

    def test_me_unauth(self):
        assert requests.get(f"{BASE_URL}/api/auth/me").status_code == 401

    def test_register_me_logout(self):
        email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        s = requests.Session()
        r = s.post(f"{BASE_URL}/api/auth/register", json={"name": "TEST_User", "email": email, "password": "pass1234"})
        assert r.status_code == 200, r.text
        assert r.json()["email"] == email
        me = s.get(f"{BASE_URL}/api/auth/me")
        assert me.status_code == 200 and me.json()["email"] == email
        dup = requests.post(f"{BASE_URL}/api/auth/register", json={"name": "x", "email": email, "password": "pass1234"})
        assert dup.status_code == 400
        assert s.post(f"{BASE_URL}/api/auth/logout").status_code == 200
        s.cookies.clear()
        assert s.get(f"{BASE_URL}/api/auth/me").status_code == 401

    def test_bruteforce_lockout(self):
        email = f"test_lock_{uuid.uuid4().hex[:8]}@example.com"
        requests.post(f"{BASE_URL}/api/auth/register", json={"name": "TEST_L", "email": email, "password": "pass1234"})
        codes = [requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": "bad"}).status_code
                 for _ in range(6)]
        assert codes[:5] == [401] * 5
        assert codes[5] == 429


# --- projects CRUD / list ---
class TestProjects:
    def test_create_get_list_step_count(self, admin, created):
        p = _mk(admin, created, "TEST_create")
        assert p["status"] == "draft" and p["steps"] == [] and "_id" not in p
        g = admin.get(f"{BASE_URL}/api/projects/{p['id']}")
        assert g.status_code == 200 and g.json()["name"] == "TEST_create"
        admin.put(f"{BASE_URL}/api/projects/{p['id']}", json={"steps": STEPS})
        lst = admin.get(f"{BASE_URL}/api/projects").json()
        item = next(x for x in lst if x["id"] == p["id"])
        assert item["step_count"] == 3
        assert "steps" not in item and "draft" not in item

    def test_update_steps_persist(self, admin, created):
        p = _mk(admin, created, "TEST_update")
        r = admin.put(f"{BASE_URL}/api/projects/{p['id']}",
                      json={"steps": STEPS, "name": "TEST_renamed", "target_url": "https://example.org"})
        assert r.status_code == 200
        g = admin.get(f"{BASE_URL}/api/projects/{p['id']}").json()
        assert g["name"] == "TEST_renamed" and g["target_url"] == "https://example.org"
        assert len(g["steps"]) == 3 and g["steps"][2]["sensitive"] is True
        assert g["steps"][1]["fallback_selectors"] == ["text=More"]
        assert all(s["id"].startswith("st_") for s in g["steps"])

    def test_invalid_step_rejected(self, admin, created):
        p = _mk(admin, created, "TEST_invalid")
        r = admin.put(f"{BASE_URL}/api/projects/{p['id']}", json={"steps": [{"action": "explode"}]})
        assert r.status_code == 422
        r = admin.put(f"{BASE_URL}/api/projects/{p['id']}", json={"brand": {"accent": "red"}})
        assert r.status_code == 422

    def test_duplicate_and_delete(self, admin, created):
        p = _mk(admin, created, "TEST_dup")
        admin.put(f"{BASE_URL}/api/projects/{p['id']}", json={"steps": STEPS})
        d = admin.post(f"{BASE_URL}/api/projects/{p['id']}/duplicate")
        assert d.status_code == 200
        dj = d.json()
        created.append(dj["id"])
        assert dj["name"] == "TEST_dup (copy)" and len(dj["steps"]) == 3 and dj["share_id"] != p["share_id"]
        assert admin.delete(f"{BASE_URL}/api/projects/{dj['id']}").status_code == 200
        assert admin.get(f"{BASE_URL}/api/projects/{dj['id']}").status_code == 404

    def test_other_user_cannot_access(self, admin, created):
        p = _mk(admin, created, "TEST_private")
        s = requests.Session()
        s.post(f"{BASE_URL}/api/auth/register", json={"name": "TEST_o", "email": f"test_{uuid.uuid4().hex[:8]}@example.com",
                                                       "password": "pass1234"})
        assert s.get(f"{BASE_URL}/api/projects/{p['id']}").status_code == 404


# --- history ---
class TestHistory:
    def test_history_and_restore(self, admin, created):
        p = _mk(admin, created, "TEST_hist")
        admin.put(f"{BASE_URL}/api/projects/{p['id']}", json={"steps": STEPS})
        admin.put(f"{BASE_URL}/api/projects/{p['id']}", json={"steps": STEPS[:1]})
        h = admin.get(f"{BASE_URL}/api/projects/{p['id']}/history").json()
        snap = next(x for x in h if x["has_snapshot"] and x["step_count"] == 3)
        r = admin.post(f"{BASE_URL}/api/projects/{p['id']}/history/{snap['id']}/restore")
        assert r.status_code == 200 and len(r.json()["steps"]) == 3
        assert admin.post(f"{BASE_URL}/api/projects/{p['id']}/history/nope/restore").status_code == 404


# --- guards: record/export/runs ---
class TestGuards:
    def test_record_browserless_missing(self, admin, created):
        p = _mk(admin, created, "TEST_rec")
        r = admin.post(f"{BASE_URL}/api/projects/{p['id']}/record")
        assert r.status_code == 400 and "Browserless is not connected" in r.json()["detail"]

    def test_export_requires_record(self, admin, created):
        p = _mk(admin, created, "TEST_exp")
        admin.put(f"{BASE_URL}/api/projects/{p['id']}", json={"steps": STEPS})
        r = admin.post(f"{BASE_URL}/api/projects/{p['id']}/export", json={"format": "gif"})
        assert r.status_code == 400 and r.json()["detail"] == "Record the demo before exporting"
        assert admin.post(f"{BASE_URL}/api/projects/{p['id']}/export", json={"format": "avi"}).status_code == 422

    def test_run_cancel_unknown(self, admin):
        assert admin.post(f"{BASE_URL}/api/runs/run_unknown/cancel").status_code == 404
        assert admin.get(f"{BASE_URL}/api/runs/run_unknown").status_code == 404

    def test_generate_validation(self, admin, created):
        p = _mk(admin, created, "TEST_gen", draft="short")
        r = admin.post(f"{BASE_URL}/api/projects/{p['id']}/generate")
        assert r.status_code == 400


# --- public share + analytics ---
class TestPublic:
    def test_share_flow_and_analytics(self, admin, created):
        p = _mk(admin, created, "TEST_share")
        admin.put(f"{BASE_URL}/api/projects/{p['id']}", json={"steps": STEPS})
        sid = p["share_id"]
        priv = requests.get(f"{BASE_URL}/api/public/{sid}")
        assert priv.status_code == 404 and "private" in priv.json()["detail"]
        assert requests.post(f"{BASE_URL}/api/public/{sid}/events", json={"type": "view", "session": "abcd1"}).status_code == 404
        admin.put(f"{BASE_URL}/api/projects/{p['id']}",
                  json={"is_public": True, "brand": {"accent": "#FF0000", "caption_position": "top", "watermark": False}})
        pub = requests.get(f"{BASE_URL}/api/public/{sid}")
        assert pub.status_code == 200
        pj = pub.json()
        assert pj["name"] == "TEST_share" and len(pj["steps"]) == 3 and pj["brand"]["accent"] == "#FF0000"
        assert "selector" not in pj["steps"][1] and "text" not in pj["steps"][2]
        for body in ({"type": "view", "session": "sess_1"}, {"type": "step", "session": "sess_1", "step_index": 2},
                     {"type": "complete", "session": "sess_1", "step_index": 2}):
            assert requests.post(f"{BASE_URL}/api/public/{sid}/events", json=body).status_code == 200
        assert requests.post(f"{BASE_URL}/api/public/{sid}/events", json={"type": "bogus", "session": "sess_1"}).status_code == 422
        assert requests.post(f"{BASE_URL}/api/public/{sid}/events", json={"type": "view", "session": "a"}).status_code == 422
        assert requests.post(f"{BASE_URL}/api/public/{sid}/events",
                             json={"type": "step", "session": "sess_1", "step_index": 999}).status_code == 422
        a = admin.get(f"{BASE_URL}/api/projects/{p['id']}/analytics").json()
        assert a["views"] == 1 and a["completions"] == 1 and a["completion_rate"] == 100 and a["per_step"] == [1, 1, 1]


# --- settings ---
class TestSettings:
    def test_settings_get_put(self, admin):
        s = admin.get(f"{BASE_URL}/api/settings")
        assert s.status_code == 200
        d = s.json()
        assert d["browserless_configured"] is False and d["llm_configured"] is True
        assert d["usage"]["limit"] == 100 and isinstance(d["usage"]["recordings_this_month"], int)
        orig = d["preferences"]
        r = admin.put(f"{BASE_URL}/api/settings", json={"voice": "echo", "narration_mode": "captions"})
        assert r.status_code == 200
        assert admin.get(f"{BASE_URL}/api/settings").json()["preferences"]["voice"] == "echo"
        admin.put(f"{BASE_URL}/api/settings", json=orig)
        assert admin.put(f"{BASE_URL}/api/settings", json={"voice": "bad", "narration_mode": "both"}).status_code == 422

    def test_tts_preview_error_handled(self, admin):
        r = admin.post(f"{BASE_URL}/api/tts/preview", json={"voice": "nova", "narration_mode": "both"})
        # budget exceeded expected -> should be a handled 4xx/502, not 500
        assert r.status_code in (200, 502), f"{r.status_code} {r.text[:200]}"
