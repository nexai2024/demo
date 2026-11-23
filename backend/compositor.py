"""Remotion compositor bridge.

When the Node compositor bundle is installed (compositor/ + npm ci), MP4
exports render through Remotion: spring-zoom camera moves, animated
callouts, karaoke captions. Anything missing — no Node, bundle not built,
render failure — raises and the export job falls back to the ffmpeg
compositor (render.build_mp4), so exports never depend on it.
"""
import asyncio
import json
import logging
import os
import shutil
import tempfile

import edl
import render
from storage import get_object

logger = logging.getLogger("appshowcase.compositor")

ROOT = os.path.dirname(os.path.abspath(__file__))
COMPOSITOR_DIR = os.path.join(os.path.dirname(ROOT), "compositor")
RENDER_CLI = os.path.join(COMPOSITOR_DIR, "render.mjs")
TIMEOUT_S = int(os.environ.get("COMPOSITOR_TIMEOUT", "1200"))


def available() -> bool:
    mode = os.environ.get("COMPOSITOR", "auto").strip().lower()
    if mode in {"0", "false", "no", "off", "ffmpeg"}:
        return False
    return (
        shutil.which("node") is not None
        and os.path.exists(RENDER_CLI)
        and os.path.isdir(os.path.join(COMPOSITOR_DIR, "node_modules", "@remotion", "renderer"))
    )


def _needed_paths(project: dict) -> list[str]:
    paths: list[str] = []
    clips = project.get("video_clips") or []
    for step in project.get("steps") or []:
        vid = step.get("video") or {}
        clip = vid.get("clip")
        if isinstance(clip, int) and 0 <= clip < len(clips):
            paths.append(clips[clip])
        for key in ("screenshot_path", "audio_path"):
            if step.get(key):
                paths.append(step[key])
    music = (project.get("brand") or {}).get("music_path")
    if music:
        paths.append(music)
    return list(dict.fromkeys(p for p in paths if p))


async def render_mp4(project: dict) -> bytes:
    """Render the project's MP4 through Remotion. Raises on any failure."""
    if not available():
        raise RuntimeError("Remotion compositor is not installed")
    with tempfile.TemporaryDirectory(prefix="fc_edl_") as tmp:
        asset_dir = os.path.join(tmp, "assets")
        os.makedirs(asset_dir)
        assets: dict[str, str] = {}
        for n, path in enumerate(_needed_paths(project)):
            try:
                data, _ = await get_object(path)
            except Exception:
                continue  # missing layer: EDL simply omits it
            name = f"a{n}{os.path.splitext(path)[1] or '.bin'}"
            with open(os.path.join(asset_dir, name), "wb") as handle:
                handle.write(data)
            assets[path] = name

        doc = edl.build_edl(project, assets)
        if not doc["segments"]:
            raise RuntimeError("EDL has no segments")
        edl_path = os.path.join(tmp, "edl.json")
        with open(edl_path, "w") as handle:
            json.dump({**doc, "assetsDir": asset_dir}, handle)
        out_path = os.path.join(tmp, "out.mp4")

        proc = await asyncio.create_subprocess_exec(
            "node", RENDER_CLI, "--edl", edl_path, "--out", out_path,
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT,
        )
        try:
            out, _ = await asyncio.wait_for(proc.communicate(), timeout=TIMEOUT_S)
        except asyncio.TimeoutError:
            proc.kill()
            raise RuntimeError(f"Remotion render timed out after {TIMEOUT_S}s")
        if proc.returncode != 0 or not os.path.exists(out_path):
            tail = (out or b"").decode("utf-8", "replace")[-1200:]
            raise RuntimeError(f"Remotion render failed (exit {proc.returncode}): {tail}")
        with open(out_path, "rb") as handle:
            data = handle.read()

    music_path = (project.get("brand") or {}).get("music_path")
    if music_path and project.get("export_preset") != "master":
        try:
            music = (await get_object(music_path))[0]
            data = await asyncio.to_thread(render.mix_bed, data, music)
        except Exception:
            pass
    logger.info("Remotion export rendered: %d KB", len(data) // 1024)
    return data
