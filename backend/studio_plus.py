"""Routes for versions, snippets, variants, preflight, packs, review, and the library."""
import base64
import hashlib
import io
import zipfile

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

from core import create_review_token, db, decode_review_claims, get_current_user, new_id, now_iso
import netpolicy
from product import transcript
from storage import APP_NAME, get_object, put_object
import vault

router = APIRouter(prefix="/api")


class LabelIn(BaseModel):
    label: str = Field(min_length=1, max_length=80)


class SnippetIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    steps: list[dict] = Field(default_factory=list)


class VariantIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    variables: dict = Field(default_factory=dict)


class WatchIn(BaseModel):
    url: str = Field(min_length=8, max_length=500)


class ReviewCommentIn(BaseModel):
    step_id: str = Field(min_length=2, max_length=40)
    text: str = Field(min_length=1, max_length=500)
    author: str = Field("Reviewer", max_length=80)


class MusicIn(BaseModel):
    filename: str = Field(default="bed.mp3", max_length=80)
    data_b64: str = Field(min_length=16, max_length=6_000_000)


def _srv():
    import server
    return server


async def _owned(pid: str, user: dict) -> dict:
    return await _srv().get_project(pid, user)


def _fresh_steps(steps: list) -> list:
    out = []
    for step in steps:
        copy = {k: v for k, v in step.items() if k not in {
            "screenshot_path", "thumb_path", "audio_path", "audio_text", "audio_path_alt", "audio_text_alt",
            "audio_spoken", "audio_spoken_alt", "motion_paths", "health_failed_path", "screenshot_mobile_path"}}
        copy["id"] = new_id("st_")
        copy["status"] = "pending"
        copy["error"] = None
        out.append(copy)
    return out


@router.post("/projects/{pid}/versions")
async def name_version(pid: str, body: LabelIn, user: dict = Depends(get_current_user)):
    project = await _owned(pid, user)
    await _srv().log_history(project, "Named version", body.label.strip(), snapshot=True)
    return {"ok": True, "label": body.label.strip()}


@router.get("/snippets")
async def list_snippets(user: dict = Depends(get_current_user)):
    rows = await db["snippets"].find({"user_id": user["user_id"]}, {"_id": 0}).to_list(100)
    return [{"id": row["id"], "name": row.get("name"), "step_count": len(row.get("steps") or [])} for row in rows]


@router.post("/snippets")
async def save_snippet(body: SnippetIn, user: dict = Depends(get_current_user)):
    if not body.steps:
        raise HTTPException(400, "Select at least one step to save")
    doc = {"id": new_id("sn_"), "user_id": user["user_id"], "name": body.name.strip(),
           "steps": body.steps[:40], "created_at": now_iso()}
    await db["snippets"].insert_one(doc)
    return {"id": doc["id"], "name": doc["name"], "step_count": len(doc["steps"])}


@router.post("/projects/{pid}/snippets/{sid}/insert")
async def insert_snippet(pid: str, sid: str, user: dict = Depends(get_current_user)):
    project = await _owned(pid, user)
    snippet = await db["snippets"].find_one({"id": sid, "user_id": user["user_id"]}, {"_id": 0})
    if not snippet:
        raise HTTPException(404, "Saved sequence not found")
    steps = list(project["steps"]) + _fresh_steps(snippet.get("steps") or [])
    await _srv().touch(pid, {"steps": steps, "status": project.get("status") or "draft"})
    return await _owned(pid, user)


@router.get("/projects/{pid}/variants")
async def list_variants(pid: str, user: dict = Depends(get_current_user)):
    project = await _owned(pid, user)
    return {"active_variant": project.get("active_variant"), "variants": project.get("variants") or []}


@router.post("/projects/{pid}/variants")
async def add_variant(pid: str, body: VariantIn, user: dict = Depends(get_current_user)):
    project = await _owned(pid, user)
    variant = {"id": new_id("var_"), "name": body.name.strip(), "variables": body.variables, "share_id": new_id()}
    variants = list(project.get("variants") or []) + [variant]
    await _srv().touch(pid, {"variants": variants})
    await db["variant_shares"].insert_one({"id": variant["share_id"], "share_id": variant["share_id"],
                                           "project_id": pid, "variant_id": variant["id"]})
    return variant


@router.post("/projects/{pid}/variants/{vid}/activate")
async def activate_variant(pid: str, vid: str, user: dict = Depends(get_current_user)):
    project = await _owned(pid, user)
    variant = next((item for item in project.get("variants") or [] if item["id"] == vid), None)
    if not variant:
        raise HTTPException(404, "Variant not found")
    variables = {**(project.get("variables") or {}), **(variant.get("variables") or {})}
    await _srv().touch(pid, {"variables": variables, "active_variant": vid})
    return await _owned(pid, user)


