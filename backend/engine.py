import asyncio
import contextlib
import os
import sys
import tempfile
import threading
import time
from typing import Awaitable, Callable

import netpolicy


def _driver_lib_dir(platform: str | None = None) -> "Path | None":
    """Directory with vendored shared libraries for the Playwright driver.

    The driver's bundled Node binary links libatomic.so.1, which minimal
    serverless images (Amazon Linux 2023 on Vercel) do not ship — the
    driver then dies at load with "error while loading shared libraries:
    libatomic.so.1", surfaced to Python as "Connection closed while
    reading from the driver". A copy is vendored under backend/native/lib.
    """
    from pathlib import Path

    if not (platform or sys.platform).startswith("linux"):
        return None
    lib_dir = Path(__file__).resolve().parent / "native" / "lib"
    return lib_dir if (lib_dir / "libatomic.so.1").is_file() else None


def _ensure_driver_runtime() -> None:
    """Make the environment safe for the Playwright Node driver to launch."""
    if os.environ.get("VERCEL"):
        # Serverless filesystems are read-only outside /tmp. If the driver
        # tries to resolve its browser registry under HOME or the package
        # directory it dies before speaking; keep it in /tmp.
        os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH", "/tmp/ms-playwright")
    lib_dir = _driver_lib_dir()
    if lib_dir is not None:
        parts = [p for p in os.environ.get("LD_LIBRARY_PATH", "").split(":") if p]
        if str(lib_dir) not in parts:
            os.environ["LD_LIBRARY_PATH"] = ":".join([str(lib_dir), *parts])


def _playwright():
    try:
        from playwright.async_api import async_playwright
    except ImportError as exc:
        raise RuntimeError("Playwright is not installed. Recording needs it, along with a Browserless API key.") from exc
    _ensure_driver_runtime()
    return async_playwright


class _DriverStderr:
    """Temporarily redirect fd 2 to a temp file while the Playwright Node
    driver starts. When the driver dies on a serverless host, Python only
    reports "Connection closed while reading from the driver" — the actual
    reason is whatever the driver printed to stderr, which would otherwise
    vanish into platform logs. Capture it so errors can quote it."""

    def __init__(self):
        self._tmp = None
        self._saved = None
        self._fd = None
        self._locked = False

    def __enter__(self):
        if not _STDERR_LOCK.acquire(blocking=False):
            return self
        self._locked = True
        try:
            self._fd = sys.stderr.fileno()
            self._tmp = tempfile.TemporaryFile()
            self._saved = os.dup(self._fd)
            os.dup2(self._tmp.fileno(), self._fd)
        except Exception:
            self.stop()
        return self

    def stop(self) -> None:
        if self._saved is not None and self._fd is not None:
            try:
                sys.stderr.flush()
            except Exception:
                pass
            try:
                os.dup2(self._saved, self._fd)
            except Exception:
                pass
            try:
                os.close(self._saved)
            except Exception:
                pass
            self._saved = None
        if self._locked:
            self._locked = False
            _STDERR_LOCK.release()

    def tail(self, limit: int = 700) -> str:
        if self._tmp is None:
            return ""
        try:
            self._tmp.seek(0)
            return self._tmp.read().decode("utf-8", "replace").strip()[-limit:]
        except Exception:
            return ""

    def __exit__(self, *exc):
        self.stop()
        if self._tmp is not None:
            try:
                self._tmp.close()
            except Exception:
                pass
            self._tmp = None
        return False


_STDERR_LOCK = threading.Lock()


def _with_driver_stderr(exc: Exception, cap: "_DriverStderr") -> RuntimeError:
    detail = cap.tail()
    base = _short(exc)
    if detail and detail not in base:
        return RuntimeError(f"{base} — the browser driver reported: {detail}")
    return RuntimeError(base)


