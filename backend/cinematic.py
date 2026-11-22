"""Turn a generated script into a narrated shot list with marks on the thing in frame."""
import re

STORY_INSTRUCTION = (
    "Rewrite every caption and voiceover as a story told over the picture, not as instructions. "
    "The viewer is already looking at the screen. Name what they see and why it matters. "
    "Never say click, open, navigate, scroll, hover, press, type, or go to. "
    "One or two spoken sentences, in the order the scenes appear, so the line matches the frame."
)

_COMMAND = re.compile(
    r"^\s*(open|click|navigate|go to|scroll|press|type|hover|select|tap|let'?s|now we)\b",
    re.I,
)
_VERBS = re.compile(r"\b(click|navigate|scroll down|scroll up|open up|go to the|press the)\b", re.I)


def looks_robotic(text: str) -> bool:
    line = (text or "").strip()
    if not line:
        return False
    return bool(_COMMAND.search(line) or _VERBS.search(line))


def needs_story_pass(steps: list) -> bool:
    return any(looks_robotic(s.get("caption")) or looks_robotic(s.get("voiceover")) for s in steps)


def direct(steps: list) -> list:
    """Fill a shot treatment and a short callout when the model left them blank."""
    for index, step in enumerate(steps):
        action = step.get("action")
        treatment = (step.get("treatment") or "").strip()
        if treatment not in {"establish", "highlight", "callout", "hover"}:
            if action == "hover":
                treatment = "hover"
            elif action in ("click", "type") and index == _hero_index(steps):
                treatment = "callout"
            elif action in ("click", "type"):
                treatment = "highlight"
            elif index == 0:
                treatment = "establish"
            else:
                treatment = "highlight"
        step["treatment"] = treatment
        if not (step.get("callout") or "").strip():
            step["callout"] = _callout(step)
        step["callout"] = str(step.get("callout") or "")[:48]
    return steps


def _hero_index(steps: list) -> int:
    for index, step in enumerate(steps):
        if step.get("action") in ("click", "type"):
            return index
    return 0


def _callout(step: dict) -> str:
    raw = (step.get("caption") or step.get("chapter") or "").strip()
    raw = _VERBS.sub("", raw).strip(" .,-")
    words = raw.split()
    if not words:
        return {"hover": "Look here", "click": "This one", "type": "Right here"}.get(step.get("action"), "")
    return " ".join(words[:5])


def stage_marks(step: dict, hotspot: dict | None) -> list:
    """Marks in screenshot pixels. Hover, highlight, and callout sit on the control in frame."""
    if not hotspot:
        return [mark for mark in (step.get("annotations") or []) if mark.get("kind") in {"blur", "arrow", "zoom"}]
    box = {
        "x": int(hotspot.get("x") or 0),
        "y": int(hotspot.get("y") or 0),
        "w": int(hotspot.get("width") or hotspot.get("w") or 40),
        "h": int(hotspot.get("height") or hotspot.get("h") or 24),
    }
    kept = [mark for mark in (step.get("annotations") or []) if mark.get("kind") in {"blur", "arrow", "zoom"}]
    treatment = step.get("treatment") or ""
    if treatment == "hover" or step.get("action") == "hover":
        kept.append({**box, "kind": "hover"})
    elif treatment == "callout":
        kept.append({**box, "kind": "callout", "text": (step.get("callout") or "Here")[:48]})
    elif treatment == "highlight" or step.get("action") in ("click", "type"):
        kept.append({**box, "kind": "highlight"})
    return kept
