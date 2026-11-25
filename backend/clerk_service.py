"""Clerk identity integration for the FastAPI backend.

Responsibilities:
- Verify Clerk session JWTs against Clerk's JWKS.
- Provision/mirror the local user profile used by projects and quotas.
- Call Clerk's Backend API for admin operations (ban/unban, lock/unlock,
  session revocation, deletion, metadata).
- Verify Svix-signed Clerk webhooks (user, organization, billing events).

Everything is environment-gated. Without Clerk keys the existing legacy
NoCodeBackend/Better Auth cookie flow remains untouched.
"""
from __future__ import annotations

import asyncio
import base64
import hashlib
import hmac
import os
import time
from datetime import datetime, timezone
from typing import Any

import httpx
import jwt
from fastapi import HTTPException

import core

API_BASE = "https://api.clerk.com/v1"
_JWK_CLIENTS: dict[str, jwt.PyJWKClient] = {}
_USER_CACHE: dict[str, tuple[float, dict | None]] = {}
_USER_CACHE_TTL = 45.0


def clerk_requested() -> bool:
    provider = os.environ.get("AUTH_PROVIDER", "").strip().lower()
    if provider:
        return provider == "clerk"
    return bool(os.environ.get("CLERK_SECRET_KEY") or os.environ.get("CLERK_PUBLISHABLE_KEY")
                or os.environ.get("CLERK_ISSUER"))


def clerk_enabled() -> bool:
    return clerk_requested() and bool(_issuer() and (os.environ.get("CLERK_SECRET_KEY") or _jwks_url()))


def _publishable_key() -> str:
    return (os.environ.get("CLERK_PUBLISHABLE_KEY") or os.environ.get("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY")
            or os.environ.get("VITE_CLERK_PUBLISHABLE_KEY") or "").strip()


def _frontend_api() -> str:
    key = _publishable_key()
    for prefix in ("pk_test_", "pk_live_"):
        if key.startswith(prefix):
            encoded = key[len(prefix):]
            try:
                decoded = base64.b64decode(encoded + "=" * (-len(encoded) % 4)).decode()
            except Exception:
                return ""
            return decoded.rstrip("$").rstrip("/")
    return ""


def _issuer() -> str:
    issuer = (os.environ.get("CLERK_ISSUER") or "").strip().rstrip("/")
    if issuer:
        return issuer
    frontend = _frontend_api()
    return f"https://{frontend}" if frontend else ""


def _jwks_url() -> str:
    explicit = (os.environ.get("CLERK_JWKS_URL") or "").strip()
    if explicit:
        return explicit
    issuer = _issuer()
    return f"{issuer}/.well-known/jwks.json" if issuer else ""


def _admin_emails() -> set[str]:
    values = []
    for name in ("CLERK_ADMIN_EMAILS", "ADMIN_EMAILS", "ADMIN_EMAIL"):
        values.extend(part.strip().lower() for part in os.environ.get(name, "").split(","))
    return {value for value in values if value}


def _decode_token_sync(token: str) -> dict:
    jwks_url = _jwks_url()
    if not jwks_url:
        raise HTTPException(503, "Clerk is not configured on the API")
    client = _JWK_CLIENTS.get(jwks_url)
    if client is None:
        client = jwt.PyJWKClient(jwks_url, cache_keys=True, lifespan=300)
        _JWK_CLIENTS[jwks_url] = client
    try:
        signing_key = client.get_signing_key_from_jwt(token)
        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            issuer=_issuer() or None,
            leeway=30,
            options={"require": ["exp", "iat", "sub", "iss"], "verify_aud": False},
        )
    except HTTPException:
        raise
    except Exception as exc:
        # Surface the real verify failure in logs; keep the client message stable.
        import logging
        logging.getLogger("clerk_service").warning(
            "Clerk JWT verify failed (%s): %s | iss_expected=%s token_prefix=%s",
            type(exc).__name__,
            exc,
            _issuer(),
            (token or "")[:24],
        )
        raise HTTPException(401, "Invalid Clerk session") from exc
    parties = {p.strip() for p in os.environ.get("CLERK_AUTHORIZED_PARTIES", "").split(",") if p.strip()}
    # Local Vite origins are always allowed outside production so a
    # production-only CLERK_AUTHORIZED_PARTIES value cannot trap a
    # developer in a login ↔ dashboard bounce after signing in with Clerk.
    if not core.is_production():
        parties.update({
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:3001",
            "http://127.0.0.1:3001",
        })
    azp = claims.get("azp")
    if parties and azp and azp not in parties:
        raise HTTPException(401, "Invalid Clerk session origin")
    return claims


