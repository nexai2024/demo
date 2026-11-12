import asyncio
import hashlib
import json
import logging
import os
from contextlib import suppress
from typing import Literal, Optional

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel, Field
from pymongo import ASCENDING, DESCENDING, IndexModel
from starlette.middleware.cors import CORSMiddleware

import ai
import engine
import render
from auth_routes import router as auth_router, seed_admin
from core import client, db, get_current_user, new_id, now_iso
from storage import APP_NAME, get_object, init_storage, put_object

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

INDEXES: dict[str, list[IndexModel]] = {
    "users": [IndexModel([("email", ASCENDING)], name="email", unique=True),
              IndexModel([("user_id", ASCENDING)], name="user_id", unique=True)],
    "user_sessions": [IndexModel([("session_token", ASCENDING)], name="session_token")],
    "login_attempts": [IndexModel([("identifier", ASCENDING)], name="identifier")],
    "projects": [IndexModel([("id", ASCENDING)], name="id", unique=True),
                 IndexModel([("user_id", ASCENDING), ("updated_at", DESCENDING)], name="user_updated"),
                 IndexModel([("share_id", ASCENDING)], name="share_id")],
    "runs": [IndexModel([("id", ASCENDING)], name="id", unique=True),
             IndexModel([("project_id", ASCENDING), ("started_at", DESCENDING)], name="project_started")],
    "history": [IndexModel([("project_id", ASCENDING), ("created_at", DESCENDING)], name="project_created")],
    "analytics_events": [IndexModel([("project_id", ASCENDING), ("created_at", DESCENDING)], name="project_created")],
}


async def ensure_indexes() -> None:
    for collection, models in INDEXES.items():
        for model in models:
            try:
                await db[collection].create_indexes([model])
            except Exception as exc:
                logger.error("ensure_indexes(%s.%s): %s", collection, model.document["name"], exc)


app = FastAPI()
api = APIRouter(prefix="/api")
TASKS: set = set()
CANCELLED: set = set()
MONTHLY_LIMIT = int(os.environ["MONTHLY_RECORDING_LIMIT"])
DEFAULT_BRAND = {"accent": "#6366F1", "caption_position": "bottom", "watermark": True}


class Cancelled(Exception):
    pass
Action = Literal["goto", "click", "type", "hover", "scroll", "press", "wait"]


class Step(BaseModel):
    id: str = Field(default_factory=lambda: new_id("st_"))
    action: Action = "wait"
    url: Optional[str] = None
    selector: Optional[str] = None
    fallback_selectors: list[str] = []
    resolved_selector: Optional[str] = None
    text: Optional[str] = None
    sensitive: bool = False
    amount: int = 600
    wait_ms: int = Field(800, ge=0, le=30000)
    caption: str = ""
    voiceover: str = ""
    duration_ms: int = Field(3000, ge=500, le=30000)
    transition: Literal["none", "fade"] = "fade"
    transition_ms: int = Field(400, ge=0, le=3000)
    screenshot_path: Optional[str] = None
    thumb_path: Optional[str] = None
    audio_voice: Optional[str] = None
    audio_path: Optional[str] = None
    audio_text: Optional[str] = None
    audio_duration_ms: Optional[int] = None
    hotspot: Optional[dict] = None
    status: str = "pending"
    error: Optional[str] = None
    attempts: int = 0
    page_url: Optional[str] = None


class ProjectIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    draft: str = ""
    target_url: str = ""


class Brand(BaseModel):
    accent: str = Field("#6366F1", pattern=r"^#[0-9a-fA-F]{6}$")
    caption_position: Literal["top", "bottom"] = "bottom"
    watermark: bool = True


class RewriteIn(BaseModel):
    instruction: str = Field(min_length=3, max_length=300)


class EventIn(BaseModel):
    type: Literal["view", "step", "complete"]
    session: str = Field(min_length=4, max_length=64)
    step_index: int = Field(0, ge=0, le=200)


