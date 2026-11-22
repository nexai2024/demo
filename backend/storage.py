import asyncio
import os
from pathlib import Path

import httpx

from ncb import cfg

APP_NAME = "flowcast"
LOCAL_ROOT = Path(__file__).parent / ".data" / "objects"


def status() -> dict:
    conf = cfg()
    try:
        with httpx.Client(timeout=15) as client:
            response = client.get(
                f"{conf['base']}/files",
                params={"Instance": conf["instance"]},
                headers={"Authorization": f"Bearer {conf['secret']}", "X-Database-Instance": conf["instance"]},
            )
        if "R2 Storage is not configured" in response.text:
            return {"mode": "local", "detail": "Cloudflare R2 is not connected on this NoCodeBackend database, so screenshots and video stay on this machine."}
        if response.status_code < 400:
            return {"mode": "remote", "detail": "Files are stored with NoCodeBackend."}
    except Exception:
        pass
    return {"mode": "local", "detail": "File storage is unavailable, so screenshots and video stay on this machine."}


def init_storage(force: bool = False) -> str:
    del force
    conf = cfg()
    return conf["instance"]


def _put(path: str, data: bytes, content_type: str) -> str:
    conf = cfg()
    name = path.rsplit("/", 1)[-1]
    try:
        with httpx.Client(timeout=120) as client:
            response = client.post(
                f"{conf['base']}/files",
                params={"Instance": conf["instance"], "path": path},
                headers={"Authorization": f"Bearer {conf['secret']}", "X-Database-Instance": conf["instance"]},
                files={"file": (name, data, content_type)},
            )
        raw = response.json() if response.content else {}
        if response.status_code < 400 and raw.get("status") != "failed":
            payload = raw.get("data") if isinstance(raw.get("data"), dict) else raw
            return str(payload.get("url") or payload.get("path") or payload.get("key") or path)
    except Exception:
        pass
    target = LOCAL_ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    return path


def _get(path: str) -> tuple[bytes, str]:
    if path.startswith("http://") or path.startswith("https://"):
        with httpx.Client(timeout=60) as client:
            response = client.get(path)
        response.raise_for_status()
        return response.content, response.headers.get("content-type", "application/octet-stream")
    conf = cfg()
    with httpx.Client(timeout=60) as client:
        response = client.get(
            f"{conf['base']}/files/{path}",
            params={"Instance": conf["instance"]},
            headers={"Authorization": f"Bearer {conf['secret']}", "X-Database-Instance": conf["instance"]},
        )
    if response.status_code < 400 and response.content and "R2 Storage is not configured" not in response.text:
        media = response.headers.get("content-type", "application/octet-stream")
        if "application/json" not in media:
            return response.content, media
    local = LOCAL_ROOT / path
    if local.exists():
        kind = "image/jpeg" if path.endswith(".jpg") else "image/webp" if path.endswith(".webp") else "audio/mpeg" if path.endswith(".mp3") else "application/octet-stream"
        return local.read_bytes(), kind
    raise FileNotFoundError(path)


async def put_object(path: str, data: bytes, content_type: str) -> str:
    return await asyncio.to_thread(_put, path, data, content_type)


async def get_object(path: str) -> tuple[bytes, str]:
    return await asyncio.to_thread(_get, path)
