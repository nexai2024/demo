import os
from typing import Awaitable, Callable

from playwright.async_api import async_playwright

VIEWPORT = {"width": 1280, "height": 800}
PRE_CAPTURE = {"click"}

INSPECT_JS = """() => {
  const out = [];
  const els = document.querySelectorAll('a,button,input,textarea,select,[role=button],[data-testid],[aria-label]');
  for (const el of els) {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    out.push({tag: el.tagName.toLowerCase(), text: (el.innerText || el.value || '').trim().slice(0, 60),
      id: el.id || undefined, name: el.getAttribute('name') || undefined, type: el.getAttribute('type') || undefined,
      placeholder: el.getAttribute('placeholder') || undefined, aria: el.getAttribute('aria-label') || undefined,
      testid: el.getAttribute('data-testid') || undefined, href: (el.getAttribute('href') || '').slice(0, 80) || undefined});
    if (out.length >= 90) break;
  }
  return out;
}"""


def is_configured() -> bool:
    return bool(os.environ.get("BROWSERLESS_API_KEY"))


def _ws_url() -> str:
    key = os.environ.get("BROWSERLESS_API_KEY")
    if not key:
        raise RuntimeError("Browserless API key is not configured")
    base = os.environ["BROWSERLESS_WS_URL"].rstrip("/")
    return f"{base}?token={key}&timeout=120000"


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


async def _locate(page, step: dict):
    candidates = [step["selector"]] + [s for s in (step.get("fallback_selectors") or []) if s]
    last = None
    for i, sel in enumerate(candidates):
        try:
            loc = page.locator(sel).first
            await loc.wait_for(state="visible", timeout=6000 if i == 0 else 2500)
            await loc.scroll_into_view_if_needed(timeout=5000)
            step["resolved_selector"] = sel
            return loc, await loc.bounding_box()
        except Exception as exc:
            last = exc
    raise last


async def _perform(page, step: dict, capture: bool):
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
        loc, box = await _locate(page, step)
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
        await page.mouse.wheel(0, int(step.get("amount") or 600))
    elif a == "press":
        await page.keyboard.press(step.get("text") or "Enter")
    await page.wait_for_timeout(int(step.get("wait_ms") or 800))
    return box, pre_shot


ProgressFn = Callable[[int, dict, str, dict], Awaitable[None]]


async def run_steps(steps: list, on_progress: ProgressFn, capture_only: set | None = None, retries: int = 1):
    async with async_playwright() as p:
        browser = await p.chromium.connect_over_cdp(_ws_url(), timeout=45000)
        try:
            context = await browser.new_context(viewport=VIEWPORT, device_scale_factor=1)
            page = await context.new_page()
            for i, step in enumerate(steps):
                capture = capture_only is None or i in capture_only
                await on_progress(i, step, "running", {})
                err, box, pre_shot, attempts = None, None, None, 0
                for attempts in range(1, retries + 2):
                    try:
                        box, pre_shot = await _perform(page, step, capture)
                        err = None
                        break
                    except Exception as exc:
                        err = _short(exc)
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
                })
        finally:
            await browser.close()


async def inspect_page(url: str) -> list:
    async with async_playwright() as p:
        browser = await p.chromium.connect_over_cdp(_ws_url(), timeout=45000)
        try:
            page = await (await browser.new_context(viewport=VIEWPORT)).new_page()
            await page.goto(url, wait_until="domcontentloaded", timeout=30000)
            try:
                await page.wait_for_load_state("networkidle", timeout=5000)
            except Exception:
                pass
            items = await page.evaluate(INSPECT_JS)
            return [{k: v for k, v in it.items() if v} for it in items]
        finally:
            await browser.close()


async def test_connection() -> None:
    async with async_playwright() as p:
        browser = await p.chromium.connect_over_cdp(_ws_url(), timeout=30000)
        await browser.close()