@contextlib.asynccontextmanager
async def _driver():
    """Start Playwright with driver stderr captured until first connect.

    Yields (playwright, capture). Callers should invoke this only around
    startup + connect_over_cdp; the capture releases fd 2 when stopped or
    when the context exits. If startup fails, the raised error quotes the
    driver's own stderr instead of the generic closed-connection message.
    """
    cap = _DriverStderr()
    with cap:
        cm = _playwright()()
        p = None
        try:
            p = await cm.__aenter__()
            yield p, cap
        except Exception as exc:
            if cap.tail():
                raise _with_driver_stderr(exc, cap) from exc
            raise
        finally:
            if p is not None:
                await cm.__aexit__(None, None, None)

VIEWPORT = {"width": 1280, "height": 800}
MOBILE_VIEWPORT = {"width": 390, "height": 844}
PRE_CAPTURE = {"click"}

INSPECT_JS = """() => {
  const out = [];
  const viewTop = window.scrollY;
  const viewBottom = viewTop + window.innerHeight;
  const els = document.querySelectorAll('a,button,input,textarea,select,[role=button],[data-testid],[aria-label]');
  for (const el of els) {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    const top = r.top + window.scrollY;
    if (top < viewTop - 8 || top > viewBottom - 8) continue;
    out.push({tag: el.tagName.toLowerCase(), text: (el.innerText || el.value || '').trim().slice(0, 60),
      id: el.id || undefined, name: el.getAttribute('name') || undefined, type: el.getAttribute('type') || undefined,
      placeholder: el.getAttribute('placeholder') || undefined, aria: el.getAttribute('aria-label') || undefined,
      testid: el.getAttribute('data-testid') || undefined, href: (el.getAttribute('href') || '').slice(0, 80) || undefined});
    if (out.length >= 90) break;
  }
    return out;
}"""

BRIEF_JS = """() => ({
  title: (document.title || "").slice(0, 140),
  description: ((document.querySelector('meta[name="description"]') || {}).content || "").slice(0, 280),
  headings: [...document.querySelectorAll("h1,h2")].map((h) => (h.innerText || "").trim().slice(0, 90)).filter(Boolean).slice(0, 8)
})"""


DEFAULT_WS_URL = "wss://production-sfo.browserless.io"


def is_configured() -> bool:
    return bool(os.environ.get("BROWSERLESS_API_KEY"))


def ws_base() -> str:
    return (os.environ.get("BROWSERLESS_WS_URL") or DEFAULT_WS_URL).rstrip("/")


def _ws_url(timeout_ms: int = 120000) -> str:
    key = os.environ.get("BROWSERLESS_API_KEY")
    if not key:
        raise RuntimeError("Browserless API key is not configured")
    return f"{ws_base()}?token={key}&timeout={int(timeout_ms)}"


def describe(step: dict) -> str:
    a = step.get("action")
    sel = step.get("selector") or ""
    return {
        "goto": f"Navigating to {step.get('url')}",
        "click": f"Clicking {sel}",
        "type": f"Typing into {sel}",
        "hover": f"Hovering over {sel}",
        "scroll": f"Scrolling {step.get('amount', 600)}px",
        "press": f"Pressing {step.get('text') or 'Enter'}",
        "wait": f"Waiting {step.get('wait_ms', 800)}ms",
    }.get(a, a)


def _short(exc: Exception) -> str:
    return str(exc).split("\n")[0][:240]


def blocked_page(url: str) -> str | None:
    text = (url or "").lower()
    if "google." in text and "/sorry" in text:
        return ("Google blocked this browser with its unusual-traffic check. "
                "Open the site directly instead of searching Google, then record again.")
    if "challenges.cloudflare.com" in text or "/cdn-cgi/challenge" in text:
        return "Cloudflare blocked this browser. Record a direct visit to a page that does not present a challenge."
    if "captcha" in text and ("google." in text or "hcaptcha" in text or "recaptcha" in text):
        return "A CAPTCHA page stopped the recording. Open the product directly instead of a page that challenges automated browsers."
    return None