@router.post("/projects/{pid}/preflight")
async def preflight(pid: str, user: dict = Depends(get_current_user)):
    import engine
    project = await _owned(pid, user)
    _srv()._require_browserless()
    if not project["steps"]:
        raise HTTPException(400, "Add steps before checking selectors")
    raw = await db.projects.find_one({"id": pid}, {"_id": 0}) or {}
    login = vault.open_login(raw.get("login") or {}, pid)
    start = (project.get("target_url") or "").strip()
    try:
        await netpolicy.validate_url(start)
    except netpolicy.DestinationBlocked as exc:
        raise HTTPException(400, str(exc))
    steps = [{**s, "text": vault.open_step_text(s, pid)} if s.get("sensitive") else s for s in raw.get("steps") or project["steps"]]
    try:
        rows = await engine.score_script(start, steps, login=None if login.get("storage_state") else login,
                                         storage_state=login.get("storage_state"))
    except Exception as exc:
        raise HTTPException(424, f"Selector check failed: {str(exc)[:180]}")
    return {"steps": rows, "recorded": False}


@router.get("/projects/{pid}/pack")
async def image_pack(pid: str, user: dict = Depends(get_current_user)):
    project = await _owned(pid, user)
    raw = await db.projects.find_one({"id": pid}, {"_id": 0}) or {}
    published = (raw.get("published") or {}).get("steps")
    steps = published or project["steps"]
    pack = io.BytesIO()
    with zipfile.ZipFile(pack, "w", zipfile.ZIP_DEFLATED) as archive:
        lines = []
        for index, step in enumerate(steps, 1):
            caption = (step.get("caption") or step.get("voiceover") or step.get("action") or "").strip()
            lines.append(f"{index}. {caption}")
            path = step.get("screenshot_path")
            if not path:
                continue
            try:
                blob, _ = await get_object(path)
            except Exception:
                continue
            archive.writestr(f"{index:02d}.jpg", blob)
        view = {"steps": steps}
        archive.writestr("captions.txt", "\n".join(lines))
        archive.writestr("captions.vtt", transcript(view, "vtt"))
    safe = "".join(c if c.isalnum() else "-" for c in project["name"]).strip("-")[:40] or "demo"
    return Response(content=pack.getvalue(), media_type="application/zip",
                    headers={"Content-Disposition": f'attachment; filename="{safe}-frames.zip"'})


@router.post("/projects/{pid}/music")
async def upload_music(pid: str, body: MusicIn, user: dict = Depends(get_current_user)):
    project = await _owned(pid, user)
    try:
        raw = base64.b64decode(body.data_b64, validate=True)
    except Exception:
        raise HTTPException(400, "The audio file could not be read")
    if len(raw) > 4_000_000:
        raise HTTPException(400, "Keep the music bed under 4 MB")
    path = await put_object(f"{APP_NAME}/u/{user['user_id']}/{pid}/bed_{new_id()}.mp3", raw, "audio/mpeg")
    brand = {**(project.get("brand") or {}), "music_path": path}
    await _srv().touch(pid, {"brand": brand})
    return {"ok": True}


@router.delete("/projects/{pid}/music")
async def remove_music(pid: str, user: dict = Depends(get_current_user)):
    project = await _owned(pid, user)
    brand = {**(project.get("brand") or {})}
    brand.pop("music_path", None)
    await _srv().touch(pid, {"brand": brand})
    return {"ok": True}


@router.post("/projects/{pid}/auth-profile")
async def save_auth_profile(pid: str, user: dict = Depends(get_current_user)):
    import engine
    await _owned(pid, user)
    _srv()._require_browserless()
    raw = await db.projects.find_one({"id": pid}, {"_id": 0}) or {}
    raw_login = dict(raw.get("login") or {})
    opened_login = vault.open_login(raw_login, pid)
    if not opened_login.get("url") and not opened_login.get("recipe"):
        raise HTTPException(400, "Add a login URL or a login recipe first")
    if opened_login.get("url"):
        try:
            await netpolicy.validate_url(opened_login["url"])
        except netpolicy.DestinationBlocked as exc:
            raise HTTPException(400, str(exc))
    try:
        state = await engine.capture_storage(opened_login)
    except Exception as exc:
        raise HTTPException(424, f"Could not save the signed-in browser: {str(exc)[:180]}")
    raw_login["storage_state"] = state
    raw_login["storage_saved_at"] = now_iso()
    await _srv().touch(pid, {"login": vault.seal_login(raw_login, pid)})
    return {"has_storage": True, "saved_at": raw_login["storage_saved_at"]}


@router.delete("/projects/{pid}/auth-profile")
async def clear_auth_profile(pid: str, user: dict = Depends(get_current_user)):
    await _owned(pid, user)
    raw = await db.projects.find_one({"id": pid}, {"_id": 0}) or {}
    login = dict(raw.get("login") or {})
    login.pop("storage_state", None)
    login.pop("storage_saved_at", None)
    await _srv().touch(pid, {"login": login})
    return {"has_storage": False}


