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


def test_broken_s3_falls_back_to_local_in_dev_only(dev_env, monkeypatch):
    calls = {"put": 0}

    def broken_put(*a, **k):
        calls["put"] += 1
        raise storage.StorageError("bucket unreachable")

    monkeypatch.setattr(storage, "_S3_DOWN_UNTIL", 0.0)
    monkeypatch.setattr(storage, "_s3_config", lambda: {"bucket": "demo-app-dir", "prefix": ""})
    monkeypatch.setattr(storage, "_put_s3", broken_put)
    path = asyncio.run(storage.put_object("appshowcase/u/p/s1.jpg", b"IMG", "image/jpeg"))
    assert (dev_env / path).read_bytes() == b"IMG"
    # The breaker parks S3 after the first failure: no per-file retry tax.
    asyncio.run(storage.put_object("appshowcase/u/p/s2.jpg", b"IMG", "image/jpeg"))
    assert calls["put"] == 1

    monkeypatch.setattr(storage, "_S3_DOWN_UNTIL", 0.0)
    monkeypatch.setenv("APP_ENV", "production")
    with pytest.raises(storage.StorageError, match="bucket unreachable"):
        asyncio.run(storage.put_object("appshowcase/u/p/s3.jpg", b"IMG", "image/jpeg"))


def test_probe_reports_broken_s3_with_local_fallback(dev_env, monkeypatch):
    def broken(*a, **k):
        raise storage.StorageError("Could not connect to the endpoint URL")

    monkeypatch.setattr(storage, "_S3_DOWN_UNTIL", 0.0)
    monkeypatch.setattr(storage, "_s3_config",
                        lambda: {"bucket": "demo-app-dir", "endpoint": None, "region": "auto", "prefix": ""})
    monkeypatch.setattr(storage, "_put_s3", broken)
    result = storage.probe()
    assert result["configured"] == "s3" and result["bucket"] == "demo-app-dir"
    assert result["ok"] is True and result["served_by"] == "local" and result["fallback_used"] is True
    assert "endpoint URL" in result["error"]
    assert result["latency_ms"] is not None


def test_probe_reports_healthy_s3(dev_env, monkeypatch):
    store = {}

    class FakeS3:
        def delete_object(self, Bucket, Key):
            store.pop(Key, None)

    monkeypatch.setattr(storage, "_s3_config",
                        lambda: {"bucket": "b", "endpoint": None, "region": "us-east-1", "prefix": ""})
    monkeypatch.setattr(storage, "_put_s3", lambda path, data, ct: store.update({path: data}) or path)
    monkeypatch.setattr(storage, "_get_s3",
                        lambda path, byte_range=None: (store[path], "text/plain", {}))
    monkeypatch.setattr(storage, "_get_s3_client", lambda: FakeS3())
    result = storage.probe()
    assert result["ok"] is True and result["served_by"] == "s3" and result["fallback_used"] is False
    assert result["error"] is None and store == {}  # probe object cleaned up


def test_probe_fails_loudly_in_production(dev_env, monkeypatch):
    def broken(*a, **k):
        raise storage.StorageError("bucket unreachable")

    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setattr(storage, "_S3_DOWN_UNTIL", 0.0)
    monkeypatch.setattr(storage, "_s3_config",
                        lambda: {"bucket": "b", "endpoint": None, "region": "auto", "prefix": ""})
    monkeypatch.setattr(storage, "_put_s3", broken)
    result = storage.probe()
    assert result["ok"] is False and result["served_by"] is None
    assert "bucket unreachable" in result["error"]


def test_config_problems_explain_broken_s3_combos(monkeypatch):
    monkeypatch.setenv("S3_BUCKET", "demo-app-dir")
    monkeypatch.setenv("AWS_REGION", "auto")
    monkeypatch.setenv("S3_PREFIX", "appshowcase")
    monkeypatch.delenv("S3_ENDPOINT_URL", raising=False)
    problems = storage.config_problems()
    assert any("S3_ENDPOINT_URL" in p for p in problems)
    assert any("S3_PREFIX" in p for p in problems)

    monkeypatch.setenv("S3_ENDPOINT_URL", "https://acc123.r2.cloudflarestorage.com")
    monkeypatch.delenv("S3_PREFIX", raising=False)
    assert storage.config_problems() == []


