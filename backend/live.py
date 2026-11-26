"""A Browserless page the studio can click, type, and scroll in. Each action becomes a step."""
import asyncio
import json
import os
import time

from engine import VIEWPORT, _DriverStderr, _perform, _playwright, _short, _sign_in, _ws_url, _with_driver_stderr, blocked_page

ELEMENT_AT = """({x, y}) => {
  const el = document.elementFromPoint(x, y);
  if (!el) return null;
  const target = el.closest('a,button,input,textarea,select,label,[role=button],[role=link],[data-testid]') || el;
  return describe(target);
  function describe(node) {
    const rect = node.getBoundingClientRect();
    const editable = node.matches('input,textarea,[contenteditable="true"]');
    return {
      tag: node.tagName.toLowerCase(),
      text: (node.innerText || '').trim().slice(0, 80),
      value: editable ? (node.value ?? node.innerText ?? '') : undefined,
      id: node.id || undefined,
      name: node.getAttribute('name') || undefined,
      type: node.getAttribute('type') || undefined,
      placeholder: node.getAttribute('placeholder') || undefined,
      aria: node.getAttribute('aria-label') || undefined,
      testid: node.getAttribute('data-testid') || undefined,
      editable,
      x: rect.x, y: rect.y, width: rect.width, height: rect.height,
    };
  }
}"""

FOCUSED = """() => {
  const node = document.activeElement;
  if (!node || node === document.body || node === document.documentElement) return null;
  const editable = node.matches('input,textarea,[contenteditable="true"]');
  if (!editable) return null;
  const rect = node.getBoundingClientRect();
  return {
    tag: node.tagName.toLowerCase(),
    text: (node.getAttribute('aria-label') || node.getAttribute('placeholder') || node.getAttribute('name') || '').slice(0, 80),
    value: node.value ?? node.innerText ?? '',
    id: node.id || undefined,
    name: node.getAttribute('name') || undefined,
    type: node.getAttribute('type') || undefined,
    placeholder: node.getAttribute('placeholder') || undefined,
    aria: node.getAttribute('aria-label') || undefined,
    testid: node.getAttribute('data-testid') || undefined,
    editable: true,
    x: rect.x, y: rect.y, width: rect.width, height: rect.height,
  };
}"""

