import asyncio
import hashlib
import io
import re
import hmac
import json
import logging
import os
from contextlib import suppress
from typing import Literal, Optional

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel, Field
from starlette.middleware.cors import CORSMiddleware

try:
    import ai
except ImportError:
    ai = None
try:
    import engine
except ImportError:
    engine = None
try:
    import live as live_browser
except ImportError:
    live_browser = None
try:
    import render
except ImportError:
    render = None
from auth_routes import router as auth_router, seed_admin
from datetime import datetime, timedelta, timezone

import copy
from core import (DB_BACKEND, FATAL_PREFIXES, DuplicateKeyError, config_problems, cors_origins, create_viewer_token, db, validate_config, decode_viewer_token, get_current_user, hash_password, new_id,
                  now, now_iso, verify_password)
import billing
import cinematic
import clerk_service
import compositor
import jobs
import netpolicy
from product import (VIEWPORTS, apply_track, environment_base, estimate_seconds, parse_playwright, prepare_step,
                     public_view, publish_diff, speak, substitute, transcript)
from storage import APP_NAME, StorageError, get_object, init_storage, probe as storage_probe, put_object, status as storage_status
import vault

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

async def ensure_indexes() -> None:
    if DB_BACKEND != "mongodb":
        return
    await db.projects.create_index("id", unique=True)
    await db.projects.create_index([("user_id", 1), ("updated_at", -1)])
    await db.runs.create_index("id", unique=True)
    await db.runs.create_index([("status", 1), ("started_at", 1)])
    await db.runs.create_index([("project_id", 1), ("started_at", -1)])
    await db.cron_runs.create_index("run_id", unique=True)
    await db.storage_probes.create_index([("at", -1)])
    await db.analytics_events.create_index([("project_id", 1), ("created_at", -1)])
    await db.login_attempts.create_index("identifier", unique=True)
    await db["quota_counters"].create_index("id", unique=True)
    await db["quota_reservations"].create_index("id", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.admin_audit.create_index([("at", -1)])
    await db.webhook_events.create_index("event_id", unique=True)
    await db.organizations.create_index("id", unique=True)
    await db.organization_memberships.create_index([("user_id", 1), ("organization_id", 1)])


app = FastAPI()


@app.exception_handler(ai.AIUnavailable if ai else Exception)
async def ai_unavailable_handler(request: Request, exc):
    from fastapi.responses import JSONResponse
    return JSONResponse(status_code=503, content={"detail": str(exc), "code": getattr(exc, "code", "ai_error")})


@app.exception_handler(StorageError)
async def storage_error_handler(request: Request, exc):
    from fastapi.responses import JSONResponse
    return JSONResponse(status_code=503, content={"detail": str(exc), "code": "storage_unavailable"})


api = APIRouter(prefix="/api")
TASKS: set = set()
MONTHLY_LIMIT = int(os.environ.get("MONTHLY_RECORDING_LIMIT", "20"))
DEFAULT_BRAND = {"accent": "#6366F1", "caption_position": "bottom", "watermark": True, "zoom": True}


class Cancelled(Exception):
    pass
Action = Literal["goto", "click", "type", "hover", "scroll", "press", "wait", "assert"]


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
    duration_ms: int = Field(6000, ge=500, le=30000)
    transition: Literal["none", "fade"] = "fade"
    transition_ms: int = Field(800, ge=0, le=3000)
    screenshot_path: Optional[str] = None
    thumb_path: Optional[str] = None
    audio_voice: Optional[str] = None
    audio_path: Optional[str] = None
    audio_text: Optional[str] = None
    audio_duration_ms: Optional[int] = None
    hotspot: Optional[dict] = None
    status: str = "pending"
    regression: bool = False
    error: Optional[str] = None
    attempts: int = 0
    page_url: Optional[str] = None
    voice: Optional[str] = None
    chapter: str = ""
    callout: str = ""
    treatment: str = ""
    annotations: list[dict] = []
    comments: list[dict] = []
    health_failed_path: Optional[str] = None
    screenshot_mobile_path: Optional[str] = None
    motion_paths: list[str] = []
    branch: str = ""
    choices: list[dict] = []
    caption_alt: str = ""
    voiceover_alt: str = ""
    # Interactive scenes: a step with scene_type set is not recorded by the browser.
    # It is rendered by the player (and as a timed frame in exports) and ends via exit_trigger.
    scene_type: Literal["", "title", "credits", "email", "waitlist", "cta"] = ""
    scene: dict = {}
    exit_trigger: Literal["timer", "continue", "submit"] = "timer"
    skippable: bool = False
    # Video-first capture: (clip index into project.video_clips, ms window)
    # plus per-word narration timings from timestamped TTS.
    video: Optional[dict] = None
    words: list[dict] = []


SERVER_FIELDS = ("screenshot_path", "thumb_path", "audio_path", "audio_text", "audio_voice", "audio_duration_ms",
                 "hotspot", "status", "error", "attempts", "page_url", "resolved_selector", "regression",
                 "health_failed_path", "screenshot_mobile_path", "motion_paths", "visual_delta", "visual_change",
                 "audio_spoken", "audio_path_alt", "audio_text_alt", "audio_spoken_alt", "audio_duration_alt",
                 "video", "words")


class ProjectIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    draft: str = ""
    target_url: str = ""


class Brand(BaseModel):
    accent: str = Field("#6366F1", pattern=r"^#[0-9a-fA-F]{6}$")
    caption_position: Literal["top", "bottom"] = "bottom"
    watermark: bool = True
    zoom: bool = True
    music_path: Optional[str] = None


class RecipeStep(BaseModel):
    action: Literal["goto", "click", "type", "press", "wait"] = "click"
    selector: Optional[str] = None
    text: Optional[str] = None
    url: Optional[str] = None


class GlossaryItem(BaseModel):
    word: str = Field(min_length=1, max_length=80)
    spoken: str = Field(min_length=1, max_length=120)


class ShareSettingsIn(BaseModel):
    password: Optional[str] = Field(None, min_length=4, max_length=128)
    remove_password: bool = False
    expires_at: Optional[datetime] = None


class UnlockIn(BaseModel):
    password: str = Field(min_length=1, max_length=128)


class RewriteIn(BaseModel):
    instruction: str = Field(min_length=3, max_length=300)


class EventIn(BaseModel):
    type: Literal["view", "step", "complete", "dwell", "lead", "cta"]
    session: str = Field(min_length=4, max_length=64)
    step_index: int = Field(0, ge=0, le=200)
    dwell_ms: Optional[int] = Field(None, ge=0, le=600000)
    email: Optional[str] = Field(None, max_length=200)
    name: Optional[str] = Field(None, max_length=120)
    scene_id: Optional[str] = Field(None, max_length=40)
    scene_type: Optional[str] = Field(None, max_length=20)
    referrer: Optional[str] = Field(None, max_length=300)
    device: Optional[Literal["desktop", "phone"]] = None
    branch: Optional[str] = Field(None, max_length=40)


class ProjectUpdate(BaseModel):
    brand: Optional[Brand] = None
    name: Optional[str] = None
    draft: Optional[str] = None
    target_url: Optional[str] = None
    steps: Optional[list[Step]] = None
    voice: Optional[str] = None
    narration_mode: Optional[Literal["captions", "voiceover", "both"]] = None
    is_public: Optional[bool] = None
    auto_refresh: Optional[bool] = None
    variables: Optional[dict] = None
    environments: Optional[dict] = None
    active_environment: Optional[Literal["production", "staging", "local"]] = None
    viewport: Optional[Literal["desktop", "mobile", "both"]] = None
    cta_label: Optional[str] = None
    cta_url: Optional[str] = None
    webhook_url: Optional[str] = None
    product_slug: Optional[str] = None
    review_status: Optional[Literal["draft", "approved"]] = None
    login_url: Optional[str] = None
    login_username: Optional[str] = None
    login_password: Optional[str] = None
    clear_login: bool = False
    login_recipe: Optional[list[RecipeStep]] = None
    glossary: Optional[list[GlossaryItem]] = None
    guided: Optional[bool] = None
    notify_url: Optional[str] = Field(None, max_length=500)
    active_track: Optional[Literal["primary", "alt"]] = None
    tour_order: Optional[int] = Field(None, ge=0, le=99)
    archived: Optional[bool] = None


class ExportIn(BaseModel):
    format: Literal["gif", "mp4"]
    preset: Literal["standard", "docs", "square", "master", "vertical", "hook"] = "standard"


class SourceIn(BaseModel):
    source: str = Field(min_length=1, max_length=20000)


class CaptureIn(BaseModel):
    after: int = Field(0, ge=0, le=200)
    scroll: int = Field(0, ge=0, le=8000)


class LiveStartIn(BaseModel):
    after: int = Field(0, ge=0, le=200)


class LiveClickIn(BaseModel):
    x: float = Field(ge=0, le=1280)
    y: float = Field(ge=0, le=800)


class LiveTypeIn(BaseModel):
    text: str = Field(min_length=1, max_length=200)


class LiveKeyIn(BaseModel):
    key: str = Field(min_length=1, max_length=20)


class LiveScrollIn(BaseModel):
    amount: int = Field(ge=-2400, le=2400)


class CommentIn(BaseModel):
    text: str = Field(min_length=1, max_length=500)


class PrefsIn(BaseModel):
    voice: Literal["alloy", "ash", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer"]
    narration_mode: Literal["captions", "voiceover", "both"]


class AdminUserPatch(BaseModel):
    role: Optional[Literal["user", "admin"]] = None
    status: Optional[Literal["active", "suspended"]] = None
    plan_override: Optional[str] = Field(None, max_length=40)
    monthly_limit_override: Optional[int] = Field(None, ge=0, le=100000)


# ---------- helpers ----------
async def get_project(pid: str, user: dict) -> dict:
    p = await db.projects.find_one({"id": pid, "user_id": user["user_id"], "is_deleted": False}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Project not found")
    p["has_share_password"] = bool(p.pop("share_password_hash", None))
    raw_login = dict(p.get("login") or {})
    flags = vault.login_flags(raw_login)
    p["has_login"] = bool(flags["has_password"] or raw_login.get("username") or raw_login.get("recipe"))
    p["has_storage"] = flags["has_storage"]
    p["credential_expired"] = flags["credential_expired"]
    p["storage_expired"] = flags["storage_expired"]
    p["login"] = vault.owner_login_view(raw_login, pid)
    p["steps"] = vault.mask_steps(p.get("steps") or [])
    published = p.pop("published", None) or {}
    p["published_at"] = published.get("published_at")
    p["publish_diff"] = publish_diff(p.get("steps") or [], published.get("steps") or [])
    p["estimate_seconds"] = estimate_seconds(p)
    p["session_cap"] = 120
    p["over_cap"] = p["estimate_seconds"] > 120
    p["guided"] = bool(p.get("guided"))
    p["active_track"] = p.get("active_track") or "primary"
    p["webhook_log"] = (p.get("webhook_log") or [])[-8:]
    return p


def ai_error(exc: Exception) -> str:
    msg = str(exc)
    if "Budget has been exceeded" in msg or "budget" in msg.lower():
        return "Your OpenAI account is out of credit. Add billing or raise the spend limit, then retry."
    return msg[:160]


async def log_history(project: dict, event: str, detail: str = "", snapshot: bool = False) -> None:
    doc = {"id": new_id("h_"), "project_id": project["id"], "event": event, "detail": detail,
           "created_at": now_iso(), "steps": vault.redact_steps(project.get("steps")) if snapshot else None}
    await db.history.insert_one(doc)


async def touch(pid: str, fields: dict) -> None:
    await db.projects.update_one({"id": pid}, {"$set": {**fields, "updated_at": now_iso()}})


def spawn(coro) -> None:
    task = asyncio.create_task(coro)
    TASKS.add(task)
    task.add_done_callback(TASKS.discard)


INSTANCE_ID = jobs.INSTANCE_ID


async def run_log(run_id: str, msg: str, level: str = "info", **fields) -> None:
    await db.runs.update_one({"id": run_id}, {"$set": {"message": msg, "heartbeat_at": now_iso(),
                                                       "lease_expires_at": jobs._lease_until(), "owner": INSTANCE_ID, **fields},
                                             "$push": {"logs": {"t": now_iso(), "level": level, "msg": msg}}})


async def _post_json(url: str, payload: dict) -> tuple[bool, int, str]:
    return await netpolicy.post_json(url, payload)


async def finish_run(run_id: str, pid: str, status: str, msg: str, result=None) -> None:
    won = await jobs.finalize_run(run_id, pid, status, msg, result=result)
    if not won:
        return
    try:
        project = await db.projects.find_one({"id": pid}, {"_id": 0})
        if not project:
            return
        await db["notifications"].insert_one({
            "id": new_id("nt_"), "user_id": project.get("user_id"), "project_id": pid,
            "project_name": project.get("name") or "Demo", "status": status, "message": msg,
            "created_at": now_iso(), "read": False,
        })
        url = (project.get("notify_url") or "").strip()
        if url.startswith(("http://", "https://")):
            spawn(_post_json(url, {"event": "run", "status": status, "message": msg,
                                   "demo": project.get("name"), "project_id": pid}))
    except Exception:
        logger.warning("run notification failed for %s", pid)


async def ensure_idle(project: dict) -> None:
    rid = project.get("active_run_id")
    if rid and await db.runs.find_one({"id": rid, "status": {"$in": ["queued", "running"]}}, {"_id": 0}):
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
    return cinematic.direct(steps)


async def narrated_script(draft: str, target_url: str, elements: list, session_id: str, brief: dict | None = None, changelog: bool = False) -> tuple[dict, list]:
    if changelog:
        result = await ai.changelog_script(draft, target_url, session_id)
    else:
        result = await ai.generate_script(draft, target_url, elements, session_id, brief)
    steps = normalize_steps(result.get("steps") or [], target_url)
    if steps and cinematic.needs_story_pass(steps):
        edits = await ai.rewrite_narration(steps, cinematic.STORY_INSTRUCTION, f"{session_id}_story")
        by_id = {e.get("id"): e for e in edits if e.get("id")}
        for step in steps:
            edit = by_id.get(step["id"])
            if not edit:
                continue
            step["caption"] = str(edit.get("caption") or step["caption"])[:90]
            step["voiceover"] = str(edit.get("voiceover") or step["voiceover"])[:1000]
            step["callout"] = ""
        steps = cinematic.direct(steps)
    return result, steps


# ---------- background jobs ----------
def _collect_secrets(login: dict, steps: list) -> set[str]:
    found: set[str] = set()
    if login.get("password"):
        found.add(str(login["password"]))
    for s in login.get("recipe") or []:
        if s.get("action") == "type" and s.get("text"):
            found.add(str(s["text"]))
    for s in steps or []:
        if s.get("sensitive") and s.get("text"):
            found.add(str(s["text"]))
    return found


async def job_record(project: dict, run_id: str, only_idx: Optional[int], final: bool = True,
                     health: bool = False, only: Optional[set] = None) -> str:
    pid = project["id"]
    stored = await db.projects.find_one({"id": pid}, {"_id": 0}) or {}
    steps = list(stored.get("steps") or project.get("steps") or [])
    if only_idx is not None:
        steps = steps[: only_idx + 1]
    capture = only if only is not None else (None if only_idx is None else {only_idx})
    login = vault.open_login(stored.get("login") or {}, pid)
    opened_steps = [{**s, "text": vault.open_step_text(s, pid)} if s.get("sensitive") else dict(s) for s in steps]
    secrets_to_scrub = _collect_secrets(login, opened_steps)
    project = {**stored, **project, "steps": steps, "login": login}
    # Scenes are rendered by the player/exporter, never sent to the browser.
    rec_pairs = [(i, s) for i, s in enumerate(opened_steps) if not s.get("scene_type")]
    prepared = [prepare_step(s, project) for _, s in rec_pairs]
    cap_rec = None if capture is None else {pi for pi, (oi, _) in enumerate(rec_pairs) if oi in capture}
    viewport_name = project.get("viewport") or "desktop"
    viewport = VIEWPORTS["mobile" if viewport_name == "mobile" else "desktop"]
    n = len(steps)
    pending_video: dict[str, dict] = {}
    prev_done = {s["id"] for s in steps if s.get("status") == "done" and s.get("screenshot_path")}
    done_in_run = await jobs.completed_checkpoint_steps(run_id)
    if done_in_run and capture is None:
        capture = {i for i, s in enumerate(steps) if s["id"] not in done_in_run}
    elif done_in_run and capture is not None:
        capture = {i for i in capture if i < len(steps) and steps[i]["id"] not in done_in_run}

    async def on_progress(i: int, step: dict, state: str, data: dict) -> None:
        if await jobs.is_cancelled(run_id):
            raise Cancelled()
        oi = rec_pairs[i][0] if i < len(rec_pairs) else i
        if cap_rec is not None and i not in cap_rec:
            if state == "running":
                await run_log(run_id, f"Replaying step {oi + 1}/{n} to reach target: {engine.describe(step)}", current=oi + 1)
            elif state == "failed":
                err_txt = vault.scrub(str(data.get("error") or ""), secrets_to_scrub)
                await run_log(run_id, f"Replay of step {oi + 1} failed: {err_txt}", "warn")
            return
        if state == "running":
            await db.projects.update_one({"id": pid, "steps.id": step["id"]}, {"$set": {"steps.$.status": "running"}})
            await run_log(run_id, f"Step {oi + 1}/{n}: {engine.describe(step)}...", current=oi + 1)
            return
        clean_err = vault.scrub(str(data.get("error")), secrets_to_scrub) if data.get("error") else None
        if data.get("video"):
            pending_video[step["id"]] = data["video"]
        upd = {"steps.$.status": state, "steps.$.error": clean_err, "steps.$.attempts": data.get("attempts", 1),
               "steps.$.page_url": data.get("url"), "steps.$.resolved_selector": data.get("resolved_selector"),
               "steps.$.regression": state == "failed" and step["id"] in prev_done}
        keep_old = health and state == "failed" and step["id"] in prev_done
        visual_shift = False
        if health and state == "done" and data.get("screenshot") and step.get("screenshot_path"):
            try:
                old, _ = await get_object(step["screenshot_path"])
                delta = await asyncio.to_thread(render.frame_delta, old, data["screenshot"])
            except Exception:
                delta = 0
            upd["steps.$.visual_delta"] = round(delta, 3)
            if delta >= 0.18:
                visual_shift = True
                upd["steps.$.visual_change"] = True
                changed_path = await put_object(
                    f"{APP_NAME}/u/{project['user_id']}/{pid}/{step['id']}_shift_{new_id()}.jpg",
                    data["screenshot"], "image/jpeg")
                upd["steps.$.health_failed_path"] = changed_path
        if not keep_old and not visual_shift:
            upd["steps.$.hotspot"] = data.get("hotspot")
            if data.get("hotspot"):
                upd["steps.$.annotations"] = cinematic.stage_marks(step, data.get("hotspot"))
        if data.get("screenshot") and (keep_old or visual_shift):
            if keep_old:
                failed_path = await put_object(f"{APP_NAME}/u/{project['user_id']}/{pid}/{step['id']}_health_{new_id()}.jpg", data["screenshot"], "image/jpeg")
                upd["steps.$.health_failed_path"] = failed_path
        elif data.get("screenshot") and not keep_old:
            base = f"{APP_NAME}/u/{project['user_id']}/{pid}/{step['id']}_{new_id()}"
            path = await put_object(f"{base}.jpg", data["screenshot"], "image/jpeg")
            thumb = await asyncio.to_thread(render.make_thumb, data["screenshot"])
            upd["steps.$.thumb_path"] = await put_object(f"{base}_t.webp", thumb, "image/webp")
            upd["steps.$.screenshot_path"] = path
            upd["steps.$.visual_change"] = False
            upd["steps.$.visual_delta"] = None
            motion_paths = []
            for frame_i, blob in enumerate((data.get("motion") or [])[:8]):
                motion_paths.append(await put_object(f"{base}_scroll_{frame_i}.jpg", blob, "image/jpeg"))
            upd["steps.$.motion_paths"] = motion_paths
            if i == 0 or not project.get("thumbnail_path"):
                await touch(pid, {"thumbnail_path": path})
                project["thumbnail_path"] = path
        await db.projects.update_one({"id": pid, "steps.id": step["id"]}, {"$set": upd})
        await jobs.record_checkpoint(run_id, step["id"])
        if state == "failed":
            await run_log(run_id, f"Step {oi + 1} failed after {data.get('attempts')} attempts: {clean_err}", "error")
        else:
            await run_log(run_id, f"Step {oi + 1}/{n} captured", "success")

    try:
        storage = login.get("storage_state") or None

        async def remember(state: dict) -> None:
            fresh_login = dict((await db.projects.find_one({"id": pid}, {"_id": 0}) or {}).get("login") or {})
            fresh_login["storage_state"] = state
            fresh_login["storage_saved_at"] = now_iso()
            await touch(pid, {"login": vault.seal_login(fresh_login, pid)})

        if prepared and (cap_rec is None or cap_rec):
            async def _phase(name: str) -> None:
                if name == "encoding":
                    await run_log(run_id, "Encoding recorded video…", current=n)

            preview_path = f"{APP_NAME}/u/{project['user_id']}/runs/{run_id}/preview.jpg"
            preview_last = 0.0

            async def on_preview(shot: bytes, url: str = "") -> None:
                nonlocal preview_last
                import time as _time
                now = _time.monotonic()
                # Throttle storage writes so we stay near ~2–3 fps without flooding S3/disk.
                if now - preview_last < 0.35:
                    return
                preview_last = now
                try:
                    jpeg = await asyncio.to_thread(render.make_preview, shot)
                    await put_object(preview_path, jpeg, "image/jpeg")
                    await db.runs.update_one(
                        {"id": run_id},
                        {"$set": {
                            "preview_path": preview_path,
                            "preview_url": url or "",
                            "preview_at": now_iso(),
                        }},
                    )
                except Exception:
                    logger.debug("run preview publish failed for %s", run_id, exc_info=True)

            result = await engine.run_steps(prepared, on_progress, capture_only=cap_rec, viewport=viewport,
                                            login=None if storage else login, storage_state=storage,
                                            on_storage=None if storage else remember, on_phase=_phase,
                                            on_preview=on_preview)
            # Upload the recorded session clips and point each captured step
            # at its (clip, start_ms, end_ms) window — the edit decision list
            # the player and exporter consume.
            clip_blobs = (result or {}).get("video_clips") or []
            if clip_blobs and pending_video:
                await run_log(run_id, f"Uploading {len([b for b in clip_blobs if b])} video clip(s)…", current=n)
                fresh_proj = await db.projects.find_one({"id": pid}, {"_id": 0}) or {}
                existing_clips = list(fresh_proj.get("video_clips") or [])
                offset = len(existing_clips)
                new_paths: list[str] = []
                for blob in clip_blobs:
                    if blob:
                        new_paths.append(await put_object(
                            f"{APP_NAME}/u/{project['user_id']}/{pid}/{pid}_clip{offset + len(new_paths)}_{new_id()}.mp4",
                            blob, "video/mp4"))
                    else:
                        new_paths.append("")
                await touch(pid, {"video_clips": existing_clips + new_paths})
                for sid, vid in pending_video.items():
                    local = vid.get("clip", 0)
                    if 0 <= local < len(new_paths) and new_paths[local]:
                        window = {"clip": offset + local,
                                  "start_ms": vid.get("start_ms", 0),
                                  "end_ms": vid.get("end_ms", 0)}
                        if vid.get("action_ms") is not None:
                            window["action_ms"] = vid["action_ms"]
                        await db.projects.update_one(
                            {"id": pid, "steps.id": sid},
                            {"$set": {"steps.$.video": window}})
        if prepared and viewport_name == "both" and capture is None:
            mobile: list = []

            async def collect(i: int, step: dict, state: str, data: dict) -> None:
                if await jobs.is_cancelled(run_id):
                    raise Cancelled()
                if state == "done" and data.get("screenshot"):
                    mobile.append((step["id"], data["screenshot"]))

            await engine.run_steps(prepared, collect, viewport=VIEWPORTS["mobile"],
                                   login=None if storage else login, storage_state=storage,
                                   record_video=False)
            for sid, blob in mobile:
                path = await put_object(f"{APP_NAME}/u/{project['user_id']}/{pid}/{sid}_m_{new_id()}.jpg", blob, "image/jpeg")
                await db.projects.update_one({"id": pid, "steps.id": sid}, {"$set": {"steps.$.screenshot_mobile_path": path}})
        fresh = await db.projects.find_one({"id": pid}, {"_id": 0})
        failed = [s for s in fresh["steps"] if s["status"] == "failed"]
        status = "partial" if failed else "ready"
        broken = [{"index": i, "id": s["id"], "caption": s.get("caption", ""), "error": s.get("error")}
                  for i, s in enumerate(fresh["steps"]) if s.get("regression")]
        shifted = [{"index": i, "id": s["id"], "caption": s.get("caption", ""), "delta": s.get("visual_delta")}
                   for i, s in enumerate(fresh["steps"]) if s.get("visual_change")]
        fields = {"status": status}
        if health or only_idx is None:
            fields["health"] = {"checked_at": now_iso(), "kind": "scheduled" if health else "manual",
                                "broken": broken, "changed": shifted, "ok": len(fresh["steps"]) - len(failed),
                                "total": len(fresh["steps"])}
        await touch(pid, fields)
        label = "Weekly health check" if health else ("Re-recorded step" if only_idx is not None else "Recorded demo")
        await log_history(fresh, label, f"{len(fresh['steps']) - len(failed)}/{len(fresh['steps'])} steps captured"
                          + (f", {len(broken)} broke after a UI change" if broken else ""), snapshot=True)
        if broken or shifted:
            parts = []
            if broken:
                parts.append(f"{len(broken)} step(s) broke")
            if shifted:
                parts.append(f"{len(shifted)} step(s) look different")
            msg = ("Health check kept the previous frames — " if health else "Recording complete — ") + " and ".join(parts)
        else:
            msg = f"Recording complete with {len(failed)} failed step(s)" if failed else "Recording complete"
        if final:
            await finish_run(run_id, pid, "completed", msg)
        else:
            await run_log(run_id, msg, "success")
        return "completed"
    except Cancelled:
        await db.projects.update_one({"id": pid}, {"$set": {"steps.$[s].status": "pending"}},
                                     array_filters=[{"s.status": "running"}])
        await touch(pid, {"status": "partial"})
        await finish_run(run_id, pid, "cancelled", "Recording cancelled by user")
        return "cancelled"
    except Exception as exc:
        logger.exception("record job failed")
        await db.projects.update_one({"id": pid}, {"$set": {"steps.$[s].status": "failed"}},
                                     array_filters=[{"s.status": "running"}])
        await touch(pid, {"status": "failed"})
        clean = vault.scrub(str(exc), secrets_to_scrub)[:200]
        await finish_run(run_id, pid, "failed", f"Recording failed: {clean}")
        return "failed"


def _clip_stale(step: dict, source: str, voice: str, spoken: str, path_key: str, text_key: str, spoken_key: str) -> bool:
    previous = step.get(spoken_key)
    spoken_changed = bool(previous) and previous != spoken
    return bool(source.strip()) and (step.get(text_key) != source or spoken_changed
                                     or step.get("audio_voice") != voice or not step.get(path_key))


async def job_voiceover(project: dict, run_id: str, final: bool = True) -> str:
    pid, voice = project["id"], project.get("voice", "nova")
    glossary = project.get("glossary") or []
    todo = []
    for s in project["steps"]:
        clip_voice = s.get("voice") or voice
        spoken = speak(s.get("voiceover") or "", glossary)
        alt = speak(s.get("voiceover_alt") or "", glossary)
        if _clip_stale(s, s.get("voiceover") or "", clip_voice, spoken, "audio_path", "audio_text", "audio_spoken"):
            todo.append((s, "primary", spoken, clip_voice))
        if _clip_stale(s, s.get("voiceover_alt") or "", clip_voice, alt, "audio_path_alt", "audio_text_alt", "audio_spoken_alt"):
            todo.append((s, "alt", alt, clip_voice))
    try:
        for i, (s, track, spoken, clip_voice) in enumerate(todo):
            if await jobs.is_cancelled(run_id):
                await finish_run(run_id, pid, "cancelled", f"Voiceover cancelled after {i} clip(s)")
                return "cancelled"
            label = s.get("voiceover_alt") if track == "alt" else s.get("voiceover")
            await run_log(run_id, f"Voiceover {i + 1}/{len(todo)}: \"{(label or '')[:50]}\"", current=i + 1)
            audio, words = await ai.synthesize_timed(spoken, clip_voice)
            path = await put_object(f"{APP_NAME}/u/{project['user_id']}/{pid}/{s['id']}_{track}_{new_id()}.mp3", audio, "audio/mpeg")
            dur = await asyncio.to_thread(render.audio_duration_ms, audio)
            if track == "alt":
                fields = {"steps.$.audio_path_alt": path, "steps.$.audio_text_alt": s.get("voiceover_alt") or "",
                          "steps.$.audio_spoken_alt": spoken, "steps.$.audio_duration_alt": dur}
            else:
                fields = {"steps.$.audio_path": path, "steps.$.audio_text": s.get("voiceover") or "",
                          "steps.$.audio_voice": clip_voice, "steps.$.audio_duration_ms": dur, "steps.$.audio_spoken": spoken,
                          "steps.$.words": words}
            await db.projects.update_one({"id": pid, "steps.id": s["id"]}, {"$set": fields})
        msg = f"Voiceover ready ({len(todo)} clip(s) generated)"
        if final:
            await finish_run(run_id, pid, "completed", msg)
        else:
            await run_log(run_id, msg, "success")
        return "completed"
    except Exception as exc:
        logger.exception("voiceover job failed")
        await finish_run(run_id, pid, "failed", f"Voiceover failed: {ai_error(exc)}")
        return "failed"


async def job_autopilot(project: dict, run_id: str) -> None:
    pid = project["id"]
    try:
        elements = []
        await run_log(run_id, "Scanning the live page with Browserless...")
        brief = {}
        try:
            reading = await engine.read_page(project["target_url"])
            elements = reading.get("elements") or []
            brief = reading.get("brief") or {}
        except Exception as exc:
            await run_log(run_id, f"Page scan skipped: {str(exc)[:120]}", "warn")
        if await jobs.is_cancelled(run_id):
            raise Cancelled()
        await run_log(run_id, f"Reading the page and writing the narration ({len(elements)} live elements found)...")
        result, steps = await narrated_script(project["draft"], project["target_url"], elements, f"auto_{pid}_{new_id()}", brief)
        if not steps:
            raise ValueError("AI returned no usable steps. Add more detail to your draft.")
        steps = vault.seal_steps(steps, pid)
        project.update({"steps": steps, "thumbnail_path": None})
        await touch(pid, {"steps": steps, "status": "recording", "thumbnail_path": None})
        await log_history(project, "Generated script with AI", f"{len(steps)} steps (one-click run)", snapshot=True)
        await db.runs.update_one({"id": run_id}, {"$set": {"total": len(steps)}})
        await run_log(run_id, f"Script ready: {len(steps)} steps. Launching Browserless...", "success")
    except Cancelled:
        return await finish_run(run_id, pid, "cancelled", "Cancelled before recording")
    except Exception as exc:
        logger.exception("autopilot scripting failed")
        await touch(pid, {"status": "draft" if not project.get("steps") else project.get("status", "draft")})
        return await finish_run(run_id, pid, "failed", f"AI scripting failed: {ai_error(exc)}")
    if await job_record(project, run_id, None, final=False) != "completed":
        return
    if project.get("narration_mode") != "captions":
        fresh = await db.projects.find_one({"id": pid}, {"_id": 0})
        if await job_voiceover(fresh, run_id, final=False) != "completed":
            return
    await finish_run(run_id, pid, "completed", "Demo ready — scripted, recorded and narrated in one run")


async def refresh_all(cron_run_id: str) -> None:
    if engine is None or not engine.is_configured():
        logger.warning("weekly refresh skipped: Browserless not configured")
        return
    projects = await db.projects.find({"auto_refresh": True, "is_deleted": False, "steps.0": {"$exists": True}},
                                      {"_id": 0}).to_list(500)
    queued = 0
    for p in projects:
        try:
            await jobs.enqueue_run(
                p, "health", len(p["steps"]),
                "Weekly health check: re-recording to catch UI changes...",
                {"action": "record", "only_idx": None, "health": True, "only": None},
            )
            queued += 1
        except HTTPException:
            continue  # project already has an active run
    await db.cron_runs.update_one({"run_id": cron_run_id}, {"$set": {"finished_at": now_iso(), "projects": queued}})


def fingerprint(project: dict) -> str:
    keys = ("screenshot_path", "audio_path", "caption", "hotspot", "duration_ms", "transition", "transition_ms",
            "audio_duration_ms", "annotations", "motion_paths", "scene_type", "scene", "exit_trigger", "skippable",
            "video")
    payload = [[s.get(k) for k in keys] for s in project["steps"]] + [project.get("video_clips") or []]
    raw = json.dumps([payload, project.get("narration_mode"), project.get("brand"), project.get("export_preset"),
                      project.get("active_track")], sort_keys=True, default=str)
    return hashlib.sha1(raw.encode()).hexdigest()


async def job_export(project: dict, run_id: str, fmt: str, preset: str = "standard") -> None:
    pid = project["id"]
    fresh_proj = await db.projects.find_one({"id": pid}, {"_id": 0}) or project
    project = {**fresh_proj, "export_preset": preset}
    if project.get("active_track") == "alt":
        project = {**project, "steps": apply_track(project["steps"], "alt")}
    # The render engine is part of the export identity: a Remotion render
    # must not reuse an ffmpeg cache entry (or vice versa).
    engine = "remotion" if fmt == "mp4" and compositor.available() else "ffmpeg"
    fp = f"{fingerprint(project)}:{engine}"
    cached = next((e for e in project.get("exports", []) if e.get("fingerprint") == fp and e["format"] == fmt), None)
    if cached:
        return await finish_run(run_id, pid, "completed", f"{fmt.upper()} unchanged — reused cached export", result=cached)
    try:
        if await jobs.is_cancelled(run_id):
            return await finish_run(run_id, pid, "cancelled", f"{fmt.upper()} export cancelled")
        await run_log(run_id, f"Composing {len(project['steps'])} frames with captions & hotspots...", current=1)
        data = None
        if engine == "remotion":
            try:
                data = await compositor.render_mp4(project)
            except Exception as exc:
                logger.warning("Remotion export failed, falling back to ffmpeg: %s", str(exc)[:300])
                await run_log(run_id, "Remotion compositor unavailable — rendering with ffmpeg...", current=1)
        if data is None:
            data = await render.render(project, fmt)
        if await jobs.is_cancelled(run_id):
            return await finish_run(run_id, pid, "cancelled", f"{fmt.upper()} export cancelled")
        await run_log(run_id, f"Uploading {fmt.upper()} ({len(data) // 1024} KB)...", current=2)
        # Deterministic key per (project, format, fingerprint) so retries never duplicate artifacts
        path = await put_object(f"{APP_NAME}/u/{project['user_id']}/{pid}/export_{fp[:16]}.{fmt}", data,
                                "image/gif" if fmt == "gif" else "video/mp4")
        latest = await db.projects.find_one({"id": pid}, {"_id": 0}) or project
        existing = next((e for e in latest.get("exports", []) if e.get("fingerprint") == fp and e["format"] == fmt), None)
        if existing:
            exp = existing
        else:
            exp = {"id": new_id("ex_"), "format": fmt, "path": path, "size": len(data), "created_at": now_iso(),
                   "fingerprint": fp}
            await db.projects.update_one({"id": pid}, {"$push": {"exports": exp}, "$set": {"updated_at": now_iso()}})
            await log_history(project, f"Exported {fmt.upper()}", f"{len(data) // 1024} KB")
        await finish_run(run_id, pid, "completed", f"{fmt.upper()} export ready", result=exp)
    except Exception as exc:
        logger.exception("export job failed")
        await finish_run(run_id, pid, "failed", f"Export failed: {str(exc)[:200]}")


async def execute_run(run: dict) -> None:
    """Execute one claimed durable run and keep its lease renewed until completion."""
    run_id, pid = run["id"], run["project_id"]
    spec = run.get("job_spec") or {}
    action = spec.get("action") or run.get("kind")
    project = await db.projects.find_one({"id": pid}, {"_id": 0})
    if not project:
        await finish_run(run_id, pid, "failed", "Project no longer exists")
        return

    stop_hb = asyncio.Event()

    async def heartbeat() -> None:
        interval = max(10, jobs.LEASE_SECONDS // 3)
        while not stop_hb.is_set():
            try:
                await asyncio.wait_for(stop_hb.wait(), timeout=interval)
            except asyncio.TimeoutError:
                try:
                    await jobs.renew_lease(run_id)
                except Exception as exc:
                    logger.warning("lease renew failed for %s: %s", run_id, exc)

    hb_task = asyncio.create_task(heartbeat())
    try:
        if action == "record":
            only = set(spec["only"]) if spec.get("only") is not None else None
            await job_record(project, run_id, spec.get("only_idx"), health=bool(spec.get("health")), only=only)
        elif action == "autopilot":
            await job_autopilot(project, run_id)
        elif action == "voiceover":
            await job_voiceover(project, run_id)
        elif action == "export":
            await job_export(project, run_id, spec.get("format", "mp4"), spec.get("preset", "standard"))
        else:
            await finish_run(run_id, pid, "failed", f"Unknown job action: {action}")
    finally:
        stop_hb.set()
        hb_task.cancel()
        with suppress(asyncio.CancelledError):
            await hb_task


async def worker_loop(poll_seconds: float = 1.0) -> None:
    """Durable worker loop: claims queued runs and reclaims expired leases from crashed workers."""
    while True:
        try:
            run = await jobs.claim_next_run()
            if run:
                await execute_run(run)
                continue
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.warning("worker loop error: %s", exc)
        await asyncio.sleep(poll_seconds)


# ---------- project routes ----------
@api.get("/")
async def root():
    return {"app": "AppShowcase", "ok": True}


@api.get("/projects")
async def list_projects(view: Literal["active", "archived", "trash"] = "active", user: dict = Depends(get_current_user)):
    if view == "trash":
        match = {"user_id": user["user_id"], "is_deleted": True}
    elif view == "archived":
        match = {"user_id": user["user_id"], "is_deleted": False, "archived": True}
    else:
        match = {"user_id": user["user_id"], "is_deleted": False, "archived": {"$ne": True}}
    pipeline = [
        {"$match": match},
        {"$sort": {"updated_at": -1}},
        {"$limit": 200},
        {"$project": {"_id": 0, "id": 1, "name": 1, "target_url": 1, "status": 1, "thumbnail_path": 1,
                      "updated_at": 1, "is_public": 1, "auto_refresh": 1, "health": 1, "search_text": 1,
                      "archived": 1, "step_count": {"$size": "$steps"}}},
    ]
    return await db.projects.aggregate(pipeline).to_list(200)


def _validate_customer_url(url: str | None, label: str = "URL") -> str:
    text = (url or "").strip()
    if not text:
        return ""
    try:
        return netpolicy.validate_url_sync(text).url
    except netpolicy.DestinationBlocked as exc:
        raise HTTPException(400, f"Invalid {label}: {exc}")


@api.post("/projects")
async def create_project(body: ProjectIn, user: dict = Depends(get_current_user)):
    target = _validate_customer_url(body.target_url, "target URL") if body.target_url.strip() else ""
    prefs = user.get("preferences") or {}
    p = {"id": new_id("prj_"), "user_id": user["user_id"], "name": body.name.strip(), "draft": body.draft,
         "target_url": target, "steps": [], "status": "draft",
         "voice": prefs.get("voice", "nova"), "narration_mode": prefs.get("narration_mode", "both"),
         "share_id": new_id(), "is_public": False, "thumbnail_path": None, "exports": [], "brand": DEFAULT_BRAND,
         "auto_refresh": False, "health": None, "share_password_hash": None, "share_expires_at": None,
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
    raw = await db.projects.find_one({"id": pid}, {"_id": 0}) or {}
    fields = body.model_dump(exclude_none=True, exclude={"clear_login", "login_url", "login_username", "login_password", "cta_label", "cta_url", "login_recipe"})
    if "target_url" in fields and fields["target_url"].strip():
        fields["target_url"] = _validate_customer_url(fields["target_url"], "target URL")
    if "webhook_url" in fields and fields["webhook_url"].strip():
        fields["webhook_url"] = _validate_customer_url(fields["webhook_url"], "webhook URL")
    if "notify_url" in fields and fields["notify_url"].strip():
        fields["notify_url"] = _validate_customer_url(fields["notify_url"], "notification URL")
    if "environments" in fields and isinstance(fields["environments"], dict):
        cleaned_envs = {}
        for env_name, env_url in fields["environments"].items():
            cleaned_envs[env_name] = _validate_customer_url(env_url, f"{env_name} URL") if str(env_url or "").strip() else ""
        fields["environments"] = cleaned_envs
    if body.cta_label is not None or body.cta_url is not None:
        cta = dict(p.get("cta") or {})
        if body.cta_label is not None:
            cta["label"] = body.cta_label
        if body.cta_url is not None:
            cta["url"] = body.cta_url
        fields["cta"] = cta
    if body.clear_login or body.login_url is not None or body.login_username is not None or body.login_password:
        login = {} if body.clear_login else dict(raw.get("login") or {})
        if not body.clear_login:
            if body.login_url is not None:
                login["url"] = _validate_customer_url(body.login_url, "login URL") if body.login_url.strip() else ""
            if body.login_username is not None:
                login["username"] = body.login_username
            if body.login_password:
                login["password"] = body.login_password
                login["credentials_saved_at"] = now_iso()
        fields["login"] = vault.seal_login(login, pid)
    if body.login_recipe is not None:
        login = fields.get("login")
        if login is None:
            login = {} if body.clear_login else dict(raw.get("login") or {})
        recipe = [step.model_dump() for step in body.login_recipe]
        for step in recipe:
            if step.get("action") == "goto" and step.get("url"):
                step["url"] = _validate_customer_url(step["url"], "login recipe URL")
        login["recipe"] = recipe
        login["credentials_saved_at"] = now_iso()
        fields["login"] = vault.seal_login(login, pid)
    if body.glossary is not None:
        fields["glossary"] = [item.model_dump() for item in body.glossary]
    if "steps" in fields:
        stored = {s["id"]: s for s in raw.get("steps") or p["steps"]}
        fields["steps"] = []
        for s in body.steps:
            d = s.model_dump()
            if d.get("action") == "goto" and d.get("url") and "{{" not in d["url"]:
                d["url"] = _validate_customer_url(d["url"], "step URL")
            prev = stored.get(d["id"], {})
            for k in SERVER_FIELDS:
                d[k] = prev.get(k, Step.model_fields[k].default if k in Step.model_fields else None)
            if d.get("scene_type"):
                cfg = d.get("scene") or {}
                if cfg.get("webhook_url") and str(cfg["webhook_url"]).strip():
                    cfg["webhook_url"] = _validate_customer_url(str(cfg["webhook_url"]), "scene webhook URL")
                if cfg.get("cta_url") and str(cfg["cta_url"]).strip() and "{{" not in str(cfg["cta_url"]):
                    cfg["cta_url"] = _validate_customer_url(str(cfg["cta_url"]), "scene link URL")
                d["scene"] = cfg
                d["status"] = "done"  # scenes are rendered, never recorded
            fields["steps"].append(d)
        fields["steps"] = vault.seal_steps(fields["steps"], pid, existing=raw.get("steps"))
        fields["search_text"] = " ".join(
            " ".join(str(s.get(k) or "") for k in ("caption", "voiceover", "caption_alt", "voiceover_alt", "selector", "url", "error"))
            for s in fields["steps"])[:4000]
    if "brand" in fields:
        brand = body.brand.model_dump(exclude_none=True)
        if not brand.get("music_path") and (p.get("brand") or {}).get("music_path"):
            brand["music_path"] = p["brand"]["music_path"]
        fields["brand"] = brand
    await touch(pid, fields)
    p.update(fields)
    if "steps" in fields:
        last = await db.history.find_one({"project_id": pid}, {"_id": 0}, sort=[("created_at", -1)])
        redacted = vault.redact_steps(fields["steps"])
        if last and last["event"] == "Edited timeline" and last["created_at"] > (now() - timedelta(minutes=2)).isoformat():
            await db.history.update_one({"id": last["id"]}, {"$set": {"steps": redacted, "created_at": now_iso(),
                                                                     "detail": f"{len(redacted)} steps"}})
        else:
            await log_history(p, "Edited timeline", f"{len(redacted)} steps", snapshot=True)
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
    raw = await db.projects.find_one({"id": pid}, {"_id": 0}) or p
    new_pid = new_id("prj_")
    resealed = vault.reseal_project(raw, pid, new_pid)
    copy_doc = {**p, "id": new_pid, "name": f"{p['name']} (copy)", "share_id": new_id(), "is_public": False,
                "share_password_hash": None, "share_expires_at": None, "auto_refresh": False, "health": None,
                "exports": [], "active_run_id": None, "published": None, "review_token_jti": None,
                "login": resealed["login"], "steps": vault.seal_steps(resealed["steps"], new_pid),
                "created_at": now_iso(), "updated_at": now_iso()}
    for ephemeral in ("has_share_password", "has_login", "has_storage", "credential_expired", "storage_expired"):
        copy_doc.pop(ephemeral, None)
    await db.projects.insert_one(dict(copy_doc))
    await log_history(copy_doc, "Duplicated", f"from {p['name']}", snapshot=True)
    return await get_project(new_pid, user)


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
    raw = await db.projects.find_one({"id": pid}, {"_id": 0}) or {}
    h = await db.history.find_one({"id": hid, "project_id": pid}, {"_id": 0})
    if not h or not h.get("steps"):
        raise HTTPException(404, "Snapshot not found")
    merged = vault.merge_sensitive(h["steps"], raw.get("steps") or [])
    await touch(pid, {"steps": merged})
    p["steps"] = merged
    await log_history(p, "Restored version", h["event"], snapshot=True)
    return await get_project(pid, user)


@api.post("/projects/{pid}/generate")
async def generate(pid: str, user: dict = Depends(get_current_user)):
    p = await get_project(pid, user)
    if len(p["draft"].strip()) < 10:
        raise HTTPException(400, "Write a draft of at least a few words first")
    _validate_customer_url(p["target_url"], "target URL")
    elements, inspected, brief = [], False, {}
    if engine is not None and engine.is_configured():
        try:
            reading = await engine.read_page(p["target_url"])
            elements = reading.get("elements") or []
            brief = reading.get("brief") or {}
            inspected = True
        except Exception as exc:
            logger.warning("inspect failed: %s", exc)
    try:
        result, steps = await narrated_script(p["draft"], p["target_url"], elements, f"gen_{pid}_{new_id()}", brief)
    except Exception as exc:
        logger.exception("generate failed")
        raise HTTPException(424, f"AI could not build a script: {ai_error(exc)}")
    if not steps:
        raise HTTPException(424, "AI returned no usable steps. Try adding more detail to your draft.")
    await touch(pid, {"steps": steps, "status": "scripted", "thumbnail_path": None})
    p["steps"] = steps
    await log_history(p, "Generated script with AI", f"{len(steps)} steps", snapshot=True)
    out = await get_project(pid, user)
    out["inspected_elements"] = len(elements) if inspected else None
    out["ai_title"] = result.get("title")
    first = (steps[0].get("url") or p["target_url"] or "")
    out["review"] = {"first_url": first, "seconds": estimate_seconds({**p, "steps": steps}),
                     "host_mismatch": url_host(first) != url_host(p["target_url"])}
    return out


def url_host(url: str) -> str:
    try:
        return url.split("/")[2].lower()
    except Exception:
        return ""


def month_start() -> str:
    return now().replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()


async def usage_count(user: dict) -> int:
    count, _ = await jobs.usage_summary(user["user_id"])
    return count


async def usage_seconds(user: dict) -> int:
    _, seconds = await jobs.usage_summary(user["user_id"])
    return seconds


async def plan_and_limits(user: dict) -> tuple[str, int, int]:
    """Effective plan = highest of the user's Clerk plan, an admin override,
    and any entitled organization plan they belong to."""
    doc = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0}) or {}
    candidates: list[str | None] = []
    if billing.billing_is_entitled(doc.get("billing_status")):
        candidates.append(doc.get("plan"))
    elif not doc.get("billing_status") or doc.get("billing_status") == "free":
        # Legacy/local profiles have no subscription record; only their
        # explicit free tier is implied. A canceled/expired Clerk plan must
        # not keep conferring its old paid limits.
        candidates.append("free")
    memberships = await db.organization_memberships.find(
        {"user_id": user["user_id"]}, {"_id": 0}).to_list(100)
    for membership in memberships:
        org = await db.organizations.find_one({"id": membership.get("organization_id")}, {"_id": 0}) or {}
        if billing.billing_is_entitled(org.get("billing_status")):
            candidates.append(org.get("plan"))
    plan = doc.get("plan_override") or billing.highest_plan(candidates)
    recordings, seconds = billing.limits_for(plan, doc.get("monthly_limit_override"))
    return plan, recordings, seconds


async def monthly_limit_for(user: dict) -> int:
    _, recordings, _ = await plan_and_limits(user)
    return recordings


def _require_browserless() -> None:
    if engine is None or not engine.is_configured():
        raise HTTPException(400, "Browserless is not connected yet. Add your Browserless API key in Settings.")


@api.post("/projects/{pid}/autopilot")
async def autopilot(pid: str, user: dict = Depends(get_current_user)):
    p = await get_project(pid, user)
    _require_browserless()
    if len(p["draft"].strip()) < 10:
        raise HTTPException(400, "Write a draft of at least a few words first")
    _validate_customer_url(p["target_url"], "target URL")
    seconds = estimate_seconds(p)
    note = "One-click run: script → record → voiceover"
    if seconds > 120:
        note = "One-click run continues in parts because it is longer than a 120s browser session"
    run = await jobs.enqueue_run(
        p, "autopilot", 3, note, {"action": "autopilot"}, seconds=seconds, monthly_limit=await monthly_limit_for(user)
    )
    await touch(pid, {"status": "recording"})
    return run


@api.post("/projects/{pid}/health-check")
async def health_check(pid: str, user: dict = Depends(get_current_user)):
    p = await get_project(pid, user)
    _require_browserless()
    if not p["steps"]:
        raise HTTPException(400, "Record the demo first")
    return await jobs.enqueue_run(
        p, "health", len(p["steps"]), "Health check: re-recording to catch UI changes...",
        {"action": "record", "only_idx": None, "health": True, "only": None},
    )


@api.put("/projects/{pid}/share-settings")
async def share_settings(pid: str, body: ShareSettingsIn, user: dict = Depends(get_current_user)):
    await get_project(pid, user)
    fields = {"share_expires_at": body.expires_at.astimezone(timezone.utc).isoformat() if body.expires_at else None}
    if body.remove_password:
        fields["share_password_hash"] = None
    elif body.password:
        fields["share_password_hash"] = hash_password(body.password)
    await touch(pid, fields)
    p = await get_project(pid, user)
    await log_history(p, "Share settings updated", ("password protected" if p["has_share_password"] else "no password")
                      + (f", expires {fields['share_expires_at'][:16]}" if fields["share_expires_at"] else ""))
    return p


@api.post("/cron/refresh-demos")
async def cron_refresh_demos(request: Request):
    # Cron endpoints must ack 2xx immediately; enqueue durable runs for workers.
    auth = request.headers.get("Authorization", "")
    cron_secret = os.environ.get("WEBHOOK_CRON_SECRET", "")
    if not cron_secret:
        raise HTTPException(503, "Scheduled refresh is not configured")
    if not auth.startswith("Bearer ") or not hmac.compare_digest(auth[7:], cron_secret):
        raise HTTPException(401, "Unauthorized")
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(400, "Invalid body")
    run_key = request.headers.get("X-Webhook-Id") or (body or {}).get("run_id")
    if not run_key:
        raise HTTPException(400, "Missing run id")
    try:
        await db.cron_runs.insert_one({"run_id": run_key, "schedule": "weekly-refresh", "received_at": now_iso()})
    except DuplicateKeyError:
        return {"ok": True, "duplicate": True}
    spawn(refresh_all(run_key))
    return {"ok": True}


@api.post("/cron/storage-probe")
async def cron_storage_probe(request: Request):
    """Nightly storage check (same Bearer-secret auth as the demo refresh).
    Records the result; the dashboard banner surfaces a failure via
    /api/ready's storage_probe field before users hit it mid-recording."""
    auth = request.headers.get("Authorization", "")
    cron_secret = os.environ.get("WEBHOOK_CRON_SECRET", "")
    if not cron_secret:
        raise HTTPException(503, "Scheduled probe is not configured")
    if not auth.startswith("Bearer ") or not hmac.compare_digest(auth[7:], cron_secret):
        raise HTTPException(401, "Unauthorized")
    result = await record_storage_probe("nightly")
    return {"ok": result["ok"], "served_by": result["served_by"], "error": result["error"]}


@api.post("/projects/{pid}/record")
async def record(pid: str, user: dict = Depends(get_current_user)):
    p = await get_project(pid, user)
    _require_browserless()
    if not p["steps"]:
        raise HTTPException(400, "Generate or add steps before recording")
    seconds = estimate_seconds(p)
    note = "Launching secure Browserless Chromium session..."
    if seconds > 120:
        note = "This run is longer than one 120s browser session, so it will continue in parts."
    run = await jobs.enqueue_run(
        p, "record", len(p["steps"]), note,
        {"action": "record", "only_idx": None, "health": False, "only": None},
        seconds=seconds, monthly_limit=await monthly_limit_for(user),
    )
    await db.projects.update_one({"id": pid}, {"$set": {"steps.$[].status": "pending", "steps.$[].error": None,
                                                       "status": "recording"}})
    return run


@api.post("/projects/{pid}/steps/{sid}/rerecord")
async def rerecord(pid: str, sid: str, user: dict = Depends(get_current_user)):
    p = await get_project(pid, user)
    idx = next((i for i, s in enumerate(p["steps"]) if s["id"] == sid), None)
    if idx is None:
        raise HTTPException(404, "Step not found")
    if p["steps"][idx].get("scene_type"):
        raise HTTPException(400, "Scenes are rendered, not recorded — nothing to re-record")
    _require_browserless()
    seconds = estimate_seconds({**p, "steps": p["steps"][: idx + 1]})
    return await jobs.enqueue_run(
        p, "rerecord", idx + 1, f"Re-recording step {idx + 1} (replaying previous steps first)...",
        {"action": "record", "only_idx": idx, "health": False, "only": None},
        seconds=seconds, monthly_limit=await monthly_limit_for(user),
    )


@api.post("/projects/{pid}/voiceover")
async def voiceover(pid: str, user: dict = Depends(get_current_user)):
    p = await get_project(pid, user)
    if not any((s.get("voiceover") or s.get("voiceover_alt") or "").strip() for s in p["steps"]):
        raise HTTPException(400, "Add voiceover text to at least one step first")
    return await jobs.enqueue_run(
        p, "voiceover", len(p["steps"]), f"Synthesizing voiceover with voice '{p.get('voice')}'...",
        {"action": "voiceover"},
    )


@api.post("/projects/{pid}/export")
async def export(pid: str, body: ExportIn, user: dict = Depends(get_current_user)):
    p = await get_project(pid, user)
    if not any(s.get("screenshot_path") or s.get("scene_type") for s in p["steps"]):
        raise HTTPException(400, "Record the demo before exporting")
    return await jobs.enqueue_run(
        p, "export", 3, f"Rendering {body.format.upper()}...",
        {"action": "export", "format": body.format, "preset": body.preset},
    )


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
            if run["status"] not in ("queued", "running"):
                break
            await asyncio.sleep(0.5)
    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@api.get("/runs/{rid}/preview")
async def run_preview(rid: str, user: dict = Depends(get_current_user)):
    """Latest low-res JPEG from the recording worker for the studio live view."""
    run = await db.runs.find_one({"id": rid, "user_id": user["user_id"]}, {"_id": 0})
    if not run:
        raise HTTPException(404, "Run not found")
    path = run.get("preview_path")
    if not path:
        raise HTTPException(404, "No preview yet")
    try:
        data, ctype = await get_object(path)
    except Exception:
        raise HTTPException(404, "No preview yet")
    if not data:
        raise HTTPException(404, "No preview yet")
    return Response(content=data, media_type=ctype or "image/jpeg",
                    headers={"Cache-Control": "no-store", "X-Preview-Url": (run.get("preview_url") or "")[:500]})


@api.post("/runs/{rid}/cancel")
async def cancel_run(rid: str, user: dict = Depends(get_current_user)):
    return await jobs.request_cancel(rid, user["user_id"])


@api.post("/projects/{pid}/rewrite")
async def rewrite(pid: str, body: RewriteIn, user: dict = Depends(get_current_user)):
    p = await get_project(pid, user)
    if not p["steps"]:
        raise HTTPException(400, "Nothing to rewrite yet")
    try:
        edits = await ai.rewrite_narration(p["steps"], body.instruction, f"rw_{pid}_{new_id()}")
    except Exception as exc:
        raise HTTPException(424, f"AI rewrite failed: {ai_error(exc)}")
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
    url = _validate_customer_url(step.get("page_url") or prev_url or p["target_url"], "page URL")
    blocked = engine.blocked_page(url)
    if blocked:
        raise HTTPException(400, blocked)
    try:
        elements = await engine.inspect_page(url)
        fix = await ai.repair_selector(step, elements, f"fix_{sid}_{new_id()}")
    except Exception as exc:
        raise HTTPException(424, f"Repair failed: {ai_error(exc)}")
    if not fix.get("selector"):
        raise HTTPException(424, "AI could not find a better selector")
    step.update({"selector": fix["selector"], "fallback_selectors": (fix.get("fallback_selectors") or [])[:3],
                 "status": "pending", "error": None})
    await touch(pid, {"steps": p["steps"]})
    await log_history(p, "AI selector repair", f"Step {idx + 1}: {fix.get('reason', '')}", snapshot=True)
    out = await get_project(pid, user)
    out["repair_reason"] = fix.get("reason")
    return out


@api.post("/projects/{pid}/rerecord-failed")
async def rerecord_failed(pid: str, user: dict = Depends(get_current_user)):
    p = await get_project(pid, user)
    _require_browserless()
    failed = sorted(i for i, s in enumerate(p["steps"]) if s.get("status") == "failed")
    if not failed:
        raise HTTPException(400, "No failed steps to re-record")
    seconds = estimate_seconds(p)
    return await jobs.enqueue_run(
        p, "rerecord", max(failed) + 1, f"Re-recording {len(failed)} failed step(s)...",
        {"action": "record", "only_idx": None, "health": False, "only": failed},
        seconds=seconds, monthly_limit=await monthly_limit_for(user),
    )


@api.post("/projects/{pid}/publish")
async def publish(pid: str, user: dict = Depends(get_current_user)):
    p = await get_project(pid, user)
    raw = await db.projects.find_one({"id": pid}, {"_id": 0}) or p
    if not raw.get("steps"):
        raise HTTPException(400, "Add steps before publishing")
    snap = {
        "release_id": new_id("rel_"),
        "steps": copy.deepcopy(vault.redact_steps(raw["steps"])),
        "name": p["name"],
        "brand": copy.deepcopy(p.get("brand")),
        "narration_mode": p.get("narration_mode"),
        "cta": copy.deepcopy(p.get("cta")),
        "published_at": now_iso(),
    }
    await touch(pid, {"published": snap, "is_public": True})
    await log_history(p, "Published share", f"{len(snap['steps'])} steps ({snap['release_id']})")
    return await get_project(pid, user)


@api.get("/projects/{pid}/transcript")
async def project_transcript(pid: str, fmt: Literal["txt", "vtt"] = "txt", user: dict = Depends(get_current_user)):
    p = await get_project(pid, user)
    body = transcript(p, fmt)
    media = "text/vtt" if fmt == "vtt" else "text/plain"
    return Response(content=body, media_type=f"{media}; charset=utf-8")


@api.post("/projects/{pid}/changelog")
async def changelog(pid: str, body: SourceIn, user: dict = Depends(get_current_user)):
    p = await get_project(pid, user)
    _validate_customer_url(p["target_url"], "target URL")
    elements, brief = [], {}
    if engine is not None and engine.is_configured():
        try:
            reading = await engine.read_page(p["target_url"])
            elements, brief = reading.get("elements") or [], reading.get("brief") or {}
        except Exception:
            logger.warning("changelog inspect failed", exc_info=True)
    try:
        result, steps = await narrated_script(body.source, p["target_url"], elements, f"log_{pid}_{new_id()}", brief, changelog=True)
    except Exception as exc:
        raise HTTPException(424, f"Could not script the changelog: {ai_error(exc)}")
    if not steps:
        raise HTTPException(424, "The changelog did not produce any steps")
    await touch(pid, {"steps": steps, "status": "scripted", "draft": body.source})
    p["steps"] = steps
    await log_history(p, "Scripted from changelog", f"{len(steps)} steps", snapshot=True)
    return await get_project(pid, user)


@api.post("/projects/{pid}/import-playwright")
async def import_playwright(pid: str, body: SourceIn, user: dict = Depends(get_current_user)):
    p = await get_project(pid, user)
    parsed = parse_playwright(body.source)
    steps = normalize_steps(parsed, p["target_url"])
    if not steps:
        raise HTTPException(400, "No page.goto, click, or fill calls were found in that file")
    if ai is not None:
        try:
            edits = await ai.rewrite_narration(steps, cinematic.STORY_INSTRUCTION, f"imp_{pid}")
            by_id = {e.get("id"): e for e in edits}
            for step in steps:
                edit = by_id.get(step["id"])
                if edit:
                    step["caption"] = edit.get("caption") or step["caption"]
                    step["voiceover"] = edit.get("voiceover") or ""
        except Exception:
            logger.warning("playwright import narration skipped", exc_info=True)
    await touch(pid, {"steps": steps, "status": "scripted"})
    p["steps"] = steps
    await log_history(p, "Imported Playwright test", f"{len(steps)} steps", snapshot=True)
    return await get_project(pid, user)


@api.post("/projects/{pid}/capture")
async def capture(pid: str, body: CaptureIn, user: dict = Depends(get_current_user)):
    p = await get_project(pid, user)
    _require_browserless()
    raw = await db.projects.find_one({"id": pid}, {"_id": 0}) or {}
    login = vault.open_login(raw.get("login") or {}, pid)
    opened_steps = [{**s, "text": vault.open_step_text(s, pid)} if s.get("sensitive") else dict(s) for s in raw.get("steps") or p["steps"]]
    project = {**raw, "steps": opened_steps, "login": login}
    start = _validate_customer_url(environment_base(project) or p["target_url"], "target URL")
    if body.after > len(opened_steps):
        raise HTTPException(400, "There are not that many steps to replay")
    prepared = [prepare_step(step, project) for step in opened_steps[:body.after]]
    try:
        found = await engine.inspect_after(start, prepared, login=None if login.get("storage_state") else login, scroll=body.scroll,
                                           storage_state=login.get("storage_state"))
    except Exception as exc:
        raise HTTPException(424, f"Could not open the page: {str(exc)[:180]}")
    return {"url": found["url"], "elements": found["elements"][:40], "after": body.after}


def _live_ready() -> None:
    if live_browser is None or engine is None or not engine.is_configured():
        raise HTTPException(400, "Browserless is not connected yet. Add your Browserless API key in Settings.")


async def _live_project(pid: str, user: dict) -> tuple[dict, str]:
    p = await get_project(pid, user)
    raw = await db.projects.find_one({"id": pid}, {"_id": 0}) or {}
    login = vault.open_login(raw.get("login") or {}, pid)
    opened_steps = [{**s, "text": vault.open_step_text(s, pid)} if s.get("sensitive") else dict(s) for s in raw.get("steps") or p["steps"]]
    project = {**raw, "steps": opened_steps, "login": login}
    start = _validate_customer_url(environment_base(project) or p["target_url"], "target URL")
    return project, start


@api.post("/projects/{pid}/live/start")
async def live_start(pid: str, body: LiveStartIn, user: dict = Depends(get_current_user)):
    project, start = await _live_project(pid, user)
    _live_ready()
    if body.after > len(project["steps"]):
        raise HTTPException(400, "There are not that many steps to replay")
    prepared = [prepare_step(step, project) for step in project["steps"][:body.after]]
    login = project.get("login") or {}
    storage = login.get("storage_state")
    try:
        found = await live_browser.open_session(
            pid, start, prepared,
            None if storage else login,
            user["user_id"],
            storage_state=storage,
        )
    except Exception as exc:
        raise HTTPException(424, f"Could not open the live browser: {str(exc)[:700]}")
    return {
        "url": found["url"],
        "after": body.after,
        "has_storage": bool(storage),
        "warning": found.get("warning") or "",
    }


def _own_live(pid: str, user: dict) -> None:
    if not live_browser or not live_browser.owns(pid, user["user_id"]):
        raise HTTPException(404, "Live browser is not open")


@api.get("/projects/{pid}/live")
async def live_status(pid: str, user: dict = Depends(get_current_user)):
    if not live_browser or not live_browser.owns(pid, user["user_id"]):
        return {"open": False, "url": "", "error": ""}
    return live_browser.status(pid)


@api.get("/projects/{pid}/live/frame")
async def live_frame(pid: str, user: dict = Depends(get_current_user)):
    _own_live(pid, user)
    data = live_browser.frame(pid)
    if not data:
        raise HTTPException(404, "Live browser is not open")
    return Response(content=data, media_type="image/jpeg", headers={"Cache-Control": "no-store"})


@api.post("/projects/{pid}/live/click")
async def live_click(pid: str, body: LiveClickIn, user: dict = Depends(get_current_user)):
    _own_live(pid, user)
    try:
        return await live_browser.click(pid, body.x, body.y)
    except Exception as exc:
        raise HTTPException(424, str(exc)[:180])


@api.post("/projects/{pid}/live/type")
async def live_type(pid: str, body: LiveTypeIn, user: dict = Depends(get_current_user)):
    _own_live(pid, user)
    try:
        return await live_browser.type_text(pid, body.text)
    except Exception as exc:
        raise HTTPException(424, str(exc)[:180])


@api.post("/projects/{pid}/live/scroll")
async def live_scroll(pid: str, body: LiveScrollIn, user: dict = Depends(get_current_user)):
    _own_live(pid, user)
    try:
        return await live_browser.scroll(pid, body.amount)
    except Exception as exc:
        raise HTTPException(424, str(exc)[:180])


@api.post("/projects/{pid}/live/key")
async def live_key(pid: str, body: LiveKeyIn, user: dict = Depends(get_current_user)):
    _own_live(pid, user)
    try:
        return await live_browser.press_key(pid, body.key)
    except Exception as exc:
        raise HTTPException(424, str(exc)[:180])


@api.post("/projects/{pid}/live/stop")
async def live_stop(pid: str, user: dict = Depends(get_current_user)):
    await get_project(pid, user)
    if live_browser:
        await live_browser.close_session(pid)
    return {"ok": True}


@api.post("/projects/{pid}/live/save-session")
async def live_save_session(pid: str, user: dict = Depends(get_current_user)):
    """Persist cookies/localStorage from the open live browser as the project auth profile."""
    await get_project(pid, user)
    _own_live(pid, user)
    try:
        state = await live_browser.export_storage(pid)
    except Exception as exc:
        raise HTTPException(424, f"Could not save the session: {str(exc)[:180]}")
    raw = await db.projects.find_one({"id": pid}, {"_id": 0}) or {}
    raw_login = dict(raw.get("login") or {})
    raw_login["storage_state"] = state
    raw_login["storage_saved_at"] = now_iso()
    await touch(pid, {"login": vault.seal_login(raw_login, pid)})
    snap = live_browser.snapshot(pid)
    return {"has_storage": True, "saved_at": raw_login["storage_saved_at"], "url": snap.get("url") or ""}


@api.post("/projects/{pid}/live/start-from-here")
async def live_start_from_here(pid: str, user: dict = Depends(get_current_user)):
    """Save the live session and make the current page the demo starting point.

    Keeps timeline steps after the first go-to (if any), replaces the opening
    navigation with the live URL, and stores cookies so Record demo skips login.
    """
    await get_project(pid, user)
    _own_live(pid, user)
    try:
        state = await live_browser.export_storage(pid)
        snap = live_browser.snapshot(pid)
    except Exception as exc:
        raise HTTPException(424, f"Could not capture the live page: {str(exc)[:180]}")
    url = (snap.get("url") or "").strip()
    if not url.startswith(("http://", "https://")):
        raise HTTPException(400, "The live browser is not on a usable page yet")
    url = _validate_customer_url(url, "live page URL")

    raw = await db.projects.find_one({"id": pid}, {"_id": 0}) or {}
    raw_login = dict(raw.get("login") or {})
    raw_login["storage_state"] = state
    raw_login["storage_saved_at"] = now_iso()

    steps = list(raw.get("steps") or [])
    # Drop leading goto steps — the live URL becomes the new entry point.
    while steps and steps[0].get("action") == "goto":
        steps.pop(0)
    entry = {
        "id": new_id("st_"),
        "action": "goto",
        "url": url,
        "selector": "",
        "text": None,
        "caption": f"Open {url}",
        "voiceover": "",
        "status": "pending",
        "wait_ms": 800,
        "duration_ms": 3000,
        "transition": "fade",
        "transition_ms": 800,
        "attempts": 0,
    }
    steps = [entry] + steps
    await touch(pid, {
        "login": vault.seal_login(raw_login, pid),
        "target_url": url,
        "steps": steps,
        "status": "scripted",
    })
    return await get_project(pid, user)


@api.post("/projects/{pid}/steps/{sid}/comments")
async def add_comment(pid: str, sid: str, body: CommentIn, user: dict = Depends(get_current_user)):
    p = await get_project(pid, user)
    step = next((s for s in p["steps"] if s["id"] == sid), None)
    if not step:
        raise HTTPException(404, "Step not found")
    comment = {"id": new_id("c_"), "text": body.text.strip(), "author": user.get("name") or user.get("email") or "You", "at": now_iso()}
    comments = list(step.get("comments") or []) + [comment]
    await db.projects.update_one({"id": pid, "steps.id": sid}, {"$set": {"steps.$.comments": comments, "updated_at": now_iso()}})
    return await get_project(pid, user)


@api.get("/projects/{pid}/analytics")
async def analytics(pid: str, user: dict = Depends(get_current_user)):
    p = await get_project(pid, user)
    events = await db.analytics_events.find({"project_id": pid}, {"_id": 0}).sort("created_at", -1).to_list(5000)
    views, completes, reach = set(), set(), {}
    cta_clicks, referrers, devices, series = 0, {}, {"desktop": 0, "phone": 0}, {}
    for e in events:
        if e["type"] == "view":
            views.add(e["session"])
            device = e.get("device") if e.get("device") in devices else "desktop"
            devices[device] += 1
            host = url_host(e.get("referrer") or "") or "direct"
            referrers[host] = referrers.get(host, 0) + 1
            day = (e.get("created_at") or "")[:10]
            if day:
                series[day] = series.get(day, 0) + 1
        elif e["type"] == "complete":
            completes.add(e["session"])
        elif e["type"] == "cta":
            cta_clicks += 1
        reach[e["session"]] = max(reach.get(e["session"], 0), e.get("step_index", 0))
    n = len(p["steps"])
    per_step = [sum(1 for v in reach.values() if v >= i) for i in range(n)]
    dwells: dict[int, list] = {}
    leads = []
    for e in events:
        if e.get("dwell_ms"):
            dwells.setdefault(int(e.get("step_index") or 0), []).append(e["dwell_ms"])
        if e["type"] == "lead" and e.get("email"):
            leads.append({"email": e["email"], "name": e.get("name") or "", "scene_type": e.get("scene_type") or "",
                          "scene_id": e.get("scene_id") or "", "step_index": e.get("step_index"), "at": e.get("created_at")})
    avg_dwell = [round(sum(dwells.get(i, [])) / len(dwells[i])) if dwells.get(i) else 0 for i in range(n)]
    return {"views": len(views), "completions": len(completes),
            "completion_rate": round(len(completes) / len(views) * 100) if views else 0, "per_step": per_step,
            "avg_dwell_ms": avg_dwell, "leads": leads[:500], "cta_clicks": cta_clicks,
            "devices": devices, "referrers": [{"host": k, "views": v} for k, v in sorted(referrers.items(), key=lambda item: -item[1])[:8]],
            "series": [{"day": day, "views": series[day]} for day in sorted(series)[-14:]]}


@api.get("/projects/{pid}/leads.csv")
async def leads_csv(pid: str, user: dict = Depends(get_current_user)):
    await get_project(pid, user)
    events = await db.analytics_events.find({"project_id": pid, "type": "lead"}, {"_id": 0}).sort("created_at", -1).to_list(5000)
    import csv as csv_mod
    buf = io.StringIO()
    writer = csv_mod.writer(buf)
    writer.writerow(["email", "name", "scene_type", "scene_id", "step_index", "captured_at"])
    for e in events:
        if e.get("email"):
            writer.writerow([e["email"], e.get("name") or "", e.get("scene_type") or "", e.get("scene_id") or "",
                             e.get("step_index"), e.get("created_at") or ""])
    return Response(content=buf.getvalue(), media_type="text/csv",
                    headers={"Content-Disposition": 'attachment; filename="leads.csv"'})


def fire_webhook(project: dict, payload: dict) -> None:
    url = (project.get("webhook_url") or "").strip()
    if not url.startswith(("http://", "https://")):
        return

    async def send() -> None:
        ok, code, error = False, 0, ""
        for attempt in range(3):
            ok, code, error = await _post_json(url, payload)
            if ok:
                break
            await asyncio.sleep(0.4 * (attempt + 1))
        entry = {"at": now_iso(), "event": payload.get("event"), "ok": ok, "status": code, "error": error}
        current = await db.projects.find_one({"id": project["id"]}, {"_id": 0})
        log = ((current or {}).get("webhook_log") or [])[-19:] + [entry]
        await touch(project["id"], {"webhook_log": log})

    spawn(send())


def _motion_response(step: dict | None, index: int) -> Response:
    paths = (step or {}).get("motion_paths") or []
    if index < 0 or index >= len(paths):
        raise HTTPException(404, "Asset not found")
    return paths[index]


def _share_cache_headers(project: dict) -> dict:
    """Never allow shared/CDN caches to store restricted, expiring, or revocable share assets."""
    if project.get("share_password_hash") or project.get("share_expires_at"):
        return {"Cache-Control": "private, no-store", "Pragma": "no-cache", "Vary": "X-Viewer-Token"}
    return {"Cache-Control": "private, no-cache", "Vary": "X-Viewer-Token"}


async def _asset(p: dict, sid: str, kind: str, cache_headers: dict | None = None) -> Response:
    step = next((s for s in p["steps"] if s["id"] == sid), None)
    field = {"screenshot": "screenshot_path", "thumb": "thumb_path", "audio": "audio_path", "mobile": "screenshot_mobile_path"}[kind]
    path = step and (step.get(field) or (step.get("screenshot_path") if kind == "thumb" else None))
    if not path:
        raise HTTPException(404, "Asset not found")
    data, _ = await get_object(path)
    media = "audio/mpeg" if kind == "audio" else ("image/webp" if path.endswith(".webp") else "image/jpeg")
    return Response(content=data, media_type=media, headers=cache_headers or {"Cache-Control": "private, no-store"})


@api.get("/projects/{pid}/steps/{sid}/motion/{index}")
async def step_motion(pid: str, sid: str, index: int, user: dict = Depends(get_current_user)):
    project = await get_project(pid, user)
    step = next((s for s in project["steps"] if s["id"] == sid), None)
    path = _motion_response(step, index)
    data, _ = await get_object(path)
    return Response(content=data, media_type="image/jpeg", headers={"Cache-Control": "private, max-age=86400"})


async def _video_asset(p: dict, sid: str, cache_headers: dict | None = None,
                       request: Request | None = None) -> Response:
    step = next((s for s in p["steps"] if s["id"] == sid), None)
    vid = (step or {}).get("video") or {}
    clips = p.get("video_clips") or []
    clip = vid.get("clip")
    path = clips[clip] if isinstance(clip, int) and 0 <= clip < len(clips) else None
    if not path:
        raise HTTPException(404, "Video not found")
    data, _ = await get_object(path)
    headers = {"Accept-Ranges": "bytes", **(cache_headers or {"Cache-Control": "private, no-store"})}
    # Browsers require Range support to seek: without it a seek past the
    # buffered region restarts the element at 0 (the player seeks per step).
    range_header = request.headers.get("range") if request is not None else None
    if range_header:
        m = re.match(r"bytes=(\d*)-(\d*)", range_header.strip())
        if m:
            total = len(data)
            start = int(m.group(1)) if m.group(1) else 0
            end = int(m.group(2)) if m.group(2) else total - 1
            if start >= total:
                return Response(status_code=416, headers={"Content-Range": f"bytes */{total}"})
            end = min(end, total - 1)
            headers["Content-Range"] = f"bytes {start}-{end}/{total}"
            return Response(content=data[start:end + 1], status_code=206,
                            media_type="video/mp4", headers=headers)
    return Response(content=data, media_type="video/mp4", headers=headers)


@api.get("/projects/{pid}/steps/{sid}/video")
async def step_video(pid: str, sid: str, request: Request, user: dict = Depends(get_current_user)):
    project = await get_project(pid, user)
    return await _video_asset(project, sid, request=request)


@api.get("/projects/{pid}/steps/{sid}/{kind}")
async def step_asset(pid: str, sid: str, kind: Literal["screenshot", "thumb", "audio", "mobile"], user: dict = Depends(get_current_user),
                     track: Optional[Literal["primary", "alt"]] = None):
    project = await get_project(pid, user)
    if kind == "audio" and track == "alt":
        project = {**project, "steps": apply_track(project["steps"], "alt")}
    return await _asset(project, sid, kind)


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
async def _public_project(share_id: str, request: Request, unlock: bool = True) -> dict:
    p = await db.projects.find_one({"share_id": share_id, "is_public": True, "is_deleted": False}, {"_id": 0})
    if not p:
        link = await db["variant_shares"].find_one({"share_id": share_id}, {"_id": 0})
        if link:
            parent = await db.projects.find_one({"id": link.get("project_id"), "is_public": True, "is_deleted": False}, {"_id": 0})
            variant = next((v for v in (parent or {}).get("variants") or [] if v.get("id") == link.get("variant_id")), None)
            if parent and variant:
                p = dict(parent)
                p["variables"] = {**(parent.get("variables") or {}), **(variant.get("variables") or {})}
                p["name"] = f"{parent.get('name')} · {variant.get('name')}"
                p["share_id"] = share_id
    if not p:
        raise HTTPException(404, "This demo is private or does not exist")
    if p.get("share_expires_at") and p["share_expires_at"] < now_iso():
        raise HTTPException(410, "This demo link has expired")
    pw = p.get("share_password_hash")
    if unlock and pw:
        token = request.headers.get("X-Viewer-Token") or request.query_params.get("t") or ""
        if decode_viewer_token(token) != f"{share_id}:{pw[-10:]}":
            raise HTTPException(401, "password_required")
    return p


@api.post("/public/{share_id}/unlock")
async def public_unlock(share_id: str, body: UnlockIn, request: Request):
    p = await _public_project(share_id, request, unlock=False)
    if not p.get("share_password_hash"):
        return {"token": None}
    fwd = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
    ident = f"share:{share_id}:{fwd or (request.client.host if request.client else 'x')}"
    attempt = await db.login_attempts.find_one({"identifier": ident}, {"_id": 0})
    locked = attempt.get("locked_until") if attempt else None
    if isinstance(locked, str):
        locked = datetime.fromisoformat(locked)
    if attempt and attempt.get("count", 0) >= 10 and locked and locked > now():
        raise HTTPException(429, "Too many attempts. Try again in 15 minutes.")
    if not verify_password(body.password, p["share_password_hash"]):
        await db.login_attempts.update_one({"identifier": ident}, {"$inc": {"count": 1},
                                           "$set": {"locked_until": now() + timedelta(minutes=15)}}, upsert=True)
        raise HTTPException(403, "Incorrect password")
    await db.login_attempts.delete_one({"identifier": ident})
    return {"token": create_viewer_token(f"{share_id}:{p['share_password_hash'][-10:]}")}


def _tour_key(row: dict):
    order = row.get("tour_order")
    return (order if isinstance(order, int) else 50, row.get("name") or "")


def _require_published(project: dict) -> dict:
    view = public_view(project)
    if not view:
        raise HTTPException(404, "This demo has not been published yet")
    return view


@api.get("/public/products/{slug}")
async def public_product(slug: str):
    rows = await db.projects.find({"product_slug": slug, "is_public": True, "is_deleted": False}, {"_id": 0}).to_list(50)
    cutoff = now_iso()
    published_rows = [
        r for r in rows
        if (r.get("published") or {}).get("steps")
        and (not r.get("share_expires_at") or r["share_expires_at"] >= cutoff)
    ]
    published_rows.sort(key=_tour_key)
    return {"slug": slug, "demos": [{"name": (r.get("published") or {}).get("name") or r.get("name"),
                                     "share_id": r.get("share_id"),
                                     "tour_order": r.get("tour_order") or 0,
                                     "step_count": len((r.get("published") or {}).get("steps") or []),
                                     "updated_at": (r.get("published") or {}).get("published_at") or r.get("updated_at")}
                                    for r in published_rows]}


async def _next_demo(project: dict, share_id: str) -> dict | None:
    slug = project.get("product_slug") or ""
    if not slug:
        return None
    rows = await db.projects.find({"product_slug": slug, "is_public": True, "is_deleted": False}, {"_id": 0}).to_list(50)
    cutoff = now_iso()
    rows = [r for r in rows if (r.get("published") or {}).get("steps")
            and (not r.get("share_expires_at") or r["share_expires_at"] >= cutoff)]
    rows.sort(key=_tour_key)
    ids = [r.get("share_id") for r in rows]
    if share_id not in ids:
        return None
    nxt = ids.index(share_id) + 1
    if nxt >= len(rows):
        return None
    return {"name": (rows[nxt].get("published") or {}).get("name") or rows[nxt].get("name"), "share_id": rows[nxt].get("share_id")}


@api.get("/public/{share_id}")
async def public_demo(share_id: str, request: Request, response: Response, track: Optional[Literal["primary", "alt"]] = None):
    raw = await _public_project(share_id, request)
    p = _require_published(raw)
    for k, v in _share_cache_headers(raw).items():
        response.headers[k] = v
    variables = p.get("variables") or {}
    source = apply_track(p["steps"], track or p.get("active_track") or "primary")
    keep = ("id", "action", "caption", "voiceover", "duration_ms", "transition", "transition_ms", "hotspot",
            "audio_duration_ms", "chapter", "annotations", "scene_type", "exit_trigger", "skippable",
            "video", "words")
    steps = []
    for s in source:
        item = {k: s.get(k) for k in keep}
        # Never expose delivery endpoints (webhooks / owner-notify flags) to viewers.
        item["scene"] = {k: v for k, v in (s.get("scene") or {}).items() if k not in ("webhook_url", "notify_owner")}
        item["caption"] = substitute(item.get("caption"), variables)
        item["voiceover"] = substitute(item.get("voiceover"), variables)
        item.update({"has_screenshot": bool(s.get("screenshot_path")),
                     "has_mobile": bool(s.get("screenshot_mobile_path")),
                     "has_audio": bool(s.get("audio_path")), "motion_count": len(s.get("motion_paths") or []),
                     "branch": s.get("branch") or "", "choices": s.get("choices") or [],
                     "v": (s.get("screenshot_path") or "")[-12:]})
        steps.append(item)
    has_alt = any((s.get("caption_alt") or s.get("voiceover_alt")) for s in p["steps"])
    brand = {**DEFAULT_BRAND, **(p.get("brand") or {})}
    brand.pop("music_path", None)
    return {"name": p["name"], "narration_mode": p.get("narration_mode", "both"), "steps": steps,
            "brand": brand, "updated_at": p["updated_at"],
            "expires_at": p.get("share_expires_at"), "cta": p.get("cta") or {},
            "published_at": p.get("published_at"), "release_id": p.get("release_id"),
            "product_slug": p.get("product_slug") or "",
            "guided": bool(p.get("guided")), "tracks": ["primary", "alt"] if has_alt else ["primary"],
            "track": track or p.get("active_track") or "primary",
            "next": await _next_demo(p, share_id)}


@api.get("/public/{share_id}/transcript")
async def public_transcript(share_id: str, request: Request, fmt: Literal["txt", "vtt"] = "vtt"):
    raw = await _public_project(share_id, request)
    p = _require_published(raw)
    media = "text/vtt" if fmt == "vtt" else "text/plain"
    return Response(content=transcript(p, fmt), media_type=f"{media}; charset=utf-8", headers=_share_cache_headers(raw))


_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


@api.post("/public/{share_id}/events")
async def public_event(share_id: str, body: EventIn, request: Request):
    p = _require_published(await _public_project(share_id, request))
    if body.type == "lead" and not _EMAIL_RE.match((body.email or "").strip()):
        raise HTTPException(400, "A valid email is required")
    fields = {"created_at": now_iso()}
    if body.dwell_ms is not None:
        fields["dwell_ms"] = body.dwell_ms
    if body.email:
        fields["email"] = body.email.strip()
    if body.name:
        fields["name"] = body.name.strip()
    if body.scene_id:
        fields["scene_id"] = body.scene_id
    if body.scene_type:
        fields["scene_type"] = body.scene_type
    if body.referrer:
        fields["referrer"] = body.referrer[:300]
    if body.device:
        fields["device"] = body.device
    if body.branch:
        fields["branch"] = body.branch[:40]
    if body.type == "lead":
        # Every submission is a lead, even repeat submits in one session.
        await db.analytics_events.insert_one({"project_id": p["id"], "session": body.session,
                                              "type": body.type, "step_index": body.step_index, **fields})
    else:
        await db.analytics_events.update_one(
            {"project_id": p["id"], "session": body.session, "type": body.type, "step_index": body.step_index},
            {"$set": fields}, upsert=True)
    if body.type in ("complete", "lead", "cta"):
        payload = {"event": body.type, "demo": p.get("name"), "share_id": share_id,
                   "step_index": body.step_index, "email": body.email, "name": body.name,
                   "scene_id": body.scene_id, "scene_type": body.scene_type, "session": body.session}
        fire_webhook(p, payload)
        if body.type == "lead" and body.scene_id:
            step = next((s for s in p["steps"] if s["id"] == body.scene_id), None)
            cfg = (step or {}).get("scene") or {}
            hook = str(cfg.get("webhook_url") or "").strip()
            if hook.startswith(("http://", "https://")):
                spawn(_post_json(hook, payload))
            if cfg.get("notify_owner"):
                notify = str(p.get("notify_url") or "").strip()
                if notify.startswith(("http://", "https://")):
                    spawn(_post_json(notify, payload))
    return {"ok": True}


@api.get("/public/{share_id}/steps/{sid}/motion/{index}")
async def public_motion(share_id: str, sid: str, index: int, request: Request):
    raw = await _public_project(share_id, request)
    project = _require_published(raw)
    step = next((s for s in project["steps"] if s["id"] == sid), None)
    path = _motion_response(step, index)
    data, _ = await get_object(path)
    return Response(content=data, media_type="image/jpeg", headers=_share_cache_headers(raw))


@api.get("/public/{share_id}/steps/{sid}/video")
async def public_video(share_id: str, sid: str, request: Request):
    raw = await _public_project(share_id, request)
    project = _require_published(raw)
    return await _video_asset(project, sid, cache_headers=_share_cache_headers(raw), request=request)


@api.get("/public/{share_id}/steps/{sid}/{kind}")
async def public_asset(share_id: str, sid: str, kind: Literal["screenshot", "thumb", "audio", "mobile"], request: Request,
                       track: Optional[Literal["primary", "alt"]] = None):
    raw = await _public_project(share_id, request)
    project = _require_published(raw)
    if kind == "audio" and track == "alt":
        project = {**project, "steps": apply_track(project["steps"], "alt")}
    return await _asset(project, sid, kind, cache_headers=_share_cache_headers(raw))


# ---------- settings ----------
@api.get("/health")
async def health():
    """Liveness: the process is up."""
    return {"ok": True, "instance": INSTANCE_ID}


@api.get("/ready")
async def ready():
    """Readiness: dependencies this instance needs are configured and reachable."""
    st = storage_status()
    problems = config_problems()
    fatal = [p for p in problems if p.startswith(FATAL_PREFIXES)]
    checks = {"database": DB_BACKEND, "ai": bool(ai and ai.provider()[2]),
              "browserless": bool(engine and engine.is_configured()),
              "browser_driver_lib": bool(engine and engine._driver_lib_dir()),
              "compositor": "remotion" if compositor.available() else "ffmpeg",
              "storage": st.get("mode"), "storage_ok": st.get("mode") in {"s3", "remote", "local"},
              "auth_provider": "clerk" if clerk_service.clerk_enabled() else "legacy",
              "clerk_configured": clerk_service.clerk_enabled(),
              "config_ok": not fatal, "config_problems": problems,
              "cors_origins": cors_origins(),
              "startup_error": getattr(app.state, "config_error", None)}
    try:
        await db.runs.find_one({"id": "__ready__"}, {"_id": 0})
        checks["database_ok"] = True
    except Exception as exc:
        checks["database_ok"] = False
        logger.warning("readiness db check failed: %s", exc)
    # Latest recorded storage probe (startup/nightly/manual). Informational
    # only — it never changes the readiness status code, but the dashboard
    # banner turns a failed probe into a visible warning.
    try:
        latest_probe = await db.storage_probes.find_one({}, {"_id": 0}, sort=[("at", -1)])
    except Exception:
        latest_probe = None
    probe_result = (latest_probe or {}).get("result") or {}
    checks["storage_probe"] = (
        {"ok": probe_result.get("ok"), "at": latest_probe.get("at"), "source": latest_probe.get("source"),
         "served_by": probe_result.get("served_by"),
         "error": (probe_result.get("error") or "")[:240] or None}
        if latest_probe else None)
    ok = checks["database_ok"] and checks["storage_ok"] and checks["config_ok"]
    from fastapi.responses import JSONResponse
    return JSONResponse(status_code=200 if ok else 503, content=checks)


async def record_storage_probe(source: str) -> dict:
    """Run the storage probe and persist the result (latest 60 kept) so a
    breakage found at startup, overnight, or from Settings is visible on
    the dashboard banner before a user's recording hits it."""
    result = await asyncio.to_thread(storage_probe)
    try:
        await db.storage_probes.insert_one(
            {"id": new_id("prb_"), "source": source, "at": now_iso(), "result": result})
        rows = await db.storage_probes.find({}, {"id": 1}).sort("at", -1).to_list(200)
        for stale in rows[60:]:
            await db.storage_probes.delete_one({"id": stale["id"]})
    except Exception:
        logger.warning("Could not record storage probe", exc_info=True)
    if not result.get("ok"):
        logger.warning("Storage probe (%s) failed: %s", source, result.get("error"))
    return result


# ---------- admin: users, utilization, audit ----------
async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if (user.get("role") or "user") != "admin":
        raise HTTPException(403, "Admin access required")
    return user


async def _admin_audit(actor: dict, action: str, target_user_id: str, details: dict | None = None) -> None:
    try:
        await db.admin_audit.insert_one({
            "id": new_id("aud_"), "at": now_iso(), "actor_id": actor.get("user_id"),
            "actor_email": actor.get("email"), "action": action,
            "target_user_id": target_user_id, "details": details or {},
        })
    except Exception:
        logger.warning("Could not write admin audit entry", exc_info=True)


async def _admin_target(uid: str) -> dict:
    doc = await db.users.find_one({"user_id": uid}, {"_id": 0})
    if doc:
        return doc
    remote = await clerk_service.fetch_user(uid, force=True) if clerk_service.clerk_enabled() else None
    if not remote:
        raise HTTPException(404, "User not found")
    doc = {"user_id": uid, "clerk_id": uid, "email": remote.get("email"), "name": remote.get("name"),
           "picture": remote.get("picture"), "auth_provider": "clerk", "role": remote.get("role") or "user",
           "status": "suspended" if remote.get("banned") else "active", "plan": "free",
           "billing_status": "free", "preferences": {"voice": "nova", "narration_mode": "both"},
           "created_at": now_iso()}
    await db.users.insert_one(dict(doc))
    return doc


async def _usage_map() -> dict[str, dict]:
    users = await db.users.find({}, {"_id": 0}).to_list(10000)
    projects = await db.projects.find({}, {"_id": 0}).to_list(20000)
    runs = await db.runs.find({}, {"_id": 0}).to_list(20000)
    usage: dict[str, dict] = {}
    for doc in users:
        count, seconds = await jobs.usage_summary(doc["user_id"])
        usage[doc["user_id"]] = {"projects": 0, "runs": 0, "active_runs": 0, "completed_runs": 0,
                                 "failed_runs": 0, "recordings_this_month": count,
                                 "seconds_this_month": seconds, "last_run_at": None}
    for project in projects:
        row = usage.setdefault(project.get("user_id"), {"projects": 0, "runs": 0, "active_runs": 0,
                                                        "completed_runs": 0, "failed_runs": 0,
                                                        "recordings_this_month": 0, "seconds_this_month": 0,
                                                        "last_run_at": None})
        if not project.get("is_deleted"):
            row["projects"] += 1
    for run in runs:
        row = usage.setdefault(run.get("user_id"), {"projects": 0, "runs": 0, "active_runs": 0,
                                                    "completed_runs": 0, "failed_runs": 0,
                                                    "recordings_this_month": 0, "seconds_this_month": 0,
                                                    "last_run_at": None})
        row["runs"] += 1
        if run.get("status") in {"queued", "running"}:
            row["active_runs"] += 1
        if run.get("status") in {"done", "completed", "success"}:
            row["completed_runs"] += 1
        if run.get("status") in {"failed", "error", "cancelled"}:
            row["failed_runs"] += 1
        started = run.get("started_at") or run.get("created_at")
        if started and (not row["last_run_at"] or str(started) > str(row["last_run_at"])):
            row["last_run_at"] = started
    return usage


def _admin_user_row(doc: dict, usage: dict) -> dict:
    plan = doc.get("plan_override") or doc.get("plan") or "free"
    limit, seconds_limit = billing.limits_for(plan, doc.get("monthly_limit_override"))
    return {
        "user_id": doc.get("user_id"), "clerk_id": doc.get("clerk_id"),
        "email": doc.get("email"), "name": doc.get("name"), "picture": doc.get("picture"),
        "auth_provider": doc.get("auth_provider") or "legacy",
        "role": doc.get("role") or "user", "status": doc.get("status") or "active",
        "plan": plan, "plan_name": billing.plan_info(plan)["name"],
        "billing_status": doc.get("billing_status") or "free",
        "billing_current_period_end": doc.get("billing_current_period_end"),
        "created_at": doc.get("created_at"), "last_seen_at": doc.get("last_seen_at"),
        "usage": {**usage, "limit": limit, "seconds_limit": seconds_limit},
    }


@api.get("/admin/summary")
async def admin_summary(admin: dict = Depends(require_admin)):
    users = await db.users.find({}, {"_id": 0}).to_list(10000)
    usage = await _usage_map()
    return {
        "users": len(users),
        "active_users": sum(1 for u in users if (u.get("status") or "active") == "active"),
        "suspended_users": sum(1 for u in users if (u.get("status") or "active") != "active"),
        "admins": sum(1 for u in users if u.get("role") == "admin"),
        "projects": sum(v["projects"] for v in usage.values()),
        "runs": sum(v["runs"] for v in usage.values()),
        "active_runs": sum(v["active_runs"] for v in usage.values()),
        "recordings_this_month": sum(v["recordings_this_month"] for v in usage.values()),
        "seconds_this_month": sum(v["seconds_this_month"] for v in usage.values()),
        "plans": {slug: sum(1 for u in users if billing.normalize_plan(u.get("plan_override") or u.get("plan")) == slug)
                  for slug in billing.PLANS},
    }


@api.get("/admin/users")
async def admin_users(query: str = "", limit: int = 50, offset: int = 0,
                      admin: dict = Depends(require_admin)):
    docs = await db.users.find({}, {"_id": 0}).to_list(10000)
    by_id = {doc.get("user_id"): doc for doc in docs}
    if clerk_service.clerk_enabled():
        try:
            remote_users = await clerk_service.list_users(limit=limit, offset=offset, query=query)
        except HTTPException:
            remote_users = []
        for remote in remote_users:
            uid = remote.get("id")
            if uid and uid not in by_id:
                by_id[uid] = {"user_id": uid, "clerk_id": uid, "email": remote.get("email"),
                              "name": remote.get("name"), "picture": remote.get("picture"),
                              "auth_provider": "clerk", "role": remote.get("role") or "user",
                              "status": "suspended" if remote.get("banned") else "active",
                              "plan": "free", "billing_status": "free", "created_at": None}
    rows = list(by_id.values())
    needle = query.strip().lower()
    if needle:
        rows = [doc for doc in rows if needle in str(doc.get("email") or "").lower()
                or needle in str(doc.get("name") or "").lower() or needle == str(doc.get("user_id"))]
    rows.sort(key=lambda doc: str(doc.get("created_at") or ""), reverse=True)
    usage = await _usage_map()
    total = len(rows)
    page = rows[max(offset, 0): max(offset, 0) + min(max(limit, 1), 100)]
    return {"total": total, "users": [_admin_user_row(doc, usage.get(doc.get("user_id"), {
        "projects": 0, "runs": 0, "active_runs": 0, "completed_runs": 0, "failed_runs": 0,
        "recordings_this_month": 0, "seconds_this_month": 0, "last_run_at": None})) for doc in page]}


@api.get("/admin/users/{uid}")
async def admin_user_detail(uid: str, admin: dict = Depends(require_admin)):
    doc = await _admin_target(uid)
    usage = (await _usage_map()).get(uid, {"projects": 0, "runs": 0, "active_runs": 0, "completed_runs": 0,
                                           "failed_runs": 0, "recordings_this_month": 0,
                                           "seconds_this_month": 0, "last_run_at": None})
    projects = await db.projects.find({"user_id": uid, "is_deleted": False}, {"_id": 0}).sort("updated_at", -1).to_list(20)
    audit = await db.admin_audit.find({"target_user_id": uid}, {"_id": 0}).sort("at", -1).to_list(50)
    memberships = await db.organization_memberships.find({"user_id": uid}, {"_id": 0}).to_list(100)
    return {"user": _admin_user_row(doc, usage), "projects": projects, "audit": audit,
            "organizations": memberships}


@api.patch("/admin/users/{uid}")
async def admin_patch_user(uid: str, body: AdminUserPatch, admin: dict = Depends(require_admin)):
    doc = await _admin_target(uid)
    fields = {key: value for key, value in body.model_dump().items() if value is not None}
    if "plan_override" in fields and fields["plan_override"] == "":
        fields["plan_override"] = None
    if fields:
        await db.users.update_one({"user_id": uid}, {"$set": fields})
    if clerk_service.clerk_enabled() and doc.get("auth_provider") == "clerk":
        if "role" in fields:
            await clerk_service.update_user_metadata(uid, {"role": fields["role"]})
        if fields.get("status") == "suspended":
            await clerk_service.ban_user(uid)
        elif fields.get("status") == "active":
            await clerk_service.unban_user(uid)
            await clerk_service.unlock_user(uid)
    await _admin_audit(admin, "user.update", uid, fields)
    return {"ok": True, "user": _admin_user_row({**doc, **fields}, (await _usage_map()).get(uid, {}))}


async def _admin_action(uid: str, admin: dict, action: str) -> dict:
    doc = await _admin_target(uid)
    is_clerk_user = clerk_service.clerk_enabled() and (doc.get("auth_provider") == "clerk" or str(uid).startswith("user_"))
    details: dict = {}
    if action == "suspend":
        if is_clerk_user:
            await clerk_service.ban_user(uid)
        await db.users.update_one({"user_id": uid}, {"$set": {"status": "suspended", "suspended_at": now_iso()}})
    elif action == "reactivate":
        if is_clerk_user:
            await clerk_service.unban_user(uid)
            await clerk_service.unlock_user(uid)
        await db.users.update_one({"user_id": uid}, {"$set": {"status": "active", "suspended_at": None}})
    elif action == "revoke_sessions":
        details["revoked_sessions"] = await clerk_service.revoke_user_sessions(uid) if is_clerk_user else 0
    elif action == "cancel":
        if is_clerk_user:
            await clerk_service.delete_user(uid)
        await db.users.update_one({"user_id": uid}, {"$set": {"status": "deleted", "deleted_at": now_iso()}})
    else:
        raise HTTPException(404, "Unknown admin action")
    await _admin_audit(admin, f"user.{action}", uid, details)
    return {"ok": True, "action": action, **details}


@api.post("/admin/users/{uid}/suspend")
async def admin_suspend_user(uid: str, admin: dict = Depends(require_admin)):
    return await _admin_action(uid, admin, "suspend")


@api.post("/admin/users/{uid}/reactivate")
async def admin_reactivate_user(uid: str, admin: dict = Depends(require_admin)):
    return await _admin_action(uid, admin, "reactivate")


@api.post("/admin/users/{uid}/revoke-sessions")
async def admin_revoke_user_sessions(uid: str, admin: dict = Depends(require_admin)):
    return await _admin_action(uid, admin, "revoke_sessions")


@api.post("/admin/users/{uid}/cancel")
async def admin_cancel_user(uid: str, admin: dict = Depends(require_admin)):
    return await _admin_action(uid, admin, "cancel")


@api.get("/admin/audit")
async def admin_audit(limit: int = 100, admin: dict = Depends(require_admin)):
    rows = await db.admin_audit.find({}, {"_id": 0}).sort("at", -1).to_list(min(max(limit, 1), 500))
    return {"entries": rows}


# ---------- Clerk webhooks: identity, organizations, billing sync ----------
@api.post("/webhooks/clerk")
async def clerk_webhook(request: Request):
    raw = await request.body()
    event = clerk_service.verify_webhook(raw, dict(request.headers))
    event_id = request.headers.get("svix-id")
    if event_id and await db.webhook_events.find_one({"event_id": event_id}, {"_id": 0}):
        return {"ok": True, "duplicate": True}
    event_type = str(event.get("type") or "")
    data = event.get("data") or {}
    try:
        await db.webhook_events.insert_one({"event_id": event_id, "type": event_type, "at": now_iso()})
    except Exception:
        pass

    if event_type in {"user.created", "user.updated", "user.deleted"}:
        remote = clerk_service.normalize_user(data)
        uid = remote.get("id")
        if uid:
            if event_type == "user.deleted":
                await db.users.update_one({"user_id": uid}, {"$set": {"status": "deleted", "deleted_at": now_iso()}})
            else:
                doc = await db.users.find_one({"user_id": uid}, {"_id": 0})
                fields = {"user_id": uid, "clerk_id": uid, "email": remote.get("email"), "name": remote.get("name"),
                          "picture": remote.get("picture"), "auth_provider": "clerk",
                          "role": (doc or {}).get("role") or remote.get("role") or "user",
                          "status": "suspended" if remote.get("banned") else ((doc or {}).get("status") or "active"),
                          "updated_at": now_iso()}
                if doc:
                    await db.users.update_one({"user_id": uid}, {"$set": fields})
                else:
                    await db.users.insert_one({**fields, "preferences": {"voice": "nova", "narration_mode": "both"},
                                               "plan": "free", "billing_status": "free", "created_at": now_iso()})
    elif event_type in {"organization.created", "organization.updated", "organization.deleted"}:
        oid = data.get("id")
        if oid:
            if event_type == "organization.deleted":
                await db.organizations.update_one({"id": oid}, {"$set": {"status": "deleted", "updated_at": now_iso()}})
            else:
                fields = {"id": oid, "name": data.get("name"), "slug": data.get("slug"),
                          "picture": data.get("image_url"), "status": "active", "updated_at": now_iso()}
                if await db.organizations.find_one({"id": oid}, {"_id": 0}):
                    await db.organizations.update_one({"id": oid}, {"$set": fields})
                else:
                    await db.organizations.insert_one({**fields, "plan": "free", "billing_status": "free",
                                                       "created_at": now_iso()})
    elif event_type.startswith("organizationMembership."):
        org = data.get("organization") or {}
        public_user = data.get("public_user_data") or {}
        oid, uid = org.get("id"), public_user.get("user_id")
        if oid and uid:
            filt = {"organization_id": oid, "user_id": uid}
            if event_type == "organizationMembership.deleted":
                await db.organization_memberships.delete_one(filt)
            else:
                fields = {**filt, "role": str(data.get("role") or "org:member").removeprefix("org:"),
                          "updated_at": now_iso()}
                if await db.organization_memberships.find_one(filt, {"_id": 0}):
                    await db.organization_memberships.update_one(filt, {"$set": fields})
                else:
                    await db.organization_memberships.insert_one({**fields, "created_at": now_iso()})
    elif event_type.startswith(("subscription", "paymentAttempt")):
        payer = data.get("payer") or {}
        items = data.get("items") or []
        item = items[0] if items else data
        plan_slug = ((item.get("plan") or {}).get("slug") if isinstance(item, dict) else None)
        status = data.get("status") or (item.get("status") if isinstance(item, dict) else None) or event_type.rsplit(".", 1)[-1]
        fields = {"billing_status": str(status), "billing_updated_at": now_iso(),
                  "billing_subscription_id": data.get("id")}
        if plan_slug:
            fields["plan"] = billing.normalize_plan(plan_slug)
        if payer.get("organization_id"):
            await db.organizations.update_one({"id": payer["organization_id"]}, {"$set": fields})
        elif payer.get("user_id"):
            await db.users.update_one({"user_id": payer["user_id"]}, {"$set": fields})
    return {"ok": True}


@api.get("/settings")
async def get_settings(user: dict = Depends(get_current_user)):
    plan, limit, seconds_limit = await plan_and_limits(user)
    count, seconds_used = await jobs.usage_summary(user["user_id"])
    is_admin = (user.get("role") or "user") == "admin"
    payload = {
        "preferences": user.get("preferences") or {"voice": "nova", "narration_mode": "both"},
        "auth": {"provider": user.get("auth_provider"), "role": user.get("role") or "user",
                 "clerk_configured": clerk_service.clerk_enabled()},
        "usage": {"recordings_this_month": count, "limit": limit, "plan": billing.plan_info(plan)["name"],
                  "plan_slug": plan, "billing_status": user.get("billing_status") or "free",
                  "seconds_this_month": seconds_used, "seconds_limit": seconds_limit,
                  "session_cap": 120},
        # Coarse readiness flags remain available so the studio can disable
        # record when Browserless is down; region/model/storage detail is admin-only.
        "browserless_configured": bool(engine and engine.is_configured()),
        "llm_configured": bool(ai and ai.provider()[2]),
    }
    if is_admin:
        payload.update({
            "browserless_region": engine.ws_base() if engine else "",
            "ai_model": ai.provider()[3] if ai else "Not installed",
            "tts_model": ai.tts_key()[1] if ai else "Not installed",
            "storage": storage_status(),
        })
    else:
        payload.update({
            "browserless_region": "",
            "ai_model": "",
            "tts_model": "",
            "storage": {"mode": "hidden", "detail": "System storage is managed by admins."},
        })
    return payload


@api.put("/settings")
async def put_settings(body: PrefsIn, user: dict = Depends(get_current_user)):
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"preferences": body.model_dump()}})
    return {"preferences": body.model_dump()}


