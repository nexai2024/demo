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


def _access_point_arn(value: str) -> str | None:
    """Return a bare Access Point ARN if ``value`` is one (optionally ``s3://``-prefixed)."""
    text = (value or "").strip()
    if text.startswith("s3://arn:"):
        text = text[len("s3://"):]
    if text.startswith("arn:aws:s3:") and ":accesspoint/" in text:
        return text
    return None


def _normalize_s3_binding(bucket: str, endpoint: str | None, region: str) -> tuple[str, str | None, str]:
    """Fix the common Access-Point-ARN-as-endpoint mistake.

    boto3 wants either:
      * ``S3_BUCKET=<bucket|alias|accesspoint-arn>`` and empty ``S3_ENDPOINT_URL`` for AWS, or
      * ``S3_ENDPOINT_URL=https://...`` for R2/MinIO.

    Putting ``s3://arn:aws:s3:region:acct:accesspoint/name`` in ``S3_ENDPOINT_URL``
    makes botocore raise "Custom endpoint ... was not a valid URI".
    """
    for candidate in (endpoint or "", bucket):
        arn = _access_point_arn(candidate)
        if not arn:
            continue
        parts = arn.split(":")
        # arn:aws:s3:REGION:ACCOUNT:accesspoint/NAME
        arn_region = parts[3] if len(parts) > 3 else ""
        if not region or region == "auto":
            region = arn_region or "us-east-1"
        if endpoint and _access_point_arn(endpoint):
            logger.warning(
                "S3_ENDPOINT_URL is an Access Point ARN; using it as S3_BUCKET and clearing the custom endpoint")
            endpoint = None
        bucket = arn
        break
    if endpoint and not endpoint.startswith(("http://", "https://")):
        raise StorageError(
            f"S3_ENDPOINT_URL must be an http(s) URL (R2/MinIO), not {endpoint!r}. "
            "For an AWS Access Point, put the ARN or *-s3alias name in S3_BUCKET and leave "
            "S3_ENDPOINT_URL empty.")
    return bucket, endpoint, region


