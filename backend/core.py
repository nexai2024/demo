import os
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path

import bcrypt
import jwt
from dotenv import load_dotenv
from fastapi import HTTPException, Request
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv(Path(__file__).parent / ".env")

client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]
JWT_ALG = "HS256"
NO_ID = {"_id": 0}


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


def _secret() -> str:
    return os.environ["JWT_SECRET"]


def create_access_token(user_id: str, email: str) -> str:
    payload = {"sub": user_id, "email": email, "type": "access", "exp": now() + timedelta(minutes=15)}
    return jwt.encode(payload, _secret(), algorithm=JWT_ALG)


def create_refresh_token(user_id: str) -> str:
    payload = {"sub": user_id, "type": "refresh", "exp": now() + timedelta(days=7)}
    return jwt.encode(payload, _secret(), algorithm=JWT_ALG)


def create_viewer_token(subject: str) -> str:
    payload = {"sub": subject, "type": "viewer", "exp": now() + timedelta(hours=12)}
    return jwt.encode(payload, _secret(), algorithm=JWT_ALG)


def decode_viewer_token(token: str) -> str | None:
    return decode_token(token, "viewer") if token else None


def decode_token(token: str, expected: str) -> str | None:
    try:
        payload = jwt.decode(token, _secret(), algorithms=[JWT_ALG])
    except jwt.InvalidTokenError:
        return None
    return payload["sub"] if payload.get("type") == expected else None


async def _user_from_session(token: str) -> str | None:
    sess = await db.user_sessions.find_one({"session_token": token}, NO_ID)
    if not sess:
        return None
    exp = sess["expires_at"]
    if isinstance(exp, str):
        exp = datetime.fromisoformat(exp)
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    return sess["user_id"] if exp > now() else None


async def get_current_user(request: Request) -> dict:
    user_id = None
    access = request.cookies.get("access_token")
    if access:
        user_id = decode_token(access, "access")
    if not user_id and request.cookies.get("session_token"):
        user_id = await _user_from_session(request.cookies["session_token"])
    auth = request.headers.get("Authorization", "")
    if not user_id and auth.startswith("Bearer "):
        token = auth[7:]
        user_id = decode_token(token, "access") or await _user_from_session(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user
