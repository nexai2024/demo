# Flowcast — AI Product Demo Builder (PRD)

## Original problem statement
Build an AI Product Demo Builder that generates interactive/video product walkthroughs from a text draft, release notes or feature spec using Browserless. The AI turns drafts into browser actions (goto/click/type/scroll/hover/wait) with captions or AI voiceover. Browserless runs the actions and captures screenshots, with live progress ("Step 3/6: Navigating to settings..."). Studio timeline editor: edit steps, captions and voiceover, transition speeds, and re-record steps. Exports: GIF, MP4, embeddable interactive player. Project management: save, duplicate, history, share links. Robust error handling, secure key management.
Follow-up request: a 30-item modernization plan (15 enhancements + 15 new features), implemented right away. See /app/memory/MODERNIZATION_PLAN.md.

## User choices
Claude Sonnet 5.5 (Emergent LLM key) · real Browserless with the user's key · captions + AI voiceover (OpenAI TTS HD) · email/password (JWT) + Emergent Google sign-in.

## Architecture
- Backend FastAPI: core.py (db, JWT/session auth), auth_routes.py, server.py (projects, runs, SSE, public, analytics, settings), engine.py (Playwright `connect_over_cdp` to Browserless WS, retries + fallback selectors), ai.py (Claude script/rewrite/repair + TTS), render.py (Pillow frames, GIF, ffmpeg MP4 via imageio-ffmpeg), storage.py (Emergent object storage).
- Background jobs run with asyncio tasks; progress is stored in `runs` and streamed over SSE, with polling as fallback.
- Frontend React: lazy routes, Studio (Draft/Timeline/Export & share/Analytics tabs, player, run console, filmstrip, ⌘K palette, history sheet), Dashboard, Settings, Share/Embed player.

## Implemented (2026-06)
- Auth (JWT cookies + refresh, brute-force lockout, Google session exchange), admin seeding
- Projects CRUD, duplicate, soft-delete, history with snapshot restore (timeline edits are merged into one entry per 2 minutes)
- AI script generation grounded in live page elements, JSON repair retry
- Browserless recording with retries, fallback selectors, hotspots, thumbnails, cancel, re-record a single step
- Voiceover generation (only for changed text), GIF/MP4 export with fingerprint cache, brand kit, watermark
- Public share/embed player (hotspots, chapters, deep links, keyboard), viewer analytics
- AI rewrite/translate, Fix-with-AI selector repair, usage meter (100 recordings/month)
- 25 of the 30 plan items are done

## Blockers / notes
- Browserless key added and verified (plan max session timeout is 120 s). Recording, the backup selectors, re-record, GIF/MP4 export and the export cache are verified end to end.
- The Emergent LLM key budget is exceeded. AI generation, rewrite, repair and voiceover fail until the balance is topped up.

## Backlog
- P1: scheduled re-recording (cron), Slack/email notifications, password/expiring share links
- P2: team workspaces & comments, Stripe paid plans
