import asyncio
import json
import os
import random
import re

import httpx


class AIUnavailable(RuntimeError):
    """Raised with a user-safe message when OpenAI cannot serve a request."""

    def __init__(self, message: str, code: str = "ai_error"):
        super().__init__(message)
        self.code = code


OPENAI_BASE = os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
RETRY_STATUS = {408, 409, 429, 500, 502, 503, 504}


def provider() -> tuple[str, str, str, str]:
    """(provider, model, api_key, label). OpenAI is the only AI provider."""
    model = os.environ.get("OPENAI_MODEL", "gpt-4o")
    return "openai", model, os.environ.get("OPENAI_API_KEY", ""), f"OpenAI {model}"


def models() -> list[str]:
    """Primary model first, then an optional cheaper fallback."""
    primary = provider()[1]
    fallback = os.environ.get("OPENAI_FALLBACK_MODEL", "gpt-4o-mini")
    return [primary] + ([fallback] if fallback and fallback != primary else [])


def tts_key() -> tuple[str, str]:
    return os.environ.get("OPENAI_API_KEY", ""), "OpenAI TTS HD"


def classify_error(status_code: int, body: str) -> AIUnavailable:
    """Map an OpenAI error response to a clear, user-safe message."""
    text = (body or "").lower()
    if status_code == 401:
        return AIUnavailable("The OpenAI API key is invalid or revoked. Update OPENAI_API_KEY.", "invalid_key")
    if status_code == 429 and ("insufficient_quota" in text or "billing" in text or "exceeded your current quota" in text):
        return AIUnavailable("The OpenAI account is out of credit. Add billing or raise the spend limit, then retry.", "quota")
    if status_code == 429:
        return AIUnavailable("OpenAI is rate limiting requests. Wait a moment and retry.", "rate_limit")
    if status_code == 404 or "model_not_found" in text:
        return AIUnavailable("The configured OpenAI model is not available to this account.", "model")
    if status_code >= 500:
        return AIUnavailable("OpenAI is temporarily unavailable. Retry shortly.", "upstream")
    return AIUnavailable(f"OpenAI rejected the request ({status_code}).", "bad_request")


async def _post(path: str, payload: dict, timeout: float = 120, attempts: int = 3) -> httpx.Response:
    """POST to OpenAI with exponential backoff on transient failures."""
    key = os.environ.get("OPENAI_API_KEY", "")
    if not key:
        raise AIUnavailable("AI is not configured. Set OPENAI_API_KEY.", "not_configured")
    last: AIUnavailable | None = None
    for attempt in range(attempts):
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(f"{OPENAI_BASE}{path}", headers={"Authorization": f"Bearer {key}"}, json=payload)
        except httpx.HTTPError:
            last = AIUnavailable("Could not reach OpenAI. Check the network and retry.", "network")
        else:
            if response.status_code < 400:
                return response
            last = classify_error(response.status_code, response.text)
            if response.status_code not in RETRY_STATUS or last.code == "quota":
                raise last
        if attempt < attempts - 1:
            await asyncio.sleep(min(8.0, 0.8 * 2 ** attempt) * (0.75 + random.random() / 2))
    raise last or AIUnavailable("OpenAI request failed.")


SYSTEM = """You are a documentary editor who turns a product draft into a browser recording that looks directed, not like a click-path. Read the PAGE BRIEF and PAGE ELEMENTS first. Infer who the page is for (buyer, new user, admin) and which one or two things on the page would make that person stay. Build the shot list around those.

Return ONLY a JSON object, no prose, no markdown fences:
{"title": "short demo title", "audience": "who this cut is for", "steps": [ {"action": "...", "url": "...", "selector": "...", "fallback_selectors": ["..."], "text": "...", "sensitive": false, "amount": 640, "wait_ms": 1400, "caption": "...", "voiceover": "...", "callout": "...", "treatment": "highlight", "duration_ms": 7000} ]}

Allowed actions:
- "goto": requires "url" (absolute). The FIRST step must be a goto to the target URL.
- Stay on the target site and pages it links to. Never open Google, Bing, DuckDuckGo, or any other search engine. Those sites block this recorder. If the draft says "search for the product", go straight to the target URL instead.
- "click": requires "selector".
- "type": requires "selector" and "text" (the value typed). Set "sensitive": true for passwords/secrets.
- "hover": requires "selector".
- "scroll": "amount" in pixels (positive = down). Use about 500-700, one screen. The recorder glides through it slowly and then holds so the viewer can read.
- "press": "text" is a keyboard key such as "Enter".
- "wait": pause; use "wait_ms".
- Before the single most important click, add a "hover" on that same selector so the control lights up. The hover is its own scene.

Selector rules (Playwright selector syntax):
- Prefer selectors from the PAGE ELEMENTS list when provided (ids, data-testid, name, placeholder, visible text).
- Good examples: "#email", "[data-testid=save-btn]", "input[name=q]", "text=Sign in", "role=button[name=\\"Save\\"]", "a:has-text(\\"Pricing\\")", "li:has-text(\\"Buy milk\\") input.toggle".
- For every click/type/hover add 1-3 "fallback_selectors" using a DIFFERENT strategy (text vs css vs role).
- Never invent long brittle CSS chains or generated class names.

Narration rules — the line must match the picture, and it must sound like a story:
- The click frame is the screen BEFORE the click. Describe what is already visible. The next step describes the result.
- "caption": a title card, max 70 characters. It names the idea, not the gesture.
- "voiceover": one or two spoken sentences, 12 to 28 words, present tense, about what the viewer is looking at and why it matters to the audience you inferred.
- Never say click, open, navigate, scroll, hover, press, type, or go to. Those are stage directions and they sound robotic.
- Bad: "Open up the landing page, click products."
- Good, on the landing page: "The promise is the first thing on the page, written for someone who has not booked a call yet."
- Good, hovering Products: "Products is sitting in the header, the way in."
- Good, after it opens: "Every option is on one screen, so the comparison happens here."
- "callout": 2 to 5 words that label the thing in frame, such as "The promise" or "Compare plans". No verbs.
- "treatment": "establish" on the opening shot, "hover" on a hover, "callout" on the one shot that should stop the viewer, "highlight" on the other clicks and scrolls.
- "duration_ms": 6500-9000 so the line can finish while the frame is still up. Scroll steps use the longer end.
- 5 to 12 steps. Only show what the live page can actually do."""

