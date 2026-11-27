"""Release-check tests covering every P0 hardening requirement offline (no network, no external DB)."""
import asyncio
import copy
import io
from datetime import datetime, timedelta, timezone

import httpx
import pytest
from fastapi.testclient import TestClient

import core
import jobs
import netpolicy
import product
import server
import storage
import studio_plus
import vault
from ncb_store import DuplicateKeyError, _apply, _match, _project


# ---------- lightweight in-memory Mongo-compatible test double ----------
class _Res:
    def __init__(self, matched: int, modified: int):
        self.matched_count = matched
        self.modified_count = modified


class _Cursor:
    def __init__(self, docs: list, projection):
        self.docs = docs
        self.projection = projection
        self._sort = None

    def sort(self, key, direction=-1):
        self._sort = (key, direction)
        return self

    async def to_list(self, limit: int = 100):
        out = list(self.docs)
        if self._sort:
            k, d = self._sort
            out.sort(key=lambda doc: doc.get(k) or "", reverse=d < 0)
        return [_project(copy.deepcopy(doc), self.projection) for doc in out[:limit]]


class _MemCollection:
    def __init__(self):
        self.rows: list[dict] = []

    async def find_one(self, filt: dict, projection=None, sort=None):
        hits = [copy.deepcopy(r) for r in self.rows if _match(r, filt)]
        if sort:
            for k, d in reversed(sort):
                hits.sort(key=lambda doc, field=k: doc.get(field) or "", reverse=d < 0)
        return _project(hits[0], projection) if hits else None

    def find(self, filt: dict, projection=None):
        hits = [copy.deepcopy(r) for r in self.rows if _match(r, filt)]
        return _Cursor(hits, projection)

    async def insert_one(self, doc: dict):
        d = copy.deepcopy(doc)
        for key in ("id", "run_id"):
            if d.get(key) and any(r.get(key) == d[key] for r in self.rows):
                raise DuplicateKeyError(d[key])
        self.rows.append(d)
        return d

    async def update_one(self, filt: dict, update: dict, upsert: bool = False, array_filters=None):
        for idx, r in enumerate(self.rows):
            if _match(r, filt):
                doc = copy.deepcopy(r)
                _apply(doc, update, filt, array_filters, inserting=False)
                self.rows[idx] = doc
                return _Res(1, 1)
        if upsert:
            doc = {k: v for k, v in filt.items() if not isinstance(v, dict) and "." not in k}
            _apply(doc, update, filt, array_filters, inserting=True)
            await self.insert_one(doc)
            return _Res(0, 1)
        return _Res(0, 0)

    async def update_many(self, filt: dict, update: dict):
        n = 0
        for idx, r in enumerate(self.rows):
            if _match(r, filt):
                doc = copy.deepcopy(r)
                _apply(doc, update, filt, None, inserting=False)
                self.rows[idx] = doc
                n += 1
        return _Res(n, n)

    async def delete_one(self, filt: dict):
        for idx, r in enumerate(self.rows):
            if _match(r, filt):
                self.rows.pop(idx)
                return

    async def count_documents(self, filt: dict) -> int:
        return sum(1 for r in self.rows if _match(r, filt))


class _MemDB:
    def __init__(self):
        self._cols: dict[str, _MemCollection] = {}

    def __getattr__(self, name: str) -> _MemCollection:
        return self._cols.setdefault(name, _MemCollection())

    def __getitem__(self, name: str) -> _MemCollection:
        return self._cols.setdefault(name, _MemCollection())


@pytest.fixture
def memdb(monkeypatch):
    fake = _MemDB()
    for mod in (core, jobs, server, studio_plus):
        monkeypatch.setattr(mod, "db", fake)
    return fake


@pytest.fixture
def fake_dns(monkeypatch):
    mapping = {
        "public.example": ["93.184.216.34"],
        "evil-rebind.example": ["10.0.0.5"],
        "meta.example": ["169.254.169.254"],
        "v6mapped.example": ["::ffff:127.0.0.1"],
    }

    def resolve(host, port):
        if host in mapping:
            return mapping[host]
        return [host] if host[0].isdigit() or ":" in host else []

    netpolicy.set_resolver(resolve)
    yield mapping
    netpolicy.set_resolver(None)


