"""Pure checks for the demo-studio helpers. No server and no browser."""
import io

from PIL import Image

from product import apply_track, publish_diff, speak
from render import frame_delta


def test_glossary_replaces_whole_words():
    text = speak("Open appshowcase, then appshowcase settings", [{"word": "appshowcase", "spoken": "flow cast"}])
    assert text == "Open flow cast, then flow cast settings"


def test_publish_diff_counts_edits():
    current = [{"id": "a", "caption": "Now", "selector": "#go"}, {"id": "c", "caption": "New"}]
    published = [{"id": "a", "caption": "Then", "selector": "#go"}, {"id": "b", "caption": "Gone"}]
    diff = publish_diff(current, published)
    assert diff["added"] == 1 and diff["removed"] == 1
    assert diff["changed"][0]["fields"] == ["caption"]


def test_alt_track_swaps_narration():
    steps = apply_track([{"caption": "A", "caption_alt": "B", "voiceover_alt": "Hear B", "audio_path_alt": "clip.mp3"}], "alt")
    assert steps[0]["caption"] == "B"
    assert steps[0]["audio_path"] == "clip.mp3"


def test_frame_delta_is_zero_for_the_same_picture():
    buf = io.BytesIO()
    Image.new("RGB", (80, 40), (10, 20, 30)).save(buf, format="JPEG")
    blob = buf.getvalue()
    assert frame_delta(blob, blob) == 0


def test_private_url_is_rejected():
    import pytest
    from product import assert_public_url
    with pytest.raises(ValueError):
        assert_public_url("http://127.0.0.1/releases")
    with pytest.raises(ValueError):
        assert_public_url("file:///etc/passwd")
