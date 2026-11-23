# AppShowcase production readiness report

November 22, 2026

## Decision

**Hold public launch.** AppShowcase covers the core journey from script and browser capture through narration, review, export, and public playback. The frontend builds. Public release depends on closing five launch blockers and proving the complete workflow on a production-like deployment.

## Verification

- The optimized frontend build compiled with installed dependencies. Gzip sizes were 110.61 kB for main JavaScript and 14.18 kB for main CSS. These are build outputs, not runtime performance measurements.
- Four backend helper tests passed when invoked directly: glossary substitution, publish diff, alternate narration, and identical-frame comparison. The configured pytest suite could not start because pytest is absent from the local virtualenv. The bundled FFmpeg binary responded to its version command.
- Read-only local HTTP probes returned 200 for the frontend root and API root, 401 for unauthenticated project listing, and 404 for the frontend help URL.
- Review covered the current working tree, including uncommitted changes, and the product knowledge base. Authenticated browser journeys, production configuration, third-party integrations, deployment recovery, accessibility conformance, and load were unverified.

## Release findings

P0 blocks a public release. P1 requires action or explicit acceptance before expanding a pilot.

### P0 · Constrain outbound requests

Customer-configured webhooks and notifications use the API’s outbound HTTP client. Browser automation opens user-configured destinations through a separate provider. The release watcher has a destination check, but controls differ across paths.

**Release check** · Apply a shared destination policy and enforce network isolation at the connection layer and in the browser provider. Confirm allowed public destinations still work and protected networks are unreachable.

[backend/server.py:300](/Users/solopreneursolutions/Documents/demo/backend/server.py:300) · [backend/server.py:1334](/Users/solopreneursolutions/Documents/demo/backend/server.py:1334) · [backend/studio_plus.py:231](/Users/solopreneursolutions/Documents/demo/backend/studio_plus.py:231) · [backend/engine.py:202](/Users/solopreneursolutions/Documents/demo/backend/engine.py:202)

### P0 · Protect signing keys and captured credentials

Viewer and review token signing has a built-in development fallback. Target passwords and captured browser state are written into project records. Production secret configuration and provider encryption were unverified.

**Release check** · Fail production startup without a strong managed signing key. Vault target credentials and browser state, enforce expiry, and verify credentials never enter history, logs, exports, or public payloads.

[backend/core.py:42](/Users/solopreneursolutions/Documents/demo/backend/core.py:42) · [backend/server.py:706](/Users/solopreneursolutions/Documents/demo/backend/server.py:706) · [backend/studio_plus.py:201](/Users/solopreneursolutions/Documents/demo/backend/studio_plus.py:201)

### P0 · Enforce share access on every asset

Public motion frames receive a shared-cache directive even after access checks. Publishing saves a snapshot, while public_view can fall back to current steps when a populated snapshot is absent.

**Release check** · Use private or no-store caching for restricted assets. Make published releases explicit and immutable. Verify drafts, revoked links, and expired or password-protected assets across direct URLs, embeds, and the CDN.

[backend/server.py:1103](/Users/solopreneursolutions/Documents/demo/backend/server.py:1103) · [backend/server.py:1413](/Users/solopreneursolutions/Documents/demo/backend/server.py:1413) · [backend/server.py:1548](/Users/solopreneursolutions/Documents/demo/backend/server.py:1548) · [backend/product.py:190](/Users/solopreneursolutions/Documents/demo/backend/product.py:190)

### P0 · Make jobs and cancellation durable

Runs are started in application tasks. Cancellation is process-local, job admission and reservation are separate, and startup marks running jobs failed. This makes restarts and multiple replicas unsafe for in-flight work.

**Release check** · Use durable job dispatch, atomic project leases and quotas, idempotent checkpoints, and persisted cancellation. Restart a worker during capture and export and confirm one terminal outcome with no duplicate charge or artifact.

[backend/server.py:278](/Users/solopreneursolutions/Documents/demo/backend/server.py:278) · [backend/server.py:332](/Users/solopreneursolutions/Documents/demo/backend/server.py:332) · [backend/server.py:1028](/Users/solopreneursolutions/Documents/demo/backend/server.py:1028) · [backend/server.py:1620](/Users/solopreneursolutions/Documents/demo/backend/server.py:1620)

### P0 · Require durable shared media storage

A failed remote upload can silently write to local disk. A successful recording or export can then reference media that exists on only one instance.

**Release check** · Require shared object storage in production. Make upload failure visible and retryable. Verify an asset created by one replica remains readable by another after a restart, and rehearse backup restoration.

[backend/storage.py:37](/Users/solopreneursolutions/Documents/demo/backend/storage.py:37) · [backend/storage.py:60](/Users/solopreneursolutions/Documents/demo/backend/storage.py:60)

### P1 · Prove write consistency and capacity