REWRITE_SYSTEM = """You edit narration for a product film. You receive a JSON list of steps with id, action, caption and voiceover, plus an instruction.
Return ONLY JSON: {"steps": [{"id": "...", "caption": "...", "voiceover": "..."}]} with the same ids in the same order.
Captions stay under 70 characters and name the idea. Voiceover is one or two present-tense sentences about what is on screen.
Never write click, open, navigate, scroll, hover, press, type, or go to. Keep the facts. Follow the instruction."""

REPAIR_SYSTEM = """You fix failing Playwright selectors for a browser automation step. You receive the step, the error, and a list of visible interactive elements on the page.
Return ONLY JSON: {"selector": "...", "fallback_selectors": ["..."], "reason": "one short sentence"}.
Use Playwright selector syntax (css, text=, role=, :has-text()). Pick the element that best matches the step's intent (caption/voiceover)."""


def _parse_json(text: str) -> dict:
    cleaned = re.sub(r"```(?:json)?", "", text)
    match = re.search(r"\{.*\}", cleaned, re.S)
    if not match:
        raise ValueError("AI response did not contain JSON")
    return json.loads(match.group(0))


async def _chat(system: str, prompt: str) -> str:
    last: AIUnavailable | None = None
    for model in models():
        payload = {"model": model, "response_format": {"type": "json_object"},
                   "messages": [{"role": "system", "content": system}, {"role": "user", "content": prompt}]}
        try:
            response = await _post("/chat/completions", payload)
        except AIUnavailable as exc:
            last = exc
            if exc.code in {"quota", "model", "upstream", "rate_limit"}:
                continue  # try the fallback model
            raise
        return response.json()["choices"][0]["message"]["content"]
    raise last or AIUnavailable("OpenAI request failed.")


async def ask_json(system: str, prompt: str, session_id: str) -> dict:
    del session_id
    raw = await _chat(system, prompt)
    try:
        return _parse_json(raw)
    except (ValueError, json.JSONDecodeError):
        raw = await _chat(system, prompt + "\n\nYour previous reply was not valid JSON. Reply again with ONLY the complete JSON object.")
        return _parse_json(raw)


CHANGELOG_SYSTEM = SYSTEM + """

The draft is a product changelog or release note. Visit only the screens those notes mention. The first step is still a goto to the target URL. Do not open a search engine."""


async def generate_script(draft: str, target_url: str, elements: list, session_id: str, brief: dict | None = None) -> dict:
    prompt = f"TARGET URL: {target_url}\n\nDRAFT:\n{draft}\n"
    if brief:
        prompt += "\nPAGE BRIEF (what the live page says about itself):\n" + json.dumps(brief)[:2000]
    if elements:
        prompt += "\nPAGE ELEMENTS found on the target URL (use these for selectors):\n" + json.dumps(elements)[:9000]
    return await ask_json(SYSTEM, prompt, session_id)


async def changelog_script(notes: str, target_url: str, session_id: str) -> dict:
    prompt = f"TARGET URL: {target_url}\n\nCHANGELOG:\n{notes}\n"
    return await ask_json(CHANGELOG_SYSTEM, prompt, session_id)


async def rewrite_narration(steps: list, instruction: str, session_id: str) -> list:
    slim = [{"id": s["id"], "action": s["action"], "caption": s.get("caption", ""), "voiceover": s.get("voiceover", "")}
            for s in steps]
    result = await ask_json(REWRITE_SYSTEM, f"INSTRUCTION: {instruction}\n\nSTEPS:\n{json.dumps(slim)}", session_id)
    return result.get("steps") or []


async def repair_selector(step: dict, elements: list, session_id: str) -> dict:
    info = {k: step.get(k) for k in ("action", "selector", "fallback_selectors", "caption", "voiceover", "error", "page_url")}
    prompt = f"STEP:\n{json.dumps(info)}\n\nPAGE ELEMENTS:\n{json.dumps(elements)[:9000]}"
    return await ask_json(REPAIR_SYSTEM, prompt, session_id)


async def synthesize(text: str, voice: str) -> bytes:
    response = await _post("/audio/speech", {"model": "tts-1-hd", "voice": voice, "input": text[:4000]})
    return response.content
