import logging
import os
import secrets
import time
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path

import bcrypt
import jwt
from dotenv import load_dotenv
from fastapi import HTTPException, Request

from ncb import auth_session

load_dotenv(Path(__file__).parent / ".env")
logger = logging.getLogger(__name__)

# Data store: a real MongoDB when MONGO_URL is set (recommended for production); otherwise the
# NoCodeBackend adapter, which filters rows client-side and is only suited to small deployments.
if os.environ.get("MONGO_URL"):
    from motor.motor_asyncio import AsyncIOMotorClient
    from pymongo.errors import DuplicateKeyError  # noqa: F401
    DB_BACKEND = "mongodb"
    db = AsyncIOMotorClient(os.environ["MONGO_URL"], serverSelectionTimeoutMS=5000)[os.environ.get("DB_NAME", "flowcast")]
else:
    from ncb_store import DuplicateKeyError, db  # noqa: F401
    DB_BACKEND = "nocodebackend"

JWT_ALG = "HS256"
NO_ID = {"_id": 0}
DEFAULT_PREFS = {"voice": "nova", "narration_mode": "both"}


def now() -> datetime:
    return datetime.now(timezone.utc)


def now_iso() -> str:
    return now().isoformat()


def new_id(prefix: str = "") -> str:
    return f"{prefix}{uuid.uuid4().hex[:12]}"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def is_production() -> bool:
    return os.environ.get("APP_ENV", "development").strip().lower() in {"production", "prod"}


_EPHEMERAL_SECRET = secrets.token_urlsafe(48)


WEAK_MARKERS = ("changeme", "change-me", "change_me", "secret", "password", "example", "local-dev", "default", "test", "1234")


def secret_problem(value: str, name: str = "JWT_SECRET") -> str | None:
    """Why a signing/encryption secret is unacceptable, or None when it is strong enough."""
    if not value:
        return f"{name} is not set"
    if len(value) < 32:
        return f"{name} must be at least 32 characters"
    if len(set(value)) < 12:
        return f"{name} has too little variety (use a random value)"
    lowered = value.lower()
    if any(marker in lowered for marker in WEAK_MARKERS):
        return f"{name} looks like a placeholder; generate a random value"
    return None


def _secret() -> str:
    """JWT signing key. Production requires a strong managed key; development gets a random per-process key."""
    value = os.environ.get("JWT_SECRET", "")
    if is_production():
        problem = secret_problem(value)
        if problem:
            raise RuntimeError(f"{problem} (APP_ENV=production)")
        return value
    return value or _EPHEMERAL_SECRET


def _verification_secrets() -> list[str]:
    """Current key first, then retired keys (JWT_SECRET_PREVIOUS, comma separated) so rotation does not log everyone out."""
    keys = [_secret()]
    keys += [k.strip() for k in os.environ.get("JWT_SECRET_PREVIOUS", "").split(",") if k.strip()]
    return keys


def cors_origins() -> list[str]:
    raw = os.environ.get("CORS_ORIGINS", "")
    origins = [o.strip().rstrip("/") for o in raw.split(",") if o.strip()]
    if origins:
        return origins
    return [] if is_production() else ["http://localhost:3000", "http://127.0.0.1:3000"]


FATAL_PREFIXES = ("JWT_SECRET", "VAULT_MASTER_KEY", "CORS_ORIGINS", "MONGO_URL", "STORAGE")


def config_problems() -> list[str]:
    """Return configuration problems. Entries starting with FATAL_PREFIXES stop a production start."""
    problems = []
    problem = secret_problem(os.environ.get("JWT_SECRET", ""))
    if problem:
        problems.append(problem)
    vault_key = os.environ.get("VAULT_MASTER_KEY", "")
    problem = secret_problem(vault_key, "VAULT_MASTER_KEY")
    if problem:
        problems.append(problem)
    elif vault_key == os.environ.get("JWT_SECRET"):
        problems.append("VAULT_MASTER_KEY must differ from JWT_SECRET")
    origins = cors_origins()
    if not origins:
        problems.append("CORS_ORIGINS is not set (comma-separated list of allowed origins)")
    if "*" in origins:
        problems.append("CORS_ORIGINS must not contain '*' because credentials are enabled")
    if DB_BACKEND != "mongodb":
        problems.append("MONGO_URL is required in production: job leases, quotas and releases need atomic updates")
    import storage
    problems.extend(storage.config_problems())
    if not os.environ.get("OPENAI_API_KEY"):
        problems.append("OPENAI_API_KEY is not set (AI features disabled)")
    if not os.environ.get("WEBHOOK_CRON_SECRET"):
        problems.append("WEBHOOK_CRON_SECRET is not set (scheduled refresh disabled)")
    return problems


def validate_config() -> None:
    """Fail fast in production; warn in development."""
    problems = config_problems()
    fatal = [p for p in problems if p.startswith(FATAL_PREFIXES)]
    for problem in problems:
        if is_production() or problem not in fatal:
            logger.warning("config: %s", problem)
    if is_production() and fatal:
        raise RuntimeError("Refusing to start with unsafe configuration: " + "; ".join(fatal))


_USER_CACHE: dict[str, tuple[float, dict]] = {}
_USER_TTL = 8.0


async def get_current_user(request: Request) -> dict:
    cookie = request.headers.get("cookie") or ""
    if not cookie:
        raise HTTPException(status_code=401, detail="Not authenticated")
    cached = _USER_CACHE.get(cookie)
    if cached and time.monotonic() - cached[0] < _USER_TTL:
        return cached[1]
    session = await auth_session(dict(request.headers))
    if not session:
        _USER_CACHE.pop(cookie, None)
        raise HTTPException(status_code=401, detail="Not authenticated")
    profile = await db.users.find_one({"user_id": session["id"]}) or {}
    user = {
        "user_id": session["id"],
        "email": str(session["email"]).lower(),
        "name": profile.get("name") or session.get("name") or session["email"],
        "picture": session.get("image"),
        "auth_provider": "nocodebackend",
        "preferences": profile.get("preferences") or DEFAULT_PREFS,
    }
    _USER_CACHE[cookie] = (time.monotonic(), user)
    if len(_USER_CACHE) > 40:
        cutoff = time.monotonic() - _USER_TTL
        for key, (ts, _) in list(_USER_CACHE.items()):
            if ts < cutoff:
                _USER_CACHE.pop(key, None)
    return user