The data adapter patches whole documents after read and filter operations. It also caches reads per process and caps page scanning, which can affect concurrent edits, reporting completeness, and quota accounting.

**Release check** · Use atomic mutations or optimistic revisions, server-side pagination and aggregates, and indexed tenant-scoped queries. Verify parallel saves and analytics counts on representative data.

[backend/ncb_store.py:162](/Users/solopreneursolutions/Documents/demo/backend/ncb_store.py:162) · [backend/ncb_store.py:226](/Users/solopreneursolutions/Documents/demo/backend/ncb_store.py:226) · [backend/ncb_store.py:268](/Users/solopreneursolutions/Documents/demo/backend/ncb_store.py:268)

### P1 · Verify deep links and deployment contracts

The local frontend returned HTTP 200 at / and HTTP 404 at /help even though the SPA declares /help. The tested listener’s release identity and production routing are unverified.

**Release check** · Verify SPA rewrites and API routing with direct refreshes on help, studio, share, review, product hub, and embed URLs. Add a release identifier, deployment smoke checks, and a rollback rehearsal.

[frontend/src/App.js:42](/Users/solopreneursolutions/Documents/demo/frontend/src/App.js:42) · [frontend/src/setupProxy.js](/Users/solopreneursolutions/Documents/demo/frontend/src/setupProxy.js)

### P1 · Bound render cost and instrument dependencies

Rendering reads media into memory and invokes FFmpeg subprocesses. The basic API probe establishes HTTP reachability. It gives no evidence of storage, browser, TTS, or render readiness.

**Release check** · Set worker concurrency, deadlines, upload limits, and bounded retries. Monitor queue age, run success, provider errors, spend, and media failures. Load-test long demos and concurrent exports with an agreed traffic model.

[backend/render.py:169](/Users/solopreneursolutions/Documents/demo/backend/render.py:169) · [backend/render.py:331](/Users/solopreneursolutions/Documents/demo/backend/render.py:331) · [backend/server.py:652](/Users/solopreneursolutions/Documents/demo/backend/server.py:652)

### P1 · Prove the author and viewer journeys

Four helper assertions passed directly. The configured pytest command could not start because pytest is missing from the local virtualenv. The API suite requires an explicitly configured test instance and can skip on login failure. Player chapter rows are click-driven.

**Release check** · Create a CI gate on disposable test data for auth isolation, generation, capture, export, and publish. Fail when the integration fixture cannot log in. Verify mobile layouts, keyboard navigation, captions, and screen-reader announcements.

[backend/tests/test_appshowcase_api.py:8](/Users/solopreneursolutions/Documents/demo/backend/tests/test_appshowcase_api.py:8) · [backend/pytest.ini](/Users/solopreneursolutions/Documents/demo/backend/pytest.ini) · [frontend/src/components/DemoPlayer.jsx:287](/Users/solopreneursolutions/Documents/demo/frontend/src/components/DemoPlayer.jsx:287)

## Release sequence

- **Contain launch risks** · API and platform owners close all P0 findings. Confirm secure credentials and share access, durable media, and one terminal result for jobs during restart and cancellation.
- **Prove the pilot** · QA and product run a clean staging journey: create a demo, generate or import steps, capture, recover a failed step, narrate, export, review, publish, and replay through both share and embed. Verify desktop and mobile, direct-route refreshes, and keyboard operation.
- **Establish operating limits** · Platform owners rehearse restore and rollback. Agree on pilot volume and run deadlines. Suggested initial targets are at least 95% successful supported-fixture runs and p95 first frame within 2 seconds on a defined mobile network profile. Baseline both before committing to them.
- **Prioritize the roadmap** · Start with first-run setup, chapter accessibility, run recovery, and player loading. Validate time to first publish and playback abandonment before investing in workspaces, CI integration, or other larger bets.

## Product roadmap

Success measures are proposed. Effort is relative and provisional. S is a focused change, M spans several surfaces, and L adds a substantial capability or integration.

### 20 enhancements to existing features

