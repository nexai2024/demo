import os
import time
from typing import Awaitable, Callable


def _playwright():
    try:
        from playwright.async_api import async_playwright
    except ImportError as exc:
        raise RuntimeError("Playwright is not installed. Recording needs it, along with a Browserless API key.") from exc
    return async_playwright

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
        await page.goto(step["url"], wait_until="domcontentloaded", timeout=30000)
        try:
            await page.wait_for_load_state("networkidle", timeout=6000)
        except Exception:
            pass
    elif a in ("click", "hover", "type"):
        if not step.get("selector"):
            raise ValueError(f"{a} step needs a selector")
        loc, box = await _locate(page, step, quick=pace == "fast")
        if a == "click":
            if capture:
                pre_shot = await page.screenshot(type="jpeg", quality=85)
            await loc.click(timeout=10000)
        elif a == "hover":
            await loc.hover(timeout=10000)
        else:
            await loc.click(timeout=10000)
            await loc.fill("")
            await loc.press_sequentially(step.get("text") or "", delay=35)
    elif a == "scroll":
        motion = await glide_scroll(page, int(step.get("amount") or 600), capture and pace == "show")
        if motion:
            step["_motion"] = motion
    elif a == "press":
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


async def _connect_page(playwright, viewport: dict | None, storage_state: dict | None):
    browser = await playwright.chromium.connect_over_cdp(_ws_url(), timeout=45000)
    kwargs = {"viewport": viewport or VIEWPORT, "device_scale_factor": 1}
    if storage_state:
        kwargs["storage_state"] = storage_state
    context = await browser.new_context(**kwargs)
    return browser, context, await context.new_page()


ProgressFn = Callable[[int, dict, str, dict], Awaitable[None]]


async def run_steps(steps: list, on_progress: ProgressFn, capture_only: set | None = None, retries: int = 1,
                    viewport: dict | None = None, login: dict | None = None, storage_state: dict | None = None,
                    on_storage=None):
    """Record steps. A Browserless session ends at 120s, so a long script reconnects and replays."""
    budget = 90
    async with _playwright()() as p:
        browser = None
        try:
            browser, context, page = await _connect_page(p, viewport, storage_state)
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
                try:
                    await browser.close()
                except Exception:
                    pass
                browser, context, page = await _connect_page(p, viewport, storage_state)
                started = time.monotonic()
                if not storage_state:
                    await _sign_in(page, login)
                for prev in steps[:upto]:
                    try:
                        await _perform(page, prev, False, "fast")
                    except Exception:
                        break

            for i, step in enumerate(steps):
                if i and time.monotonic() - started > budget:
                    await renew(i)
                capture = capture_only is None or i in capture_only
                await on_progress(i, step, "running", {})
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
                await on_progress(i, step, "failed" if err else "done", {
                    "screenshot": shot if capture else None, "hotspot": box, "error": err,
                    "attempts": attempts, "url": page.url, "captured": capture,
                    "resolved_selector": step.get("resolved_selector"),
                    "motion": step.pop("_motion", None) if capture else None,
                })
                if err and blocked_page(page.url):
                    raise RuntimeError(err)
        finally:
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
    async with _playwright()() as p:
        browser, _, page = await _connect_page(p, VIEWPORT, storage_state)
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
    async with _playwright()() as p:
        browser, context, page = await _connect_page(p, VIEWPORT, None)
        try:
            await _sign_in(page, login)
            return await context.storage_state()
        finally:
            await browser.close()


async def score_script(start_url: str, steps: list, login: dict | None = None, storage_state: dict | None = None) -> list:
    """Replay a script without saving frames. Each selector is found, ambiguous, or missing."""
    results = []
    async with _playwright()() as p:
        browser, _, page = await _connect_page(p, VIEWPORT, storage_state)
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
    async with _playwright()() as p:
        browser = await p.chromium.connect_over_cdp(_ws_url(), timeout=30000)
        await browser.close()
