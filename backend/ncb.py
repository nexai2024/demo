import os
from pathlib import Path

import httpx
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

# Flowcast rows live in the existing demo_projects table, marked tenant_id=flowcast.
# This database has no API for creating tables, and that tenant is not used by the other app.
TABLE = "demo_projects"
TENANT = "flowcast"


def cfg() -> dict:
    instance = os.environ.get("NCB_INSTANCE", "")
    secret = os.environ.get("NCB_SECRET_KEY") or os.environ.get("NCB_API_KEY") or ""
    if not instance or not secret:
        raise RuntimeError("Set NCB_INSTANCE and NCB_SECRET_KEY in backend/.env")
    return {
        "base": (os.environ.get("NCB_BASE_URL") or "https://api.nocodebackend.com").rstrip("/"),
        "auth": (os.environ.get("NCB_AUTH_API_URL") or "https://app.nocodebackend.com/api/user-auth").rstrip("/"),
        "instance": instance,
        "secret": secret,
    }


def _headers() -> dict:
    conf = cfg()
    return {
        "Authorization": f"Bearer {conf['secret']}",
        "Content-Type": "application/json",
        "X-Database-Instance": conf["instance"],
    }


async def ncb(op: str, table: str, *, record_id: str | int | None = None, body=None, params: dict | None = None) -> dict:
    conf = cfg()
    # Search moved to GET /read/:table. Filters travel as query parameters.
    route = "read" if op == "search" else op
    path = f"/{route}/{table}" if record_id in (None, "") else f"/{route}/{table}/{record_id}"
    query = {"Instance": conf["instance"], **(params or {})}
    if op == "search" and isinstance(body, dict):
        query.update({key: value for key, value in body.items() if value not in (None, "")})
        body = None
    method = {"read": "GET", "create": "POST", "search": "GET", "update": "PUT", "delete": "DELETE"}[op]
    async with httpx.AsyncClient(timeout=40) as client:
        response = await client.request(method, conf["base"] + path, params=query, headers=_headers(),
                                        json=body if method in {"POST", "PUT"} else None)
    raw = response.json() if response.content else {}
    failed = response.status_code >= 400 or raw.get("status") == "failed" or raw.get("success") is False
    if failed:
        message = raw.get("error") or raw.get("message") or f"NoCodeBackend HTTP {response.status_code}"
        raise RuntimeError(str(message)[:300])
    data = raw.get("data", raw)
    meta = raw.get("metadata") or {}
    page = int((params or {}).get("page") or raw.get("page") or meta.get("page") or 1)
    limit = int((params or {}).get("limit") or raw.get("limit") or meta.get("limit") or 0)
    count = raw.get("count")
    has_more = bool(meta.get("hasMore"))
    if isinstance(count, int) and limit:
        has_more = has_more or page * limit < count
    return {"data": data, "has_more": has_more, "raw": raw}


async def auth_call(path: str, request_headers: dict, body: dict | None = None) -> httpx.Response:
    conf = cfg()
    headers = {
        "Authorization": f"Bearer {conf['secret']}",
        "X-Database-Instance": conf["instance"],
        "Content-Type": "application/json",
        "Cookie": request_headers.get("cookie", ""),
    }
    for name in ("origin", "referer", "user-agent"):
        if request_headers.get(name):
            headers[name.title() if name != "user-agent" else "User-Agent"] = request_headers[name]
    if "Origin" not in headers:
        headers["Origin"] = request_headers.get("origin") or "http://localhost:3001"
    async with httpx.AsyncClient(timeout=30) as client:
        return await client.post(f"{conf['auth']}/{path.lstrip('/')}", headers=headers, json=body or {})


async def auth_session(request_headers: dict) -> dict | None:
    conf = cfg()
    headers = {
        "Authorization": f"Bearer {conf['secret']}",
        "X-Database-Instance": conf["instance"],
        "Cookie": request_headers.get("cookie", ""),
        "Origin": request_headers.get("origin") or "http://localhost:3001",
    }
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.get(f"{conf['auth']}/get-session", headers=headers)
    if response.status_code >= 400:
        return None
    data = response.json() if response.content else None
    if not isinstance(data, dict):
        return None
    user = data.get("user") or (data.get("session") or {}).get("user") or (data.get("data") or {}).get("user")
    if not isinstance(user, dict) or not user.get("id") or not user.get("email"):
        return None
    return user
