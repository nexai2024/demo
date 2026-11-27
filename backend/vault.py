"""Application-layer encryption for target credentials and captured browser state.

AES-256-GCM, key id embedded in each token so keys can be rotated, and a context string (project id +
field) is bound as associated data so a ciphertext cannot be moved to another record.

  VAULT_MASTER_KEY            current key: base64 of 32 random bytes (preferred) or a >=32 char secret
  VAULT_MASTER_KEY_PREVIOUS   comma separated retired keys, still accepted for decryption

Production refuses to start without a strong VAULT_MASTER_KEY (see core.validate_config).
"""
import base64
import hashlib
import json
import logging
import os
import secrets
import time
from datetime import datetime, timezone
from pathlib import Path

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

logger = logging.getLogger(__name__)

PREFIX = "v1"
MASK = "••••••••"
SECRET_LOGIN_FIELDS = ("password", "storage_state")


class VaultError(RuntimeError):
    pass


def _key_bytes(value: str) -> bytes:
    value = value.strip()
    try:
        raw = base64.b64decode(value, validate=True)
        if len(raw) == 32:
            return raw
    except Exception:
        pass
    if len(value) < 32:
        raise VaultError("Vault keys must be base64 of 32 bytes or at least 32 characters")
    return HKDF(algorithm=hashes.SHA256(), length=32, salt=b"appshowcase-vault-v1", info=b"aes-256-gcm").derive(value.encode())


def _kid(key: bytes) -> str:
    return hashlib.sha256(key).hexdigest()[:8]


def _dev_key() -> str:
    path = Path(__file__).parent / ".data" / "vault.dev.key"
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(base64.b64encode(secrets.token_bytes(32)).decode())
        path.chmod(0o600)
    return path.read_text().strip()


def _keyring() -> tuple[bytes, dict[str, bytes]]:
    current_raw = os.environ.get("VAULT_MASTER_KEY", "").strip()
    if not current_raw:
        if os.environ.get("APP_ENV", "").lower() in {"production", "prod"}:
            raise VaultError("VAULT_MASTER_KEY is required in production")
        current_raw = _dev_key()
    current = _key_bytes(current_raw)
    ring = {_kid(current): current}
    for old in os.environ.get("VAULT_MASTER_KEY_PREVIOUS", "").split(","):
        if old.strip():
            key = _key_bytes(old)
            ring[_kid(key)] = key
    return current, ring


def is_sealed(value) -> bool:
    return isinstance(value, str) and value.startswith(PREFIX + ":") and value.count(":") >= 2


def seal(value, context: str) -> str:
    """Encrypt any JSON-serialisable value. Already sealed values are returned unchanged."""
    if is_sealed(value):
        return value
    key, _ = _keyring()
    nonce = secrets.token_bytes(12)
    data = AESGCM(key).encrypt(nonce, json.dumps(value).encode(), context.encode())
    return f"{PREFIX}:{_kid(key)}:{base64.urlsafe_b64encode(nonce + data).decode()}"


def unseal(token, context: str):
    """Decrypt a sealed value. Legacy plaintext (never sealed) is returned as-is."""
    if not is_sealed(token):
        return token
    _, ring = _keyring()
    _, kid, blob = token.split(":", 2)
    key = ring.get(kid)
    if key is None:
        raise VaultError("No vault key matches this record (was the key rotated without keeping the old one?)")
    raw = base64.urlsafe_b64decode(blob.encode())
    try:
        return json.loads(AESGCM(key).decrypt(raw[:12], raw[12:], context.encode()))
    except Exception as exc:
        raise VaultError("Could not decrypt this value") from exc


# ---------- expiry ----------
def credential_ttl_seconds() -> float:
    return float(os.environ.get("CREDENTIAL_TTL_DAYS", "30")) * 86400


def storage_ttl_seconds() -> float:
    return float(os.environ.get("STORAGE_STATE_TTL_HOURS", "12")) * 3600


def _age(stamp) -> float | None:
    if not stamp:
        return None
    try:
        when = datetime.fromisoformat(str(stamp))
    except ValueError:
        return None
    if when.tzinfo is None:
        when = when.replace(tzinfo=timezone.utc)
    return time.time() - when.timestamp()


def _expired(stamp, ttl: float) -> bool:
    age = _age(stamp)
    return age is None or age > ttl  # unknown age counts as expired: forces a fresh, timestamped save


# ---------- login blocks ----------
def seal_login(login: dict | None, pid: str) -> dict:
    out = dict(login or {})
    for field in SECRET_LOGIN_FIELDS:
        if out.get(field):
            out[field] = seal(out[field], f"{pid}:login.{field}")
    if out.get("recipe"):
        recipe = []
        for index, step in enumerate(out["recipe"]):
            step = dict(step)
            if step.get("action") == "type" and step.get("text"):
                step["text"] = seal(step["text"], f"{pid}:login.recipe.{index}")
            recipe.append(step)
        out["recipe"] = recipe
    return out


def _try_unseal(token, context: str):
    """Return (value, ok). ok is False when the ciphertext cannot be opened with the current keyring."""
    try:
        return unseal(token, context), True
    except VaultError as exc:
        logger.warning("vault unseal failed for %s: %s", context, exc)
        return None, False