@api.post("/settings/test-browserless")
async def test_browserless(user: dict = Depends(require_admin)):
    _require_browserless()
    try:
        await engine.test_connection()
    except Exception as exc:
        raise HTTPException(424, f"Could not connect to Browserless: {str(exc)[:1000]}")
    return {"ok": True}


@api.post("/settings/test-storage")
async def test_storage(user: dict = Depends(require_admin)):
    """Put/get round-trip probe: configured backend, resolved endpoint,
    and the exact error when it's broken (see storage.probe)."""
    return await record_storage_probe("manual")


@api.post("/tts/preview")
async def tts_preview(body: PrefsIn, user: dict = Depends(get_current_user)):
    try:
        audio = await ai.synthesize("Hi! This is how your product demo narration will sound.", body.voice)
    except Exception as exc:
        raise HTTPException(424, f"Voice preview failed: {ai_error(exc)}")
    return Response(content=audio, media_type="audio/mpeg")


from studio_plus import router as plus_router

app.include_router(auth_router)
app.include_router(api)
app.include_router(plus_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=cors_origins(),
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Requested-With", "X-Webhook-Id", "X-Viewer-Token"],
)


@app.on_event("startup")
async def startup():
    logger.info("CORS allowlist (from CORS_ORIGINS): %s", cors_origins() or "EMPTY — cross-origin requests will be rejected")
    # Never let a config/infra problem kill the whole function: on serverless
    # hosts a raised startup turns every route into an opaque
    # FUNCTION_INVOCATION_FAILED. Log it, remember it, and let /api/health
    # and /api/ready report exactly what is wrong instead.
    app.state.config_error = None
    try:
        validate_config()
    except Exception as exc:
        app.state.config_error = str(exc)
        logger.error("configuration problem (see /api/ready): %s", exc)
    try:
        await asyncio.to_thread(init_storage)
    except Exception as exc:
        logger.error("Storage init failed: %s", exc)
    app.state.index_task = asyncio.create_task(ensure_indexes())
    try:
        await seed_admin()
    except Exception as exc:
        logger.error("Admin seed failed: %s", exc)
    embedded = os.environ.get("EMBEDDED_WORKER", "true").strip().lower() not in {"0", "false", "no"}
    app.state.worker_task = asyncio.create_task(worker_loop()) if embedded else None
    app.state.probe_task = asyncio.create_task(_startup_storage_probe())


async def _startup_storage_probe() -> None:
    """Self-check storage shortly after boot and record the result, so a
    dead bucket is on the dashboard before the first recording hits it."""
    try:
        await asyncio.sleep(2)
        await record_storage_probe("startup")
    except Exception:
        logger.warning("Startup storage probe failed", exc_info=True)


@app.on_event("shutdown")
async def shutdown():
    for task in (getattr(app.state, "index_task", None), getattr(app.state, "worker_task", None),
                 getattr(app.state, "probe_task", None)):
        if task is None:
            continue
        task.cancel()
        with suppress(asyncio.CancelledError):
            await task
    return None
