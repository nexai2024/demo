import asyncio
import io
import os
import re
import subprocess
import tempfile

import imageio_ffmpeg
from PIL import Image, ImageDraw, ImageFont

from storage import get_object

FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
W, H = 1280, 800
INDIGO = (99, 102, 241)


def _font(size: int):
    for path in ("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",):
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default(size=size)


def _wrap(draw, text, font, max_w):
    words, lines, cur = text.split(), [], ""
    for w in words:
        trial = f"{cur} {w}".strip()
        if draw.textlength(trial, font=font) <= max_w:
            cur = trial
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines[:3]


def _rgb(hex_color: str) -> tuple:
    h = (hex_color or "#6366F1").lstrip("#")
    try:
        return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
    except ValueError:
        return INDIGO


def make_thumb(shot: bytes) -> bytes:
    img = Image.open(io.BytesIO(shot)).convert("RGB")
    img.thumbnail((480, 300))
    buf = io.BytesIO()
    img.save(buf, format="WEBP", quality=72)
    return buf.getvalue()


def compose_base(shot: bytes | None, hotspot: dict | None, brand: dict) -> Image.Image:
    accent = _rgb(brand.get("accent"))
    if shot:
        img = Image.open(io.BytesIO(shot)).convert("RGB").resize((W, H))
    else:
        img = Image.new("RGB", (W, H), (15, 23, 42))
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    if hotspot:
        cx, cy = hotspot["x"] + hotspot["width"] / 2, hotspot["y"] + hotspot["height"] / 2
        d.rounded_rectangle([hotspot["x"] - 6, hotspot["y"] - 6, hotspot["x"] + hotspot["width"] + 6,
                             hotspot["y"] + hotspot["height"] + 6], radius=10, outline=accent + (255,), width=4)
        d.ellipse([cx - 14, cy - 14, cx + 14, cy + 14], fill=accent + (150,), outline=(255, 255, 255, 255), width=3)
    return Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")


def compose_overlay(caption: str, show_caption: bool, brand: dict) -> Image.Image:
    accent = _rgb(brand.get("accent"))
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    if show_caption and caption:
        font = _font(30)
        lines = _wrap(d, caption, font, W - 200)
        lh = 42
        bh = lh * len(lines) + 36
        top = 40 if brand.get("caption_position") == "top" else H - bh - 40
        d.rounded_rectangle([80, top, W - 80, top + bh], radius=18, fill=(3, 7, 18, 215))
        d.rectangle([80, top + 14, 86, top + bh - 14], fill=accent + (255,))
        for i, line in enumerate(lines):
            d.text((112, top + 18 + i * lh), line, font=font, fill=(248, 250, 252, 255))
    if brand.get("watermark", True):
        wf = _font(16)
        label = "Made with Flowcast"
        tw = d.textlength(label, font=wf)
        d.rounded_rectangle([W - tw - 40, 16, W - 16, 46], radius=8, fill=(3, 7, 18, 170))
        d.text((W - tw - 28, 21), label, font=wf, fill=(226, 232, 240, 230))
    return overlay


def compose_frame(shot, caption, hotspot, show_caption, brand) -> Image.Image:
    base = compose_base(shot, hotspot, brand).convert("RGBA")
    return Image.alpha_composite(base, compose_overlay(caption, show_caption, brand)).convert("RGB")


def zoom_filter(hotspot: dict, frames: int) -> str:
    cx = (hotspot["x"] + hotspot["width"] / 2) / W
    cy = (hotspot["y"] + hotspot["height"] / 2) / H
    zm = max(1.3, min(1.9, min(W / max(hotspot["width"] * 5, 1), H / max(hotspot["height"] * 5, 1))))
    ramp = max(1, int(frames * 0.35))
    p = f"min(on/{ramp},1)"
    z = f"1+{zm - 1:.3f}*{p}*{p}*(3-2*{p})"
    x = f"max(0,min(iw-iw/zoom,{cx:.4f}*iw-iw/zoom/2))"
    y = f"max(0,min(ih-ih/zoom,{cy:.4f}*ih-ih/zoom/2))"
    return f"scale={W * 2}:{H * 2},zoompan=z='{z}':x='{x}':y='{y}':d={frames}:s={W}x{H}:fps=30"


async def load_frames(project: dict) -> list:
    show_caption = project.get("narration_mode", "both") in ("captions", "both")
    brand = project.get("brand") or {}
    frames = []
    for s in project["steps"]:
        shot = (await get_object(s["screenshot_path"]))[0] if s.get("screenshot_path") else None
        audio = (await get_object(s["audio_path"]))[0] if s.get("audio_path") else None
        frames.append((s, compose_base(shot, s.get("hotspot"), brand),
                       compose_overlay(s.get("caption", ""), show_caption, brand), audio))
    return frames