KEYS = {"Enter", "Tab", "Escape", "Backspace", "Delete", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"}
_SESSIONS: dict = {}


def _attr(name: str, value: str) -> str:
    safe = str(value).replace("\\", "\\\\").replace('"', '\\"')
    return f'[{name}="{safe}"]'


def selector_for(info: dict | None) -> str:
    if not info:
        return "body"
    if info.get("testid"):
        return _attr("data-testid", info["testid"])
    if info.get("id") and " " not in str(info["id"]):
        return f"#{info['id']}"
    if info.get("name") and info.get("tag") in {"input", "textarea", "select"}:
        return f"{info['tag']}{_attr('name', info['name'])}"
    if info.get("aria"):
        return _attr("aria-label", info["aria"])
    if info.get("text"):
        return f"text={json.dumps(info['text'][:60])}"
    return info.get("tag") or "body"


def _hotspot(info: dict | None) -> dict | None:
    if not info or info.get("width") is None:
        return None
    return {"x": info.get("x") or 0, "y": info.get("y") or 0, "width": info.get("width") or 0, "height": info.get("height") or 0}


def _label(info: dict | None) -> str:
    if not info:
        return "the page"
    return info.get("aria") or info.get("placeholder") or info.get("text") or info.get("name") or info.get("tag") or "element"


def _event(action: str, info: dict | None, url: str, text: str | None = None, coalesce: bool = False) -> dict:
    label = _label(info)
    if action == "type":
        caption = f"Type into {label}"[:90]
    elif action == "press":
        caption = f"Press {text or 'key'}"
    else:
        caption = (info or {}).get("text") or f"Click {label}"
        caption = caption[:90]
    return {
        "action": action,
        "selector": selector_for(info),
        "text": text,
        "caption": caption,
        "url": url,
        "hotspot": _hotspot(info),
        "coalesce": coalesce,
        "sensitive": bool(info and info.get("type") == "password"),
    }


def _renew_after() -> float:
    try:
        return max(20.0, min(110.0, float(os.environ.get("LIVE_RENEW_SECONDS", "95"))))
    except ValueError:
        return 95.0


class _Session:
    def __init__(self):
        self.playwright = None
        self.browser = None
        self.context = None
        self.page = None
        self.frame = b""
        self.url = ""
        self.error = ""
        self.closed = False
        self.lock = asyncio.Lock()
        self.task = None
        self.user_id = ""
        self.opened = 0.0
        self.start_url = ""
        self.login = None
        self.storage_state = None
        self.steps: list = []
        self.renewing = False
        self.failures = 0
        self.wants = 0
        self.warning = ""


def status(pid: str) -> dict | None:
    session = _SESSIONS.get(pid)
    if not session:
        return None
    return {"open": not session.closed and not session.error, "url": session.url, "error": session.error, "warning": session.warning, "renewing": session.renewing}


def frame(pid: str) -> bytes | None:
    session = _SESSIONS.get(pid)
    if not session or not session.frame:
        return None
    return session.frame


def owns(pid: str, user_id: str) -> bool:
    session = _SESSIONS.get(pid)
    return bool(session and session.user_id == user_id)


async def close_session(pid: str) -> None:
    session = _SESSIONS.pop(pid, None)
    if not session:
        return
    session.closed = True
    task = session.task
    if task:
        task.cancel()
        try:
            await task
        except (asyncio.CancelledError, Exception):
            pass
    if session.browser:
        try:
            await session.browser.close()
        except Exception:
            pass
    if session.playwright:
        try:
            await session.playwright.stop()
        except Exception:
            pass


async def _shot(session: _Session) -> None:
    session.frame = await session.page.screenshot(type="jpeg", quality=40)
    session.url = session.page.url
    wall = blocked_page(session.url)
    if wall:
        session.error = wall


def _note(session: _Session, step: dict) -> None:
    action = step.get("action")
    previous = session.steps[-1] if session.steps else None
    if action == "type" and previous and previous.get("action") == "type" and previous.get("selector") == step.get("selector"):
        session.steps[-1] = step
        return
    if action == "scroll" and previous and previous.get("action") == "scroll":
        previous["amount"] = int(previous.get("amount") or 0) + int(step.get("amount") or 0)
        return
    session.steps.append(step)


def _disconnected(exc: Exception) -> bool:
    text = str(exc).lower()
    return any(bit in text for bit in ("websocket", "target closed", "browser has been closed", "connection closed", "socket"))


async def _drop_browser(session: _Session) -> None:
    if session.browser:
        try:
            await session.browser.close()
        except Exception:
            pass
    if session.playwright:
        try:
            await session.playwright.stop()
        except Exception:
            pass
    session.browser = None
    session.context = None
    session.playwright = None
    session.page = None


async def _connect(session: _Session) -> None:
    import netpolicy
    await netpolicy.validate_url(session.start_url)
    # Capture the driver's stderr during startup so a dead-on-arrival driver
    # (e.g. on a serverless host) reports its real error, not just
    # "Connection closed while reading from the driver".
    with _DriverStderr() as cap:
        try:
            session.playwright = await _playwright()().start()
            session.browser = await session.playwright.chromium.connect_over_cdp(_ws_url(), timeout=45000)
        except Exception as exc:
            if cap.tail():
                raise _with_driver_stderr(exc, cap) from exc
            raise
    kwargs = {"viewport": VIEWPORT, "device_scale_factor": 1}
    if session.storage_state:
        kwargs["storage_state"] = session.storage_state
    context = await session.browser.new_context(**kwargs)
    await netpolicy.install_browser_guard(context)
    session.context = context
    session.page = await context.new_page()
    session.opened = time.monotonic()


async def _replay(session: _Session) -> str:
    page = session.page
    # Cookies/localStorage from a saved auth profile skip the login recipe.
    if not session.storage_state:
        await _sign_in(page, session.login)
    await page.goto(session.start_url, wait_until="domcontentloaded", timeout=30000)
    for i, step in enumerate(session.steps):
        try:
            await _perform(page, step, False, "fast")
        except Exception as exc:
            wall = blocked_page(page.url)
            if wall:
                raise RuntimeError(wall) from exc
            return f"Step {i + 1} could not be replayed. The pane stayed open on the last page it reached."
        wall = blocked_page(page.url)
        if wall:
            raise RuntimeError(wall)
    return ""


async def _renew(session: _Session) -> None:
    """Reconnect the Browserless session without dumping the user back to the landing page.

    Prefer: snapshot cookies + current URL, open a fresh CDP context with that
    storage_state, then goto the same URL. Full login+step replay is only the
    fallback when we have no usable mid-session position.
    """
    session.renewing = True
    try:
        current_url = ""
        try:
            if session.page is not None:
                current_url = session.page.url or session.url or ""
            elif session.url:
                current_url = session.url
        except Exception:
            current_url = session.url or ""
        try:
            if session.context is not None:
                session.storage_state = await session.context.storage_state()
        except Exception:
            pass
        await _drop_browser(session)
        await _connect(session)
        session.error = ""
        if current_url and current_url.startswith(("http://", "https://")):
            import netpolicy
            try:
                await netpolicy.validate_url(current_url)
                await session.page.goto(current_url, wait_until="domcontentloaded", timeout=30000)
                session.warning = ""
            except Exception:
                session.warning = await _replay(session)
        else:
            session.warning = await _replay(session)
        await _shot(session)
        session.failures = 0
    except Exception as exc:
        session.failures += 1
        session.error = _short(exc)
    finally:
        session.renewing = False


async def _ensure_fresh(session: _Session) -> None:
    if session.page is not None and time.monotonic() - session.opened < _renew_after():
        return
    if session.failures >= 3:
        raise RuntimeError(session.error or "The live browser could not be continued")
    await _renew(session)
    if session.error or session.page is None:
        raise RuntimeError(session.error or "The live browser could not be continued")


async def _pump(session: _Session) -> None:
    while not session.closed:
        if session.wants or session.lock.locked():
            await asyncio.sleep(0.03)
            continue
        try:
            async with session.lock:
                if session.closed or session.wants:
                    continue
                due = session.page is None or time.monotonic() - session.opened >= _renew_after()
                if due:
                    await _renew(session)
                elif session.page is not None and not session.error:
                    await _shot(session)
            if session.error:
                return
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            if session.closed:
                return
            if _disconnected(exc) and session.failures < 3:
                try:
                    async with session.lock:
                        await _renew(session)
                except Exception as renew_exc:
                    session.error = _short(renew_exc)
                    return
                if session.error:
                    return
                continue
            session.error = _short(exc)
            return
        await asyncio.sleep(0.22)


async def open_session(pid: str, start_url: str, steps: list, login: dict | None, user_id: str,
                      storage_state: dict | None = None) -> dict:
    await close_session(pid)
    session = _Session()
    session.user_id = user_id
    session.start_url = start_url
    session.login = login
    session.storage_state = storage_state
    session.steps = [dict(step) for step in steps]
    _SESSIONS[pid] = session
    try:
        await _connect(session)
        session.warning = await _replay(session)
        async with session.lock:
            await _shot(session)
        if session.error:
            raise RuntimeError(session.error)
        session.task = asyncio.create_task(_pump(session))
        return {"url": session.url, "warning": session.warning}
    except Exception:
        await close_session(pid)
        raise


async def _run(session: _Session, work):
    """Do the browser action and return. The picture pump takes the next frame."""
    session.wants += 1
    try:
        async with session.lock:
            await _ensure_fresh(session)
            return await work()
    finally:
        session.wants = max(0, session.wants - 1)


async def click(pid: str, x: float, y: float) -> dict:
    session = _require(pid)

    def work():
        return _click(session, x, y)

    return await _run(session, work)


async def _click(session: _Session, x: float, y: float) -> dict:
    info = await session.page.evaluate(ELEMENT_AT, {"x": x, "y": y})
    await session.page.mouse.click(x, y)
    _note(session, {"action": "click", "selector": selector_for(info), "wait_ms": 80})
    return _event("click", info, session.url)


async def type_text(pid: str, text: str) -> dict:
    session = _require(pid)

    async def work():
        focused = await session.page.evaluate(FOCUSED)
        if focused:
            await session.page.keyboard.insert_text(text)
            focused = await session.page.evaluate(FOCUSED)
            event = _event("type", focused, session.url, text=(focused or {}).get("value") or "", coalesce=True)
            _note(session, {"action": "type", "selector": event["selector"], "text": event["text"] or "", "wait_ms": 80})
            return event
        await session.page.keyboard.insert_text(text)
        event = _event("press", None, session.url, text=text)
        _note(session, {"action": "press", "text": text, "wait_ms": 80})
        return event

    return await _run(session, work)


async def press_key(pid: str, key: str) -> dict:
    if key not in KEYS:
        raise ValueError("That key is not recorded")
    session = _require(pid)

    async def work():
        await session.page.keyboard.press(key)
        focused = await session.page.evaluate(FOCUSED)
        if key == "Backspace" and focused:
            event = _event("type", focused, session.url, text=focused.get("value") or "", coalesce=True)
            _note(session, {"action": "type", "selector": event["selector"], "text": event["text"] or "", "wait_ms": 80})
            return event
        _note(session, {"action": "press", "text": key, "wait_ms": 80})
        return _event("press", focused, session.url, text=key)

    return await _run(session, work)


async def scroll(pid: str, amount: int) -> dict:
    session = _require(pid)

    async def work():
        await session.page.mouse.wheel(0, int(amount))
        _note(session, {"action": "scroll", "amount": int(amount), "wait_ms": 80})
        return {
            "action": "scroll",
            "selector": "",
            "text": None,
            "caption": "Scroll the page",
            "url": session.page.url,
            "hotspot": None,
            "amount": int(amount),
            "coalesce": True,
            "duration_ms": 7000,
            "transition": "fade",
            "transition_ms": 800,
            "wait_ms": 1400,
            "sensitive": False,
        }

    return await _run(session, work)


async def export_storage(pid: str) -> dict:
    """Snapshot cookies/localStorage from the open live browser for reuse on later runs."""
    session = _require(pid)

    async def work():
        if session.context is None:
            raise RuntimeError("Live browser has no context")
        state = await session.context.storage_state()
        session.storage_state = state
        return state

    return await _run(session, work)


def snapshot(pid: str) -> dict:
    session = _SESSIONS.get(pid)
    if not session or session.closed:
        raise RuntimeError("Live browser is not open")
    return {
        "url": session.url or (session.page.url if session.page else ""),
        "has_storage": bool(session.storage_state),
    }


def _require(pid: str) -> _Session:
    session = _SESSIONS.get(pid)
    if not session or session.closed:
        raise RuntimeError("Live browser is not open")
    if session.error and not session.renewing:
        raise RuntimeError(session.error)
    return session