# ========== 1. P0: Constrain outbound requests ==========
@pytest.mark.parametrize("bad_url", [
    "http://localhost/admin",
    "http://127.0.0.1:8000/api",
    "http://169.254.169.254/latest/meta-data/",
    "http://10.0.0.1/internal",
    "http://evil-rebind.example/hook",
    "http://meta.example/hook",
    "http://v6mapped.example/hook",
    "https://public.example:22/",
    "https://user:pass@public.example/hook",
    "file:///etc/passwd",
])
def test_outbound_policy_blocks_protected_destinations(fake_dns, bad_url):
    with pytest.raises(netpolicy.DestinationBlocked):
        netpolicy.validate_url_sync(bad_url)


def test_href_policy_skips_dns_but_blocks_private_ips(fake_dns):
    # Player CTAs are opened by the viewer — unresolved public hostnames are fine.
    assert netpolicy.validate_href_sync("https://unresolved.example/cta").host == "unresolved.example"
    assert netpolicy.incomplete_href("https://") is True
    with pytest.raises(netpolicy.DestinationBlocked):
        netpolicy.validate_href_sync("http://127.0.0.1/internal")
    with pytest.raises(netpolicy.DestinationBlocked):
        netpolicy.validate_href_sync("https://localhost/x")


def test_outbound_policy_pins_ip_and_refuses_redirects(fake_dns):
    seen = {}

    def handler(req: httpx.Request) -> httpx.Response:
        seen["url"] = str(req.url)
        seen["host"] = req.headers.get("host")
        seen["sni"] = req.extensions.get("sni_hostname")
        return httpx.Response(200, json={"ok": True})

    transport = httpx.MockTransport(handler)
    ok, status, err = asyncio.run(netpolicy.post_json("https://public.example/webhook", {"a": 1}, transport=transport))
    assert (ok, status, err) == (True, 200, "")
    assert "93.184.216.34" in seen["url"]
    assert seen["host"] == "public.example"
    assert seen["sni"] == "public.example"

    # Protected destination is blocked before any transport call
    ok2, status2, err2 = asyncio.run(netpolicy.post_json("http://evil-rebind.example/hook", {"a": 1}, transport=transport))
    assert ok2 is False and status2 == 0 and err2.startswith("blocked:")


def test_browser_guard_blocks_internal_subresources_and_websockets(fake_dns):
    guard = netpolicy.BrowserGuard()
    aborted, continued, ws_closed = [], [], []

    class FakeReq:
        def __init__(self, url):
            self.url = url

    class FakeRoute:
        def __init__(self, url):
            self.request = FakeReq(url)

        async def abort(self, reason):
            aborted.append((self.request.url, reason))

        async def continue_(self):
            continued.append(self.request.url)

    class FakeWS:
        def __init__(self, url):
            self.url = url

        async def close(self, code=1000, reason=""):
            ws_closed.append((self.url, code))

        def connect_to_server(self):
            continued.append(self.url)

    asyncio.run(guard.handle_route(FakeRoute("https://public.example/app.js")))
    asyncio.run(guard.handle_route(FakeRoute("http://169.254.169.254/latest/meta-data/")))
    asyncio.run(guard.handle_ws(FakeWS("ws://127.0.0.1:9222/devtools")))
    asyncio.run(guard.handle_ws(FakeWS("wss://public.example/live")))

    assert "https://public.example/app.js" in continued
    assert "wss://public.example/live" in continued
    assert any("169.254.169.254" in u for u, _ in aborted)
    assert any("127.0.0.1" in u for u, _ in ws_closed)