@router.post("/projects/{pid}/watch")
async def watch_release(pid: str, body: WatchIn, user: dict = Depends(get_current_user)):
    project = await _owned(pid, user)
    try:
        response = await netpolicy.fetch(body.url)
    except netpolicy.DestinationBlocked as exc:
        raise HTTPException(400, str(exc))
    except Exception as exc:
        raise HTTPException(424, f"Could not read that page: {str(exc)[:140]}")
    url = body.url.strip()
    if response.status_code in (301, 302, 303, 307, 308):
        raise HTTPException(400, "That page redirects. Paste the final URL.")
    if response.status_code >= 400:
        raise HTTPException(424, f"The page returned {response.status_code}")
    text = response.text[:12000]
    digest = hashlib.sha1(text.encode()).hexdigest()
    if digest == project.get("watch_hash"):
        return {"changed": False}
    fields = {"watch_url": url, "watch_hash": digest, "draft": text[:8000]}
    scripted = False
    try:
        import ai
        from server import normalize_steps
        result = await ai.changelog_script(text[:8000], project.get("target_url") or url, f"watch_{pid}_{new_id()}")
        steps = normalize_steps(result.get("steps") or [], project.get("target_url") or url)
        if steps:
            fields["steps"] = steps
            fields["status"] = "scripted"
            scripted = True
    except Exception:
        scripted = False
    await _srv().touch(pid, fields)
    return {"changed": True, "scripted": scripted}


@router.post("/projects/{pid}/review-link")
async def review_link(pid: str, user: dict = Depends(get_current_user)):
    await _owned(pid, user)
    jti = new_id("rv_")
    await _srv().touch(pid, {"review_token_jti": jti})
    token = create_review_token(pid, jti=jti)
    return {"token": token, "path": f"/review/{token}"}


@router.delete("/projects/{pid}/review-link")
async def revoke_review_link(pid: str, user: dict = Depends(get_current_user)):
    await _owned(pid, user)
    await _srv().touch(pid, {"review_token_jti": None})
    return {"ok": True}


async def _review_project(token: str) -> dict:
    claims = decode_review_claims(token)
    if not claims:
        raise HTTPException(401, "This review link has expired")
    pid, jti = claims
    project = await db.projects.find_one({"id": pid, "is_deleted": False}, {"_id": 0})
    if not project or not project.get("review_token_jti") or project.get("review_token_jti") != jti:
        raise HTTPException(401, "This review link has been revoked or expired")
    return project


@router.get("/review/{token}")
async def review_demo(token: str):
    project = await _review_project(token)
    pid = project["id"]
    keep = ("id", "action", "caption", "voiceover", "duration_ms", "hotspot", "chapter", "annotations", "comments")
    steps = [{k: s.get(k) for k in keep} | {"has_screenshot": bool(s.get("screenshot_path")),
                                            "has_audio": bool(s.get("audio_path")),
                                            "v": (s.get("screenshot_path") or "")[-12:]}
             for s in project.get("steps") or []]
    return {"name": project.get("name"), "steps": steps, "review_status": project.get("review_status") or "draft",
            "project_id": pid, "share_id": project.get("share_id")}


@router.get("/review/{token}/steps/{sid}/{kind}")
async def review_asset(token: str, sid: str, kind: str):
    if kind not in {"screenshot", "thumb", "audio"}:
        raise HTTPException(404, "Asset not found")
    project = await _review_project(token)
    return await _srv()._asset(project, sid, kind, cache_headers={"Cache-Control": "private, no-store", "Pragma": "no-cache"})


@router.post("/review/{token}/comments")
async def review_comment(token: str, body: ReviewCommentIn):
    project = await _review_project(token)
    pid = project["id"]
    step = next((s for s in (project or {}).get("steps") or [] if s.get("id") == body.step_id), None)
    if not step:
        raise HTTPException(404, "Step not found")
    comments = list(step.get("comments") or []) + [{"id": new_id("c_"), "text": body.text.strip(),
                                                    "author": body.author.strip() or "Reviewer", "at": now_iso()}]
    await db.projects.update_one({"id": pid, "steps.id": body.step_id}, {"$set": {"steps.$.comments": comments}})
    return {"ok": True}


@router.post("/review/{token}/approve")
async def review_approve(token: str):
    project = await _review_project(token)
    await db.projects.update_one({"id": project["id"]}, {"$set": {"review_status": "approved", "updated_at": now_iso()}})
    return {"ok": True}


@router.post("/projects/{pid}/restore")
async def restore_deleted(pid: str, user: dict = Depends(get_current_user)):
    project = await db.projects.find_one({"id": pid, "user_id": user["user_id"], "is_deleted": True}, {"_id": 0})
    if not project:
        raise HTTPException(404, "Nothing in the trash with that id")
    await _srv().touch(pid, {"is_deleted": False})
    return {"ok": True}


@router.get("/notifications")
async def list_notifications(user: dict = Depends(get_current_user)):
    rows = await db["notifications"].find({"user_id": user["user_id"]}, {"_id": 0}).to_list(40)
    rows.sort(key=lambda row: row.get("created_at") or "", reverse=True)
    return rows[:20]


@router.post("/notifications/read")
async def read_notifications(user: dict = Depends(get_current_user)):
    await db["notifications"].update_many({"user_id": user["user_id"], "read": False}, {"$set": {"read": True}})
    return {"ok": True}
