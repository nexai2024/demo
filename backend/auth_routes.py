import os

from fastapi import APIRouter, Depends, HTTPException, Request, Response

from core import DEFAULT_PREFS, db, get_current_user, now
from ncb import auth_call, auth_session
from pydantic import BaseModel, EmailStr, Field

router = APIRouter(prefix="/api/auth")


class RegisterIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


def _message(response) -> str:
    try:
        data = response.json()
    except Exception:
        return "Authentication failed"
    if isinstance(data, dict):
        error = data.get("message") or data.get("error") or data.get("code")
        if isinstance(error, dict):
            error = error.get("message")
        if error:
            return str(error)
    return "Authentication failed"


def _https(request: Request) -> bool:
    proto = (request.headers.get("x-forwarded-proto") or request.url.scheme).split(",")[0].strip().lower()
    return proto == "https"


def _localize(cookie: str, https: bool) -> str:
    parts = [part.strip() for part in cookie.split(";") if part.strip()]
    if not parts:
        return cookie
    name, _, value = parts[0].partition("=")
    if not https and name.startswith("__Secure-"):
        name = name[len("__Secure-"):]
    if not https and name.startswith("__Host-"):
        name = name[len("__Host-"):]
    kept = []
    for attr in parts[1:]:
        if attr.lower().startswith("domain="):
            continue
        if not https and attr.lower() == "secure":
            continue
        kept.append(attr)
    if not any(attr.lower().startswith("path=") for attr in kept):
        kept.append("Path=/")
    return "; ".join([f"{name}={value}", *kept])


def _apply_cookies(response: Response, upstream, https: bool) -> None:
    setter = getattr(upstream.headers, "get_list", None)
    cookies = setter("set-cookie") if setter else []
    if not cookies and upstream.headers.get("set-cookie"):
        cookies = [upstream.headers["set-cookie"]]
    for cookie in cookies:
        response.headers.append("set-cookie", _localize(cookie, https))


async def _profile(user: dict) -> dict:
    found = await db.users.find_one({"user_id": user["id"]})
    if not found:
        found = {"user_id": user["id"], "email": user["email"].lower(), "name": user.get("name") or user["email"],
                 "preferences": DEFAULT_PREFS, "created_at": now().isoformat()}
        await db.users.insert_one(dict(found))
    return {
        "user_id": user["id"],
        "email": user["email"].lower(),
        "name": found.get("name") or user.get("name") or user["email"],
        "picture": user.get("image"),
        "auth_provider": "nocodebackend",
        "preferences": found.get("preferences") or DEFAULT_PREFS,
    }


async def _headers(request: Request) -> dict:
    return {name: value for name, value in request.headers.items()}


@router.post("/register")
async def register(body: RegisterIn, request: Request, response: Response):
    upstream = await auth_call("sign-up/email", await _headers(request),
                               {"email": body.email.lower(), "password": body.password, "name": body.name.strip()})
    if upstream.status_code >= 400:
        raise HTTPException(400, _message(upstream))
    _apply_cookies(response, upstream, _https(request))
    session = _user_from_body(upstream) or await auth_session(
        {"cookie": _cookie_header(upstream), "origin": request.headers.get("origin", "")})
    if not session:
        raise HTTPException(400, "Account was created but the session could not be read")
    return await _profile(session)


def _cookie_header(upstream) -> str:
    setter = getattr(upstream.headers, "get_list", None)
    cookies = setter("set-cookie") if setter else []
    return "; ".join(cookie.split(";", 1)[0] for cookie in cookies)


def _user_from_body(upstream) -> dict | None:
    try:
        data = upstream.json()
    except Exception:
        return None
    if not isinstance(data, dict):
        return None
    user = data.get("user") or data
    if isinstance(user, dict) and user.get("id") and user.get("email"):
        return user
    return None


@router.post("/login")
async def login(body: LoginIn, request: Request, response: Response):
    upstream = await auth_call("sign-in/email", await _headers(request),
                               {"email": body.email.lower(), "password": body.password})
    if upstream.status_code >= 400:
        raise HTTPException(401, _message(upstream) or "Invalid email or password")
    _apply_cookies(response, upstream, _https(request))
    session = _user_from_body(upstream) or await auth_session(
        {"cookie": _cookie_header(upstream), "origin": request.headers.get("origin", "")})
    if not session:
        raise HTTPException(401, "Invalid email or password")
    return await _profile(session)


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    return user


@router.post("/refresh")
async def refresh(request: Request):
    if not await auth_session(dict(request.headers)):
        raise HTTPException(401, "Session expired")
    return {"ok": True}


@router.post("/logout")
async def logout(request: Request, response: Response):
    upstream = await auth_call("sign-out", await _headers(request), {})
    _apply_cookies(response, upstream, _https(request))
    https = _https(request)
    for name in ("better-auth.session_token", "better-auth.session_data", "access_token", "refresh_token", "session_token"):
        response.delete_cookie(name, path="/", secure=https, samesite="none" if https else "lax")
    return {"ok": True}


async def seed_admin() -> None:
    email = os.environ.get("ADMIN_EMAIL", "").lower()
    password = os.environ.get("ADMIN_PASSWORD", "")
    if not email or not password:
        return
    if await db.users.find_one({"email": email}):
        return
    upstream = await auth_call("sign-up/email", {"origin": "http://localhost:3001"},
                               {"email": email, "password": password, "name": "Demo Admin"})
    if upstream.status_code < 400:
        session = await auth_session({"cookie": _cookie_header(upstream), "origin": "http://localhost:3001"})
        if session:
            await _profile(session)
