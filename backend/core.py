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
def _mongo_url() -> str:
    """MONGO_URL, tolerating the classic paste error MONGO_URL=MONGODB_URI="mongodb+srv://..."."""
    raw = (os.environ.get("MONGO_URL") or "").strip().strip('"').strip("'")
    if raw and not raw.startswith(("mongodb://", "mongodb+srv://")) and "mongodb" in raw:
        raw = raw[raw.index("mongodb"):].strip().strip('"').strip("'")
    return raw


_MONGO_URL = _mongo_url()
_db_client = None
if _MONGO_URL:
    try:
        from motor.motor_asyncio import AsyncIOMotorClient
        from pymongo.errors import DuplicateKeyError  # noqa: F401
        _db_client = AsyncIOMotorClient(_MONGO_URL, serverSelectionTimeoutMS=5000)
        DB_BACKEND = "mongodb"
        db = _db_client[os.environ.get("DB_NAME", "appshowcase")]
    except Exception as exc:  # an invalid URI must not crash the whole API at import
        logger.error("MONGO_URL is set but unusable (%s); falling back to NoCodeBackend store", exc)
        _db_client = None
if _db_client is None:
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


def create_access_token(user_id: str, email: str) -> str:
    payload = {"sub": user_id, "email": email, "type": "access", "exp": now() + timedelta(minutes=15)}
    return jwt.encode(payload, _secret(), algorithm=JWT_ALG)


def create_refresh_token(user_id: str) -> str:
    payload = {"sub": user_id, "type": "refresh", "exp": now() + timedelta(days=7)}
    return jwt.encode(payload, _secret(), algorithm=JWT_ALG)


def create_viewer_token(subject: str) -> str:
    payload = {"sub": subject, "type": "viewer", "exp": now() + timedelta(hours=12)}
    return jwt.encode(payload, _secret(), algorithm=JWT_ALG)


def create_review_token(project_id: str, jti: str | None = None, days: int = 7) -> str:
    payload = {"sub": project_id, "type": "review", "exp": now() + timedelta(days=days), "jti": jti or new_id("rv_")}
    return jwt.encode(payload, _secret(), algorithm=JWT_ALG)


def _decode(token: str) -> dict | None:
    if not token:
        return None
    for key in _verification_secrets():
        try:
            return jwt.decode(token, key, algorithms=[JWT_ALG])
        except jwt.InvalidTokenError:
            continue
    return None


def decode_token(token: str, expected: str) -> str | None:
    payload = _decode(token)
    return payload["sub"] if payload and payload.get("type") == expected else None


def decode_viewer_token(token: str) -> str | None:
    return decode_token(token, "viewer")


def decode_review_token(token: str) -> str | None:
    return decode_token(token, "review")


def decode_review_claims(token: str) -> tuple[str, str] | None:
    """(project_id, jti) for a valid review token; the jti is checked against the project to support revocation."""
    claims = _decode(token)
    if not claims or claims.get("type") != "review" or not claims.get("jti"):
        return None
    return claims["sub"], claims["jti"]


def cors_origins() -> list[str]:
    """Parse CORS_ORIGINS, tolerating classic paste errors.

    Browsers send Origin as exactly ``scheme://host[:port]``, and Starlette
    compares it verbatim — so a scheme-less (``www.example.com``), quoted, or
    path-carrying (``https://example.com/dashboard``) env value would never
    match and every preflight would 400 with "Disallowed CORS origin".
    Normalize each entry to a bare origin so those pastes still work.
    """
    from urllib.parse import urlparse

    origins: list[str] = []
    for part in os.environ.get("CORS_ORIGINS", "").split(","):
        o = part.strip().strip('"').strip("'").strip().rstrip("/")
        if not o:
            continue
        if o == "*":
            origins.append(o)
            continue
        if "://" not in o:
            scheme = "http" if o.startswith(("localhost", "127.0.0.1")) else "https"
            o = f"{scheme}://{o}"
        parsed = urlparse(o)
        if parsed.netloc:
            o = f"{parsed.scheme}://{parsed.netloc}"
        if o not in origins:
            origins.append(o)
    if origins:
        return origins
    return [] if is_production() else ["http://localhost:3000", "http://127.0.0.1:3000"]


FATAL_PREFIXES = ("JWT_SECRET", "VAULT_MASTER_KEY", "CORS_ORIGINS", "MONGO_URL", "STORAGE", "CLERK")


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
    if os.environ.get("AUTH_PROVIDER", "").strip().lower() == "clerk":
        if not os.environ.get("CLERK_SECRET_KEY"):
            problems.append("CLERK_SECRET_KEY is not set (required when AUTH_PROVIDER=clerk)")
        if not (os.environ.get("CLERK_PUBLISHABLE_KEY") or os.environ.get("VITE_CLERK_PUBLISHABLE_KEY")):
            problems.append("CLERK_PUBLISHABLE_KEY is not set (required when AUTH_PROVIDER=clerk)")
        if not os.environ.get("CLERK_WEBHOOK_SIGNING_SECRET"):
            problems.append("Clerk webhooks are not configured (CLERK_WEBHOOK_SIGNING_SECRET); user and billing sync will be stale")
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
    authorization = request.headers.get("authorization") or ""
    import clerk_service
    if clerk_service.clerk_enabled():
        # Clerk mode is exclusive: never fall through to legacy cookie sessions,
        # which silently mask a broken Bearer token as a different user.
        if not authorization.lower().startswith("bearer "):
            raise HTTPException(status_code=401, detail="Not authenticated")
        claims = await clerk_service.verify_token(authorization[7:].strip())
        return await clerk_service.profile_for_claims(claims)
    if authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
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
    if profile.get("status") in {"suspended", "banned", "deleted"}:
        raise HTTPException(status_code=403, detail="Account suspended. Contact support.")
    user = {
        "user_id": session["id"],
        "email": str(session["email"]).lower(),
        "name": profile.get("name") or session.get("name") or session["email"],
        "picture": session.get("image"),
        "auth_provider": "nocodebackend",
        "preferences": profile.get("preferences") or DEFAULT_PREFS,
        "role": profile.get("role") or "user",
        "status": profile.get("status") or "active",
        "plan": profile.get("plan_override") or profile.get("plan") or "free",
        "billing_status": profile.get("billing_status") or "free",
    }
    _USER_CACHE[cookie] = (time.monotonic(), user)
    if len(_USER_CACHE) > 40:
        cutoff = time.monotonic() - _USER_TTL
        for key, (ts, _) in list(_USER_CACHE.items()):
            if ts < cutoff:
                _USER_CACHE.pop(key, None)
    return user