def _s3_config() -> dict | None:
    bucket = os.environ.get("S3_BUCKET", "").strip()
    if not bucket:
        return None
    endpoint = os.environ.get("S3_ENDPOINT_URL", "").strip() or None
    # 'auto' is the R2 region and only valid with a custom endpoint; plain
    # AWS with no region configured means the default AWS region.
    region = os.environ.get("AWS_REGION", "").strip() or ("auto" if endpoint else "us-east-1")
    bucket, endpoint, region = _normalize_s3_binding(bucket, endpoint, region)
    return {
        "bucket": bucket,
        "endpoint": endpoint,
        "region": region,
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
    global _S3_CLIENT, _S3_DOWN_UNTIL
    _S3_CLIENT = None
    _S3_DOWN_UNTIL = 0.0


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
    raw_endpoint = os.environ.get("S3_ENDPOINT_URL", "").strip()
    if raw_endpoint and _access_point_arn(raw_endpoint):
        # Still report so operators clean up env vars even though we normalize at runtime.
        problems_pre = [
            "STORAGE: S3_ENDPOINT_URL looks like an Access Point ARN — move it to S3_BUCKET "
            "and clear S3_ENDPOINT_URL (http(s) only for R2/MinIO)"]
    else:
        problems_pre = []
    try:
        conf = _s3_config()
    except StorageError as exc:
        return problems_pre + [f"STORAGE: {exc}"]
    if conf:
        problems = list(problems_pre)
        if conf["region"] == "auto" and not conf["endpoint"]:
            # boto3 would build <bucket>.s3.auto.amazonaws.com, which
            # does not exist: 'auto' is only valid with an R2 endpoint.
            problems.append(
                "STORAGE: AWS_REGION=auto requires S3_ENDPOINT_URL "
                "(Cloudflare R2: https://<account-id>.r2.cloudflarestorage.com); "
                "for AWS S3 set AWS_REGION to the bucket's real region (e.g. us-east-1)")
        if conf["prefix"]:
            # Warning-grade (no STORAGE: prefix): storage still works,
            # keys just gain a redundant folder.
            problems.append(
                "Storage note: S3_PREFIX duplicates the folder already in object paths "
                f"('appshowcase/...' becomes '{conf['prefix']}/appshowcase/...'); clear S3_PREFIX")
        return problems
    if _ncb_configured() and os.environ.get("STORAGE_BACKEND", "").strip().lower() == "ncb":
        return problems_pre
    return problems_pre + ["STORAGE: S3_BUCKET is not set; durable shared object storage is required in production"]


def _s3_reachable(conf: dict) -> None:
    """Confirm the configured bucket/access point can store objects.

    Prefer ``HeadBucket``, but Access Point policies often allow Put/Get while
    denying ListBucket — in that case a tiny probe object is enough proof.
    """
    client = _get_s3_client()
    bucket = conf["bucket"]
    try:
        client.head_bucket(Bucket=bucket)
        return
    except Exception as head_exc:
        probe_key = _s3_key(f"appshowcase/_probe/init-{os.getpid()}.txt")
        try:
            client.put_object(Bucket=bucket, Key=probe_key, Body=b"ok", ContentType="text/plain")
            client.get_object(Bucket=bucket, Key=probe_key)
            try:
                client.delete_object(Bucket=bucket, Key=probe_key)
            except Exception:
                pass
            logger.info("S3 HeadBucket denied for %s; object probe succeeded", bucket)
            return
        except Exception as probe_exc:
            raise StorageError(
                f"Configured S3 bucket '{bucket}' is not accessible: {head_exc}. "
                f"Object probe also failed: {probe_exc}. "
                "Check AWS_ACCESS_KEY_ID permissions on this bucket/access point, "
                "or set S3_BUCKET to the plain bucket name (e.g. demo-app-dir) "
                "instead of an Access Point ARN.") from probe_exc


def status() -> dict:
    s3 = _s3_config()
    if s3:
        try:
            _s3_reachable(s3)
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


def probe() -> dict:
    """Live storage diagnostic for the Settings page.

    Tries the CONFIGURED backend directly (no dev fallback) so a broken
    S3/R2/NCB config shows its real error, then the app-effective put/get
    round-trip to show what uploads actually experience.
    """
    import uuid

    conf = _s3_config()
    configured = "s3" if conf else ("ncb" if _ncb_configured() else "local")
    result = {
        "configured": configured,
        "bucket": conf["bucket"] if conf else None,
        "endpoint": conf["endpoint"] if conf else None,
        "region": conf["region"] if conf else None,
        "prefix": conf["prefix"] if conf else "",
        "ok": False,
        "served_by": None,
        "fallback_used": False,
        "latency_ms": None,
        "error": None,
        "problems": config_problems(),
    }
    payload = f"appshowcase storage probe {uuid.uuid4().hex[:8]}".encode()
    path = f"appshowcase/_probe/{uuid.uuid4().hex}.txt"

    direct_error = None
    if configured == "s3":
        try:
            _put_s3(path, payload, "text/plain")
            data, _ = _get_s3(path)
            if data != payload:
                raise StorageError("Round-trip mismatch: read back different bytes")
        except Exception as exc:
            direct_error = f"{type(exc).__name__}: {str(exc)[:280]}"
    elif configured == "ncb":
        try:
            _put_ncb(path, payload, "text/plain")
        except Exception as exc:
            direct_error = f"{type(exc).__name__}: {str(exc)[:280]}"

    started = time.monotonic()
    try:
        stored_path = _put(path, payload, "text/plain")
        data, _ = _get(stored_path)
        if data != payload:
            raise StorageError("Round-trip mismatch: read back different bytes")
        result["ok"] = True
        result["served_by"] = configured if direct_error is None else "local"
        result["fallback_used"] = direct_error is not None and result["served_by"] == "local"
        _probe_cleanup(stored_path, result["served_by"])
    except Exception as exc:
        result["error"] = f"{type(exc).__name__}: {str(exc)[:280]}"
    result["latency_ms"] = round((time.monotonic() - started) * 1000)
    if direct_error:
        # Surface the remote failure even when the dev fallback saved us.
        result["error"] = direct_error
    return result


def _probe_cleanup(path: str, served_by: str | None) -> None:
    try:
        if served_by == "s3":
            conf = _s3_config()
            if conf:
                _get_s3_client().delete_object(Bucket=conf["bucket"], Key=_s3_key(path))
        elif served_by == "local":
            (LOCAL_ROOT / path).unlink(missing_ok=True)
    except Exception:
        pass


def init_storage(force: bool = False) -> str:
    del force
    s3 = _s3_config()
    if s3:
        try:
            _s3_reachable(s3)
            return f"s3://{s3['bucket']}"
        except Exception as exc:
            if _is_production():
                if isinstance(exc, StorageError):
                    raise
                raise StorageError(f"Configured S3 bucket '{s3['bucket']}' is not accessible: {exc}") from exc
            logger.warning("S3 reachability check failed in dev: %s", exc)
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
            try:
                raw = response.json() if response.content else {}
            except ValueError:
                raw = {}
            if response.status_code < 400 and raw.get("status") != "failed" and "R2 Storage is not configured" not in response.text:
                payload = raw.get("data") if isinstance(raw.get("data"), dict) else raw
                return str(payload.get("url") or payload.get("path") or payload.get("key") or path)
            last = StorageError(f"Remote storage rejected upload ({response.status_code}): {response.text[:160]}")
            if response.status_code >= 400 or not raw:
                # A healthy files API answers with JSON; a 4xx or a
                # non-JSON body means the backend is misconfigured
                # (e.g. no R2 bucket) and retrying cannot fix it.
                break
        except Exception as exc:
            last = exc
        if attempt < attempts - 1:
            time.sleep(min(4.0, 0.4 * (2 ** attempt)))
    raise StorageError(f"Remote upload failed for '{path}': {last}") from last


_S3_DOWN_UNTIL = 0.0


def _trip_s3_breaker() -> None:
    """In dev, one failed S3 op parks the bucket for 5 minutes so every
    file doesn't pay connect retries before falling back to local disk."""
    global _S3_DOWN_UNTIL
    _S3_DOWN_UNTIL = time.monotonic() + 300


def _put(path: str, data: bytes, content_type: str) -> str:
    if _s3_config() and time.monotonic() >= _S3_DOWN_UNTIL:
        try:
            return _put_s3(path, data, content_type)
        except StorageError:
            if not _allow_local_fallback():
                raise
            # Dev must keep working while an S3/R2 config is being set up;
            # production still fails loudly. /api/ready keeps reporting
            # the broken bucket, so this never masks it silently.
            _trip_s3_breaker()
            logger.warning("S3 upload failed in dev; falling back to local disk for %s", path)
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
    if _s3_config() and time.monotonic() >= _S3_DOWN_UNTIL:
        try:
            return _get_s3(path)
        except (StorageError, FileNotFoundError):
            if not _allow_local_fallback():
                raise
            _trip_s3_breaker()
            logger.warning("S3 read failed in dev; trying local disk for %s", path)
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