# ========== 2. P0: Protect signing keys and captured credentials ==========
def test_production_rejects_weak_or_missing_keys(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("JWT_SECRET", "local-dev-jwt-secret-placeholder-123456")
    monkeypatch.setenv("VAULT_MASTER_KEY", "a" * 40)
    monkeypatch.setenv("CORS_ORIGINS", "https://app.example.com")
    monkeypatch.setenv("S3_BUCKET", "prod-bucket")
    monkeypatch.setattr(core, "DB_BACKEND", "mongodb")
    with pytest.raises(RuntimeError):
        core.validate_config()


def test_jwt_and_vault_key_rotation(monkeypatch):
    old_jwt = "K8mN2pQ5rS9tV3wX7yZ1cB4fG6hJ0lM2"
    new_jwt = "Z9yX7wV5tS3rQ1pN8mK6jH4gF2dC0bA9"
    monkeypatch.setenv("JWT_SECRET", old_jwt)
    tok = core.create_viewer_token("share_1")
    monkeypatch.setenv("JWT_SECRET", new_jwt)
    monkeypatch.setenv("JWT_SECRET_PREVIOUS", old_jwt)
    assert core.decode_viewer_token(tok) == "share_1"

    old_vk = "V1aB2cD3eF4gH5iJ6kL7mN8oP9qR0sT1"
    new_vk = "W9zY8xW7vU6tS5rQ4pO3nM2lK1jI0hG9"
    monkeypatch.setenv("VAULT_MASTER_KEY", old_vk)
    sealed = vault.seal("super-secret-pw", "prj_1:login.password")
    assert sealed.startswith("v1:") and "super-secret-pw" not in sealed
    monkeypatch.setenv("VAULT_MASTER_KEY", new_vk)
    monkeypatch.setenv("VAULT_MASTER_KEY_PREVIOUS", old_vk)
    assert vault.unseal(sealed, "prj_1:login.password") == "super-secret-pw"
    # Context binding prevents moving ciphertext to another project
    with pytest.raises(vault.VaultError):
        vault.unseal(sealed, "prj_OTHER:login.password")


def test_open_login_soft_fails_when_key_rotated_without_previous(monkeypatch):
    old_vk = "V1aB2cD3eF4gH5iJ6kL7mN8oP9qR0sT1"
    new_vk = "W9zY8xW7vU6tS5rQ4pO3nM2lK1jI0hG9"
    fresh = __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat()
    monkeypatch.setenv("VAULT_MASTER_KEY", old_vk)
    monkeypatch.delenv("VAULT_MASTER_KEY_PREVIOUS", raising=False)
    sealed = vault.seal_login({
        "username": "alice",
        "password": "my-password-123",
        "credentials_saved_at": fresh,
        "storage_state": {"cookies": [{"name": "sid", "value": "cookie-secret"}]},
        "storage_saved_at": fresh,
    }, "prj_1")
    monkeypatch.setenv("VAULT_MASTER_KEY", new_vk)
    opened = vault.open_login(sealed, "prj_1")
    assert "password" not in opened and opened.get("credential_unreadable") is True
    assert "storage_state" not in opened and opened.get("storage_unreadable") is True
    assert opened.get("username") == "alice"
    cleaned, changed = vault.drop_unreadable_login(sealed, "prj_1")
    assert changed is True
    assert "password" not in cleaned and "storage_state" not in cleaned
    assert cleaned.get("username") == "alice"


def test_credential_and_storage_expiry_and_redaction(monkeypatch):
    monkeypatch.setenv("VAULT_MASTER_KEY", "V1aB2cD3eF4gH5iJ6kL7mN8oP9qR0sT1")
    old_ts = (datetime.now(timezone.utc) - timedelta(days=45)).isoformat()
    fresh_ts = datetime.now(timezone.utc).isoformat()

    sealed_expired = vault.seal_login({
        "url": "https://public.example/login",
        "username": "alice",
        "password": "my-password-123",
        "credentials_saved_at": old_ts,
        "storage_state": {"cookies": [{"name": "sid", "value": "cookie-secret"}]},
        "storage_saved_at": old_ts,
    }, "prj_1")
    assert "my-password-123" not in str(sealed_expired)
    assert "cookie-secret" not in str(sealed_expired)

    opened_expired = vault.open_login(sealed_expired, "prj_1")
    assert "password" not in opened_expired and opened_expired["credential_expired"] is True
    assert "storage_state" not in opened_expired and opened_expired["storage_expired"] is True

    sealed_fresh = vault.seal_login({
        "password": "my-password-123", "credentials_saved_at": fresh_ts,
        "storage_state": {"cookies": [{"name": "sid", "value": "cookie-secret"}]}, "storage_saved_at": fresh_ts,
    }, "prj_1")
    opened_fresh = vault.open_login(sealed_fresh, "prj_1")
    assert opened_fresh["password"] == "my-password-123"
    assert opened_fresh["storage_state"]["cookies"][0]["value"] == "cookie-secret"

    owner = vault.owner_login_view(sealed_fresh, "prj_1")
    assert "password" not in owner and "storage_state" not in owner

    steps = [{"id": "s1", "action": "type", "text": "top-secret", "sensitive": True}]
    sealed_steps = vault.seal_steps(steps, "prj_1")
    assert sealed_steps[0]["text"] != "top-secret" and vault.is_sealed(sealed_steps[0]["text"])
    assert vault.redact_steps(sealed_steps)[0]["text"] == ""
    assert vault.mask_steps(sealed_steps)[0]["text"] == vault.MASK
    assert vault.scrub("failed typing top-secret into input", {"top-secret"}) == "failed typing [redacted] into input"


# ========== 3. P0: Enforce share access on every asset & immutable releases ==========
def test_share_access_immutable_releases_and_cache_headers(memdb, monkeypatch):
    monkeypatch.setenv("JWT_SECRET", "K8mN2pQ5rS9tV3wX7yZ1cB4fG6hJ0lM2")
    monkeypatch.setenv("VAULT_MASTER_KEY", "V1aB2cD3eF4gH5iJ6kL7mN8oP9qR0sT1")

    async def fake_get_object(path):
        return b"JPEGDATA", "image/jpeg"

    monkeypatch.setattr(server, "get_object", fake_get_object)

    user = {"user_id": "u1", "email": "a@example.com", "name": "Alice"}
    server.app.dependency_overrides[core.get_current_user] = lambda: user
    try:
        client = TestClient(server.app)
        proj = {
            "id": "prj_1", "user_id": "u1", "name": "Demo", "draft": "d", "target_url": "https://public.example",
            "steps": [{"id": "st_1", "action": "type", "text": vault.seal("pw-secret", "prj_1:step:st_1:text"),
                       "sensitive": True, "caption": "v1 caption", "voiceover": "",
                       "screenshot_path": "s1.jpg", "motion_paths": ["m0.jpg"]}],
            "status": "ready", "share_id": "sh_1", "is_public": True, "is_deleted": False,
            "brand": server.DEFAULT_BRAND, "exports": [], "created_at": core.now_iso(), "updated_at": core.now_iso(),
        }
        asyncio.run(memdb.projects.insert_one(proj))

        # Draft without explicit published snapshot MUST return 404 (never fall back to draft steps)
        assert client.get("/api/public/sh_1").status_code == 404
        assert client.get("/api/public/sh_1/steps/st_1/screenshot").status_code == 404
        assert client.get("/api/public/sh_1/steps/st_1/motion/0").status_code == 404

        # Publish explicit immutable release
        pub = client.post("/api/projects/prj_1/publish")
        assert pub.status_code == 200
        raw_after_pub = asyncio.run(memdb.projects.find_one({"id": "prj_1"}))
        assert raw_after_pub["published"]["steps"][0]["text"] == ""  # sensitive text redacted in release

        # Edit draft after publish: public release must stay immutable at "v1 caption"
        asyncio.run(memdb.projects.update_one({"id": "prj_1"}, {"$set": {"steps": [
            {**proj["steps"][0], "caption": "DRAFT v2 UNPUBLISHED"}
        ]}}))
        res = client.get("/api/public/sh_1")
        assert res.status_code == 200 and res.json()["steps"][0]["caption"] == "v1 caption"
        assert "public" not in (res.headers.get("cache-control") or "").lower()

        # Motion frame must NOT have `public` Cache-Control
        mres = client.get("/api/public/sh_1/steps/st_1/motion/0")
        assert mres.status_code == 200
        assert "public" not in mres.headers["cache-control"].lower()
        assert "private" in mres.headers["cache-control"].lower()

        # Password-protected share enforces 401 on demo + assets + motion, and uses private, no-store
        pw_hash = core.hash_password("letmein123")
        asyncio.run(memdb.projects.update_one({"id": "prj_1"}, {"$set": {"share_password_hash": pw_hash}}))
        assert client.get("/api/public/sh_1").status_code == 401
        assert client.get("/api/public/sh_1/steps/st_1/motion/0").status_code == 401
        token = client.post("/api/public/sh_1/unlock", json={"password": "letmein123"}).json()["token"]
        m_auth = client.get("/api/public/sh_1/steps/st_1/motion/0", headers={"X-Viewer-Token": token})
        assert m_auth.status_code == 200
        assert "no-store" in m_auth.headers["cache-control"].lower()
        assert "private" in m_auth.headers["cache-control"].lower()

        # Expired share returns 410 across demo and assets
        expired_at = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
        asyncio.run(memdb.projects.update_one({"id": "prj_1"}, {"$set": {"share_expires_at": expired_at}}))
        assert client.get("/api/public/sh_1", headers={"X-Viewer-Token": token}).status_code == 410
        assert client.get("/api/public/sh_1/steps/st_1/motion/0", headers={"X-Viewer-Token": token}).status_code == 410

        # Revoked share (is_public=False) returns 404
        asyncio.run(memdb.projects.update_one({"id": "prj_1"}, {"$set": {"share_expires_at": None, "is_public": False}}))
        assert client.get("/api/public/sh_1", headers={"X-Viewer-Token": token}).status_code == 404

        # Review link supports explicit revocation
        rv = client.post("/api/projects/prj_1/review-link").json()["token"]
        assert client.get(f"/api/review/{rv}").status_code == 200
        rv_asset = client.get(f"/api/review/{rv}/steps/st_1/screenshot")
        assert rv_asset.status_code == 200 and "no-store" in rv_asset.headers["cache-control"].lower()
        assert client.delete("/api/projects/prj_1/review-link").status_code == 200
        assert client.get(f"/api/review/{rv}").status_code == 401
    finally:
        server.app.dependency_overrides.clear()


# ========== 4. P0: Durable jobs, atomic leases & quotas, persisted cancellation ==========
def test_durable_jobs_leases_quotas_cancellation_and_restart_recovery(memdb, monkeypatch):
    # This test claims runs in-process, i.e. the embedded-worker topology.
    monkeypatch.setenv("EMBEDDED_WORKER", "true")
    monkeypatch.setenv("WORKER_CLAIM_SHARED", "true")  # allow claims under APP_ENV=development + Atlas URL in shell env
    proj = {
        "id": "prj_j", "user_id": "u1", "name": "Job Demo", "status": "ready",
        "steps": [{"id": "s1", "screenshot_path": "a.jpg", "caption": "hi"}],
        "exports": [], "active_run_id": None, "is_deleted": False,
    }
    asyncio.run(memdb.projects.insert_one(proj))

    # Enqueue job #1: acquires lease + reserves quota atomically
    run1 = asyncio.run(jobs.enqueue_run(proj, "record", 1, "start", {"action": "record"}, seconds=30, monthly_limit=1))
    assert run1["status"] == "queued"

    # Concurrent enqueue while leased -> 409
    with pytest.raises(Exception) as exc:
        asyncio.run(jobs.enqueue_run(proj, "record", 1, "dup", {"action": "record"}, seconds=30, monthly_limit=1))
    assert getattr(exc.value, "status_code", None) == 409

    # Worker A claims job #1 and writes a step checkpoint, then "crashes" (lease expires)
    claimed_a = asyncio.run(jobs.claim_next_run(owner="wrk_A"))
    assert claimed_a["id"] == run1["id"] and claimed_a["attempt"] == 1
    asyncio.run(jobs.record_checkpoint(run1["id"], "s1"))
    assert "s1" in asyncio.run(jobs.completed_checkpoint_steps(run1["id"]))

    # Simulate crash by expiring lease in DB
    past = (datetime.now(timezone.utc) - timedelta(seconds=10)).isoformat()
    asyncio.run(memdb.runs.update_one({"id": run1["id"]}, {"$set": {"lease_expires_at": past}}))

    # Worker B reclaims the expired run; quota is NOT charged a second time
    claimed_b = asyncio.run(jobs.claim_next_run(owner="wrk_B"))
    assert claimed_b["id"] == run1["id"] and claimed_b["attempt"] == 2 and claimed_b["owner"] == "wrk_B"
    count, secs = asyncio.run(jobs.usage_summary("u1"))
    assert (count, secs) == (1, 30)

    # Persisted cancellation is visible to any replica
    asyncio.run(jobs.request_cancel(run1["id"], "u1"))
    assert asyncio.run(jobs.is_cancelled(run1["id"])) is True

    # Finalize wins exactly once (idempotent terminal outcome)
    assert asyncio.run(jobs.finalize_run(run1["id"], "prj_j", "cancelled", "stopped")) is True
    assert asyncio.run(jobs.finalize_run(run1["id"], "prj_j", "completed", "late")) is False

    # Monthly limit (1) is now enforced on next run
    with pytest.raises(Exception) as exc2:
        asyncio.run(jobs.enqueue_run(proj, "record", 1, "over", {"action": "record"}, seconds=30, monthly_limit=1))
    assert getattr(exc2.value, "status_code", None) == 402


def test_export_retry_does_not_duplicate_artifact(memdb, monkeypatch):
    monkeypatch.setenv("EMBEDDED_WORKER", "true")
    proj = {
        "id": "prj_ex", "user_id": "u1", "name": "Export Demo", "status": "ready",
        "steps": [{"id": "s1", "screenshot_path": "a.jpg", "caption": "hi"}],
        "exports": [], "active_run_id": None, "is_deleted": False,
    }
    asyncio.run(memdb.projects.insert_one(proj))

    class FakeRender:
        async def render(self, p, fmt):
            return b"MP4BYTES"

    uploaded = {}

    async def fake_put(path, data, ct):
        uploaded[path] = data
        return path

    monkeypatch.setattr(server, "render", FakeRender())
    monkeypatch.setattr(server, "put_object", fake_put)

    r1 = asyncio.run(jobs.enqueue_run(proj, "export", 3, "exp", {"action": "export", "format": "mp4", "preset": "standard"}))
    asyncio.run(server.job_export(proj, r1["id"], "mp4", "standard"))
    r2 = asyncio.run(jobs.enqueue_run(proj, "export", 3, "exp2", {"action": "export", "format": "mp4", "preset": "standard"}))
    asyncio.run(server.job_export(proj, r2["id"], "mp4", "standard"))

    fresh = asyncio.run(memdb.projects.find_one({"id": "prj_ex"}))
    assert len(fresh["exports"]) == 1  # cached / deduplicated, never duplicated


# ========== 4b. Stale runs never lease a project forever; enqueue needs a worker ==========
def _job_proj(pid):
    return {
        "id": pid, "user_id": "u1", "name": "Stale Demo", "status": "ready",
        "steps": [{"id": "s1", "screenshot_path": "a.jpg", "caption": "hi"}],
        "exports": [], "active_run_id": None, "is_deleted": False,
    }


def test_enqueue_fails_fast_when_no_worker(memdb, monkeypatch):
    monkeypatch.setenv("EMBEDDED_WORKER", "false")
    monkeypatch.delenv("WORKER_CLAIM_SHARED", raising=False)
    proj = _job_proj("prj_nw")
    asyncio.run(memdb.projects.insert_one(proj))

    with pytest.raises(Exception) as exc:
        asyncio.run(jobs.enqueue_run(proj, "export", 1, "x", {"action": "export"}))
    assert getattr(exc.value, "status_code", None) == 503
    # The rejected attempt must not lease the project or queue anything
    fresh = asyncio.run(memdb.projects.find_one({"id": "prj_nw"}))
    assert not fresh.get("active_run_id")
    assert asyncio.run(memdb.runs.find_one({"project_id": "prj_nw"})) is None

    # Once a worker heartbeats, enqueue succeeds again
    monkeypatch.setenv("WORKER_CLAIM_SHARED", "true")
    asyncio.run(jobs.note_worker_presence("wrk_ext"))
    run = asyncio.run(jobs.enqueue_run(proj, "export", 1, "x", {"action": "export"}))
    assert run["status"] == "queued"


def test_stale_queued_run_auto_clears_and_unblocks(memdb, monkeypatch):
    monkeypatch.setenv("EMBEDDED_WORKER", "true")
    monkeypatch.setenv("WORKER_CLAIM_SHARED", "true")
    proj = _job_proj("prj_sq")
    asyncio.run(memdb.projects.insert_one(proj))
    run1 = asyncio.run(jobs.enqueue_run(proj, "export", 1, "x", {"action": "export"}))

    # No worker ever claimed it; age it past the stale window
    past = (datetime.now(timezone.utc) - timedelta(seconds=jobs.STALE_SECONDS + 60)).isoformat()
    asyncio.run(memdb.runs.update_one({"id": run1["id"]}, {"$set": {"started_at": past}}))

    run2 = asyncio.run(jobs.enqueue_run(proj, "export", 1, "y", {"action": "export"}))
    assert run2["status"] == "queued"
    old = asyncio.run(memdb.runs.find_one({"id": run1["id"]}))
    assert old["status"] == "failed" and "No worker picked up" in old["message"]
    fresh = asyncio.run(memdb.projects.find_one({"id": "prj_sq"}))
    assert fresh["active_run_id"] == run2["id"]


def test_stale_running_run_auto_clears_and_unblocks(memdb, monkeypatch):
    monkeypatch.setenv("EMBEDDED_WORKER", "true")
    monkeypatch.setenv("WORKER_CLAIM_SHARED", "true")
    proj = _job_proj("prj_sr")
    asyncio.run(memdb.projects.insert_one(proj))
    run1 = asyncio.run(jobs.enqueue_run(proj, "export", 1, "x", {"action": "export"}))
    claimed = asyncio.run(jobs.claim_next_run(owner="wrk_dead"))
    assert claimed["id"] == run1["id"]

    # Worker died: lease and heartbeat far past due
    past = (datetime.now(timezone.utc) - timedelta(seconds=jobs.STALE_SECONDS + 60)).isoformat()
    asyncio.run(memdb.runs.update_one({"id": run1["id"]},
                                      {"$set": {"lease_expires_at": past, "heartbeat_at": past}}))

    run2 = asyncio.run(jobs.enqueue_run(proj, "export", 1, "y", {"action": "export"}))
    assert run2["status"] == "queued"
    old = asyncio.run(memdb.runs.find_one({"id": run1["id"]}))
    assert old["status"] == "failed" and "stopped responding" in old["message"]


def test_recent_running_run_still_blocks(memdb, monkeypatch):
    monkeypatch.setenv("EMBEDDED_WORKER", "true")
    monkeypatch.setenv("WORKER_CLAIM_SHARED", "true")
    proj = _job_proj("prj_fresh")
    asyncio.run(memdb.projects.insert_one(proj))
    asyncio.run(jobs.enqueue_run(proj, "export", 1, "x", {"action": "export"}))
    asyncio.run(jobs.claim_next_run(owner="wrk_live"))
    with pytest.raises(Exception) as exc:
        asyncio.run(jobs.enqueue_run(proj, "export", 1, "y", {"action": "export"}))
    assert getattr(exc.value, "status_code", None) == 409



def test_dev_worker_refuses_remote_mongo_claims(monkeypatch):
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.delenv("WORKER_CLAIM_SHARED", raising=False)
    monkeypatch.setenv("MONGO_URL", "mongodb+srv://user:pass@cluster.mongodb.net/app")
    assert jobs.worker_may_claim() is False
    monkeypatch.setenv("APP_ENV", "production")
    assert jobs.worker_may_claim() is True


# ========== 5. P0: Require durable shared media storage ==========
def test_storage_forbids_local_fallback_in_production_and_retries_s3(monkeypatch):
    storage.reset_client()
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.delenv("S3_BUCKET", raising=False)
    monkeypatch.delenv("NCB_INSTANCE", raising=False)
    with pytest.raises(storage.StorageError):
        storage.init_storage()
    with pytest.raises(storage.StorageError):
        asyncio.run(storage.put_object("appshowcase/a.jpg", b"123", "image/jpeg"))

    # Simulate shared S3 bucket across two replicas/restarts with 1 transient upload failure
    bucket_store: dict[str, tuple[bytes, str]] = {}
    calls = {"put": 0}

    class FakeS3:
        def head_bucket(self, Bucket):
            return {}

        def put_object(self, Bucket, Key, Body, ContentType):
            calls["put"] += 1
            if calls["put"] == 1:
                raise RuntimeError("transient 503")
            bucket_store[Key] = (Body, ContentType)

        def get_object(self, Bucket, Key):
            if Key not in bucket_store:
                err = RuntimeError("missing")
                err.response = {"Error": {"Code": "NoSuchKey"}}
                raise err
            body, ct = bucket_store[Key]
            return {"Body": io.BytesIO(body), "ContentType": ct, "ContentLength": len(body)}

        def head_object(self, Bucket, Key):
            if Key not in bucket_store:
                err = RuntimeError("missing")
                err.response = {"Error": {"Code": "NoSuchKey"}, "ResponseMetadata": {"HTTPStatusCode": 404}}
                raise err
            body, ct = bucket_store[Key]
            return {"ContentLength": len(body), "ContentType": ct}

    monkeypatch.setenv("S3_BUCKET", "prod-shared-bucket")
    monkeypatch.setattr(storage, "_get_s3_client", lambda: FakeS3())
    monkeypatch.setattr(storage.time, "sleep", lambda _: None)

    path = asyncio.run(storage.put_object("appshowcase/u1/p1/s1.jpg", b"IMG", "image/jpeg"))
    assert calls["put"] == 2  # retried transient error and succeeded
    # Simulate reading from a second replica / after restart
    storage.reset_client()
    monkeypatch.setattr(storage, "_get_s3_client", lambda: FakeS3())
    data, media = asyncio.run(storage.get_object(path))
    assert data == b"IMG" and media == "image/jpeg"
