"""EDL builder + recorder action marks: the Remotion compositor contract."""
import edl
import engine


def _project():
    return {
        "export_preset": "standard",
        "narration_mode": "both",
        "brand": {"accent": "#6366F1", "caption_position": "bottom", "watermark": True},
        "video_clips": ["clip0.mp4"],
        "steps": [
            {"id": "s1", "action": "type", "caption": "Add a task", "duration_ms": 6000,
             "screenshot_path": "s1.jpg", "audio_path": "s1.mp3", "audio_duration_ms": 900,
             "hotspot": {"x": 390, "y": 250, "width": 100, "height": 40},
             "annotations": [{"kind": "callout", "x": 390, "y": 200, "w": 120, "h": 40, "text": "Type here"}],
             "words": [{"w": "Add", "start_ms": 0, "end_ms": 200}],
             "video": {"clip": 0, "start_ms": 2000, "end_ms": 15000, "action_ms": 5000}},
            {"id": "s2", "action": "click", "caption": "Open settings", "duration_ms": 6000,
             "screenshot_path": "s2.jpg",
             "hotspot": {"x": 10, "y": 10, "width": 30, "height": 30}},
            {"id": "s3", "scene_type": "title", "caption": "Welcome",
             "scene": {"title": "Welcome", "subtitle": "A demo"}, "duration_ms": 4000},
        ],
    }


ASSETS = {"clip0.mp4": "a0.mp4", "s1.jpg": "a1.jpg", "s1.mp3": "a2.mp3", "s2.jpg": "a3.jpg"}


def test_edl_video_segment_windows_camera_and_karaoke():
    doc = edl.build_edl(_project(), ASSETS)
    assert (doc["width"], doc["height"], doc["fps"]) == (1280, 800, 30)
    seg = doc["segments"][0]
    assert seg["type"] == "video" and seg["src"] == "a0.mp4" and seg["poster"] == "a1.jpg"
    assert seg["trimBeforeFrames"] == 60  # 2000ms into the clip
    assert seg["sourceFrames"] == 390  # 13s window
    assert seg["durationInFrames"] == 180  # 6000ms hold
    assert seg["playbackRate"] == round(min(3.0, 13 / 6), 3)  # sped up to fit
    # Action at 3s into the window, compressed by the playback rate.
    assert seg["actionFrame"] == round(3.0 * 30 / seg["playbackRate"])
    cam = seg["camera"]
    assert cam["fx"] == round(440 / 1280, 4) and cam["fy"] == round(270 / 800, 4)
    assert cam["zoom"] == 1.28 and cam["inFrames"] > 0
    assert seg["caption"]["words"][0]["w"] == "Add"
    assert seg["audio"] == "a2.mp3"
    assert seg["annotations"][0]["kind"] == "callout"


def test_edl_still_scene_and_total_duration():
    doc = edl.build_edl(_project(), ASSETS)
    still, scene = doc["segments"][1], doc["segments"][2]
    assert still["type"] == "still" and still["src"] == "a3.jpg"
    assert still["camera"] is not None  # click with hotspot: gentle zoom
    assert scene["type"] == "scene" and scene["scene"]["title"] == "Welcome"
    total = sum(s["durationInFrames"] for s in doc["segments"]) - sum(
        s["transitionInFrames"] for s in doc["segments"])
    assert doc["durationInFrames"] == total
    assert doc["segments"][0]["transitionInFrames"] == 0
    assert doc["segments"][1]["transitionInFrames"] > 0


def test_edl_falls_back_when_clip_asset_missing():
    doc = edl.build_edl(_project(), {"s1.jpg": "a1.jpg", "s2.jpg": "a3.jpg"})
    assert doc["segments"][0]["type"] == "still"  # poster only, no clip file
    assert doc["segments"][0]["audio"] is None


def test_speed_rule():
    assert edl.speed_for(4.0, 6.0) == 1.0
    assert edl.speed_for(13.0, 6.0) == round(13 / 6, 3) or edl.speed_for(13.0, 6.0) == min(3.0, 13 / 6)
    assert edl.speed_for(60.0, 6.0) == 3.0


def test_compositor_can_be_forced_off(monkeypatch):
    import compositor

    monkeypatch.setenv("COMPOSITOR", "off")
    assert compositor.available() is False
    monkeypatch.setenv("COMPOSITOR", "ffmpeg")
    assert compositor.available() is False


def test_recorder_range_includes_clamped_action_mark():
    rec = engine._VideoRecorder(enabled=True)
    rec._clip = {"index": 0, "t0": 1000.0, "frames": [], "dir": "/tmp", "started": 0}
    window = rec.range_for(1100.0, 2000.0, 1500.0)
    assert window == {"clip": 0, "start_ms": 100, "end_ms": 1000, "action_ms": 500}
    clamped = rec.range_for(1100.0, 2000.0, 999999.0)
    assert clamped["action_ms"] == clamped["end_ms"]
    assert "action_ms" not in rec.range_for(1100.0, 2000.0)