def audio_duration_ms(data: bytes) -> int:
    with tempfile.NamedTemporaryFile(suffix=".mp3") as f:
        f.write(data)
        f.flush()
        out = subprocess.run([FFMPEG, "-i", f.name], capture_output=True, text=True).stderr
    m = re.search(r"Duration: (\d+):(\d+):(\d+\.\d+)", out)
    if not m:
        return 0
    h, mi, s = m.groups()
    return int((int(h) * 3600 + int(mi) * 60 + float(s)) * 1000)


def _step_ms(step: dict, has_audio: bool) -> int:
    base = int(step.get("duration_ms") or 3000)
    if has_audio:
        base = max(base, int(step.get("audio_duration_ms") or 0) + 400)
    return base


def build_gif(frames: list) -> bytes:
    imgs, durs, prev = [], [], None
    for step, base, over, _ in frames:
        frame = Image.alpha_composite(base.convert("RGBA"), over).convert("RGB")
        small = frame.resize((960, 600))
        tm = int(step.get("transition_ms") or 0)
        if prev is not None and step.get("transition") == "fade" and tm > 0:
            for k in (1, 2, 3):
                imgs.append(Image.blend(prev, small, k / 4))
                durs.append(max(20, tm // 3))
        imgs.append(small)
        durs.append(int(step.get("duration_ms") or 3000))
        prev = small
    pal = [im.convert("P", palette=Image.ADAPTIVE, colors=256) for im in imgs]
    buf = io.BytesIO()
    pal[0].save(buf, format="GIF", save_all=True, append_images=pal[1:], duration=durs, loop=0, optimize=True)
    return buf.getvalue()


def build_mp4(frames: list, with_audio: bool, zoom: bool = True) -> bytes:
    with tempfile.TemporaryDirectory() as tmp:
        segs = []
        for i, (step, base, over, audio) in enumerate(frames):
            use_audio = with_audio and audio is not None
            secs = _step_ms(step, use_audio) / 1000
            tm = int(step.get("transition_ms") or 0) / 1000
            fade = f",fade=t=in:st=0:d={tm:.2f}" if step.get("transition") == "fade" and tm > 0 else ""
            do_zoom = zoom and step.get("hotspot") and step.get("action") in ("click", "hover", "type")
            base_path, over_path = os.path.join(tmp, f"b{i}.png"), os.path.join(tmp, f"o{i}.png")
            if do_zoom:
                base.save(base_path)
                over.save(over_path)
                cmd = [FFMPEG, "-y", "-i", base_path, "-loop", "1", "-framerate", "30", "-i", over_path]
            else:
                Image.alpha_composite(base.convert("RGBA"), over).convert("RGB").save(base_path)
                cmd = [FFMPEG, "-y", "-loop", "1", "-framerate", "30", "-i", base_path]
            if use_audio:
                a_path = os.path.join(tmp, f"a{i}.mp3")
                with open(a_path, "wb") as f:
                    f.write(audio)
                cmd += ["-i", a_path]
            else:
                cmd += ["-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo"]
            seg = os.path.join(tmp, f"s{i}.mp4")
            if do_zoom:
                frames_n = int(secs * 30) + 2
                graph = f"[0:v]{zoom_filter(step['hotspot'], frames_n)}[z];[z][1:v]overlay=0:0,format=yuv420p{fade}[v]"
                a_idx = 2
                cmd += ["-filter_complex", graph, "-map", "[v]", "-map", f"{a_idx}:a"]
            else:
                cmd += ["-vf", f"scale=1280:800,format=yuv420p{fade}"]
            cmd += ["-t", f"{secs:.2f}", "-af", "apad", "-c:v", "libx264", "-preset", "veryfast",
                    "-r", "30", "-pix_fmt", "yuv420p", "-c:a", "aac", "-ar", "44100", "-ac", "2", seg]
            subprocess.run(cmd, check=True, capture_output=True)
            segs.append(seg)
        list_path = os.path.join(tmp, "list.txt")
        with open(list_path, "w") as f:
            f.writelines(f"file '{s}'\n" for s in segs)
        out = os.path.join(tmp, "out.mp4")
        subprocess.run([FFMPEG, "-y", "-f", "concat", "-safe", "0", "-i", list_path, "-c", "copy",
                        "-movflags", "+faststart", out], check=True, capture_output=True)
        with open(out, "rb") as f:
            return f.read()


async def render(project: dict, fmt: str) -> bytes:
    frames = await load_frames(project)
    if fmt == "gif":
        return await asyncio.to_thread(build_gif, frames)
    with_audio = project.get("narration_mode", "both") in ("voiceover", "both")
    return await asyncio.to_thread(build_mp4, frames, with_audio, (project.get("brand") or {}).get("zoom", True))
