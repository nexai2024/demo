import os
from datetime import timedelta

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, EmailStr, Field

from core import (NO_ID, create_access_token, create_refresh_token, db, decode_token, get_current_user,
                  hash_password, new_id, now, verify_password)

router = APIRouter(prefix="/api/auth")
COOKIE = {"httponly": True, "secure": True, "samesite": "none", "path": "/"}
DEFAULT_PREFS = {"voice": "nova", "narration_mode": "both"}


class RegisterIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class SessionIn(BaseModel):
    session_id: str


def _public(user: dict) -> dict:
    return {k: v for k, v in user.items() if k not in ("password_hash", "_id")}


def _set_jwt(response: Response, user: dict) -> None:
    response.set_cookie("access_token", create_access_token(user["user_id"], user["email"]), max_age=900, **COOKIE)
    response.set_cookie("refresh_token", create_refresh_token(user["user_id"]), max_age=604800, **COOKIE)


@router.post("/register")
async def register(body: RegisterIn, response: Response):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "An account with this email already exists")
    user = {"user_id": new_id("user_"), "email": email, "name": body.name.strip(), "picture": None,
            "password_hash": hash_password(body.password), "auth_provider": "password",
            "preferences": DEFAULT_PREFS, "created_at": now().isoformat()}
    await db.users.insert_one(dict(user))
    _set_jwt(response, user)
    return _public(user)


@router.post("/login")
async def login(body: LoginIn, request: Request, response: Response):
    email = body.email.lower()
    ident = f"{request.client.host if request.client else 'x'}:{email}"
    attempt = await db.login_attempts.find_one({"identifier": ident}, NO_ID)
    if attempt and attempt.get("count", 0) >= 5 and attempt.get("locked_until", now()) > now():
        raise HTTPException(429, "Too many failed attempts. Try again in 15 minutes.")
    user = await db.users.find_one({"email": email})
    if not user or not user.get("password_hash") or not verify_password(body.password, user["password_hash"]):
        count = (attempt or {}).get("count", 0) + 1
        await db.login_attempts.update_one(
            {"identifier": ident},
            {"$set": {"count": count, "locked_until": now() + timedelta(minutes=15)}}, upsert=True)
        raise HTTPException(401, "Invalid email or password")
    await db.login_attempts.delete_one({"identifier": ident})
    _set_jwt(response, user)
    return _public(user)


@router.post("/google/session")
async def google_session(body: SessionIn, response: Response):
    async with httpx.AsyncClient(timeout=20) as c:
        r = await c.get("https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                        headers={"X-Session-ID": body.session_id})
    if r.status_code != 200:
        raise HTTPException(401, "Google sign-in failed")
    data = r.json()
    email = data["email"].lower()
    user = await db.users.find_one({"email": email}, NO_ID)
    if user:
        await db.users.update_one({"email": email}, {"$set": {"picture": data.get("picture")}})
    else:
        user = {"user_id": new_id("user_"), "email": email, "name": data.get("name") or email,
                "picture": data.get("picture"), "auth_provider": "google",
                "preferences": DEFAULT_PREFS, "created_at": now().isoformat()}
        await db.users.insert_one(dict(user))
    await db.user_sessions.insert_one({"user_id": user["user_id"], "session_token": data["session_token"],
                                       "expires_at": now() + timedelta(days=7), "created_at": now()})
    response.set_cookie("session_token", data["session_token"], max_age=604800, **COOKIE)
    return _public(await db.users.find_one({"email": email}, NO_ID))


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    return user


@router.post("/refresh")
async def refresh(request: Request, response: Response):
    user_id = decode_token(request.cookies.get("refresh_token") or "", "refresh")
    user = user_id and await db.users.find_one({"user_id": user_id}, NO_ID)
    if not user:
        raise HTTPException(401, "Session expired")
    response.set_cookie("access_token", create_access_token(user["user_id"], user["email"]), max_age=900, **COOKIE)
    return {"ok": True}


@router.post("/logout")
async def logout(request: Request, response: Response):
    if request.cookies.get("session_token"):
        await db.user_sessions.delete_one({"session_token": request.cookies["session_token"]})
    for name in ("access_token", "refresh_token", "session_token"):
        response.delete_cookie(name, path="/", secure=True, samesite="none")
    return {"ok": True}


async def seed_admin() -> None:
    email = os.environ["ADMIN_EMAIL"].lower()
    if not await db.users.find_one({"email": email}):
        await db.users.insert_one({"user_id": new_id("user_"), "email": email, "name": "Demo Admin",
                                   "picture": None, "password_hash": hash_password(os.environ["ADMIN_PASSWORD"]),
                                   "auth_provider": "password", "role": "admin", "preferences": DEFAULT_PREFS,
                                   "created_at": now().isoformat()})
