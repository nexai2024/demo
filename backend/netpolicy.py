"""One outbound-destination policy for every path that reaches a customer-supplied URL.

Used by:
  * API webhooks and run notifications (``post_json``)
  * the release watcher (``fetch``)
  * save-time validation of customer-configured URLs (``validate_url_sync``)
  * the browser provider: a request guard installed on every Playwright context (``install_browser_guard``)

Connection-layer enforcement: ``request`` resolves the host once, rejects the call if ANY answer is a
protected address, then connects to the validated IP itself (SNI and ``Host`` keep the original name), so a
second DNS lookup can never swap in an internal address (DNS rebinding). Redirects are never followed.
"""
import asyncio
import ipaddress
import logging
import os
import socket
import time
from dataclasses import dataclass
from urllib.parse import urlsplit, urlunsplit

import httpx

logger = logging.getLogger(__name__)


class DestinationBlocked(ValueError):
    """The destination is not a permitted public address."""


DEFAULT_PORTS = {80, 443, 8080, 8443}
BLOCKED_HOSTS = {"localhost", "metadata", "metadata.google.internal", "instance-data", "kubernetes", "kubernetes.default"}
BLOCKED_SUFFIXES = (".local", ".localhost", ".internal", ".lan", ".home.arpa", ".corp", ".intranet", ".svc", ".cluster.local")
BLOCKED_NETWORKS = [ipaddress.ip_network(n) for n in (
    "0.0.0.0/8", "10.0.0.0/8", "100.64.0.0/10", "127.0.0.0/8", "169.254.0.0/16", "172.16.0.0/12",
    "192.0.0.0/24", "192.0.2.0/24", "192.88.99.0/24", "192.168.0.0/16", "198.18.0.0/15", "198.51.100.0/24",
    "203.0.113.0/24", "224.0.0.0/4", "240.0.0.0/4",
    "::/128", "::1/128", "::ffff:0:0/96", "64:ff9b::/96", "64:ff9b:1::/48", "100::/64", "2001::/32",
    "2001:db8::/32", "2002::/16", "fc00::/7", "fe80::/10", "ff00::/8",
)]
MAX_RESPONSE_BYTES = 1_000_000


def allowed_ports() -> set[int]:
    raw = os.environ.get("OUTBOUND_ALLOWED_PORTS", "")
    ports = {int(p) for p in raw.split(",") if p.strip().isdigit()}
    return ports or DEFAULT_PORTS


def ip_allowed(ip: ipaddress._BaseAddress) -> bool:
    if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped:
        ip = ip.ipv4_mapped
    if not ip.is_global:
        return False
    return not any(ip.version == net.version and ip in net for net in BLOCKED_NETWORKS)


def _resolve_sync(host: str, port: int) -> list[str]:
    infos = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
    return sorted({info[4][0] for info in infos})


_resolver = _resolve_sync  # tests may replace this to simulate DNS


def set_resolver(fn) -> None:
    global _resolver
    _resolver = fn or _resolve_sync


@dataclass
class Destination:
    url: str
    scheme: str
    host: str
    port: int
    ips: list[str]


def _parse(url: str):
    text = (url or "").strip()
    if not text or any(ch in text for ch in "\\\r\n\t ") or len(text) > 2000:
        raise DestinationBlocked("That address is not a valid URL")
    parts = urlsplit(text)
    if parts.scheme not in ("http", "https"):
        raise DestinationBlocked("Use an http or https URL")
    if parts.username or parts.password or "@" in parts.netloc:
        raise DestinationBlocked("URLs with embedded credentials are not allowed")
    host = (parts.hostname or "").rstrip(".").lower()
    if not host:
        raise DestinationBlocked("That address is not a valid URL")
    try:
        port = parts.port or (443 if parts.scheme == "https" else 80)
    except ValueError as exc:
        raise DestinationBlocked("That address has an invalid port") from exc
    if port not in allowed_ports():
        raise DestinationBlocked(f"Port {port} is not allowed")
    if host in BLOCKED_HOSTS or host.endswith(BLOCKED_SUFFIXES):
        raise DestinationBlocked("That address is not allowed")
    return text, parts, host, port


def _check_ips(host: str, ips: list[str]) -> list[str]:
    if not ips:
        raise DestinationBlocked("Could not resolve that host")
    for raw in ips:
        try:
            ip = ipaddress.ip_address(raw.split("%")[0])
        except ValueError as exc:
            raise DestinationBlocked("Could not resolve that host") from exc
        if not ip_allowed(ip):
            raise DestinationBlocked("That address is not allowed")
    return ips


def validate_url_sync(url: str) -> Destination:
    text, parts, host, port = _parse(url)
    try:
        ips = _resolver(host, port)
    except socket.gaierror as exc:
        raise DestinationBlocked("Could not resolve that host") from exc
    return Destination(text, parts.scheme, host, port, _check_ips(host, list(ips)))