async def verify_token(token: str) -> dict:
    return await asyncio.to_thread(_decode_token_sync, token)


async def _api(method: str, path: str, *, params: dict | None = None, json: dict | None = None) -> Any:
    secret = os.environ.get("CLERK_SECRET_KEY", "").strip()
    if not secret:
        raise HTTPException(503, "CLERK_SECRET_KEY is not configured")
    headers = {"Authorization": f"Bearer {secret}", "Content-Type": "application/json"}
    try:
        async with httpx.AsyncClient(timeout=25) as client:
            response = await client.request(method, f"{API_BASE}{path}", headers=headers, params=params, json=json)
    except httpx.HTTPError as exc:
        raise HTTPException(502, "Clerk API is unreachable") from exc
    if response.status_code >= 400:
        detail = "Clerk API request failed"
        try:
            payload = response.json()
            errors = payload.get("errors") if isinstance(payload, dict) else None
            if errors:
                detail = str(errors[0].get("long_message") or errors[0].get("message") or detail)
        except Exception:
            pass
        status = 404 if response.status_code == 404 else 502
        raise HTTPException(status, detail)
    if not response.content:
        return {}
    try:
        return response.json()
    except Exception:
        return {}


def normalize_user(data: dict) -> dict:
    emails = data.get("email_addresses") or []
    primary_id = data.get("primary_email_address_id")
    primary = next((item for item in emails if item.get("id") == primary_id), emails[0] if emails else {})
    name = " ".join(part for part in [data.get("first_name"), data.get("last_name")] if part).strip()
    public = data.get("public_metadata") or {}
    return {
        "id": data.get("id"),
        "email": str(primary.get("email_address") or "").lower(),
        "name": name or primary.get("email_address") or data.get("username") or "User",
        "picture": data.get("image_url"),
        "banned": bool(data.get("banned")),
        "locked": bool(data.get("locked")),
        "role": public.get("role"),
        "created_at_ms": data.get("created_at"),
        "last_sign_in_at_ms": data.get("last_sign_in_at"),
        "public_metadata": public,
    }


async def fetch_user(user_id: str, *, force: bool = False) -> dict | None:
    if not os.environ.get("CLERK_SECRET_KEY"):
        return None
    cached = _USER_CACHE.get(user_id)
    if not force and cached and time.monotonic() - cached[0] < _USER_CACHE_TTL:
        return cached[1]
    try:
        data = await _api("GET", f"/users/{user_id}")
    except HTTPException as exc:
        if exc.status_code == 404:
            data = None
        else:
            # Authentication should not hard-fail just because Clerk's
            # profile API is briefly unavailable; verified JWT claims are
            # still authoritative for identity.
            return cached[1] if cached else None
    user = normalize_user(data) if isinstance(data, dict) and data else None
    _USER_CACHE[user_id] = (time.monotonic(), user)
    return user


def _iso_from_ms(value) -> str | None:
    try:
        return datetime.fromtimestamp(float(value) / 1000, tz=timezone.utc).isoformat()
    except Exception:
        return None


async def profile_for_claims(claims: dict) -> dict:
    user_id = str(claims.get("sub") or "")
    if not user_id:
        raise HTTPException(401, "Invalid Clerk session")
    remote = await fetch_user(user_id)
    if remote and (remote.get("banned") or remote.get("locked")):
        raise HTTPException(403, "Account suspended. Contact support.")

    doc = await core.db.users.find_one({"user_id": user_id}, {"_id": 0}) or {}
    email = str((remote or {}).get("email") or claims.get("email") or doc.get("email") or "").lower()
    name = (remote or {}).get("name") or claims.get("name") or doc.get("name") or email or "User"
    picture = (remote or {}).get("picture") or claims.get("picture") or doc.get("picture")
    role = "admin" if email in _admin_emails() else (doc.get("role") or (remote or {}).get("role") or "user")
    status = doc.get("status") or "active"
    if status in {"suspended", "banned", "deleted"}:
        raise HTTPException(403, "Account suspended. Contact support.")

    fields = {
        "user_id": user_id,
        "clerk_id": user_id,
        "email": email,
        "name": name,
        "picture": picture,
        "auth_provider": "clerk",
        "role": role,
        "status": status,
        "last_seen_at": core.now_iso(),
    }
    if not doc:
        fields.update({
            "preferences": core.DEFAULT_PREFS,
            "created_at": _iso_from_ms((remote or {}).get("created_at_ms")) or core.now_iso(),
            "plan": "free",
            "billing_status": "free",
        })
        try:
            await core.db.users.insert_one(dict(fields))
            doc = fields
        except Exception:
            doc = await core.db.users.find_one({"user_id": user_id}, {"_id": 0}) or fields
    else:
        changed = {key: value for key, value in fields.items() if doc.get(key) != value}
        if changed:
            await core.db.users.update_one({"user_id": user_id}, {"$set": changed})
            doc = {**doc, **changed}

    return {
        "user_id": user_id,
        "clerk_id": user_id,
        "email": email,
        "name": name,
        "picture": picture,
        "auth_provider": "clerk",
        "preferences": doc.get("preferences") or core.DEFAULT_PREFS,
        "role": role,
        "status": status,
        "plan": doc.get("plan_override") or doc.get("plan") or "free",
        "billing_status": doc.get("billing_status") or "free",
        "billing_current_period_end": doc.get("billing_current_period_end"),
        "active_organization_id": claims.get("org_id"),
        "organization_role": claims.get("org_role"),
    }