def open_login(login: dict | None, pid: str) -> dict:
    """Plaintext login for the browser. Expired / unreadable secrets are dropped, not used.

    Unreadable sealed blobs (key rotated without VAULT_MASTER_KEY_PREVIOUS) are treated like
    expiry so Live/Record can still start; callers should persist ``drop_unreadable_login``.
    """
    out = dict(login or {})
    if out.get("password"):
        if _expired(out.get("credentials_saved_at"), credential_ttl_seconds()):
            out.pop("password")
            out["credential_expired"] = True
        else:
            value, ok = _try_unseal(out["password"], f"{pid}:login.password")
            if ok:
                out["password"] = value
            else:
                out.pop("password")
                out["credential_unreadable"] = True
    if out.get("storage_state"):
        if _expired(out.get("storage_saved_at"), storage_ttl_seconds()):
            out.pop("storage_state")
            out["storage_expired"] = True
        else:
            value, ok = _try_unseal(out["storage_state"], f"{pid}:login.storage_state")
            if ok:
                out["storage_state"] = value
            else:
                out.pop("storage_state")
                out["storage_unreadable"] = True
    if out.get("recipe"):
        recipe = []
        for i, s in enumerate(out["recipe"]):
            if s.get("action") == "type" and s.get("text"):
                value, ok = _try_unseal(s["text"], f"{pid}:login.recipe.{i}")
                if ok:
                    recipe.append({**s, "text": value})
                else:
                    recipe.append({**s, "text": ""})
                    out["recipe_unreadable"] = True
            else:
                recipe.append(s)
        out["recipe"] = recipe
    return out


def drop_unreadable_login(login: dict | None, pid: str) -> tuple[dict, bool]:
    """Return a login dict safe to persist after a key rotation orphaned sealed fields.

    Drops password / storage_state / recipe type text that cannot be opened with the
    current keyring. Returns ``(cleaned, changed)``.
    """
    raw = dict(login or {})
    changed = False
    out = dict(raw)
    if out.get("password") and is_sealed(out["password"]):
        _, ok = _try_unseal(out["password"], f"{pid}:login.password")
        if not ok:
            out.pop("password", None)
            out.pop("credentials_saved_at", None)
            changed = True
    if out.get("storage_state") and is_sealed(out["storage_state"]):
        _, ok = _try_unseal(out["storage_state"], f"{pid}:login.storage_state")
        if not ok:
            out.pop("storage_state", None)
            out.pop("storage_saved_at", None)
            changed = True
    if out.get("recipe"):
        recipe = []
        for i, s in enumerate(out["recipe"]):
            step = dict(s)
            if step.get("action") == "type" and step.get("text") and is_sealed(step["text"]):
                _, ok = _try_unseal(step["text"], f"{pid}:login.recipe.{i}")
                if not ok:
                    step["text"] = ""
                    changed = True
            recipe.append(step)
        out["recipe"] = recipe
    return out, changed


def owner_login_view(login: dict | None, pid: str) -> dict:
    """What the owner's UI may see: never the password or the browser state."""
    hidden = {k: v for k, v in (login or {}).items() if k not in SECRET_LOGIN_FIELDS}
    return open_login(hidden, pid) if hidden else {}


def login_flags(login: dict | None) -> dict:
    login = login or {}
    return {
        "has_password": bool(login.get("password")),
        "credential_expired": bool(login.get("password")) and _expired(login.get("credentials_saved_at"), credential_ttl_seconds()),
        "has_storage": bool(login.get("storage_state")),
        "storage_expired": bool(login.get("storage_state")) and _expired(login.get("storage_saved_at"), storage_ttl_seconds()),
    }


# ---------- step secrets ----------
def _step_ctx(pid: str, step_id: str) -> str:
    return f"{pid}:step:{step_id}:text"


def seal_steps(steps: list, pid: str, existing: list | None = None) -> list:
    """Seal the typed value of sensitive steps. The mask placeholder keeps the stored value."""
    prior = {s.get("id"): s.get("text") for s in existing or []}
    out = []
    for step in steps:
        step = dict(step)
        if step.get("sensitive"):
            text = step.get("text")
            if text == MASK:
                step["text"] = prior.get(step.get("id"))
            elif text:
                step["text"] = seal(text, _step_ctx(pid, step["id"]))
        out.append(step)
    return out


def open_step_text(step: dict, pid: str) -> str | None:
    text = step.get("text")
    if not step.get("sensitive") or not text:
        return text
    if text == MASK:
        return ""
    value, ok = _try_unseal(text, _step_ctx(pid, step["id"]))
    return value if ok else ""


def redact_steps(steps: list) -> list:
    """Copy of the steps that is safe for history, publishing, exports, logs and any public payload."""
    return [{**s, "text": ""} if s.get("sensitive") and s.get("text") else dict(s) for s in steps or []]


def mask_steps(steps: list) -> list:
    return [{**s, "text": MASK} if s.get("sensitive") and s.get("text") else s for s in steps or []]


def merge_sensitive(restored: list, current: list) -> list:
    """Restoring a redacted snapshot must not blank a secret that still exists on the live step."""
    live = {s.get("id"): s.get("text") for s in current or [] if s.get("sensitive")}
    return [{**s, "text": live.get(s.get("id"), s.get("text"))} if s.get("sensitive") and not s.get("text") else s
            for s in restored]


def scrub(text: str, secrets_: set) -> str:
    for secret in sorted((s for s in secrets_ if s and len(s) >= 3), key=len, reverse=True):
        text = text.replace(secret, "[redacted]")
    return text


def reseal_project(raw: dict, old_pid: str, new_pid: str) -> dict:
    """Used when duplicating: re-encrypt under the new project id and drop live browser sessions."""
    login = open_login(raw.get("login") or {}, old_pid)
    login.pop("storage_state", None)
    login.pop("storage_saved_at", None)
    for flag in ("credential_expired", "storage_expired"):
        login.pop(flag, None)
    steps = []
    for step in raw.get("steps") or []:
        step = dict(step)
        if step.get("sensitive") and step.get("text"):
            step["text"] = open_step_text(step, old_pid)
        steps.append(step)
    return {"login": seal_login(login, new_pid), "steps": steps}
