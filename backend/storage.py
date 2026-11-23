"""Durable object storage for screenshots, audio, and rendered exports.

Backends (selected automatically):
  1. S3 / Cloudflare R2 / MinIO when ``S3_BUCKET`` is set (recommended for production).
  2. NoCodeBackend file storage when ``NCB_INSTANCE`` + ``NCB_SECRET_KEY`` are set and R2 is attached.
  3. Local filesystem (``backend/.data/objects``) ONLY in development (``APP_ENV != production``).

In production, silent fallback to local disk is forbidden: upload failures retry with exponential backoff
and then raise ``StorageError`` so callers and jobs surface the failure instead of saving broken paths.
"""
import asyncio
import logging
import os
import random
import time
from pathlib import Path

import httpx

logger = logging.getLogger(__name__)

APP_NAME = "appshowcase"
LOCAL_ROOT = Path(__file__).parent / ".data" / "objects"


class StorageError(RuntimeError):
    """Raised when durable object storage is unavailable or an upload/download fails."""


def _is_production() -> bool:
    return os.environ.get("APP_ENV", "development").strip().lower() in {"production", "prod"}


def _s3_config() -> dict | None:
    bucket = os.environ.get("S3_BUCKET", "").strip()
    if not bucket:
        return None
    return {
        "bucket": bucket,
        "endpoint": os.environ.get("S3_ENDPOINT_URL", "").strip() or None,
        "region": os.environ.get("AWS_REGION", "").strip() or "auto",
        "access_key": os.environ.get("AWS_ACCESS_KEY_ID", "").strip() or None,
        "secret_key": os.environ.get("AWS_SECRET_ACCESS_KEY", "").strip() or None,
        "prefix": os.environ.get("S3_PREFIX", "").strip().strip("/"),
    }


_S3_CLIENT = None


def _get_s3_client():
    global _S3_CLIENT
    conf = _s3_config()
    if not conf:
        return None
    if _S3_CLIENT is None:
        import boto3
        from botocore.config import Config
        kwargs = {
            "region_name": conf["region"],
            "config": Config(retries={"max_attempts": 3, "mode": "standard"}, connect_timeout=10, read_timeout=60),
        }
        if conf["endpoint"]:
            kwargs["endpoint_url"] = conf["endpoint"]
        if conf["access_key"] and conf["secret_key"]:
            kwargs["aws_access_key_id"] = conf["access_key"]
            kwargs["aws_secret_access_key"] = conf["secret_key"]
        _S3_CLIENT = boto3.client("s3", **kwargs)
    return _S3_CLIENT


def reset_client() -> None:
    """For tests and credential reloads."""
    global _S3_CLIENT
    _S3_CLIENT = None


def _s3_key(path: str) -> str:
    conf = _s3_config()
    prefix = conf["prefix"] if conf else ""
    clean = path.lstrip("/")
    return f"{prefix}/{clean}" if prefix else clean


def _ncb_configured() -> bool:
    return bool(os.environ.get("NCB_INSTANCE") and (os.environ.get("NCB_SECRET_KEY") or os.environ.get("NCB_API_KEY")))


def _allow_local_fallback() -> bool:
    if _is_production():
        return False
    return os.environ.get("ALLOW_LOCAL_STORAGE", "true").strip().lower() not in {"0", "false", "no"}


def config_problems() -> list[str]:
    """Return production configuration problems for object storage."""
    if _s3_config():
        return []
    if _ncb_configured() and os.environ.get("STORAGE_BACKEND", "").strip().lower() == "ncb":
        return []
    return ["STORAGE: S3_BUCKET is not set; durable shared object storage is required in production"]


def status() -> dict:
    s3 = _s3_config()
    if s3:
        try:
            _get_s3_client().head_bucket(Bucket=s3["bucket"])
            return {"mode": "s3", "bucket": s3["bucket"], "detail": f"Durable S3/R2 storage ({s3['bucket']})."}
        except Exception as exc:
            return {"mode": "error", "bucket": s3["bucket"], "detail": f"S3 bucket unreachable: {str(exc)[:140]}"}
    if _ncb_configured():
        try:
            from ncb import cfg
            conf = cfg()
            with httpx.Client(timeout=10) as client:
                response = client.get(
                    f"{conf['base']}/files",
                    params={"Instance": conf["instance"]},
                    headers={"Authorization": f"Bearer {conf['secret']}", "X-Database-Instance": conf["instance"]},
                )
            if "R2 Storage is not configured" not in response.text and response.status_code < 400:
                return {"mode": "remote", "detail": "Files are stored with NoCodeBackend R2."}
        except Exception:
            pass
    if _allow_local_fallback():
        return {"mode": "local", "detail": "Development local disk storage (not shared across replicas)."}
    return {"mode": "unconfigured", "detail": "Shared object storage is not configured."}


def init_storage(force: bool = False) -> str:
    del force
    s3 = _s3_config()
    if s3:
        try:
            _get_s3_client().head_bucket(Bucket=s3["bucket"])
            return f"s3://{s3['bucket']}"
        except Exception as exc:
            if _is_production():
                raise StorageError(f"Configured S3 bucket '{s3['bucket']}' is not accessible: {exc}") from exc
            logger.warning("S3 head_bucket failed in dev: %s", exc)
            return f"s3://{s3['bucket']}"
    if _is_production():
        if _ncb_configured() and os.environ.get("STORAGE_BACKEND", "").strip().lower() == "ncb":
            return os.environ["NCB_INSTANCE"]
        raise StorageError("Durable shared object storage (S3_BUCKET) is required when APP_ENV=production")
    LOCAL_ROOT.mkdir(parents=True, exist_ok=True)
    return str(LOCAL_ROOT)


