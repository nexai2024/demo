"""Offline unit tests: no server, no network, no database."""
import asyncio
import importlib
import os

import pytest

import ai
import core
import engine
import product


@pytest.fixture(autouse=True)
def clean_env(monkeypatch):
    for name in ("JWT_SECRET", "CORS_ORIGINS", "APP_ENV", "OPENAI_API_KEY", "WEBHOOK_CRON_SECRET"):
        monkeypatch.delenv(name, raising=False)


def test_production_requires_jwt_secret(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    with pytest.raises(RuntimeError):
        core.create_viewer_token("x")


def test_dev_secret_is_random_not_a_known_default():
    token = core.create_viewer_token("share1")
    assert core.decode_viewer_token(token) == "share1"
    assert core._secret() != "local-dev-jwt-secret"


def test_production_accepts_safe_config(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("JWT_SECRET", "k9X2pQ7mR4vL8nT1wZ5cB3jF6hD0yG9a")
    monkeypatch.setenv("VAULT_MASTER_KEY", "M3nP8qR2tV6wX1zC5bN7kJ4hF9gD0sA2")
    monkeypatch.setenv("CORS_ORIGINS", "https://app.example.com/")
    monkeypatch.setenv("S3_BUCKET", "appshowcase-prod-media")
    # Isolate from the developer's real .env storage settings.
    monkeypatch.delenv("AWS_REGION", raising=False)
    monkeypatch.delenv("S3_ENDPOINT_URL", raising=False)
    monkeypatch.delenv("S3_PREFIX", raising=False)
    monkeypatch.setattr(core, "DB_BACKEND", "mongodb")
    core.validate_config()
    assert core.cors_origins() == ["https://app.example.com"]


@pytest.mark.parametrize("raw,expected", [
    # exact value, as documented
    ("https://www.appshowcase.xyz", ["https://www.appshowcase.xyz"]),
    # scheme-less paste (the production incident: preflight 400 for every origin)
    ("www.appshowcase.xyz", ["https://www.appshowcase.xyz"]),
    # quoted / trailing slash / pasted with a page path
    ('"https://www.appshowcase.xyz/"', ["https://www.appshowcase.xyz"]),
    ("https://www.appshowcase.xyz/dashboard", ["https://www.appshowcase.xyz"]),
    # apex + www, deduped
    ("appshowcase.xyz, https://www.appshowcase.xyz, https://www.appshowcase.xyz",
     ["https://appshowcase.xyz", "https://www.appshowcase.xyz"]),
    # local dev stays http
    ("localhost:3001", ["http://localhost:3001"]),
])
def test_cors_origins_tolerates_paste_errors(monkeypatch, raw, expected):
    monkeypatch.setenv("CORS_ORIGINS", raw)
    assert core.cors_origins() == expected


def test_tokens_are_type_scoped(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", "k9X2pQ7mR4vL8nT1wZ5cB3jF6hD0yG9a")
    assert core.decode_review_token(core.create_viewer_token("p1")) is None
    assert core.decode_review_token(core.create_review_token("p1")) == "p1"
    assert core.decode_viewer_token("garbage") is None


def test_production_rejects_wildcard_cors(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("JWT_SECRET", "k9X2pQ7mR4vL8nT1wZ5cB3jF6hD0yG9a")
    monkeypatch.setenv("VAULT_MASTER_KEY", "M3nP8qR2tV6wX1zC5bN7kJ4hF9gD0sA2")
    monkeypatch.setenv("CORS_ORIGINS", "*")
    monkeypatch.setenv("S3_BUCKET", "appshowcase-prod-media")
    monkeypatch.setattr(core, "DB_BACKEND", "mongodb")
    with pytest.raises(RuntimeError):
        core.validate_config()


def test_driver_stderr_is_quoted_in_errors():
    class Cap:
        def tail(self, limit=700):
            return "node: cannot open shared object file"

    err = engine._with_driver_stderr(RuntimeError("Connection closed while reading from the driver"), Cap())
    assert "Connection closed" in str(err) and "cannot open shared object" in str(err)


def test_driver_stderr_captures_fd2_output():
    import subprocess
    import sys
    from pathlib import Path

    code = (
        "import os, engine\n"
        "with engine._DriverStderr() as cap:\n"
        "    os.write(2, b'boom from driver\\n')\n"
        "    assert 'boom from driver' in cap.tail(), cap.tail()\n"
        "print('capture-ok')\n"
    )
    out = subprocess.run([sys.executable, "-c", code], capture_output=True, text=True,
                         cwd=str(Path(engine.__file__).parent), timeout=30)
    assert out.returncode == 0 and "capture-ok" in out.stdout


def test_dead_driver_error_quotes_its_stderr(tmp_path):
    import os
    import subprocess
    import sys
    from pathlib import Path

    fake = tmp_path / "fake-node.sh"
    fake.write_text("#!/bin/sh\necho 'fake-driver-fatal: libnss3.so missing' >&2\nexit 1\n")
    fake.chmod(0o755)
    code = "\n".join([
        "import asyncio, engine",
        "async def main():",
        "    try:",
        "        await engine.test_connection()",
        "        print('UNEXPECTED SUCCESS')",
        "    except Exception as exc:",
        "        print('ERR:', exc)",
        "asyncio.run(main())",
    ])
    env = {**os.environ, "PLAYWRIGHT_NODEJS_PATH": str(fake)}
    out = subprocess.run([sys.executable, "-c", code], capture_output=True, text=True,
                         cwd=str(Path(engine.__file__).parent), env=env, timeout=60)
    assert "fake-driver-fatal: libnss3.so missing" in out.stdout, out.stdout + out.stderr
    assert "UNEXPECTED SUCCESS" not in out.stdout


def test_driver_lib_dir_only_on_linux_with_vendored_lib(monkeypatch, tmp_path):
    fake_engine = tmp_path / "engine.py"
    fake_engine.touch()
    lib_dir = tmp_path / "native" / "lib"
    lib_dir.mkdir(parents=True)
    monkeypatch.setattr(engine, "__file__", str(fake_engine))
    assert engine._driver_lib_dir("linux") is None  # lib not present yet
    (lib_dir / "libatomic.so.1").touch()
    assert engine._driver_lib_dir("linux") == lib_dir
    assert engine._driver_lib_dir("darwin") is None


def test_ensure_driver_runtime_prepends_ld_library_path(monkeypatch, tmp_path):
    lib_dir = tmp_path / "native" / "lib"
    monkeypatch.setattr(engine, "_driver_lib_dir", lambda platform=None: lib_dir)
    monkeypatch.setenv("LD_LIBRARY_PATH", "/usr/lib")
    monkeypatch.delenv("VERCEL", raising=False)
    engine._ensure_driver_runtime()
    assert os.environ["LD_LIBRARY_PATH"] == f"{lib_dir}:/usr/lib"
    engine._ensure_driver_runtime()  # idempotent, no duplicate entry
    assert os.environ["LD_LIBRARY_PATH"] == f"{lib_dir}:/usr/lib"


def test_vendored_libatomic_is_a_real_x86_64_elf():
    from pathlib import Path

    lib = Path(engine.__file__).parent / "native" / "lib" / "libatomic.so.1"
    assert lib.is_file()
    head = lib.read_bytes()[:20]
    assert head[:4] == b"\x7fELF" and head[4] == 2  # ELF64
    assert int.from_bytes(head[18:20], "little") == 62  # x86-64


def test_short_jwt_secret_is_flagged(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", "short")
    assert any("32" in p for p in core.config_problems())


@pytest.mark.parametrize("url", ["http://localhost/x", "http://127.0.0.1", "http://169.254.169.254/", "file:///etc/passwd", "ftp://a.com"])
def test_ssrf_guard_blocks_internal_urls(url):
    with pytest.raises(ValueError):
        product.assert_public_url(url)


def test_ai_provider_is_openai_only(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "should-be-ignored")
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
    prov, model, key, _ = ai.provider()
    assert (prov, key) == ("openai", "sk-test") and model


def test_ai_error_classification():
    assert ai.classify_error(401, "").code == "invalid_key"
    assert ai.classify_error(429, '{"error":{"code":"insufficient_quota"}}').code == "quota"
    assert ai.classify_error(429, "slow down").code == "rate_limit"
    assert ai.classify_error(503, "").code == "upstream"


def test_ai_not_configured_is_clear():
    with pytest.raises(ai.AIUnavailable) as err:
        asyncio.run(ai.ask_json("sys", "hi", "s"))
    assert err.value.code == "not_configured"


def test_json_parser_handles_fences():
    assert ai._parse_json('```json\n{"a": 1}\n```') == {"a": 1}
    with pytest.raises(ValueError):
        ai._parse_json("no json here")


def test_fallback_model_order(monkeypatch):
    monkeypatch.setenv("OPENAI_MODEL", "gpt-4o")
    monkeypatch.setenv("OPENAI_FALLBACK_MODEL", "gpt-4o-mini")
    assert ai.models() == ["gpt-4o", "gpt-4o-mini"]
    monkeypatch.setenv("OPENAI_FALLBACK_MODEL", "gpt-4o")
    assert ai.models() == ["gpt-4o"]


def test_quota_falls_back_to_second_model(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
    seen = []

    class R:
        status_code = 200
        def json(self):
            return {"choices": [{"message": {"content": '{"ok": true}'}}]}

    async def fake_post(path, payload, **kw):
        seen.append(payload["model"])
        if len(seen) == 1:
            raise ai.AIUnavailable("quota", "quota")
        return R()

    monkeypatch.setattr(ai, "_post", fake_post)
    assert asyncio.run(ai.ask_json("s", "p", "x")) == {"ok": True}
    assert len(seen) == 2 and seen[0] != seen[1]