async def validate_url(url: str) -> Destination:
    text, parts, host, port = _parse(url)
    try:
        ips = await asyncio.get_running_loop().run_in_executor(None, _resolver, host, port)
    except socket.gaierror as exc:
        raise DestinationBlocked("Could not resolve that host") from exc
    return Destination(text, parts.scheme, host, port, _check_ips(host, list(ips)))


@dataclass
class SafeResponse:
    status_code: int
    headers: dict
    content: bytes

    @property
    def text(self) -> str:
        return self.content.decode("utf-8", errors="replace")


def _pinned(parts, ip: str) -> str:
    literal = f"[{ip}]" if ":" in ip else ip
    netloc = literal + (f":{parts.port}" if parts.port else "")
    return urlunsplit((parts.scheme, netloc, parts.path or "/", parts.query, ""))


async def request(method: str, url: str, *, json=None, headers: dict | None = None, timeout: float = 10,
                  max_bytes: int = MAX_RESPONSE_BYTES, transport=None) -> SafeResponse:
    """Send one request to a validated public destination. Never follows redirects."""
    dest = await validate_url(url)
    parts = urlsplit(dest.url)
    host_header = dest.host + (f":{parts.port}" if parts.port else "")
    last: Exception | None = None
    for ip in dest.ips[:3]:
        try:
            async with httpx.AsyncClient(timeout=timeout, follow_redirects=False, transport=transport, trust_env=False) as client:
                async with client.stream(method, _pinned(parts, ip), json=json,
                                         headers={**(headers or {}), "Host": host_header},
                                         extensions={"sni_hostname": dest.host}) as response:
                    body = bytearray()
                    async for chunk in response.aiter_bytes():
                        body.extend(chunk)
                        if len(body) >= max_bytes:
                            break
                    return SafeResponse(response.status_code, dict(response.headers), bytes(body[:max_bytes]))
        except httpx.ConnectError as exc:
            last = exc
            continue
    raise last or httpx.ConnectError("could not connect")


async def post_json(url: str, payload: dict, **kw) -> tuple[bool, int, str]:
    """Webhook delivery. Returns (ok, status, error) and never raises."""
    try:
        response = await request("POST", url, json=payload, timeout=8, max_bytes=4096, **kw)
        return response.status_code < 400, response.status_code, ""
    except DestinationBlocked as exc:
        return False, 0, f"blocked: {exc}"
    except Exception as exc:
        return False, 0, str(exc)[:160]


async def fetch(url: str, **kw) -> SafeResponse:
    return await request("GET", url, timeout=12, **kw)


# ---------- browser provider ----------
SAFE_NON_HTTP = ("data:", "blob:", "about:")


class BrowserGuard:
    """Blocks every browser request (navigation, redirect hop, subresource, websocket) that leaves the
    public internet. The browser provider resolves names itself, so this is defence in depth on top of the
    provider's own egress isolation (see docs/PRODUCTION.md)."""

    def __init__(self, ttl: float = 30.0):
        self.ttl = ttl
        self.cache: dict[str, tuple[float, str | None]] = {}
        self.blocked: list[str] = []

    async def reason(self, url: str) -> str | None:
        if url.startswith(SAFE_NON_HTTP):
            return None
        try:
            _, parts, host, port = _parse(url)
        except DestinationBlocked as exc:
            return str(exc)
        key = f"{host}:{port}"
        hit = self.cache.get(key)
        if hit and time.monotonic() - hit[0] < self.ttl:
            return hit[1]
        try:
            await validate_url(url)
            result = None
        except DestinationBlocked as exc:
            result = str(exc)
        self.cache[key] = (time.monotonic(), result)
        return result

    async def handle_route(self, route) -> None:
        url = route.request.url
        reason = await self.reason(url)
        if reason:
            self.blocked.append(url[:200])
            logger.warning("browser request blocked (%s): %s", reason, url[:120])
            await route.abort("blockedbyclient")
            return
        await route.continue_()

    async def handle_ws(self, ws) -> None:
        reason = await self.reason(ws.url.replace("ws://", "http://", 1).replace("wss://", "https://", 1))
        if reason:
            self.blocked.append(ws.url[:200])
            await ws.close(code=1008, reason="blocked")
            return
        ws.connect_to_server()


async def install_browser_guard(context) -> BrowserGuard:
    guard = BrowserGuard()
    await context.route("**/*", guard.handle_route)
    try:
        await context.route_web_socket("**/*", guard.handle_ws)
    except Exception:  # older Playwright builds
        logger.info("route_web_socket unavailable; websocket egress relies on provider isolation")
    return guard