def test_s3_key_candidates_try_prefixed_then_bare(monkeypatch):
    monkeypatch.setenv("S3_BUCKET", "b")
    monkeypatch.setenv("S3_PREFIX", "flowcast")
    monkeypatch.delenv("S3_PREFIX_PREVIOUS", raising=False)
    monkeypatch.delenv("S3_ENDPOINT_URL", raising=False)
    storage.reset_client()
    assert storage._s3_key("appshowcase/u/x.jpg") == "flowcast/appshowcase/u/x.jpg"
    assert storage._s3_key_candidates("appshowcase/u/x.jpg") == [
        "flowcast/appshowcase/u/x.jpg",
        "appshowcase/u/x.jpg",
    ]
    # Prefix already present in the path must not be doubled.
    monkeypatch.setenv("S3_PREFIX", "appshowcase")
    storage.reset_client()
    assert storage._s3_key("appshowcase/u/x.jpg") == "appshowcase/u/x.jpg"
    assert storage._s3_key_candidates("appshowcase/u/x.jpg") == ["appshowcase/u/x.jpg"]

    # Cleared PREFIX + PREVIOUS restores reads of objects written under flowcast/.
    monkeypatch.delenv("S3_PREFIX", raising=False)
    monkeypatch.setenv("S3_PREFIX_PREVIOUS", "flowcast")
    storage.reset_client()
    assert storage._s3_key("appshowcase/u/x.jpg") == "appshowcase/u/x.jpg"
    assert storage._s3_key_candidates("appshowcase/u/x.jpg") == [
        "appshowcase/u/x.jpg",
        "flowcast/appshowcase/u/x.jpg",
    ]


def test_get_s3_falls_back_to_bare_key(monkeypatch):
    """Objects written before S3_PREFIX was set must still resolve."""
    store = {}

    class FakeBody:
        def __init__(self, data):
            self._data = data

        def read(self):
            return self._data

    class FakeS3:
        def get_object(self, Bucket, Key, **kwargs):
            if Key not in store:
                err = RuntimeError("missing")
                err.response = {"Error": {"Code": "NoSuchKey"}}
                raise err
            return {"Body": FakeBody(store[Key]), "ContentType": "image/jpeg", "ContentLength": len(store[Key])}

    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("S3_BUCKET", "b")
    monkeypatch.setenv("S3_PREFIX", "flowcast")
    monkeypatch.setenv("AWS_REGION", "us-east-1")
    monkeypatch.delenv("S3_ENDPOINT_URL", raising=False)
    monkeypatch.setattr(storage, "_S3_DOWN_UNTIL", 0.0)
    storage.reset_client()
    monkeypatch.setattr(storage, "_get_s3_client", lambda: FakeS3())
    store["appshowcase/u/x.jpg"] = b"IMG"
    data, media = __import__("asyncio").run(storage.get_object("appshowcase/u/x.jpg"))
    assert data == b"IMG" and media == "image/jpeg"


def test_access_point_arn_in_endpoint_is_normalized(monkeypatch):
    monkeypatch.setenv("S3_BUCKET", "demo-xxxx-s3alias")
    monkeypatch.setenv(
        "S3_ENDPOINT_URL",
        "s3://arn:aws:s3:us-east-1:123456789012:accesspoint/demo",
    )
    monkeypatch.setenv("AWS_REGION", "auto")
    storage.reset_client()
    conf = storage._s3_config()
    assert conf["bucket"] == "arn:aws:s3:us-east-1:123456789012:accesspoint/demo"
    assert conf["endpoint"] is None
    assert conf["region"] == "us-east-1"
    assert any("Access Point ARN" in p for p in storage.config_problems())


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
    with pytest.raises(storage.StorageError, match="rejected upload \\(404\\)"):
        storage._put_ncb("appshowcase/u/p/s1.jpg", b"IMG", "image/jpeg")
    assert calls["post"] == 1  # no pointless retries against a 404 backend


def test_ncb_non_json_body_is_a_clean_rejection(dev_env, monkeypatch):
    """NCB answering 404 with an empty/HTML body must surface as a storage
    rejection, not a raw JSONDecodeError ('Expecting value...')."""
    calls = {"post": 0}

    class FakeResponse:
        status_code = 404
        content = b"<html>not found</html>"
        text = "<html>not found</html>"

        def json(self):
            raise ValueError("Expecting value: line 1 column 1 (char 0)")

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
    with pytest.raises(storage.StorageError, match="rejected upload \\(404\\)"):
        storage._put_ncb("appshowcase/u/p/s1.jpg", b"IMG", "image/jpeg")
    assert calls["post"] == 1
