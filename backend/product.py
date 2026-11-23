"""Helpers for the studio features that sit on top of record, edit, and share."""
import re
from urllib.parse import urlparse, urlunparse

PRESETS = {
    "standard": (1280, 800),
    "docs": (960, 600),
    "square": (800, 800),
    "master": (1280, 800),
    "vertical": (720, 1280),
    "hook": (1280, 800),
}
VIEWPORTS = {
    "desktop": {"width": 1280, "height": 800},
    "mobile": {"width": 390, "height": 844},
}


def substitute(value, variables: dict | None):
    if not value or not variables:
        return value
    def repl(match):
        return str(variables.get(match.group(1), match.group(0)))
    return re.sub(r"\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}", repl, str(value))


def environment_base(project: dict) -> str:
    envs = project.get("environments") or {}
    active = project.get("active_environment") or "production"
    base = (envs.get(active) or project.get("target_url") or "").strip()
    return base.rstrip("/")


def rewrite_url(url: str | None, project: dict) -> str | None:
    if not url:
        return url
    base = environment_base(project)
    if not base or not url.startswith(("http://", "https://")):
        return url
    target = project.get("target_url") or ""
    if not target:
        return url
    src, dest = urlparse(target), urlparse(base)
    if not dest.netloc or src.netloc == dest.netloc:
        return url
    parsed = urlparse(url)
    if parsed.netloc != src.netloc:
        return url
    return urlunparse((dest.scheme or parsed.scheme, dest.netloc, parsed.path, parsed.params, parsed.query, parsed.fragment))


def prepare_step(step: dict, project: dict) -> dict:
    ready = dict(step)
    variables = project.get("variables") or {}
    ready["text"] = substitute(ready.get("text"), variables)
    ready["url"] = rewrite_url(substitute(ready.get("url"), variables), project)
    ready["caption"] = substitute(ready.get("caption"), variables)
    return ready


def estimate_seconds(project: dict) -> int:
    steps = project.get("steps") or []
    login = project.get("login") or {}
    extra = 12 if login.get("url") else 0
    passes = 2 if project.get("viewport") == "both" else 1
    body = sum(0 if s.get("scene_type") else 14 if s.get("action") == "scroll" else 8 for s in steps)
    return (body + extra) * passes


def transcript(project: dict, fmt: str = "txt") -> str:
    lines = []
    clock = 0
    for i, step in enumerate(project.get("steps") or [], 1):
        text = (step.get("voiceover") or step.get("caption") or step.get("action") or "").strip()
        ms = int(step.get("audio_duration_ms") or step.get("duration_ms") or 3000)
        if fmt == "vtt":
            lines.append(f"{_ts(clock)} --> {_ts(clock + ms)}")
            lines.append(text or " ")
            lines.append("")
        else:
            chapter = step.get("chapter")
            prefix = f"{chapter} — " if chapter else ""
            lines.append(f"{i}. {prefix}{text}")
        clock += ms
    if fmt == "vtt":
        return "WEBVTT\n\n" + "\n".join(lines)
    return "\n".join(lines)


def _ts(ms: int) -> str:
    s, milli = divmod(max(ms, 0), 1000)
    m, s = divmod(s, 60)
    h, m = divmod(m, 60)
    return f"{h:02d}:{m:02d}:{s:02d}.{milli:03d}"


def parse_playwright(source: str) -> list[dict]:
    steps = []
    for raw in source.splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        goto = re.search(r"""\.goto\(\s*['\"]([^'\"]+)['\"]""", line)
        if goto:
            steps.append({"action": "goto", "url": goto.group(1), "caption": f"Open {goto.group(1)}", "voiceover": ""})
            continue
        fill = re.search(r"""\.fill\(\s*['\"]([^'\"]+)['\"]\s*,\s*['\"]([^'\"]*)['\"]""", line)
        if fill:
            steps.append({"action": "type", "selector": fill.group(1), "text": fill.group(2), "caption": f"Type into {fill.group(1)}", "voiceover": ""})
            continue
        role = re.search(r"""get_by_role\(\s*['\"]([^'\"]+)['\"]\s*,\s*name\s*=\s*['\"]([^'\"]+)['\"]\)\s*\.click""", line)
        if role:
            steps.append({"action": "click", "selector": f"role={role.group(1)}[name=\"{role.group(2)}\"]", "caption": role.group(2), "voiceover": ""})
            continue
        click = re.search(r"""\.click\(\s*['\"]([^'\"]+)['\"]""", line)
        if click:
            steps.append({"action": "click", "selector": click.group(1), "caption": f"Click {click.group(1)}", "voiceover": ""})
            continue
        press = re.search(r"""\.press\(\s*['\"]([^'\"]+)['\"]""", line)
        if press:
            steps.append({"action": "press", "text": press.group(1), "selector": "body", "caption": f"Press {press.group(1)}", "voiceover": ""})
    return steps


def speak(text: str, glossary: list | None) -> str:
    out = text or ""
    for item in glossary or []:
        word = (item.get("word") or "").strip()
        spoken = (item.get("spoken") or "").strip()
        if word and spoken:
            out = re.sub(rf"\b{re.escape(word)}\b", spoken, out, flags=re.IGNORECASE)
    return out


def publish_diff(current: list, published: list) -> dict:
    pub = {s.get("id"): s for s in published or [] if s.get("id")}
    cur_ids = {s.get("id") for s in current or [] if s.get("id")}
    added = sum(1 for s in current or [] if s.get("id") and s.get("id") not in pub)
    removed = sum(1 for s in published or [] if s.get("id") and s.get("id") not in cur_ids)
    changed = []
    keys = ("caption", "voiceover", "selector", "action", "url", "text", "scene_type", "scene", "exit_trigger", "skippable")
    for step in current or []:
        old = pub.get(step.get("id"))
        if not old:
            continue
        fields = [k for k in keys if (step.get(k) or "") != (old.get(k) or "")]
        if (step.get("screenshot_path") or "") != (old.get("screenshot_path") or ""):
            fields.append("frame")
        if fields:
            changed.append({"id": step.get("id"), "fields": fields, "caption": step.get("caption") or ""})
    return {"added": added, "removed": removed, "changed": changed}


def apply_track(steps: list, track: str) -> list:
    if track != "alt":
        return steps
    out = []
    for step in steps:
        copy = dict(step)
        if copy.get("caption_alt"):
            copy["caption"] = copy["caption_alt"]
        if copy.get("voiceover_alt"):
            copy["voiceover"] = copy["voiceover_alt"]
            copy["audio_path"] = copy.get("audio_path_alt")
            copy["audio_duration_ms"] = copy.get("audio_duration_alt")
        out.append(copy)
    return out


def assert_public_url(url: str) -> str:
    """Shared outbound destination check (delegates to netpolicy)."""
    import netpolicy
    return netpolicy.validate_url_sync(url).url


def public_view(project: dict) -> dict | None:
    """Return an explicit, immutable published release view, or None if not published.

    Never falls back to draft ``project["steps"]`` so unpublished edits cannot leak.
    """
    import copy
    published = project.get("published") or {}
    steps = published.get("steps")
    if not isinstance(steps, list) or not steps:
        return None
    view = dict(project)
    view["steps"] = copy.deepcopy(steps)
    view["name"] = published.get("name") or project.get("name")
    view["brand"] = copy.deepcopy(published.get("brand") or project.get("brand"))
    view["narration_mode"] = published.get("narration_mode") or project.get("narration_mode")
    view["cta"] = copy.deepcopy(published.get("cta") or project.get("cta"))
    view["published_at"] = published.get("published_at")
    view["release_id"] = published.get("release_id")
    return view