def _guess_media(path: str) -> str:
    if path.endswith(".jpg") or path.endswith(".jpeg"):
        return "image/jpeg"
    if path.endswith(".webp"):
        return "image/webp"
    if path.endswith(".mp3"):
        return "audio/mpeg"
    if path.endswith(".mp4"):
        return "video/mp4"
    if path.endswith(".gif"):
        return "image/gif"
    return "application/octet-stream"


def _put_s3(path: str, data: bytes, content_type: str, attempts: int = 3) -> str:
    conf = _s3_config()
    client = _get_s3_client()
    key = _s3_key(path)
    last: Exception | None = None
    for attempt in range(attempts):
        try:
            client.put_object(Bucket=conf["bucket"], Key=key, Body=data, ContentType=content_type)
            return path
        except Exception as exc:
            last = exc
            if attempt < attempts - 1:
                time.sleep(min(4.0, 0.4 * (2 ** attempt)) * (0.75 + random.random() / 2))
    raise StorageError(f"Failed to upload '{path}' to S3 after {attempts} attempts: {last}") from last


def _get_s3(path: str) -> tuple[bytes, str]:
    conf = _s3_config()
    client = _get_s3_client()
    key = _s3_key(path)
    try:
        obj = client.get_object(Bucket=conf["bucket"], Key=key)
        body = obj["Body"].read()
        return body, obj.get("ContentType") or _guess_media(path)
    except Exception as exc:
        code = getattr(exc, "response", {}).get("Error", {}).get("Code", "")
        if code in {"NoSuchKey", "404", "NotFound"}:
            raise FileNotFoundError(path) from exc
        raise StorageError(f"Failed to read '{path}' from S3: {exc}") from exc


def _put_ncb(path: str, data: bytes, content_type: str, attempts: int = 3) -> str:
    from ncb import cfg
    conf = cfg()
    name = path.rsplit("/", 1)[-1]
    last: Exception | None = None
    for attempt in range(attempts):
        try:
            with httpx.Client(timeout=120) as client:
                response = client.post(
                    f"{conf['base']}/files",
                    params={"Instance": conf["instance"], "path": path},
                    headers={"Authorization": f"Bearer {conf['secret']}", "X-Database-Instance": conf["instance"]},
                    files={"file": (name, data, content_type)},
                )
            raw = response.json() if response.content else {}
            if response.status_code < 400 and raw.get("status") != "failed" and "R2 Storage is not configured" not in response.text:
                payload = raw.get("data") if isinstance(raw.get("data"), dict) else raw
                return str(payload.get("url") or payload.get("path") or payload.get("key") or path)
            last = StorageError(f"Remote storage rejected upload ({response.status_code}): {response.text[:160]}")
            if response.status_code == 404 or "R2 Storage is not configured" in response.text:
                break  # misconfigured backend: retrying cannot fix it
        except Exception as exc:
            last = exc
        if attempt < attempts - 1:
            time.sleep(min(4.0, 0.4 * (2 ** attempt)))
    raise StorageError(f"Remote upload failed for '{path}': {last}") from last


def _put(path: str, data: bytes, content_type: str) -> str:
    if _s3_config():
        return _put_s3(path, data, content_type)
    if _allow_local_fallback():
        # Dev: local disk IS the store. Trying the remote first made every
        # file pay several failed uploads (plus backoff) before landing here.
        target = LOCAL_ROOT / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        return path
    if _ncb_configured():
        return _put_ncb(path, data, content_type)
    raise StorageError("Shared object storage is required in production (set S3_BUCKET)")


def _get(path: str) -> tuple[bytes, str]:
    if _s3_config():
        return _get_s3(path)
    if path.startswith(("http://", "https://")):
        with httpx.Client(timeout=60) as client:
            response = client.get(path)
        response.raise_for_status()
        return response.content, response.headers.get("content-type", _guess_media(path))
    if _allow_local_fallback():
        local = LOCAL_ROOT / path
        if local.exists():
            return local.read_bytes(), _guess_media(path)
    if _ncb_configured():
        from ncb import cfg
        conf = cfg()
        try:
            with httpx.Client(timeout=60) as client:
                response = client.get(
                    f"{conf['base']}/files/{path}",
                    params={"Instance": conf["instance"]},
                    headers={"Authorization": f"Bearer {conf['secret']}", "X-Database-Instance": conf["instance"]},
                )
            if response.status_code < 400 and response.content and "R2 Storage is not configured" not in response.text:
                media = response.headers.get("content-type", _guess_media(path))
                if "application/json" not in media:
                    return response.content, media
        except Exception as exc:
            if not _allow_local_fallback():
                raise StorageError(f"Failed to read '{path}' from remote storage: {exc}") from exc
    if _allow_local_fallback():
        local = LOCAL_ROOT / path
        if local.exists():
            return local.read_bytes(), _guess_media(path)
    raise FileNotFoundError(path)


async def put_object(path: str, data: bytes, content_type: str) -> str:
    return await asyncio.to_thread(_put, path, data, content_type)


async def get_object(path: str) -> tuple[bytes, str]:
    return await asyncio.to_thread(_get, path)
