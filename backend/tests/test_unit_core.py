"""Offline unit tests: no server, no network, no database."""
import asyncio
import importlib

import pytest

import ai
import core
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


def test_tokens_are_type_scoped(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", "s" * 40)
    assert core.decode_review_token(core.create_viewer_token("p1")) is None
    assert core.decode_review_token(core.create_review_token("p1")) == "p1"
    assert core.decode_viewer_token("garbage") is None


def test_production_rejects_wildcard_cors(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("JWT_SECRET", "s" * 40)
    monkeypatch.setenv("CORS_ORIGINS", "*")
    with pytest.raises(RuntimeError):
        core.validate_config()


def test_production_accepts_safe_config(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("JWT_SECRET", "s" * 40)
    monkeypatch.setenv("CORS_ORIGINS", "https://app.example.com/")
    core.validate_config()
    assert core.cors_origins() == ["https://app.example.com"]


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
