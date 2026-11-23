"""Interactive scenes: model, persistence, public payload, lead capture, export frames."""
import asyncio

import pytest
from fastapi.testclient import TestClient

import core
import render
import server
from test_p0_hardening import memdb  # noqa: F401  (fixture)


def _project(pid="prj_scene"):
    return {
        "id": pid, "user_id": "u1", "name": "Scene Demo", "draft": "d", "target_url": "https://example.com",
        "steps": [
            {"id": "sc_title", "action": "wait", "caption": "Welcome", "voiceover": "",
             "scene_type": "title", "scene": {"title": "Welcome", "subtitle": "A quick tour"},
             "exit_trigger": "timer", "duration_ms": 4000, "status": "done"},
            {"id": "st_1", "action": "click", "selector": "a", "caption": "Click link", "voiceover": "",
             "screenshot_path": "s1.jpg", "motion_paths": []},
            {"id": "sc_mail", "action": "wait", "caption": "Get the full walkthrough", "voiceover": "",
             "scene_type": "email",
             "scene": {"title": "Get the full walkthrough", "button_label": "Continue",
                       "webhook_url": "https://hooks.example.com/leads", "notify_owner": True},
             "exit_trigger": "submit", "skippable": True, "duration_ms": 6000, "status": "done"},
        ],
        "status": "ready", "share_id": "sh_scene", "is_public": True, "is_deleted": False,
        "brand": server.DEFAULT_BRAND, "exports": [], "created_at": core.now_iso(), "updated_at": core.now_iso(),
    }


@pytest.fixture
def client(memdb, monkeypatch):  # noqa: F811
    monkeypatch.setenv("JWT_SECRET", "K8mN2pQ5rS9tV3wX7yZ1cB4fG6hJ0lM2")
    monkeypatch.setenv("VAULT_MASTER_KEY", "V1aB2cD3eF4gH5iJ6kL7mN8oP9qR0sT1")
    server.app.dependency_overrides[core.get_current_user] = lambda: {"user_id": "u1", "email": "a@example.com", "name": "Alice"}
    yield TestClient(server.app)
    server.app.dependency_overrides.clear()


def test_scene_model_and_defaults():
    s = server.Step(scene_type="waitlist", exit_trigger="submit", skippable=True)
    assert s.scene_type == "waitlist" and s.exit_trigger == "submit" and s.skippable is True
    with pytest.raises(Exception):
        server.Step(scene_type="survey")
    with pytest.raises(Exception):
        server.Step(exit_trigger="explode")


def test_scene_render_frames(monkeypatch):
    import io as _io
    from PIL import Image
    buf = _io.BytesIO()
    Image.new("RGB", (64, 40), (20, 20, 30)).save(buf, format="JPEG")

    async def fake_get_object(path):
        return buf.getvalue(), "image/jpeg"
    monkeypatch.setattr(render, "get_object", fake_get_object)
    project = _project()
    project["narration_mode"] = "captions"
    frames = asyncio.run(render.load_frames(project))
    kinds = [f[0].get("scene_type") or "step" for f in frames]
    assert kinds == ["title", "step", "email"]
    assert render._step_ms(project["steps"][0], False) == 4000
    assert render._step_ms(project["steps"][2], False) == 6000


def test_update_persists_scene_as_done(client, memdb):  # noqa: F811
    proj = _project()
    asyncio.run(memdb.projects.insert_one(proj))
    body = {"steps": [
        {"id": "sc_new", "action": "wait", "scene_type": "title",
         "scene": {"title": "Hello"}, "exit_trigger": "timer", "duration_ms": 4000, "status": "pending"},
        {"id": "st_1", "action": "click", "selector": "a", "caption": "Go"},
    ]}
    res = client.put("/api/projects/prj_scene", json=body)
    assert res.status_code == 200, res.text
    stored = asyncio.run(memdb.projects.find_one({"id": "prj_scene"}))
    scene = next(s for s in stored["steps"] if s["id"] == "sc_new")
    assert scene["scene_type"] == "title" and scene["scene"]["title"] == "Hello"
    assert scene["status"] == "done"  # scenes are rendered, never recorded


def test_public_payload_strips_webhooks_and_lead_flow(client, memdb):  # noqa: F811
    asyncio.run(memdb.projects.insert_one(_project()))
    assert client.post("/api/projects/prj_scene/publish").status_code == 200

    res = client.get("/api/public/sh_scene")
    assert res.status_code == 200, res.text
    steps = res.json()["steps"]
    mail = next(s for s in steps if s["id"] == "sc_mail")
    assert mail["scene_type"] == "email" and mail["exit_trigger"] == "submit" and mail["skippable"] is True
    assert "webhook_url" not in mail["scene"] and "notify_owner" not in mail["scene"]

    bad = client.post("/api/public/sh_scene/events", json={
        "type": "lead", "session": "sess1234", "step_index": 2, "email": "not-an-email",
        "scene_id": "sc_mail", "scene_type": "email"})
    assert bad.status_code == 400

    ok = client.post("/api/public/sh_scene/events", json={
        "type": "lead", "session": "sess1234", "step_index": 2, "email": "ada@company.com",
        "name": "Ada", "scene_id": "sc_mail", "scene_type": "email"})
    assert ok.status_code == 200, ok.text
    ok2 = client.post("/api/public/sh_scene/events", json={
        "type": "lead", "session": "sess1234", "step_index": 2, "email": "grace@company.com",
        "scene_id": "sc_mail", "scene_type": "email"})
    assert ok2.status_code == 200

    analytics = client.get("/api/projects/prj_scene/analytics").json()
    emails = sorted(l["email"] for l in analytics["leads"])
    assert emails == ["ada@company.com", "grace@company.com"]
    ada = next(l for l in analytics["leads"] if l["email"] == "ada@company.com")
    assert ada["name"] == "Ada" and ada["scene_type"] == "email"

    csv_res = client.get("/api/projects/prj_scene/leads.csv")
    assert csv_res.status_code == 200
    assert "ada@company.com,Ada,email" in csv_res.text


def test_scene_rerecord_rejected(client, memdb):  # noqa: F811
    asyncio.run(memdb.projects.insert_one(_project()))
    res = client.post("/api/projects/prj_scene/steps/sc_mail/rerecord")
    assert res.status_code == 400
    assert "not recorded" in res.json()["detail"]
