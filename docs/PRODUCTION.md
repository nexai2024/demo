# Production Operations & Release Verification

## 1. Outbound request isolation
- **API outbound client (`netpolicy.py`)**: All webhooks, run notifications, and release-watcher fetches resolve DNS once, reject private/loopback/link-local/metadata/non-global IPs and non-allowed ports, refuse redirects, and connect to the validated IP directly (preserving `Host` and TLS SNI) to prevent DNS rebinding.
- **Browser provider (`engine.py`, `live.py`)**: Every Playwright context installs `netpolicy.install_browser_guard`, aborting HTTP/HTTPS subresources, redirect hops, and WebSockets targeting protected networks.
- **Provider-level egress isolation (required in production)**: Run your Browserless/Chromium workers in an isolated egress VPC or firewall namespace that denies RFC 1918 (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), link-local/metadata (`169.254.0.0/16`), loopback, and internal cluster CIDRs at the network layer.

## 2. Managed signing keys & credential vault
- Provision `JWT_SECRET` and `VAULT_MASTER_KEY` as distinct 32+ byte random secrets from your secret manager (AWS Secrets Manager, GCP Secret Manager, Vault).
- **Zero-downtime rotation**: Set the new value in `JWT_SECRET` / `VAULT_MASTER_KEY` and place the retiring value in `JWT_SECRET_PREVIOUS` / `VAULT_MASTER_KEY_PREVIOUS` until existing tokens expire and records are re-sealed.
- Target passwords expire after `CREDENTIAL_TTL_DAYS` (default 30d); captured browser `storage_state` expires after `STORAGE_STATE_TTL_HOURS` (default 12h).

## 3. Share access & CDN caching
- Draft projects never appear on `/api/public/*`. Publishing creates an immutable snapshot (`published.release_id`) with all sensitive step text redacted.
- Public assets and motion frames return `Cache-Control: private, no-store` (for password-protected or expiring shares) or `Cache-Control: private, no-cache` (never `public`), plus `Vary: X-Viewer-Token`, so CDNs do not serve revoked or expired assets.

## 4. Durable jobs & multi-replica deployment
- Set `MONGO_URL` (required in production) so project leases, quota reservations, and terminal run transitions execute atomically.
- Set `EMBEDDED_WORKER=false` on API replicas and run dedicated worker replicas via `python worker.py`.
- Cancellation is persisted (`cancel_requested=true`) in MongoDB. Crashed workers' expired leases are reclaimed and resumed from per-step checkpoints without double-charging quotas or duplicating export artifacts.

## 5. Durable shared object storage & backup rehearsal
- Set `S3_BUCKET` (with `S3_ENDPOINT_URL` for Cloudflare R2/MinIO). Local disk fallback is disabled in production; upload failures retry and raise `503 storage_unavailable`.
- Enable bucket versioning and lifecycle rules, and schedule MongoDB + bucket restore rehearsals before launch.