async def list_users(*, limit: int = 50, offset: int = 0, query: str = "") -> list[dict]:
    params = {"limit": min(max(limit, 1), 100), "offset": max(offset, 0), "order_by": "-created_at"}
    if query:
        params["query"] = query
    data = await _api("GET", "/users", params=params)
    rows = data.get("data") if isinstance(data, dict) else data
    return [normalize_user(row) for row in (rows or []) if isinstance(row, dict)]


async def ban_user(user_id: str) -> dict:
    return await _api("POST", f"/users/{user_id}/ban", json={})


async def unban_user(user_id: str) -> dict:
    return await _api("POST", f"/users/{user_id}/unban", json={})


async def lock_user(user_id: str) -> dict:
    return await _api("POST", f"/users/{user_id}/lock", json={})


async def unlock_user(user_id: str) -> dict:
    return await _api("POST", f"/users/{user_id}/unlock", json={})


async def delete_user(user_id: str) -> dict:
    return await _api("DELETE", f"/users/{user_id}")


async def update_user_metadata(user_id: str, public_metadata: dict) -> dict:
    return await _api("PATCH", f"/users/{user_id}/metadata", json={"public_metadata": public_metadata})


async def revoke_user_sessions(user_id: str) -> int:
    data = await _api("GET", "/sessions", params={"user_id": user_id, "status": "active", "limit": 100})
    rows = data.get("data") if isinstance(data, dict) else data
    revoked = 0
    for session in rows or []:
        session_id = session.get("id") if isinstance(session, dict) else None
        if session_id:
            await _api("POST", f"/sessions/{session_id}/revoke", json={})
            revoked += 1
    return revoked


def verify_webhook(raw_body: bytes, headers: dict) -> dict:
    secret = os.environ.get("CLERK_WEBHOOK_SIGNING_SECRET", "").strip()
    if not secret:
        raise HTTPException(503, "CLERK_WEBHOOK_SIGNING_SECRET is not configured")
    svix_id = headers.get("svix-id")
    timestamp = headers.get("svix-timestamp")
    signature_header = headers.get("svix-signature")
    if not svix_id or not timestamp or not signature_header:
        raise HTTPException(400, "Missing webhook signature headers")
    try:
        timestamp_int = int(timestamp)
    except ValueError as exc:
        raise HTTPException(400, "Invalid webhook timestamp") from exc
    if abs(int(time.time()) - timestamp_int) > 300:
        raise HTTPException(400, "Webhook timestamp is outside tolerance")
    key = secret[6:] if secret.startswith("whsec_") else secret
    try:
        signing_key = base64.b64decode(key)
    except Exception as exc:
        raise HTTPException(500, "Invalid webhook signing secret") from exc
    signed = f"{svix_id}.{timestamp}.".encode() + raw_body
    expected = base64.b64encode(hmac.new(signing_key, signed, hashlib.sha256).digest()).decode()
    candidates = []
    for part in signature_header.split():
        version, _, signature = part.partition(",")
        if version == "v1" and signature:
            candidates.append(signature)
    if not any(hmac.compare_digest(expected, candidate) for candidate in candidates):
        raise HTTPException(400, "Invalid webhook signature")
    try:
        import json
        return json.loads(raw_body.decode("utf-8"))
    except Exception as exc:
        raise HTTPException(400, "Invalid webhook JSON") from exc
