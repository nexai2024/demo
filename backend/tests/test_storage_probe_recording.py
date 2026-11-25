"""Storage probe recording: startup/nightly/manual results persist, prune,
and drive the /api/ready summary the dashboard banner reads."""
import asyncio

import pytest
from fastapi.testclient import TestClient

import server
from test_p0_hardening import memdb  # noqa: F401  (fixture)

FAKE = {"configured": "s3", "bucket": "b", "endpoint": None, "region": "auto", "prefix": "",
        "ok": False, "served_by": None, "fallback_used": False, "latency_ms": 12,
        "error": "StorageError: bucket unreachable", "problems": []}


def test_record_storage_probe_persists_latest(memdb, monkeypatch):  # noqa: F811
    monkeypatch.setattr(server, "storage_probe", lambda: dict(FAKE))
    result = asyncio.run(server.record_storage_probe("nightly"))
    assert result["ok"] is False
    latest = asyncio.run(server.db.storage_probes.find_one({}, {"_id": 0}, sort=[("at", -1)]))
    assert latest["source"] == "nightly"
    assert latest["result"]["error"] == "StorageError: bucket unreachable"


def test_record_storage_probe_prunes_history(memdb, monkeypatch):  # noqa: F811
    monkeypatch.setattr(server, "storage_probe", lambda: dict(FAKE, ok=True, error=None))
    for _ in range(65):
        asyncio.run(server.record_storage_probe("manual"))
    rows = asyncio.run(server.db.storage_probes.find({}).to_list(200))
    assert len(rows) == 60


def test_cron_storage_probe_requires_secret(memdb, monkeypatch):  # noqa: F811
    monkeypatch.setattr(server, "storage_probe", lambda: dict(FAKE, ok=True, error=None))
    client = TestClient(server.app)
    monkeypatch.delenv("WEBHOOK_CRON_SECRET", raising=False)
    assert client.post("/api/cron/storage-probe", json={}).status_code == 503
    monkeypatch.setenv("WEBHOOK_CRON_SECRET", "s3cr3t")
    assert client.post("/api/cron/storage-probe", json={}).status_code == 401
    resp = client.post("/api/cron/storage-probe", json={},
                       headers={"Authorization": "Bearer s3cr3t"})
    assert resp.status_code == 200
    assert resp.json() == {"ok": True, "served_by": None, "error": None}
    latest = asyncio.run(server.db.storage_probes.find_one({}, {"_id": 0}, sort=[("at", -1)]))
    assert latest["source"] == "nightly"