class ProjectUpdate(BaseModel):
    brand: Optional[Brand] = None
    name: Optional[str] = None
    draft: Optional[str] = None
    target_url: Optional[str] = None
    steps: Optional[list[Step]] = None
    voice: Optional[str] = None
    narration_mode: Optional[Literal["captions", "voiceover", "both"]] = None
    is_public: Optional[bool] = None


class ExportIn(BaseModel):
    format: Literal["gif", "mp4"]


class PrefsIn(BaseModel):
    voice: Literal["alloy", "ash", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer"]
    narration_mode: Literal["captions", "voiceover", "both"]


# ---------- helpers ----------
async def get_project(pid: str, user: dict) -> dict:
    p = await db.projects.find_one({"id": pid, "user_id": user["user_id"], "is_deleted": False}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Project not found")
    return p


async def log_history(project: dict, event: str, detail: str = "", snapshot: bool = False) -> None:
    doc = {"id": new_id("h_"), "project_id": project["id"], "event": event, "detail": detail,
           "created_at": now_iso(), "steps": project.get("steps") if snapshot else None}
    await db.history.insert_one(doc)


async def touch(pid: str, fields: dict) -> None:
    await db.projects.update_one({"id": pid}, {"$set": {**fields, "updated_at": now_iso()}})


def spawn(coro) -> None:
    task = asyncio.create_task(coro)
    TASKS.add(task)
    task.add_done_callback(TASKS.discard)


async def new_run(project: dict, kind: str, total: int, message: str) -> dict:
    run = {"id": new_id("run_"), "project_id": project["id"], "user_id": project["user_id"], "kind": kind,
           "status": "running", "total": total, "current": 0, "message": message,
           "logs": [{"t": now_iso(), "level": "info", "msg": message}], "result": None,
           "started_at": now_iso(), "finished_at": None}
    await db.runs.insert_one(dict(run))
    await touch(project["id"], {"active_run_id": run["id"]})
    run.pop("_id", None)
    return run


async def run_log(run_id: str, msg: str, level: str = "info", **fields) -> None:
    await db.runs.update_one({"id": run_id}, {"$set": {"message": msg, **fields},
                                             "$push": {"logs": {"t": now_iso(), "level": level, "msg": msg}}})


async def finish_run(run_id: str, pid: str, status: str, msg: str, result=None) -> None:
    await run_log(run_id, msg, "error" if status == "failed" else "success",
                  status=status, finished_at=now_iso(), result=result)
    await touch(pid, {"active_run_id": None})
    CANCELLED.discard(run_id)


async def ensure_idle(project: dict) -> None:
    rid = project.get("active_run_id")
    if rid and await db.runs.find_one({"id": rid, "status": "running"}, {"_id": 0}):
        raise HTTPException(409, "Another job is already running for this project")


def normalize_steps(raw: list, target_url: str) -> list:
    steps = []
    for r in raw:
        try:
            s = Step(**{k: v for k, v in r.items() if k in Step.model_fields and v is not None})
        except Exception:
            continue
        if s.action == "goto" and not s.url:
            s.url = target_url
        steps.append(s.model_dump())
    return steps


# ---------- background jobs ----------
async def job_record(project: dict, run_id: str, only_idx: Optional[int]) -> None:
    pid, steps = project["id"], project["steps"]
    n = len(steps)

    async def on_progress(i: int, step: dict, state: str, data: dict) -> None:
        if run_id in CANCELLED:
            raise Cancelled()
        if only_idx is not None and i != only_idx:
            if state == "running":
                await run_log(run_id, f"Replaying step {i + 1}/{n} to reach target: {engine.describe(step)}", current=i + 1)
            elif state == "failed":
                await run_log(run_id, f"Replay of step {i + 1} failed: {data.get('error')}", "warn")
            return
        if state == "running":
            await db.projects.update_one({"id": pid, "steps.id": step["id"]}, {"$set": {"steps.$.status": "running"}})
            await run_log(run_id, f"Step {i + 1}/{n}: {engine.describe(step)}...", current=i + 1)
            return
        upd = {"steps.$.status": state, "steps.$.error": data.get("error"), "steps.$.attempts": data.get("attempts", 1),
               "steps.$.hotspot": data.get("hotspot"), "steps.$.page_url": data.get("url"),
               "steps.$.resolved_selector": data.get("resolved_selector")}
        if data.get("screenshot"):
            base = f"{APP_NAME}/u/{project['user_id']}/{pid}/{step['id']}_{new_id()}"
            path = await put_object(f"{base}.jpg", data["screenshot"], "image/jpeg")
            thumb = await asyncio.to_thread(render.make_thumb, data["screenshot"])
            upd["steps.$.thumb_path"] = await put_object(f"{base}_t.webp", thumb, "image/webp")
            upd["steps.$.screenshot_path"] = path
            if i == 0 or not project.get("thumbnail_path"):
                await touch(pid, {"thumbnail_path": path})
                project["thumbnail_path"] = path
        await db.projects.update_one({"id": pid, "steps.id": step["id"]}, {"$set": upd})
        if state == "failed":
            await run_log(run_id, f"Step {i + 1} failed after {data.get('attempts')} attempts: {data.get('error')}", "error")
        else:
            await run_log(run_id, f"Step {i + 1}/{n} captured", "success")

    try:
        await engine.run_steps(steps, on_progress, capture_only=None if only_idx is None else {only_idx})
        fresh = await db.projects.find_one({"id": pid}, {"_id": 0})
        failed = [s for s in fresh["steps"] if s["status"] == "failed"]
        status = "partial" if failed else "ready"
        await touch(pid, {"status": status})
        await log_history(fresh, "Re-recorded step" if only_idx is not None else "Recorded demo",
                          f"{len(fresh['steps']) - len(failed)}/{len(fresh['steps'])} steps captured", snapshot=True)
        msg = f"Recording complete with {len(failed)} failed step(s)" if failed else "Recording complete"
        await finish_run(run_id, pid, "completed", msg)
    except Cancelled:
        await db.projects.update_one({"id": pid}, {"$set": {"steps.$[s].status": "pending"}},
                                     array_filters=[{"s.status": "running"}])
        await touch(pid, {"status": "partial"})
        await finish_run(run_id, pid, "cancelled", "Recording cancelled by user")
    except Exception as exc:
        logger.exception("record job failed")
        await db.projects.update_one({"id": pid}, {"$set": {"steps.$[s].status": "failed"}},
                                     array_filters=[{"s.status": "running"}])
        await touch(pid, {"status": "failed"})
        await finish_run(run_id, pid, "failed", f"Recording failed: {str(exc)[:200]}")


async def job_voiceover(project: dict, run_id: str) -> None:
    pid, voice = project["id"], project.get("voice", "nova")
    todo = [s for s in project["steps"] if s.get("voiceover", "").strip()
            and (s.get("audio_text") != s["voiceover"] or s.get("audio_voice") != voice or not s.get("audio_path"))]
    try:
        for i, s in enumerate(todo):
            if run_id in CANCELLED:
                return await finish_run(run_id, pid, "cancelled", f"Voiceover cancelled after {i} clip(s)")
            await run_log(run_id, f"Voiceover {i + 1}/{len(todo)}: \"{s['voiceover'][:50]}\"", current=i + 1)
            audio = await ai.synthesize(s["voiceover"], voice)
            path = await put_object(f"{APP_NAME}/u/{project['user_id']}/{pid}/{s['id']}_{new_id()}.mp3", audio, "audio/mpeg")
            dur = await asyncio.to_thread(render.audio_duration_ms, audio)
            await db.projects.update_one({"id": pid, "steps.id": s["id"]}, {"$set": {
                "steps.$.audio_path": path, "steps.$.audio_text": s["voiceover"],
                "steps.$.audio_voice": voice, "steps.$.audio_duration_ms": dur}})
        await finish_run(run_id, pid, "completed", f"Voiceover ready ({len(todo)} clip(s) generated)")
    except Exception as exc:
        logger.exception("voiceover job failed")
        await finish_run(run_id, pid, "failed", f"Voiceover failed: {str(exc)[:200]}")


def fingerprint(project: dict) -> str:
    keys = ("screenshot_path", "audio_path", "caption", "hotspot", "duration_ms", "transition", "transition_ms",
            "audio_duration_ms")
    payload = [[s.get(k) for k in keys] for s in project["steps"]]
    raw = json.dumps([payload, project.get("narration_mode"), project.get("brand")], sort_keys=True, default=str)
    return hashlib.sha1(raw.encode()).hexdigest()


async def job_export(project: dict, run_id: str, fmt: str) -> None:
    pid = project["id"]
    fp = fingerprint(project)
    cached = next((e for e in project.get("exports", []) if e.get("fingerprint") == fp and e["format"] == fmt), None)
    if cached:
        return await finish_run(run_id, pid, "completed", f"{fmt.upper()} unchanged — reused cached export", result=cached)
    try:
        await run_log(run_id, f"Composing {len(project['steps'])} frames with captions & hotspots...", current=1)
        data = await render.render(project, fmt)
        await run_log(run_id, f"Uploading {fmt.upper()} ({len(data) // 1024} KB)...", current=2)
        path = await put_object(f"{APP_NAME}/u/{project['user_id']}/{pid}/export_{new_id()}.{fmt}", data,
                                "image/gif" if fmt == "gif" else "video/mp4")
        exp = {"id": new_id("ex_"), "format": fmt, "path": path, "size": len(data), "created_at": now_iso(),
               "fingerprint": fp}
        await db.projects.update_one({"id": pid}, {"$push": {"exports": exp}, "$set": {"updated_at": now_iso()}})
        await log_history(project, f"Exported {fmt.upper()}", f"{len(data) // 1024} KB")
        await finish_run(run_id, pid, "completed", f"{fmt.upper()} export ready", result=exp)
    except Exception as exc:
        logger.exception("export job failed")
        await finish_run(run_id, pid, "failed", f"Export failed: {str(exc)[:200]}")


# ---------- project routes ----------
@api.get("/")
async def root():
    return {"app": "Flowcast", "ok": True}


@api.get("/projects")
async def list_projects(user: dict = Depends(get_current_user)):
    pipeline = [
        {"$match": {"user_id": user["user_id"], "is_deleted": False}},
        {"$sort": {"updated_at": -1}},
        {"$limit": 200},
        {"$project": {"_id": 0, "id": 1, "name": 1, "target_url": 1, "status": 1, "thumbnail_path": 1,
                      "updated_at": 1, "is_public": 1, "step_count": {"$size": "$steps"}}},
    ]
    return await db.projects.aggregate(pipeline).to_list(200)


@api.post("/projects")
async def create_project(body: ProjectIn, user: dict = Depends(get_current_user)):
    prefs = user.get("preferences") or {}
    p = {"id": new_id("prj_"), "user_id": user["user_id"], "name": body.name.strip(), "draft": body.draft,
         "target_url": body.target_url.strip(), "steps": [], "status": "draft",
         "voice": prefs.get("voice", "nova"), "narration_mode": prefs.get("narration_mode", "both"),
         "share_id": new_id(), "is_public": False, "thumbnail_path": None, "exports": [], "brand": DEFAULT_BRAND,
         "active_run_id": None, "is_deleted": False, "created_at": now_iso(), "updated_at": now_iso()}
    await db.projects.insert_one(dict(p))
    await log_history(p, "Created project")
    return p


@api.get("/projects/{pid}")
async def read_project(pid: str, user: dict = Depends(get_current_user)):
    return await get_project(pid, user)


@api.put("/projects/{pid}")
async def update_project(pid: str, body: ProjectUpdate, user: dict = Depends(get_current_user)):
    p = await get_project(pid, user)
    fields = body.model_dump(exclude_none=True)
    if "steps" in fields:
        fields["steps"] = [s.model_dump() for s in body.steps]
    if "brand" in fields:
        fields["brand"] = body.brand.model_dump()
    await touch(pid, fields)
    p.update(fields)
    if "steps" in fields:
        await log_history(p, "Edited timeline", f"{len(fields['steps'])} steps", snapshot=True)
    elif "is_public" in fields:
        await log_history(p, "Sharing enabled" if body.is_public else "Sharing disabled")
    return await get_project(pid, user)


@api.delete("/projects/{pid}")
async def delete_project(pid: str, user: dict = Depends(get_current_user)):
    await get_project(pid, user)
    await touch(pid, {"is_deleted": True, "is_public": False})
    return {"ok": True}


@api.post("/projects/{pid}/duplicate")
async def duplicate_project(pid: str, user: dict = Depends(get_current_user)):
    p = await get_project(pid, user)
    copy = {**p, "id": new_id("prj_"), "name": f"{p['name']} (copy)", "share_id": new_id(), "is_public": False,
            "exports": [], "active_run_id": None, "created_at": now_iso(), "updated_at": now_iso()}
    await db.projects.insert_one(dict(copy))
    await log_history(copy, "Duplicated", f"from {p['name']}", snapshot=True)
    return copy


@api.get("/projects/{pid}/history")
async def project_history(pid: str, user: dict = Depends(get_current_user)):
    await get_project(pid, user)
    items = await db.history.find({"project_id": pid}, {"_id": 0}).sort("created_at", -1).to_list(100)
    for h in items:
        h["has_snapshot"] = bool(h.get("steps"))
        h["step_count"] = len(h["steps"]) if h.get("steps") else None
        h.pop("steps", None)
    return items


@api.post("/projects/{pid}/history/{hid}/restore")
async def restore_history(pid: str, hid: str, user: dict = Depends(get_current_user)):
    p = await get_project(pid, user)
    h = await db.history.find_one({"id": hid, "project_id": pid}, {"_id": 0})
    if not h or not h.get("steps"):
        raise HTTPException(404, "Snapshot not found")
    await touch(pid, {"steps": h["steps"]})
    p["steps"] = h["steps"]
    await log_history(p, "Restored version", h["event"], snapshot=True)
    return await get_project(pid, user)


@api.post("/projects/{pid}/generate")
async def generate(pid: str, user: dict = Depends(get_current_user)):
    p = await get_project(pid, user)
    if len(p["draft"].strip()) < 10:
        raise HTTPException(400, "Write a draft of at least a few words first")
    if not p["target_url"].startswith(("http://", "https://")):
        raise HTTPException(400, "Add a valid target URL (starting with http:// or https://)")
    elements, inspected = [], False
    if engine.is_configured():
        try:
            elements = await engine.inspect_page(p["target_url"])
            inspected = True
        except Exception as exc:
            logger.warning("inspect failed: %s", exc)
    try:
        result = await ai.generate_script(p["draft"], p["target_url"], elements, f"gen_{pid}_{new_id()}")
    except Exception as exc:
        logger.exception("generate failed")
        raise HTTPException(502, f"AI could not build a script: {str(exc)[:160]}")
    steps = normalize_steps(result.get("steps") or [], p["target_url"])
    if not steps:
        raise HTTPException(502, "AI returned no usable steps. Try adding more detail to your draft.")
    await touch(pid, {"steps": steps, "status": "scripted", "thumbnail_path": None})
    p["steps"] = steps
    await log_history(p, "Generated script with AI", f"{len(steps)} steps", snapshot=True)
    out = await get_project(pid, user)
    out["inspected_elements"] = len(elements) if inspected else None
    out["ai_title"] = result.get("title")
    return out


def month_start() -> str:
    from core import now
    return now().replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()


async def usage_count(user: dict) -> int:
    return await db.runs.count_documents({"user_id": user["user_id"], "kind": {"$in": ["record", "rerecord"]},
                                          "started_at": {"$gte": month_start()}})


async def enforce_quota(user: dict) -> None:
    if await usage_count(user) >= MONTHLY_LIMIT:
        raise HTTPException(402, f"Monthly limit of {MONTHLY_LIMIT} recordings reached. Upgrade to keep recording.")


def _require_browserless() -> None:
    if not engine.is_configured():
        raise HTTPException(400, "Browserless is not connected yet. Add your Browserless API key in Settings.")


@api.post("/projects/{pid}/record")
async def record(pid: str, user: dict = Depends(get_current_user)):
    p = await get_project(pid, user)
    _require_browserless()
    if not p["steps"]:
        raise HTTPException(400, "Generate or add steps before recording")
    await ensure_idle(p)
    await enforce_quota(user)
    await db.projects.update_one({"id": pid}, {"$set": {"steps.$[].status": "pending", "steps.$[].error": None,
                                                       "status": "recording"}})
    p = await get_project(pid, user)
    run = await new_run(p, "record", len(p["steps"]), "Launching secure Browserless Chromium session...")
    spawn(job_record(p, run["id"], None))
    return run


@api.post("/projects/{pid}/steps/{sid}/rerecord")
async def rerecord(pid: str, sid: str, user: dict = Depends(get_current_user)):
    p = await get_project(pid, user)
    _require_browserless()
    idx = next((i for i, s in enumerate(p["steps"]) if s["id"] == sid), None)
    if idx is None:
        raise HTTPException(404, "Step not found")
    await ensure_idle(p)
    await enforce_quota(user)
    p["steps"] = p["steps"][: idx + 1]
    run = await new_run(p, "rerecord", idx + 1, f"Re-recording step {idx + 1} (replaying previous steps first)...")
    spawn(job_record(p, run["id"], idx))
    return run


@api.post("/projects/{pid}/voiceover")
async def voiceover(pid: str, user: dict = Depends(get_current_user)):
    p = await get_project(pid, user)
    if not any(s.get("voiceover", "").strip() for s in p["steps"]):
        raise HTTPException(400, "Add voiceover text to at least one step first")
    await ensure_idle(p)
    run = await new_run(p, "voiceover", len(p["steps"]), f"Synthesizing voiceover with voice '{p.get('voice')}'...")
    spawn(job_voiceover(p, run["id"]))
    return run


@api.post("/projects/{pid}/export")
async def export(pid: str, body: ExportIn, user: dict = Depends(get_current_user)):
    p = await get_project(pid, user)
    if not any(s.get("screenshot_path") for s in p["steps"]):
        raise HTTPException(400, "Record the demo before exporting")
    await ensure_idle(p)
    run = await new_run(p, "export", 3, f"Rendering {body.format.upper()}...")
    spawn(job_export(p, run["id"], body.format))
    return run


@api.get("/runs/{rid}")
async def read_run(rid: str, user: dict = Depends(get_current_user)):
    run = await db.runs.find_one({"id": rid, "user_id": user["user_id"]}, {"_id": 0})
    if not run:
        raise HTTPException(404, "Run not found")
    return run


@api.get("/runs/{rid}/stream")
async def stream_run(rid: str, request: Request, user: dict = Depends(get_current_user)):
    async def gen():
        last = None
        for _ in range(2400):
            if await request.is_disconnected():
                break
            run = await db.runs.find_one({"id": rid, "user_id": user["user_id"]}, {"_id": 0})
            if not run:
                yield "event: missing\ndata: {}\n\n"
                break
            payload = json.dumps(run, default=str)
            if payload != last:
                yield f"data: {payload}\n\n"
                last = payload
            if run["status"] != "running":
                break
            await asyncio.sleep(0.5)
    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@api.post("/runs/{rid}/cancel")
async def cancel_run(rid: str, user: dict = Depends(get_current_user)):
    run = await db.runs.find_one({"id": rid, "user_id": user["user_id"]}, {"_id": 0})
    if not run:
        raise HTTPException(404, "Run not found")
    if run["status"] == "running":
        CANCELLED.add(rid)
        await run_log(rid, "Cancellation requested — stopping after current step...", "warn")
    return {"ok": True}


@api.post("/projects/{pid}/rewrite")
async def rewrite(pid: str, body: RewriteIn, user: dict = Depends(get_current_user)):
    p = await get_project(pid, user)
    if not p["steps"]:
        raise HTTPException(400, "Nothing to rewrite yet")
    try:
        edits = await ai.rewrite_narration(p["steps"], body.instruction, f"rw_{pid}_{new_id()}")
    except Exception as exc:
        raise HTTPException(502, f"AI rewrite failed: {str(exc)[:160]}")
    by_id = {e.get("id"): e for e in edits if isinstance(e, dict)}
    for s in p["steps"]:
        e = by_id.get(s["id"])
        if e:
            s["caption"] = str(e.get("caption", s["caption"]))[:200]
            s["voiceover"] = str(e.get("voiceover", s["voiceover"]))[:1000]
    await touch(pid, {"steps": p["steps"]})
    await log_history(p, "AI rewrite", body.instruction, snapshot=True)
    return await get_project(pid, user)


@api.post("/projects/{pid}/steps/{sid}/repair")
async def repair_step(pid: str, sid: str, user: dict = Depends(get_current_user)):
    p = await get_project(pid, user)
    _require_browserless()
    idx = next((i for i, s in enumerate(p["steps"]) if s["id"] == sid), None)
    if idx is None or not p["steps"][idx].get("selector"):
        raise HTTPException(400, "Only click, type and hover steps can be repaired")
    step = p["steps"][idx]
    prev_url = next((s.get("page_url") for s in reversed(p["steps"][:idx]) if s.get("page_url")), None)
    url = step.get("page_url") or prev_url or p["target_url"]
    try:
        elements = await engine.inspect_page(url)
        fix = await ai.repair_selector(step, elements, f"fix_{sid}_{new_id()}")
    except Exception as exc:
        raise HTTPException(502, f"Repair failed: {str(exc)[:160]}")
    if not fix.get("selector"):
        raise HTTPException(502, "AI could not find a better selector")
    step.update({"selector": fix["selector"], "fallback_selectors": (fix.get("fallback_selectors") or [])[:3],
                 "status": "pending", "error": None})
    await touch(pid, {"steps": p["steps"]})
    await log_history(p, "AI selector repair", f"Step {idx + 1}: {fix.get('reason', '')}", snapshot=True)
    out = await get_project(pid, user)
    out["repair_reason"] = fix.get("reason")
    return out


@api.get("/projects/{pid}/analytics")
async def analytics(pid: str, user: dict = Depends(get_current_user)):
    p = await get_project(pid, user)
    events = await db.analytics_events.find({"project_id": pid}, {"_id": 0}).sort("created_at", -1).to_list(5000)
    views, completes, reach = set(), set(), {}
    for e in events:
        if e["type"] == "view":
            views.add(e["session"])
        elif e["type"] == "complete":
            completes.add(e["session"])
        reach[e["session"]] = max(reach.get(e["session"], 0), e.get("step_index", 0))
    n = len(p["steps"])
    per_step = [sum(1 for v in reach.values() if v >= i) for i in range(n)]
    return {"views": len(views), "completions": len(completes),
            "completion_rate": round(len(completes) / len(views) * 100) if views else 0, "per_step": per_step}


async def _asset(p: dict, sid: str, kind: str) -> Response:
    step = next((s for s in p["steps"] if s["id"] == sid), None)
    field = {"screenshot": "screenshot_path", "thumb": "thumb_path", "audio": "audio_path"}[kind]
    path = step and (step.get(field) or (step.get("screenshot_path") if kind == "thumb" else None))
    if not path:
        raise HTTPException(404, "Asset not found")
    data, _ = await get_object(path)
    media = "audio/mpeg" if kind == "audio" else ("image/webp" if path.endswith(".webp") else "image/jpeg")
    return Response(content=data, media_type=media, headers={"Cache-Control": "private, max-age=86400"})


@api.get("/projects/{pid}/steps/{sid}/{kind}")
async def step_asset(pid: str, sid: str, kind: Literal["screenshot", "thumb", "audio"], user: dict = Depends(get_current_user)):
    return await _asset(await get_project(pid, user), sid, kind)


@api.get("/projects/{pid}/thumbnail")
async def thumbnail(pid: str, user: dict = Depends(get_current_user)):
    p = await get_project(pid, user)
    if not p.get("thumbnail_path"):
        raise HTTPException(404, "No thumbnail")
    data, _ = await get_object(p["thumbnail_path"])
    return Response(content=data, media_type="image/jpeg", headers={"Cache-Control": "private, max-age=86400"})


@api.get("/projects/{pid}/exports/{eid}/download")
async def download_export(pid: str, eid: str, user: dict = Depends(get_current_user)):
    p = await get_project(pid, user)
    exp = next((e for e in p.get("exports", []) if e["id"] == eid), None)
    if not exp:
        raise HTTPException(404, "Export not found")
    data, _ = await get_object(exp["path"])
    media = "image/gif" if exp["format"] == "gif" else "video/mp4"
    safe = "".join(c if c.isalnum() else "-" for c in p["name"]).strip("-")[:40] or "demo"
    return Response(content=data, media_type=media,
                    headers={"Content-Disposition": f'attachment; filename="{safe}.{exp["format"]}"'})


# ---------- public player ----------
async def _public_project(share_id: str) -> dict:
    p = await db.projects.find_one({"share_id": share_id, "is_public": True, "is_deleted": False}, {"_id": 0})
    if not p:
        raise HTTPException(404, "This demo is private or does not exist")
    return p


@api.get("/public/{share_id}")
async def public_demo(share_id: str):
    p = await _public_project(share_id)
    keep = ("id", "action", "caption", "voiceover", "duration_ms", "transition", "transition_ms", "hotspot",
            "audio_duration_ms")
    steps = [{**{k: s.get(k) for k in keep}, "has_screenshot": bool(s.get("screenshot_path")),
              "has_audio": bool(s.get("audio_path")), "v": (s.get("screenshot_path") or "")[-12:]}
             for s in p["steps"]]
    return {"name": p["name"], "narration_mode": p.get("narration_mode", "both"), "steps": steps,
            "brand": p.get("brand") or DEFAULT_BRAND, "updated_at": p["updated_at"]}


@api.post("/public/{share_id}/events")
async def public_event(share_id: str, body: EventIn):
    p = await _public_project(share_id)
    await db.analytics_events.insert_one({"project_id": p["id"], **body.model_dump(), "created_at": now_iso()})
    return {"ok": True}


@api.get("/public/{share_id}/steps/{sid}/{kind}")
async def public_asset(share_id: str, sid: str, kind: Literal["screenshot", "thumb", "audio"]):
    return await _asset(await _public_project(share_id), sid, kind)


# ---------- settings ----------
@api.get("/settings")
async def get_settings(user: dict = Depends(get_current_user)):
    return {"browserless_configured": engine.is_configured(),
            "browserless_region": os.environ.get("BROWSERLESS_WS_URL", ""),
            "llm_configured": bool(os.environ.get("EMERGENT_LLM_KEY")),
            "ai_model": "Claude Sonnet 5.5", "tts_model": "OpenAI TTS HD",
            "preferences": user.get("preferences") or {"voice": "nova", "narration_mode": "both"},
            "usage": {"recordings_this_month": await usage_count(user), "limit": MONTHLY_LIMIT, "plan": "Free"}}


@api.put("/settings")
async def put_settings(body: PrefsIn, user: dict = Depends(get_current_user)):
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"preferences": body.model_dump()}})
    return {"preferences": body.model_dump()}


@api.post("/settings/test-browserless")
async def test_browserless(user: dict = Depends(get_current_user)):
    _require_browserless()
    try:
        await engine.test_connection()
    except Exception as exc:
        raise HTTPException(502, f"Could not connect to Browserless: {str(exc)[:200]}")
    return {"ok": True}


@api.post("/tts/preview")
async def tts_preview(body: PrefsIn, user: dict = Depends(get_current_user)):
    audio = await ai.synthesize("Hi! This is how your product demo narration will sound.", body.voice)
    return Response(content=audio, media_type="audio/mpeg")


app.include_router(auth_router)
app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    app.state.index_task = asyncio.create_task(ensure_indexes())
    await seed_admin()
    await db.runs.update_many({"status": "running"}, {"$set": {"status": "failed", "message": "Interrupted by server restart"}})
    await db.projects.update_many({"active_run_id": {"$ne": None}}, {"$set": {"active_run_id": None}})
    try:
        await asyncio.to_thread(init_storage)
    except Exception as exc:
        logger.error("Storage init failed: %s", exc)


@app.on_event("shutdown")
async def shutdown():
    app.state.index_task.cancel()
    with suppress(asyncio.CancelledError):
        await app.state.index_task
    client.close()
