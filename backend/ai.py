import json
import os
import re

from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone
from emergentintegrations.llm.openai import OpenAITextToSpeech

def provider() -> tuple[str, str, str, str]:
    """(provider, model, api_key, label) — own keys win over the Emergent key."""
    if os.environ.get("ANTHROPIC_API_KEY"):
        return "anthropic", "claude-sonnet-5-5", os.environ["ANTHROPIC_API_KEY"], "Claude Sonnet 5.5 (your key)"
    if os.environ.get("OPENAI_API_KEY"):
        return "openai", "gpt-5.6-terra", os.environ["OPENAI_API_KEY"], "GPT-5.6 Terra (your OpenAI key)"
    return "anthropic", "claude-sonnet-5-5", os.environ["EMERGENT_LLM_KEY"], "Claude Sonnet 5.5 (Emergent key)"


def tts_key() -> tuple[str, str]:
    if os.environ.get("OPENAI_API_KEY"):
        return os.environ["OPENAI_API_KEY"], "OpenAI TTS HD (your key)"
    return os.environ["EMERGENT_LLM_KEY"], "OpenAI TTS HD (Emergent key)"

SYSTEM = """You are a senior product-marketing engineer who turns rough product drafts (feature specs, PRDs, release notes, bullet lists) into a precise, chronological browser automation script for recording a product demo.

Return ONLY a JSON object, no prose, no markdown fences:
{"title": "short demo title", "steps": [ {"action": "...", "url": "...", "selector": "...", "fallback_selectors": ["..."], "text": "...", "sensitive": false, "amount": 600, "wait_ms": 800, "caption": "...", "voiceover": "...", "duration_ms": 3000} ]}

Allowed actions:
- "goto": requires "url" (absolute). The FIRST step must be a goto to the target URL.
- "click": requires "selector".
- "type": requires "selector" and "text" (the value typed). Set "sensitive": true for passwords/secrets.
- "hover": requires "selector".
- "scroll": "amount" in pixels (positive = down).
- "press": "text" is a keyboard key such as "Enter".
- "wait": pause; use "wait_ms".

Selector rules (Playwright selector syntax):
- Prefer selectors from the PAGE ELEMENTS list when provided (ids, data-testid, name, placeholder, visible text).
- Good examples: "#email", "[data-testid=save-btn]", "input[name=q]", "text=Sign in", "role=button[name=\\"Save\\"]", "a:has-text(\\"Pricing\\")", "li:has-text(\\"Buy milk\\") input.toggle".
- For every click/type/hover add 1-3 "fallback_selectors" using a DIFFERENT strategy (text vs css vs role).
- Never invent long brittle CSS chains or generated class names.

Narration rules:
- "caption": on-screen text, max 90 characters, action oriented.
- "voiceover": 1-2 friendly sentences a narrator would say for that step.
- "duration_ms": 2000-6000 depending on how much there is to look at.
- 4 to 15 steps. Keep it realistic for what the page can actually do."""

REWRITE_SYSTEM = """You edit narration for product demo videos. You receive a JSON list of steps with id, action, caption and voiceover, plus an instruction.
Return ONLY JSON: {"steps": [{"id": "...", "caption": "...", "voiceover": "..."}]} with the same ids in the same order.
Captions stay under 90 characters. Voiceover is 1-2 sentences. Keep facts; follow the instruction (tone or target language)."""

REPAIR_SYSTEM = """You fix failing Playwright selectors for a browser automation step. You receive the step, the error, and a list of visible interactive elements on the page.
Return ONLY JSON: {"selector": "...", "fallback_selectors": ["..."], "reason": "one short sentence"}.
Use Playwright selector syntax (css, text=, role=, :has-text()). Pick the element that best matches the step's intent (caption/voiceover)."""


def _parse_json(text: str) -> dict:
    cleaned = re.sub(r"```(?:json)?", "", text)
    match = re.search(r"\{.*\}", cleaned, re.S)
    if not match:
        raise ValueError("AI response did not contain JSON")
    return json.loads(match.group(0))


async def _collect(chat: LlmChat, text: str) -> str:
    out = ""
    async for ev in chat.stream_message(UserMessage(text=text)):
        if isinstance(ev, TextDelta):
            out += ev.content
        elif isinstance(ev, StreamDone):
            break
    return out


async def ask_json(system: str, prompt: str, session_id: str) -> dict:
    prov, model, key, _ = provider()
    chat = LlmChat(api_key=key, session_id=session_id, system_message=system).with_model(prov, model)
    raw = await _collect(chat, prompt)
    try:
        return _parse_json(raw)
    except (ValueError, json.JSONDecodeError):
        raw = await _collect(chat, "Your previous reply was not valid JSON. Reply again with ONLY the complete JSON object.")
        return _parse_json(raw)


async def generate_script(draft: str, target_url: str, elements: list, session_id: str) -> dict:
    prompt = f"TARGET URL: {target_url}\n\nDRAFT:\n{draft}\n"
    if elements:
        prompt += "\nPAGE ELEMENTS found on the target URL (use these for selectors):\n" + json.dumps(elements)[:9000]
    return await ask_json(SYSTEM, prompt, session_id)


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
    tts = OpenAITextToSpeech(api_key=tts_key()[0])
    return await tts.generate_speech(text=text[:4000], model="tts-1-hd", voice=voice)
