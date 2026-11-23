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


def compose_scene(step: dict, brand: dict) -> Image.Image:
    """Draw an interactive scene (title / credits / form / CTA) as a still frame for exports."""
    w, h = _wh()
    accent = _rgb(brand.get("accent"))
    cfg = step.get("scene") or {}
    kind = step.get("scene_type") or ""
    img = Image.new("RGB", (w, h), (7, 9, 18))
    d = ImageDraw.Draw(img, "RGBA")
    d.rectangle([0, 0, w, 10], fill=accent)
    d.ellipse([w - 340, -180, w + 120, 280], fill=accent + (36,))
    d.ellipse([-160, h - 260, 300, h + 200], fill=accent + (26,))
    title = str(cfg.get("title") or step.get("caption") or "").strip()
    body = str(cfg.get("subtitle") or cfg.get("body") or "").strip()
    title_font, body_font, small_font = _font(54), _font(28), _font(20)
    lines = _wrap(d, title, title_font, w - 320) if title else []
    body_lines = _wrap(d, body, body_font, w - 360) if body else []
    total = len(lines) * 68 + (len(body_lines) * 40 + 18 if body_lines else 0)
    y = max(120, (h - total) // 2 - 60)
    for line in lines:
        tw = d.textlength(line, font=title_font)
        d.text(((w - tw) / 2, y), line, font=title_font, fill=(248, 250, 252))
        y += 68
    if body_lines:
        y += 10
        for line in body_lines:
            tw = d.textlength(line, font=body_font)
            d.text(((w - tw) / 2, y), line, font=body_font, fill=(148, 163, 184))
            y += 40
    y += 34
    if kind in ("email", "waitlist"):
        box_w = min(560, w - 320)
        x0 = (w - box_w) // 2
        d.rounded_rectangle([x0, y, x0 + box_w, y + 58], radius=12, outline=(71, 85, 105), width=2, fill=(2, 6, 23))
        hint = str(cfg.get("placeholder") or "you@company.com")
        d.text((x0 + 20, y + 17), hint, font=small_font, fill=(100, 116, 139))
        label = str(cfg.get("button_label") or ("Join the waitlist" if kind == "waitlist" else "Continue"))
        tw = d.textlength(label, font=body_font)
        bw = int(tw + 56)
        d.rounded_rectangle([(w - bw) // 2, y + 76, (w + bw) // 2, y + 136], radius=12, fill=accent)
        d.text(((w - tw) / 2, y + 90), label, font=body_font, fill=(255, 255, 255))
    elif kind in ("credits", "cta"):
        label = str(cfg.get("button_label") or cfg.get("cta_label") or "")
        if label:
            tw = d.textlength(label, font=body_font)
            bw = int(tw + 56)
            d.rounded_rectangle([(w - bw) // 2, y, (w + bw) // 2, y + 60], radius=12, fill=accent)
            d.text(((w - tw) / 2, y + 14), label, font=body_font, fill=(255, 255, 255))
    return img


async def load_frames(project: dict) -> list:
    show_caption = project.get("narration_mode", "both") in ("captions", "both")
    if project.get("export_preset") == "master":
        show_caption = False
    brand = project.get("brand") or {}
    frames = []
    clip_cache: dict[str, bytes] = {}
    hook = project.get("export_preset") == "hook"
    elapsed = 0
    for s in project["steps"]:
        if s.get("scene_type"):
            audio = (await get_object(s["audio_path"]))[0] if s.get("audio_path") else None
            frames.append((s, compose_scene(s, brand), compose_overlay("", False, brand), audio, [], None))
            elapsed += _step_ms(s, bool(audio))
            if hook and elapsed >= 15000:
                break
            continue
        shot = (await get_object(s["screenshot_path"]))[0] if s.get("screenshot_path") else None
        audio = (await get_object(s["audio_path"]))[0] if s.get("audio_path") else None
        motion = []
        for path in (s.get("motion_paths") or [])[:8]:
            try:
                blob = (await get_object(path))[0]
            except Exception:
                continue
            motion.append(compose_base(blob, None, brand, s.get("annotations")))
        video = None
        vid = s.get("video") or {}
        clips = project.get("video_clips") or []
        clip_idx = vid.get("clip")
        if isinstance(clip_idx, int) and 0 <= clip_idx < len(clips) and clips[clip_idx]:
            try:
                if clips[clip_idx] not in clip_cache:
                    clip_cache[clips[clip_idx]] = (await get_object(clips[clip_idx]))[0]
                video = (clip_cache[clips[clip_idx]],
                         (vid.get("start_ms") or 0) / 1000, (vid.get("end_ms") or 0) / 1000)
            except Exception:
                video = None
        frames.append((s, compose_base(shot, s.get("hotspot"), brand, s.get("annotations")),
                       compose_overlay(s.get("caption", ""), show_caption, brand), audio, motion, video))
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
    if step.get("scene_type"):
        # Interactive scenes play as a timed card in exports (their configured duration).
        base = chosen if chosen != 3000 else 4000
        if has_audio:
            base = max(base, int(step.get("audio_duration_ms") or 0) + 700)
        return base
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
    for step, base, over, _, motion, _video in frames:
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
        clip_files: dict[int, str] = {}
        for i, (step, base, over, audio, motion, video) in enumerate(frames):
            use_audio = with_audio and audio is not None
            secs = _step_ms(step, use_audio) / 1000
            fades.append(0 if i == 0 else min(_fade_ms(step) / 1000, 0.45))
            slide = None
            if video:
                # Real recorded motion for this step's window; the last frame
                # is cloned when narration runs longer than the action.
                clip_bytes, v_start, v_end = video
                key = id(clip_bytes)
                if key not in clip_files:
                    clip_path = os.path.join(tmp, f"clip{len(clip_files)}.mp4")
                    with open(clip_path, "wb") as handle:
                        handle.write(clip_bytes)
                    clip_files[key] = clip_path
                over.save(os.path.join(tmp, f"o{i}.png"))
                seg = os.path.join(tmp, f"s{i}.mp4")
                cmd = [FFMPEG, "-y", "-ss", f"{v_start:.3f}", "-to", f"{max(v_end, v_start + 0.1):.3f}",
                       "-i", clip_files[key], "-loop", "1", "-framerate", "30", "-i", os.path.join(tmp, f"o{i}.png")]
                if use_audio:
                    a_path = os.path.join(tmp, f"a{i}.mp3")
                    with open(a_path, "wb") as f:
                        f.write(audio)
                    cmd += ["-i", a_path]
                else:
                    cmd += ["-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo"]
                w, h = _wh()
                window = max(0.1, v_end - v_start)
                # Speed long actions up to fit the narration (same rule as
                # the web player) instead of cutting them off mid-motion;
                # freeze the last frame when the clip is shorter.
                speed = min(3.0, window / secs) if window > secs * 1.05 else 1.0
                sped = f"setpts=PTS/{speed:.3f}," if speed > 1.0 else ""
                graph = (f"[0:v]scale={w}:{h},{sped}tpad=stop_mode=clone:stop_duration={secs:.3f},"
                         f"trim=duration={secs:.3f},setpts=PTS-STARTPTS[v0];[v0][1:v]overlay=0:0,format=yuv420p[v]")
                cmd += ["-filter_complex", graph, "-map", "[v]", "-map", "2:a",
                        "-t", f"{secs:.2f}", "-af", "apad", "-c:v", "libx264", "-preset", "veryfast",
                        "-r", "30", "-pix_fmt", "yuv420p", "-c:a", "aac", "-ar", "44100", "-ac", "2", seg]
                subprocess.run(cmd, check=True, capture_output=True)
                segs.append(seg)
                durations.append(secs)
                continue
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
