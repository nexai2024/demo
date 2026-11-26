# Auth profiles & signed-in sessions

This document is the architecture guide for how AppShowcase signs into a **customer product** during Live browser and Record demo. It is separate from **Clerk** (how you sign into AppShowcase itself).

## Two different “logins”

| Layer | What it is | Where it lives |
| --- | --- | --- |
| AppShowcase account | Clerk JWT → `Authorization: Bearer` on `/api/*` | Frontend Clerk session; backend `clerk_service` / `get_current_user` |
| Target-app auth profile | Password and/or Playwright `storage_state` for the product under demo | Encrypted on the project as `login` via `vault.py` |

Record demo and Live never receive the target password over a share link. Public/share routes strip secrets.

## Prefer cookies over password typing

There are **two** ways to authenticate the cloud browser into the customer app. Prefer (1).

### 1. Signed-in browser session (`storage_state`) — recommended

1. Open **Live browser** in the studio.
2. Sign in manually in the live pane (or navigate past SSO if the product allows).
3. Click **Save signed-in session** *or* **Start demo from here**.

What happens:

- `POST /api/projects/{id}/live/save-session` exports Playwright `context.storage_state()` (cookies + localStorage origins).
- The blob is AES-GCM sealed with `VAULT_MASTER_KEY` under context `{pid}:login.storage_state`.
- `storage_saved_at` is set. Default TTL: **`STORAGE_STATE_TTL_HOURS=12`**.
- Later Record / Live / health runs call `vault.open_login`. If the state is still fresh, the engine opens Chromium **with that storage_state** and **skips** `_sign_in`.

**Start demo from here** also:

- Saves the same `storage_state`.
- Replaces / inserts the opening `goto` with the live page URL so the demo starts mid-app instead of on the marketing landing page.

UI signals:

- Live pane badge: “Session ready for Record demo”.
- Draft → Login setup chips: “Signed-in browser saved”.
- `project.has_storage === true` on `GET /projects/{id}`.
- Expired → `storage_expired === true`; re-open Live and save again.

Clear with Studio Extras → **Clear browser** (`DELETE /projects/{id}/auth-profile`).

### 2. Vaulted username / password — fallback

1. Draft → **Login, environments, and variables**.
2. Fill **Login page URL**, **Username**, **Password**.
3. Wait for autosave (or blur / edit something so dirty save runs). The password field should clear and show **Password saved — type to replace**, plus a **Password vaulted** chip.

What happens:

- Autosave `PUT /projects/{id}` with `login_password` (only when the field is non-empty).
- Server sets `login.password` (sealed) and **`credentials_saved_at`**.
- Default TTL: **`CREDENTIAL_TTL_DAYS=30`**.
- GET never returns the plaintext password. Flags: `has_login`, `credential_expired`.

At Record time, if there is **no** usable `storage_state`, `engine._sign_in` opens the login URL, fills email/password heuristics, and submits. Custom UIs may need a **login recipe** instead.

If `credentials_saved_at` is missing or past TTL, `open_login` **drops** the password (`credential_expired`). Type the password again and let autosave run.

## How Record chooses auth

```
open_login(project.login)
       │
       ├─ fresh storage_state? ──► new_context(storage_state=…) ──► skip _sign_in
       │
       └─ else ──► _sign_in(page, login) using url/username/password or recipe
```

Live start uses the same rule (`live_start` passes `storage_state` when present and suppresses login).

## Password save checklist (if it “doesn’t work”)

| Check | Expected |
| --- | --- |
| You typed a password and waited ~1.2s for autosave | Save indicator → **Saved** |
| Password field after save | Empty, placeholder **Password saved — type to replace** |
| Status chip | **Password vaulted** |
| `GET /api/projects/{id}` | `has_login: true`, `credential_expired: false` |
| Record still asks for login | Prefer Save signed-in session; or login URL/selectors don’t match `_sign_in` heuristics — use a login recipe |
| Worked yesterday, fails today | Password TTL (30d) or storage TTL (12h) expired — chips say so |

Common confusion: typing the password alone does **not** capture SSO cookies or MFA. For those, use Live → **Save signed-in session**.

## Encryption & TTLs

| Secret | Seal context | Timestamp | Env TTL |
| --- | --- | --- | --- |
| `login.password` | `{pid}:login.password` | `credentials_saved_at` | `CREDENTIAL_TTL_DAYS` (30) |
| `login.storage_state` | `{pid}:login.storage_state` | `storage_saved_at` | `STORAGE_STATE_TTL_HOURS` (12) |
| Sensitive step text | `{pid}:step:{id}:text` | n/a | until cleared |
| Login recipe type text | `{pid}:login.recipe.{i}` | tied to credentials stamp when recipe saved | same credential policy |

Implementation: `backend/vault.py` (`seal_login`, `open_login`, `login_flags`). Owner GET uses `owner_login_view` (no password / no storage blob).

## Live session renew (why the pane jumped to landing)

Browserless drops long CDP sessions. About every **`LIVE_RENEW_SECONDS`** (default 95, clamped 20–110), `live.py` reconnects.

**Previously:** renew always `_replay`’d from `start_url` + captured steps → felt like a random jump back to the product landing page.

**Now:** renew snapshots cookies + **current URL**, reconnects with that `storage_state`, and `goto`s the same URL. Full replay is only the fallback.

While renewing, the address line shows **Continuing this session…**.

## Live typing latency

Each printable key used to be its own `POST /live/type` (serialized behind a lock, competing with JPEG frame polls). That felt painfully slow.

`LivePane` now **batches ~100ms of keystrokes** into one type request (same pattern as scroll coalescing), skips the pending spinner for type, and slows frame polling slightly while a type buffer is open.

## Key routes

| Method | Path | Role |
| --- | --- | --- |
| PUT | `/projects/{id}` | Save login URL/user/password / recipe |
| POST | `/projects/{id}/live/start` | Open live; reuse storage when present |
| POST | `/projects/{id}/live/save-session` | Persist cookies from open live |
| POST | `/projects/{id}/live/start-from-here` | Persist cookies + set opening goto |
| DELETE | `/projects/{id}/auth-profile` | Clear stored browser state |
| GET | `/projects/{id}` | Returns `has_login`, `has_storage`, `*_expired` flags only |

## Related code

- `backend/vault.py` — seal/open/TTL
- `backend/engine.py` — `_sign_in`, `storage_state` on record
- `backend/live.py` — live session, renew, export_storage
- `backend/server.py` — project update + live routes
- `frontend/src/components/LivePane.jsx` — Save / Start from here / typed input
- `frontend/src/components/StudioParts.jsx` — password field + status chips
- `frontend/src/pages/Studio.jsx` — autosave clears typed password after vault write

## Operator env

```bash
VAULT_MASTER_KEY=…              # required to seal secrets
VAULT_MASTER_KEY_PREVIOUS=…     # optional rotation
CREDENTIAL_TTL_DAYS=30
STORAGE_STATE_TTL_HOURS=12
LIVE_RENEW_SECONDS=95
```

See also `docs/PRODUCTION.md` §2 and Help → Login / Live browser sections in `docs/KNOWLEDGE.md`.
