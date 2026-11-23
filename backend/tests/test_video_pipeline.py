"""Video-first pipeline: word alignment, clip encoding, video-segment export."""
import asyncio
import io

from PIL import Image

import ai
import engine
import render


def test_words_from_alignment_groups_characters():
    alignment = {
        "characters": list("Hi there you"),
        "character_start_times_seconds": [i * 0.1 for i in range(12)],
        "character_end_times_seconds": [(i + 1) * 0.1 for i in range(12)],
    }
    words = ai._words_from_alignment(alignment)
    assert [w["w"] for w in words] == ["Hi", "there", "you"]
    assert words[0]["start_ms"] == 0 and words[1]["start_ms"] == 300
    assert words[-1]["end_ms"] == 1200


def test_synthesize_timed_falls_back_without_elevenlabs(monkeypatch):
    monkeypatch.delenv("ELEVENLABS_API_KEY", raising=False)

    async def fake_synthesize(text, voice):
        return b"MP3BYTES"

    monkeypatch.setattr(ai, "synthesize", fake_synthesize)
    audio, words = asyncio.run(ai.synthesize_timed("hello", "nova"))
    assert audio == b"MP3BYTES" and words == []


def _make_recorder_with_frames(tmp_path, monkeypatch):
    rec = engine._VideoRecorder(enabled=True)
    clip_dir = tmp_path / "clip0"
    clip_dir.mkdir()
    frames = []
    for i in range(10):
        path = clip_dir / f"{i:05d}.jpg"
        Image.new("RGB", (320, 200), (30 + i * 20, 60, 120)).save(path, format="JPEG")
        frames.append((str(path), 1000.0 + i * 100))
    rec.clips.append({"dir": str(clip_dir), "frames": frames, "t0": 1000.0, "started": 900.0, "index": 0})
    rec._clip = rec.clips[0]
    return rec


def test_recorder_ranges_and_encoding(tmp_path, monkeypatch):
    rec = _make_recorder_with_frames(tmp_path, monkeypatch)
    window = rec.range_for(1150.0, 1750.0)
    assert window == {"clip": 0, "start_ms": 150, "end_ms": 750}
    clips = rec.encode_all()
    assert len(clips) == 1 and len(clips[0]) > 2000
    assert clips[0][4:8] == b"ftyp"  # MP4 container


def test_build_mp4_uses_video_segment():
    base = Image.new("RGB", (1280, 800), (10, 12, 24))
    over = render.compose_overlay("Watch this", True, {})
    import os
    import tempfile

    with tempfile.TemporaryDirectory() as tmp:
        clip_path = render._slideshow(tmp, "src", [Image.new("RGB", (1280, 800), (40, 80, 160))], [1.2])
        with open(clip_path, "rb") as handle:
            clip_bytes = handle.read()
    step = {"id": "s1", "action": "click", "caption": "Watch this", "duration_ms": 1500,
            "video": {"clip": 0, "start_ms": 0, "end_ms": 1200}}
    frames = [(step, base, over, None, [], (clip_bytes, 0.0, 1.2))]
    data = render.build_mp4(frames, with_audio=False)
    assert len(data) > 3000 and data[4:8] == b"ftyp"
    dur = render.audio_duration_ms  # noqa: F841 - keep import surface obvious
    out = io.BytesIO(data)
    assert out.getbuffer().nbytes == len(data)


def test_cursor_script_is_installed_js():
    assert "__fc_cursor" in engine.CURSOR_JS
    assert "requestAnimationFrame" in engine.CURSOR_JS
    assert "mousedown" in engine.CURSOR_JS
    # Passed to add_init_script as a string: it must invoke itself, or the
    # page only ever evaluates an anonymous function and no cursor appears.
    assert engine.CURSOR_JS.strip().startswith("(() =>")
    assert engine.CURSOR_JS.strip().endswith("})()")


class _FakeRequest:
    def __init__(self, headers):
        self.headers = headers


def test_video_asset_supports_range_requests(monkeypatch):
    import server

    payload = bytes(range(256)) * 40  # 10240 bytes

    async def fake_get_object(path):
        return payload, "video/mp4"

    monkeypatch.setattr(server, "get_object", fake_get_object)
    project = {"steps": [{"id": "s1", "video": {"clip": 0, "start_ms": 0, "end_ms": 1000}}],
               "video_clips": ["clip0.mp4"]}

    full = asyncio.run(server._video_asset(project, "s1"))
    assert full.status_code == 200 and full.body == payload
    assert full.headers["accept-ranges"] == "bytes"

    part = asyncio.run(server._video_asset(project, "s1", request=_FakeRequest({"range": "bytes=100-199"})))
    assert part.status_code == 206
    assert part.body == payload[100:200]
    assert part.headers["content-range"] == f"bytes 100-199/{len(payload)}"

    tail = asyncio.run(server._video_asset(project, "s1", request=_FakeRequest({"range": "bytes=10000-"})))
    assert tail.status_code == 206 and tail.body == payload[10000:]

    bad = asyncio.run(server._video_asset(project, "s1", request=_FakeRequest({"range": "bytes=99999-"})))
    assert bad.status_code == 416
