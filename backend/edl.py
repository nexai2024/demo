"""Edit Decision List: the contract between the Python backend and the
Remotion compositor (compositor/).

One JSON document describes the whole demo: an ordered list of segments
(video window / still / interactive scene), each with its duration, camera
move (spring-zoom toward the hotspot), caption (with per-word karaoke
timings when the TTS provider supplied them), callouts, narration audio,
and the crossfade into it. Timing rules intentionally mirror the web
player (DemoPlayer) and the ffmpeg exporter (render.build_mp4) so all
three renderers tell the same story.
"""
import render
from product import PRESETS

FPS = 30
SOURCE_W, SOURCE_H = 1280, 800


def speed_for(window_s: float, hold_s: float) -> float:
    """Speed a long recorded action up to fit the narration hold."""
    if window_s > hold_s * 1.05 and hold_s > 0:
        return min(3.0, window_s / hold_s)
    return 1.0


def _frames(seconds: float) -> int:
    return max(1, round(seconds * FPS))


def _camera(step: dict, duration_frames: int) -> dict | None:
    """Spring-zoom toward the step's hotspot, Screen Studio style."""
    hotspot = step.get("hotspot")
    if not hotspot or step.get("action") not in ("click", "hover", "type"):
        return None
    try:
        w = float(hotspot.get("width") or 0)
        h = float(hotspot.get("height") or 0)
        fx = (float(hotspot.get("x") or 0) + w / 2) / SOURCE_W
        fy = (float(hotspot.get("y") or 0) + h / 2) / SOURCE_H
    except (TypeError, ValueError):
        return None
    zoom = max(1.12, min(1.28, min(SOURCE_W / max(w * 8, 1), SOURCE_H / max(h * 8, 1))))
    return {
        "fx": round(fx, 4),
        "fy": round(fy, 4),
        "zoom": round(zoom, 3),
        "inFrames": min(round(0.45 * duration_frames), 36),
        # Short segments hold the zoom to the cut; longer ones release first.
        "outFrames": min(round(0.25 * duration_frames), 24) if duration_frames >= 75 else 0,
    }


def _annotations(step: dict) -> list:
    out = []
    for ann in step.get("annotations") or []:
        if not isinstance(ann, dict) or ann.get("kind") not in ("highlight", "callout", "hover", "blur", "arrow"):
            continue
        out.append({k: ann.get(k) for k in ("kind", "x", "y", "w", "h", "text")})
    return out


def build_edl(project: dict, assets: dict[str, str]) -> dict:
    """Build the EDL. `assets` maps storage paths to local file names that
    the renderer can fetch; anything missing simply drops that layer."""
    preset = project.get("export_preset") or "standard"
    width, height = PRESETS.get(preset, PRESETS["standard"])
    brand = project.get("brand") or {}
    narration = project.get("narration_mode", "both")
    with_audio = narration in ("voiceover", "both")
    show_caption = narration in ("captions", "both") and preset != "master"
    clips = project.get("video_clips") or []

    segments: list[dict] = []
    elapsed_ms = 0
    hook = preset == "hook"
    for i, step in enumerate(project.get("steps") or []):
        audio_name = None
        if with_audio and step.get("audio_path") and step["audio_path"] in assets:
            audio_name = assets[step["audio_path"]]
        hold_s = render._step_ms(step, bool(audio_name)) / 1000
        duration = _frames(hold_s)
        seg: dict = {
            "id": step.get("id") or f"step{i}",
            "durationInFrames": duration,
            "transitionInFrames": 0 if i == 0 else _frames(min(render._fade_ms(step) / 1000, 0.45)),
            "audio": audio_name,
            "caption": None,
            "hotspot": None,
            "annotations": [],
            "camera": None,
            "actionFrame": None,
        }
        if show_caption and (step.get("caption") or "").strip():
            words = step.get("words") or []
            seg["caption"] = {
                "text": step["caption"],
                "words": words if words else None,
                "position": brand.get("caption_position") or "bottom",
            }

        if step.get("scene_type"):
            seg["type"] = "scene"
            seg["scene"] = {
                "kind": step.get("scene_type"),
                **(step.get("scene") or {}),
                "caption": step.get("caption") or "",
            }
            segments.append(seg)
        else:
            hotspot = step.get("hotspot")
            if hotspot:
                seg["hotspot"] = {k: hotspot.get(k) for k in ("x", "y", "width", "height")}
            seg["annotations"] = _annotations(step)
            seg["camera"] = _camera(step, duration)
            poster = None
            if step.get("screenshot_path") and step["screenshot_path"] in assets:
                poster = assets[step["screenshot_path"]]
            vid = step.get("video") or {}
            clip_idx = vid.get("clip")
            clip_path = clips[clip_idx] if isinstance(clip_idx, int) and 0 <= clip_idx < len(clips) else None
            if clip_path and clip_path in assets and (vid.get("end_ms") or 0) > (vid.get("start_ms") or 0):
                start_s = (vid.get("start_ms") or 0) / 1000
                window_s = ((vid.get("end_ms") or 0) - (vid.get("start_ms") or 0)) / 1000
                rate = speed_for(window_s, hold_s)
                seg["type"] = "video"
                seg["src"] = assets[clip_path]
                seg["poster"] = poster
                seg["trimBeforeFrames"] = _frames(start_s)
                seg["sourceFrames"] = _frames(window_s)
                seg["playbackRate"] = round(rate, 3)
                if vid.get("action_ms") is not None:
                    at_s = max(0.0, (vid["action_ms"] - (vid.get("start_ms") or 0)) / 1000)
                    seg["actionFrame"] = min(duration - 1, _frames(at_s / rate))
            elif poster:
                seg["type"] = "still"
                seg["src"] = poster
            else:
                seg["type"] = "blank"
                seg["label"] = step.get("caption") or step.get("action") or "Step"
            segments.append(seg)

        elapsed_ms += render._step_ms(step, bool(audio_name))
        if hook and elapsed_ms >= 15000:
            break

    total = sum(s["durationInFrames"] for s in segments) - sum(s["transitionInFrames"] for s in segments)
    return {
        "version": 1,
        "fps": FPS,
        "width": width,
        "height": height,
        "durationInFrames": max(1, total),
        "sourceWidth": SOURCE_W,
        "sourceHeight": SOURCE_H,
        "brand": {
            "accent": brand.get("accent") or "#6366F1",
            "watermark": brand.get("watermark", True),
        },
        "segments": segments,
    }