async def _locate(page, step: dict, quick: bool = False):
    candidates = [step["selector"]] + [s for s in (step.get("fallback_selectors") or []) if s]
    first, later, scroll = (1200, 700, 800) if quick else (6000, 2500, 5000)
    last = None
    for i, sel in enumerate(candidates):
        try:
            loc = page.locator(sel).first
            await loc.wait_for(state="visible", timeout=first if i == 0 else later)
            await loc.scroll_into_view_if_needed(timeout=scroll)
            step["resolved_selector"] = sel
            return loc, await loc.bounding_box()
        except Exception as exc:
            last = exc
    raise last


async def glide_scroll(page, amount: int, capture: bool = False, on_frame=None) -> list:
    """Move the page in small steps so a person can watch the scroll. A fast replay is one wheel."""
    total = int(amount or 0)
    shots: list = []
    if total == 0:
        return shots
    if not capture and on_frame is None:
        await page.mouse.wheel(0, total)
        return shots
    step_px = 48 if total > 0 else -48
    planned = max(1, abs(total) // 48)
    take_every = max(1, planned // 8)
    left, n = total, 0
    while left:
        chunk = step_px if abs(left) > abs(step_px) else left
        await page.mouse.wheel(0, int(chunk))
        left -= int(chunk)
        n += 1
        await page.wait_for_timeout(140)
        if on_frame:
            await on_frame()
        if capture and n % take_every == 0 and len(shots) < 8:
            try:
                shots.append(await page.screenshot(type="jpeg", quality=80))
            except Exception:
                pass
    return shots


async def _perform(page, step: dict, capture: bool, pace: str = "show"):
    a = step["action"]
    box, pre_shot = None, None
    step["resolved_selector"] = None
    if a == "goto":
        await netpolicy.validate_url(step["url"])
        await page.goto(step["url"], wait_until="domcontentloaded", timeout=30000)
        try:
            await page.wait_for_load_state("networkidle", timeout=6000)
        except Exception:
            pass
    elif a in ("click", "hover", "type"):
        if not step.get("selector"):
            raise ValueError(f"{a} step needs a selector")
        loc, box = await _locate(page, step, quick=pace == "fast")
        if box:
            # Glide the (injected) cursor onto the target so the action is
            # performed on camera instead of teleporting between stills.
            try:
                await page.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2, steps=24)
                await page.wait_for_timeout(90)
            except Exception:
                pass
        if a == "click":
            if capture:
                pre_shot = await page.screenshot(type="jpeg", quality=85)
            step["_action_at"] = _VideoRecorder.now_ms()
            await loc.click(timeout=10000)
        elif a == "hover":
            step["_action_at"] = _VideoRecorder.now_ms()
            await loc.hover(timeout=10000)
        else:
            step["_action_at"] = _VideoRecorder.now_ms()
            await loc.click(timeout=10000)
            await loc.fill("")
            await loc.press_sequentially(step.get("text") or "", delay=35)
    elif a == "scroll":
        motion = await glide_scroll(page, int(step.get("amount") or 600), capture and pace == "show")
        if motion:
            step["_motion"] = motion
    elif a == "press":
        step["_action_at"] = _VideoRecorder.now_ms()
        key = step.get("text") or "Enter"
        if len(key) > 1 and key not in {"Enter", "Tab", "Escape", "Backspace", "Delete", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"}:
            await page.keyboard.insert_text(key)
        else:
            await page.keyboard.press(key)
    elif a == "assert":
        expected = (step.get("text") or "").strip()
        if not expected:
            raise ValueError("Assert step needs the text to look for")
        content = await page.content()
        if expected.lower() not in content.lower():
            raise RuntimeError(f"Expected to find “{expected}” on {page.url}")
    settle = 80 if pace == "fast" else max(int(step.get("wait_ms") or 0), 1400 if a == "scroll" else 900)
    await page.wait_for_timeout(settle)
    return box, pre_shot


async def _sign_in(page, login: dict | None) -> None:
    if not login or not (login.get("url") or login.get("recipe")):
        return
    if login.get("url"):
        await netpolicy.validate_url(login["url"])
        await page.goto(login["url"], wait_until="domcontentloaded", timeout=30000)
    recipe = [step for step in (login.get("recipe") or []) if step.get("action")]
    if recipe:
        for step in recipe:
            await _perform(page, step, False, "fast")
        return
    if login.get("username"):
        box = page.locator(login.get("user_selector") or "input[type=email], input[name=email], input[type=text]").first
        await box.fill(login["username"])
    if login.get("password"):
        box = page.locator(login.get("password_selector") or "input[type=password]").first
        await box.fill(login["password"])
    await page.locator(login.get("submit_selector") or "button[type=submit], button:has-text('Sign in')").first.click(timeout=10000)
    await page.wait_for_timeout(1200)


CURSOR_JS = """(() => {
  if (window.__fcCursor) return;
  window.__fcCursor = true;
  const boot = () => {
    if (!document.body || document.getElementById('__fc_cursor')) return;
    const style = document.createElement('style');
    style.textContent = '#__fc_cursor{position:fixed;left:0;top:0;width:26px;height:26px;z-index:2147483647;pointer-events:none;filter:drop-shadow(0 2px 6px rgba(0,0,0,.45))}'
      + '#__fc_cursor .ring{position:absolute;left:2px;top:2px;width:16px;height:16px;border:2px solid rgba(255,255,255,.92);border-radius:50%;opacity:0}'
      + '#__fc_cursor.boom .ring{animation:fcboom .45s ease-out}@keyframes fcboom{0%{opacity:.95;transform:scale(.4)}100%{opacity:0;transform:scale(2.8)}}';
    document.head.appendChild(style);
    const el = document.createElement('div');
    el.id = '__fc_cursor';
    el.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M5 3l14 7-6.5 1.5L9 18z" fill="#fff" stroke="#0f172a" stroke-width="1.6"/></svg><span class="ring"></span>';
    document.body.appendChild(el);
    let tx = innerWidth / 2, ty = innerHeight / 2, x = tx, y = ty, pressed = false;
    addEventListener('mousemove', (e) => { tx = e.clientX; ty = e.clientY; }, true);
    addEventListener('mousedown', () => { pressed = true; el.classList.remove('boom'); void el.offsetWidth; el.classList.add('boom'); }, true);
    addEventListener('mouseup', () => { pressed = false; }, true);
    const loop = () => {
      x += (tx - x) * 0.34; y += (ty - y) * 0.34;
      el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) scale(' + (pressed ? 0.8 : 1) + ')';
      requestAnimationFrame(loop);
    };
    loop();
  };
  if (document.body) boot(); else addEventListener('DOMContentLoaded', boot);
})()"""


async def _install_cursor(context) -> None:
    """Animated on-screen cursor: glides with easing, presses, ripples on click.

    The page has no visible pointer in headless/CDP sessions; this overlay is
    the demo's performer, in both the recorded video and poster screenshots.
    It is JS-driven, so its motion also makes the screencast emit frames.
    """
    try:
        await context.add_init_script(CURSOR_JS)
    except Exception:
        pass


class _VideoRecorder:
    """Streams CDP screencast frames to disk and encodes per-session clips.

    Frames arrive only when the page repaints, each with an epoch-ms
    timestamp. Steps are marked on the same clock and rebased to the clip's
    first frame, giving the player/export an edit decision list:
    step -> (clip, start_ms, end_ms). Encoding mirrors render._slideshow's
    concat-demuxer approach, with our own ffmpeg (no Playwright ffmpeg).
    """

    def __init__(self, enabled: bool = True):
        self.enabled = enabled and os.environ.get("VIDEO_CAPTURE", "true").strip().lower() not in {"0", "false", "no"}
        self.clips: list[dict] = []
        self._clip: dict | None = None

    @staticmethod
    def now_ms() -> float:
        return time.time() * 1000

    async def start(self, page) -> bool:
        if not self.enabled:
            return False
        import tempfile

        clip = {"dir": tempfile.mkdtemp(prefix="fc_clip_"), "frames": [], "t0": None, "started": self.now_ms()}

        def on_frame(frame):
            try:
                idx = len(clip["frames"])
                path = os.path.join(clip["dir"], f"{idx:05d}.jpg")
                with open(path, "wb") as handle:
                    handle.write(frame["data"])
                ts = float(frame["timestamp"])
                if clip["t0"] is None:
                    clip["t0"] = ts
                clip["frames"].append((path, ts))
            except Exception:
                pass

        try:
            await page.screencast.start(on_frame=on_frame, size={"width": 1920, "height": 1200}, quality=88)
        except Exception:
            self._clip = None
            return False
        clip["index"] = len(self.clips)
        self.clips.append(clip)
        self._clip = clip
        return True

    async def stop(self, page) -> None:
        if self._clip is None:
            return
        try:
            await page.screencast.stop()
        except Exception:
            pass
        self._clip = None

    def range_for(self, start_epoch: float, end_epoch: float, action_epoch: float | None = None) -> dict | None:
        clip = self._clip
        if clip is None or clip["t0"] is None:
            return None
        start = max(0, int(start_epoch - clip["t0"]))
        end = max(start + 100, int(end_epoch - clip["t0"]))
        window = {"clip": clip["index"], "start_ms": start, "end_ms": end}
        if action_epoch:
            # When the action itself landed (click/press/first keystroke),
            # so renderers can time the zoom settle and click ripple to it.
            window["action_ms"] = min(end, max(start, int(action_epoch - clip["t0"])))
        return window

    def encode_all(self) -> list[bytes]:
        """Encode each clip to H.264 MP4 bytes (30fps, from frame timestamps)."""
        import subprocess

        import imageio_ffmpeg

        ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
        out: list[bytes] = []
        for clip in self.clips:
            frames = clip["frames"]
            if len(frames) < 2:
                out.append(b"")
                continue
            lines, last = [], None
            for j, (path, ts) in enumerate(frames):
                nxt = frames[j + 1][1] if j + 1 < len(frames) else ts + 500
                dur = max(0.016, min(2.0, (nxt - ts) / 1000))
                lines.append(f"file '{path}'\nduration {dur:.3f}\n")
                last = path
            lines.append(f"file '{last}'\n")
            list_path = os.path.join(clip["dir"], "frames.txt")
            with open(list_path, "w") as handle:
                handle.writelines(lines)
            target = os.path.join(clip["dir"], "clip.mp4")
            subprocess.run([ffmpeg, "-y", "-f", "concat", "-safe", "0", "-i", list_path,
                            "-vf", "fps=30,format=yuv420p", "-c:v", "libx264", "-preset", "veryfast",
                            "-pix_fmt", "yuv420p", "-movflags", "+faststart", target],
                           check=True, capture_output=True)
            with open(target, "rb") as handle:
                out.append(handle.read())
        return out

    def cleanup(self) -> None:
        import shutil

        for clip in self.clips:
            shutil.rmtree(clip["dir"], ignore_errors=True)
        self.clips = []


async def _connect_page(playwright, viewport: dict | None, storage_state: dict | None):
    browser = await playwright.chromium.connect_over_cdp(_ws_url(), timeout=45000)
    kwargs = {"viewport": viewport or VIEWPORT, "device_scale_factor": 1}
    if storage_state:
        kwargs["storage_state"] = storage_state
    context = await browser.new_context(**kwargs)
    await netpolicy.install_browser_guard(context)
    await _install_cursor(context)
    return browser, context, await context.new_page()


ProgressFn = Callable[[int, dict, str, dict], Awaitable[None]]
PreviewFn = Callable[[bytes, str], Awaitable[None]]


async def run_steps(steps: list, on_progress: ProgressFn, capture_only: set | None = None, retries: int = 1,
                    viewport: dict | None = None, login: dict | None = None, storage_state: dict | None = None,
                    on_storage=None, record_video: bool = True, on_phase=None, on_preview: PreviewFn | None = None):
    """Record steps. A Browserless session ends at 120s, so a long script reconnects and replays."""
    budget = 90
    recorder = _VideoRecorder(enabled=record_video)
    async with _driver() as (p, cap):
        browser = None
        preview_task = None
        try:
            browser, context, page = await _connect_page(p, viewport, storage_state)
            cap.stop()
            await recorder.start(page)
            started = time.monotonic()
            if not storage_state:
                await _sign_in(page, login)
                if on_storage is not None:
                    try:
                        await on_storage(await context.storage_state())
                    except Exception:
                        pass

            async def renew(upto: int) -> None:
                nonlocal browser, context, page, started
                await recorder.stop(page)
                try:
                    await browser.close()
                except Exception:
                    pass
                browser, context, page = await _connect_page(p, viewport, storage_state)
                await recorder.start(page)
                started = time.monotonic()
                if not storage_state:
                    await _sign_in(page, login)
                for prev in steps[:upto]:
                    try:
                        await _perform(page, prev, False, "fast")
                    except Exception:
                        break

            async def preview_loop() -> None:
                # Cheap JPEG stream for the studio player while the worker drives the page.
                while True:
                    await asyncio.sleep(0.4)
                    current = page
                    if on_preview is None or current is None:
                        continue
                    try:
                        shot = await current.screenshot(type="jpeg", quality=28)
                        await on_preview(shot, current.url or "")
                    except asyncio.CancelledError:
                        raise
                    except Exception:
                        pass

            if on_preview is not None:
                preview_task = asyncio.create_task(preview_loop())

            for i, step in enumerate(steps):
                if i and time.monotonic() - started > budget:
                    await renew(i)
                capture = capture_only is None or i in capture_only
                await on_progress(i, step, "running", {})
                v_start = recorder.now_ms()
                err, box, pre_shot, attempts = None, None, None, 0
                for attempts in range(1, retries + 2):
                    try:
                        box, pre_shot = await _perform(page, step, capture, "show" if capture else "fast")
                        err = None
                        break
                    except Exception as exc:
                        err = blocked_page(page.url) or _short(exc)
                        if blocked_page(page.url):
                            break
                        if "Timeout" in err and step.get("selector"):
                            err = f"Couldn't find '{step['selector']}' (or its fallbacks) on {page.url} — try Fix with AI"
                        await page.wait_for_timeout(700)
                shot = pre_shot
                if capture and shot is None:
                    try:
                        shot = await page.screenshot(type="jpeg", quality=85)
                    except Exception:
                        shot = None
                if on_preview is not None and shot:
                    try:
                        await on_preview(shot, page.url or "")
                    except Exception:
                        pass
                await on_progress(i, step, "failed" if err else "done", {
                    "screenshot": shot if capture else None, "hotspot": box, "error": err,
                    "attempts": attempts, "url": page.url, "captured": capture,
                    "resolved_selector": step.get("resolved_selector"),
                    "motion": step.pop("_motion", None) if capture else None,
                    "video": recorder.range_for(v_start, recorder.now_ms(), step.get("_action_at")) if capture and not err else None,
                })
                if err and blocked_page(page.url):
                    raise RuntimeError(err)
            await recorder.stop(page)
            clips: list[bytes] = []
            if recorder.clips:
                if on_phase is not None:
                    await on_phase("encoding")
                try:
                    clips = await asyncio.to_thread(recorder.encode_all)
                except Exception:
                    clips = []
            return {"video_clips": clips}
        finally:
            if preview_task is not None:
                preview_task.cancel()
                with contextlib.suppress(asyncio.CancelledError, Exception):
                    await preview_task
            recorder.cleanup()
            if browser is not None:
                await browser.close()


async def _collect_elements(page) -> list:
    try:
        await page.wait_for_load_state("networkidle", timeout=5000)
    except Exception:
        pass
    items = await page.evaluate(INSPECT_JS)
    return [{k: v for k, v in it.items() if v} for it in items]


async def inspect_page(url: str) -> list:
    found = await inspect_after(url, [])
    return found["elements"]


async def read_page(url: str) -> dict:
    """Elements plus the page's own title, description, and headings, for the script."""
    found = await inspect_after(url, [])
    return {"elements": found.get("elements") or [], "brief": found.get("brief") or {}, "url": found.get("url") or url}


async def inspect_after(start_url: str, steps: list, login: dict | None = None, scroll: int = 0,
                        storage_state: dict | None = None) -> dict:
    """Open the target, replay steps, then list the elements visible on that screen."""
    await netpolicy.validate_url(start_url)
    async with _driver() as (p, cap):
        browser, _, page = await _connect_page(p, VIEWPORT, storage_state)
        cap.stop()
        try:
            if not storage_state:
                await _sign_in(page, login)
            await page.goto(start_url, wait_until="domcontentloaded", timeout=30000)
            for i, step in enumerate(steps):
                try:
                    await _perform(page, step, False, "fast")
                except Exception as exc:
                    wall = blocked_page(page.url)
                    if wall:
                        raise RuntimeError(wall) from exc
                    raise RuntimeError(f"Step {i + 1} failed before the scan: {_short(exc)}") from exc
                wall = blocked_page(page.url)
                if wall:
                    raise RuntimeError(wall)
            if scroll:
                await page.mouse.wheel(0, int(scroll))
                await page.wait_for_timeout(400)
            brief = {}
            try:
                brief = await page.evaluate(BRIEF_JS)
            except Exception:
                brief = {}
            return {"url": page.url, "elements": await _collect_elements(page), "brief": brief}
        finally:
            await browser.close()


async def capture_storage(login: dict) -> dict:
    async with _driver() as (p, cap):
        browser, context, page = await _connect_page(p, VIEWPORT, None)
        cap.stop()
        try:
            await _sign_in(page, login)
            return await context.storage_state()
        finally:
            await browser.close()


async def score_script(start_url: str, steps: list, login: dict | None = None, storage_state: dict | None = None) -> list:
    """Replay a script without saving frames. Each selector is found, ambiguous, or missing."""
    if start_url:
        await netpolicy.validate_url(start_url)
    results = []
    async with _driver() as (p, cap):
        browser, _, page = await _connect_page(p, VIEWPORT, storage_state)
        cap.stop()
        try:
            if not storage_state:
                await _sign_in(page, login)
            if start_url:
                await page.goto(start_url, wait_until="domcontentloaded", timeout=30000)
            for i, step in enumerate(steps):
                action = step.get("action")
                selector = step.get("selector")
                if action in ("click", "hover", "type") and selector:
                    try:
                        count = await page.locator(selector).count()
                    except Exception:
                        count = 0
                    status = "missing" if count == 0 else "ambiguous" if count > 1 else "found"
                    row = {"index": i, "action": action, "selector": selector, "status": status, "count": count}
                    results.append(row)
                    if count:
                        try:
                            await _perform(page, step, False, "fast")
                        except Exception as exc:
                            row["error"] = _short(exc)
                    continue
                try:
                    await _perform(page, step, False, "fast")
                    results.append({"index": i, "action": action, "status": "ok"})
                except Exception as exc:
                    wall = blocked_page(page.url)
                    results.append({"index": i, "action": action, "status": "failed", "error": wall or _short(exc)})
                    break
            return results
        finally:
            await browser.close()


async def test_connection() -> None:
    async with _driver() as (p, cap):
        browser = await p.chromium.connect_over_cdp(_ws_url(), timeout=30000)
        cap.stop()
        await browser.close()