1. **Actionable library views** · Dashboard · Effort M. Add saved filters, sortable last-published/health columns, and bulk archive or refresh to the existing demo library. *Measure* · Time to triage a stale demo.
2. **Start with a proven workflow** · New demo · Effort S. Add goal-based starter recipes, sample briefs, and URL and setup checks before a first capture. *Measure* · First-session publish rate.
3. **Review AI changes before applying** · AI scripting · Effort M. Show a step-level diff with rationale, confidence, and accept or reject controls for regenerated steps. *Measure* · AI edits accepted without rework.
4. **Preview import coverage** · Playwright import · Effort M. Show source lines, accepted actions, skipped constructs, and an editable mapping before inserting steps. *Measure* · Imported steps needing manual repair.
5. **Validate environment switches** · Environment settings · Effort M. Preview resolved URLs and variables, flag missing values, and offer a dry-run on the selected host. *Measure* · Environment-related failed runs.
6. **Make session health visible** · Saved sign-in · Effort M. Show last verified time and a reconnect flow that preserves the script and checks the expected signed-in landing state. *Measure* · Recovery time after session expiry.
7. **Improve input-to-frame feedback** · Live browser · Effort M. Use adaptive image quality and frame rate, acknowledge pending inputs visually, and pause capture traffic in hidden tabs. *Measure* · p95 click-to-frame time.
8. **Edit provisional captured steps** · Capture clicks · Effort M. Offer an inline chronological list to rename, redact, discard, or merge captured actions before committing them. *Measure* · Cleanup time per captured step.
9. **Reorder and edit in batches** · Step editor · Effort M. Add accessible reordering, range selection, and bulk timing or visibility edits with undo. *Measure* · Time to edit a 20-step script.
10. **Explain selector instability** · Selector preflight · Effort M. Show match count, locator source, and the proposed fallback side by side. Let authors apply an individual repair after reviewing it. *Measure* · Preflight-to-successful-record rate.
11. **Make retries predictable** · Failed-step recovery · Effort M. Show the replay point and affected steps before rerunning. Keep the last good frame and explain which media was reused. *Measure* · Paid browser minutes per recovery.
12. **Make run progress resumable in the UI** · Run console · Effort M. Restore active runs on reload, show phase-specific estimates, and link failure events to the affected control. *Measure* · Time from failure to next action.
13. **Preview and compare narration** · Voiceover · Effort M. Add inline sentence auditions, waveform timing, and clip-level regenerate controls that preserve untouched audio. *Measure* · Voice clips regenerated per edit.
14. **Show redaction in final outputs** · Annotations · Effort M. Preview blur regions side by side for desktop and mobile and show where an annotation appears in player and export. *Measure* · Missed redactions in QA.
15. **Make feedback actionable** · Review · Effort M. Anchor threads to step and revision, let authors resolve and reopen them, and show which approvals need renewal after edits. *Measure* · Review rounds per publish.
16. **Predict output before rendering** · Export · Effort M. Preview sample crops, estimate file size and render time, and flag missing clips or visual assets before starting. *Measure* · Exports repeated for format issues.
17. **Improve release preview and rollback** · Publish · Effort M. Preview the exact share and embed view, show changes across audio, media, and metadata, and restore an earlier published revision. *Measure* · Time to recover from a bad publish.
18. **Speed up first playback** · Player · Effort M. Prefetch the next step within a byte budget, use responsive image variants, and favor still frames on slow connections. *Measure* · p95 time to first frame.
19. **Improve chapter navigation** · Player · Effort S. Make chapters keyboard-operable, mark the active step, and add a searchable transcript that seeks to the matching step. *Measure* · Keyboard completion rate.
20. **Explain where viewers drop off** · Analytics · Effort M. Add date ranges, channel and device filters, and per-step dwell and exit rates with sample sizes. *Measure* · Time to identify a drop-off.

### 10 new features

1. **Shared team workspaces** · Workspaces · Effort L. Give teams a shared demo library, brand assets, and owner/editor/publisher roles with an activity log. *Measure* · Teams with multiple active authors.
2. **Localized release management** · Localization · Effort L. Manage language-specific captions, narration and review status from a single release, with locale fallback and translation memory. *Measure* · Published locales per demo.
3. **Branching viewer journeys** · Interactive demos · Effort L. Let viewers choose a role or goal and follow a dedicated path with branch-level measurement. *Measure* · Completion by viewer path.
4. **CRM-connected lead capture** · Distribution · Effort L. Collect consented interest from an optional player form and map demo engagement to CRM contacts and campaigns. *Measure* · Qualified leads per published demo.
5. **In-product contextual tours** · Distribution · Effort L. Ship an SDK that launches the relevant demo from a product surface based on route or lifecycle event. *Measure* · In-product tour activation.
6. **Release-pipeline integration** · Developer workflow · Effort M. Provide a GitHub or CI integration that proposes demo updates from a release and returns a status check with review links. *Measure* · Release-to-demo lead time.
7. **Docs publishing connectors** · Documentation · Effort M. Publish a demo, transcript, and chosen screenshots into a help center and update the linked article on approved releases. *Measure* · Documentation updates per release.
8. **Audience experiments** · Insights · Effort L. Randomly assign viewers to authored variants, persist assignment, and compare agreed outcomes with sample-size guidance. *Measure* · Experiments reaching a decision.
9. **Desktop and mobile screen capture** · Authoring · Effort L. Import screen recordings for native app flows and turn selected regions and timestamps into editable demo steps. *Measure* · Demos for native or non-browser flows.
10. **Multi-demo sales rooms** · Distribution · Effort L. Build prospect-specific pages with curated demos, notes, assets, and aggregate engagement for the account owner. *Measure* · Sales rooms with repeat engagement.
