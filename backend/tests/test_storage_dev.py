"""Dev storage must be local-first: a broken remote (NCB without R2) used to
make every upload pay three failed attempts plus backoff before landing on
disk, which slowed recordings to a crawl and stalled progress updates."""
import asyncio

import pytest

import storage


@pytest.fixture()
def dev_env(monkeypatch, tmp_path):
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.setenv("NCB_INSTANCE", "inst_123")
    monkeypatch.setenv("NCB_SECRET_KEY", "secret")
    monkeypatch.delenv("S3_BUCKET", raising=False)
    monkeypatch.setattr(storage, "LOCAL_ROOT", tmp_path)
    return tmp_path


def test_dev_put_and_get_never_touch_remote(dev_env, monkeypatch):
    def boom(*a, **k):
        raise AssertionError("remote storage must not be attempted in dev")

    monkeypatch.setattr(storage, "_put_ncb", boom)
    path = asyncio.run(storage.put_object("appshowcase/u/p/s1.jpg", b"IMG", "image/jpeg"))
    assert path == "appshowcase/u/p/s1.jpg"
    assert (dev_env / path).read_bytes() == b"IMG"
    data, media = asyncio.run(storage.get_object(path))
    assert data == b"IMG" and media == "image/jpeg"


def test_ncb_upload_fails_fast_on_misconfiguration(dev_env, monkeypatch):
    calls = {"post": 0}

    class FakeResponse:
        status_code = 404
        content = b"not found"
        text = "not found"

        def json(self):
            return {}

    class FakeClient:
        def __init__(self, *a, **k):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def post(self, *a, **k):
            calls["post"] += 1
            return FakeResponse()

    monkeypatch.setattr(storage.httpx, "Client", FakeClient)
    monkeypatch.setattr(storage.time, "sleep", lambda _: None)
    with pytest.raises(storage.StorageError):
        storage._put_ncb("appshowcase/u/p/s1.jpg", b"IMG", "image/jpeg")
    assert calls["post"] == 1  # no pointless retries against a 404 backend
