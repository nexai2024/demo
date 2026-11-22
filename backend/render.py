import asyncio
import contextvars
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
FRAME = contextvars.ContextVar("frame_size", default=(W, H))


def _wh() -> tuple[int, int]:
    return FRAME.get()


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


def frame_delta(before: bytes, after: bytes) -> float:
    """Share of pixels that moved, from 0 (same picture) to 1 (different picture)."""
    size = (64, 40)
    left = Image.open(io.BytesIO(before)).convert("L").resize(size)
    right = Image.open(io.BytesIO(after)).convert("L").resize(size)
    changed = sum(1 for a, b in zip(left.getdata(), right.getdata()) if abs(a - b) > 24)
    total = size[0] * size[1]
    return changed / total if total else 0.0


def _blur_region(img: Image.Image, box: dict) -> None:
    x, y = int(box.get("x") or 0), int(box.get("y") or 0)
    w, h = int(box.get("w") or box.get("width") or 80), int(box.get("h") or box.get("height") or 40)
    x, y = max(0, x), max(0, y)
    crop = img.crop((x, y, min(img.width, x + w), min(img.height, y + h)))
    if crop.width < 2 or crop.height < 2:
        return
    small = crop.resize((max(1, crop.width // 12), max(1, crop.height // 12)))
    img.paste(small.resize(crop.size), (x, y))


def compose_base(shot: bytes | None, hotspot: dict | None, brand: dict, annotations: list | None = None) -> Image.Image:
    w, h = _wh()
    accent = _rgb(brand.get("accent"))
    if shot:
        img = Image.open(io.BytesIO(shot)).convert("RGB").resize((w, h))
    else:
        img = Image.new("RGB", (w, h), (15, 23, 42))
    for ann in annotations or []:
        if ann.get("kind") == "blur":
            _blur_region(img, ann)
    overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    if hotspot:
        cx, cy = hotspot["x"] + hotspot["width"] / 2, hotspot["y"] + hotspot["height"] / 2
        d.rounded_rectangle([hotspot["x"] - 6, hotspot["y"] - 6, hotspot["x"] + hotspot["width"] + 6,
                             hotspot["y"] + hotspot["height"] + 6], radius=10, outline=accent + (255,), width=4)
        d.ellipse([cx - 14, cy - 14, cx + 14, cy + 14], fill=accent + (150,), outline=(255, 255, 255, 255), width=3)
    for ann in annotations or []:
        if ann.get("kind") == "arrow":
            x, y = int(ann.get("x") or 0), int(ann.get("y") or 0)
            d.line([(x, y + 36), (x, y)], fill=accent + (255,), width=4)
            d.polygon([(x - 7, y + 10), (x + 7, y + 10), (x, y)], fill=accent + (255,))
        elif ann.get("kind") == "zoom" and not hotspot:
            x, y = int(ann.get("x") or 0), int(ann.get("y") or 0)
            bw, bh = int(ann.get("w") or 120), int(ann.get("h") or 80)
            d.rounded_rectangle([x, y, x + bw, y + bh], radius=8, outline=accent + (255,), width=4)
        elif ann.get("kind") in ("highlight", "callout", "hover"):
            x, y = int(ann.get("x") or 0), int(ann.get("y") or 0)
            bw, bh = max(8, int(ann.get("w") or 80)), max(8, int(ann.get("h") or 32))
            pad = 10 if ann.get("kind") != "hover" else 14
            outline = accent + ((210,) if ann.get("kind") != "hover" else (160,))
            d.rounded_rectangle([x - pad, y - pad, x + bw + pad, y + bh + pad], radius=14, outline=outline, width=4)
            if ann.get("kind") == "hover":
                d.rounded_rectangle([x - pad, y - pad, x + bw + pad, y + bh + pad], radius=14, fill=accent + (40,))
            if ann.get("kind") == "callout" and ann.get("text"):
                font = _font(22)
                label = str(ann["text"])[:48]
                tw = d.textlength(label, font=font)
                lx = min(w - tw - 36, max(16, x))
                ly = max(16, y - 46)
                d.rounded_rectangle([lx - 10, ly - 6, lx + tw + 10, ly + 30], radius=8, fill=accent + (235,))
                d.text((lx, ly), label, font=font, fill=(255, 255, 255, 255))
    return Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")


def compose_overlay(caption: str, show_caption: bool, brand: dict) -> Image.Image:
    w, h = _wh()
    accent = _rgb(brand.get("accent"))
    overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    if show_caption and caption:
        font = _font(30)
        lines = _wrap(d, caption, font, w - 200)
        lh = 42
        bh = lh * len(lines) + 36
        top = 40 if brand.get("caption_position") == "top" else h - bh - 40
        d.rounded_rectangle([80, top, w - 80, top + bh], radius=18, fill=(3, 7, 18, 215))
        d.rectangle([80, top + 14, 86, top + bh - 14], fill=accent + (255,))
        for i, line in enumerate(lines):
            d.text((112, top + 18 + i * lh), line, font=font, fill=(248, 250, 252, 255))
    if brand.get("watermark", True):
        wf = _font(16)
        label = "Made with AppShowcase"
        tw = d.textlength(label, font=wf)
        d.rounded_rectangle([w - tw - 40, 16, w - 16, 46], radius=8, fill=(3, 7, 18, 170))
        d.text((w - tw - 28, 21), label, font=wf, fill=(226, 232, 240, 230))
    return overlay


def compose_frame(shot, caption, hotspot, show_caption, brand) -> Image.Image:
    base = compose_base(shot, hotspot, brand).convert("RGBA")
    return Image.alpha_composite(base, compose_overlay(caption, show_caption, brand)).convert("RGB")


def zoom_filter(hotspot: dict, frames: int) -> str:
    w, h = _wh()
    cx = (hotspot["x"] + hotspot["width"] / 2) / w
    cy = (hotspot["y"] + hotspot["height"] / 2) / h
    zm = max(1.12, min(1.28, min(w / max(hotspot["width"] * 8, 1), h / max(hotspot["height"] * 8, 1))))
    ramp = max(1, int(frames * 0.4))
    p = f"min(on/{ramp}\\,1)"
    z = f"1+{zm - 1:.3f}*{p}*{p}*(3-2*{p})"
    x = f"trunc(max(0\\,min(iw-iw/zoom\\,{cx:.4f}*iw-iw/zoom/2)))"
    y = f"trunc(max(0\\,min(ih-ih/zoom\\,{cy:.4f}*ih-ih/zoom/2)))"
    return f"scale={w * 2}:{h * 2},zoompan=z='{z}':x='{x}':y='{y}':d=1:s={w}x{h}:fps=30"


async def load_frames(project: dict) -> list:
    show_caption = project.get("narration_mode", "both") in ("captions", "both")
    if project.get("export_preset") == "master":
        show_caption = False
    brand = project.get("brand") or {}
    frames = []
    hook = project.get("export_preset") == "hook"
    elapsed = 0
    for s in project["steps"]:
        shot = (await get_object(s["screenshot_path"]))[0] if s.get("screenshot_path") else None
        audio = (await get_object(s["audio_path"]))[0] if s.get("audio_path") else None
        motion = []
        for path in (s.get("motion_paths") or [])[:8]:
            try:
                blob = (await get_object(path))[0]
            except Exception:
                continue
            motion.append(compose_base(blob, None, brand, s.get("annotations")))
        frames.append((s, compose_base(shot, s.get("hotspot"), brand, s.get("annotations")),
                       compose_overlay(s.get("caption", ""), show_caption, brand), audio, motion))
        elapsed += _step_ms(s, bool(audio))
        if hook and elapsed >= 15000:
            break
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
    chosen = int(step.get("duration_ms") or 3000)
    floor = 7000 if step.get("action") == "scroll" else 5500
    base = floor if chosen == 3000 else chosen
    if has_audio:
        base = max(base, int(step.get("audio_duration_ms") or 0) + 700)
    return base


def _fade_ms(step: dict) -> int:
    if step.get("transition") == "none":
        return 0
    chosen = int(step.get("transition_ms") or 400)
    return 800 if chosen == 400 else chosen


def _ease(images: list) -> list:
    """Blend between stills so a scroll reads as one move instead of a flicker."""
    if len(images) < 2:
        return images
    eased = []
    for left, right in zip(images, images[1:]):
        a, b = left.convert("RGB"), right.convert("RGB")
        eased.append(a)
        for k in (1, 2, 3):
            eased.append(Image.blend(a, b, k / 4))
    eased.append(images[-1].convert("RGB"))
    return eased


def build_gif(frames: list) -> bytes:
    imgs, durs, prev = [], [], None
    for step, base, over, _, motion in frames:
        frame = Image.alpha_composite(base.convert("RGBA"), over).convert("RGB")
        small = frame.resize(_wh())
        tm = min(_fade_ms(step), 450)
        if prev is not None and tm > 0:
            for k in (1, 2, 3, 4):
                incoming = small if not motion else _burn(motion[0], over).resize(_wh())
                imgs.append(Image.blend(prev, incoming, k / 5))
                durs.append(max(40, tm // 4))
        hold = _step_ms(step, False)
        if motion and step.get("action") == "scroll":
            glide = min(3200, max(1800, len(motion) * 280))
            shots = _ease([_burn(shot, over).resize(_wh()) for shot in motion] + [small])
            each = max(50, glide // len(shots))
            for shot in shots:
                imgs.append(shot)
                durs.append(each)
            hold = max(1600, hold - glide)
        imgs.append(small)
        durs.append(hold)
        prev = small
    palette = imgs[0].quantize(colors=128)
    pal = [im.quantize(palette=palette, dither=Image.Dither.NONE) for im in imgs]
    buf = io.BytesIO()
    pal[0].save(buf, format="GIF", save_all=True, append_images=pal[1:], duration=durs, loop=0, disposal=1)
    return buf.getvalue()


def _burn(shot, over) -> Image.Image:
    return Image.alpha_composite(shot.convert("RGBA"), over).convert("RGB")


def _slideshow(tmp: str, name: str, images: list, holds: list) -> str:
    lines, last = [], None
    width, height = _wh()
    for j, (image, hold) in enumerate(zip(images, holds)):
        path = os.path.join(tmp, f"{name}_{j}.png")
        image.convert("RGB").resize((width, height)).save(path)
        lines.append(f"file '{path}'\n")
        lines.append(f"duration {hold:.3f}\n")
        last = path
    lines.append(f"file '{last}'\n")
    list_path = os.path.join(tmp, f"{name}.txt")
    with open(list_path, "w") as handle:
        handle.writelines(lines)
    out = os.path.join(tmp, f"{name}.mp4")
    subprocess.run([FFMPEG, "-y", "-f", "concat", "-safe", "0", "-i", list_path, "-vf",
                    f"scale={width}:{height},format=yuv420p", "-r", "30", "-c:v", "libx264",
                    "-preset", "veryfast", "-pix_fmt", "yuv420p", out], check=True, capture_output=True)
    return out


def mix_bed(video: bytes, music: bytes) -> bytes:
    """Lay a quiet music bed under the voice. The picture is copied."""
    with tempfile.TemporaryDirectory() as tmp:
        src, bed, out = os.path.join(tmp, "in.mp4"), os.path.join(tmp, "bed"), os.path.join(tmp, "out.mp4")
        with open(src, "wb") as handle:
            handle.write(video)
        with open(bed, "wb") as handle:
            handle.write(music)
        subprocess.run([FFMPEG, "-y", "-i", src, "-stream_loop", "-1", "-i", bed, "-filter_complex",
                        "[1:a]volume=0.15[bed];[0:a][bed]amix=inputs=2:duration=first:dropout_transition=0[a]",
                        "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-shortest", out],
                       check=True, capture_output=True)
        with open(out, "rb") as handle:
            return handle.read()


def _dissolve(segs: list, durations: list, fades: list, tmp: str) -> None:
    """Overlap scenes. Fading each clip in from black is what made every cut flicker."""
    out = os.path.join(tmp, "out.mp4")
    if len(segs) == 1:
        os.replace(segs[0], out)
        return
    inputs = []
    for seg in segs:
        inputs += ["-i", seg]
    video, audio, clock = "[0:v]", "[0:a]", durations[0]
    filters = []
    for i in range(1, len(segs)):
        room = min(clock, durations[i])
        span = min(fades[i], max(0.0, room - 0.08))
        span = 0.04 if span < 0.04 else span
        filters.append(f"{video}[{i}:v]xfade=transition=fade:duration={span:.3f}:offset={clock - span:.3f}[vx{i}]")
        filters.append(f"{audio}[{i}:a]acrossfade=d={span:.3f}:c1=tri:c2=tri[ax{i}]")
        video, audio = f"[vx{i}]", f"[ax{i}]"
        clock = clock + durations[i] - span
    subprocess.run([FFMPEG, "-y", *inputs, "-filter_complex", ";".join(filters), "-map", video, "-map", audio,
                    "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-c:a", "aac",
                    "-ar", "44100", "-ac", "2", "-movflags", "+faststart", out], check=True, capture_output=True)


def build_mp4(frames: list, with_audio: bool, zoom: bool = True) -> bytes:
    with tempfile.TemporaryDirectory() as tmp:
        segs, durations, fades = [], [], []
        for i, (step, base, over, audio, motion) in enumerate(frames):
            use_audio = with_audio and audio is not None
            secs = _step_ms(step, use_audio) / 1000
            fades.append(0 if i == 0 else min(_fade_ms(step) / 1000, 0.45))
            slide = None
            if motion and step.get("action") == "scroll":
                glide = min(3.2, max(1.8, len(motion) * 0.28))
                pictures = _ease([_burn(shot, over) for shot in motion] + [_burn(base, over)])
                each = glide / len(pictures)
                hold = max(1.6, secs - glide)
                slide = _slideshow(tmp, f"slide{i}", pictures, [each] * len(pictures) + [hold])
            do_zoom = zoom and not slide and step.get("hotspot") and step.get("action") in ("click", "hover", "type")
            base_path, over_path = os.path.join(tmp, f"b{i}.png"), os.path.join(tmp, f"o{i}.png")
            if slide:
                cmd = [FFMPEG, "-y", "-i", slide]
            elif do_zoom:
                base.save(base_path)
                over.save(over_path)
                cmd = [FFMPEG, "-y", "-loop", "1", "-framerate", "30", "-i", base_path,
                       "-loop", "1", "-framerate", "30", "-i", over_path]
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
                frames_n = max(1, int(secs * 30))
                graph = f"[0:v]{zoom_filter(step['hotspot'], frames_n)}[z];[z][1:v]overlay=0:0,format=yuv420p[v]"
                cmd += ["-filter_complex", graph, "-map", "[v]", "-map", "2:a"]
            else:
                w, h = _wh()
                cmd += ["-vf", f"scale={w}:{h},format=yuv420p"]
            cmd += ["-t", f"{secs:.2f}", "-af", "apad", "-c:v", "libx264", "-preset", "veryfast",
                    "-r", "30", "-pix_fmt", "yuv420p", "-c:a", "aac", "-ar", "44100", "-ac", "2", seg]
            subprocess.run(cmd, check=True, capture_output=True)
            segs.append(seg)
            durations.append(secs)
        _dissolve(segs, durations, fades, tmp)
        with open(os.path.join(tmp, "out.mp4"), "rb") as handle:
            return handle.read()


async def render(project: dict, fmt: str) -> bytes:
    from product import PRESETS
    token = FRAME.set(PRESETS.get(project.get("export_preset") or "standard", (W, H)))
    try:
        frames = await load_frames(project)
        if fmt == "gif":
            return await asyncio.to_thread(build_gif, frames)
        with_audio = project.get("narration_mode", "both") in ("voiceover", "both")
        data = await asyncio.to_thread(build_mp4, frames, with_audio, (project.get("brand") or {}).get("zoom", True))
        music_path = (project.get("brand") or {}).get("music_path")
        if music_path and project.get("export_preset") != "master":
            try:
                music = (await get_object(music_path))[0]
                data = await asyncio.to_thread(mix_bed, data, music)
            except Exception:
                pass
        return data
    finally:
        FRAME.reset(token)
