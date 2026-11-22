# AppShowcase knowledge base

This is the support and developer guide for AppShowcase. The same file is served in the app at `/help`. A `?` beside a control opens the matching section. The address is `/help#<topic-id>`.

Each topic id is stable. Use it in a button, a support reply, or a code comment. The control index maps the on-screen label and the `data-testid` to that id.

## Start here: clicks and typed text {#capture-clicks}

Use this when you want the app to build a demo from the live product, including text that gets typed into a field.

AppShowcase does not record the keys you press on your own keyboard. **Capture clicks** opens the target site in Browserless, lists the links, buttons, and fields it can see, and turns each one you pick into a step. Typed text is a separate **Type** step. During Record, the cloud browser types that text for you.

### Open Capture clicks

1. Sign in and open **Settings**. Browserless must say **Connected**. If it says Not configured, the API process was started before the key was saved. Restart the API and reload Settings.
2. Open **Projects** and open a demo, or create one.
3. Stay on the **Draft** tab. The control is not on Timeline, Export, or Analytics.
4. Set **Target app URL** to the page you want to click. It must start with `http://` or `https://`. Use the product URL itself. A Google search URL is stopped by Google’s unusual-traffic page.
5. Click **Capture clicks**. The button stays disabled until Browserless is connected. The `?` immediately to its right opens this section. This first scan lists the target URL only.
6. Wait for the toast and the chips under **Click an element to add the next step**. The studio moves to **Timeline** and leaves the chips there.
7. Click a chip. AppShowcase appends a step and keeps the chips on screen, so you can add another element from the same page. A field becomes a Type step. Anything else becomes a Click step. Undo with ⌘Z (Ctrl+Z on Windows).
8. On that new step, click **Capture next**. AppShowcase replays the script through that step, then lists the elements on the page it opened. The **Capture clicks** button on the Timeline toolbar does the same after the last step.

The chip list is the page Browserless loaded, not a live mirror of your mouse. Picking a chip does not click the element yet. **Record demo** performs the steps.

### Put keystrokes into the demo {#type-step}

1. On the Timeline, set the step’s action to `type`, or add a step and choose `type`.
2. Set the selector to the field. A chip from an input is a good start. You can change the action from `click` to `type` and keep the selector.
3. Type the keystrokes in **Text to type**. Turn on **Sensitive input** under Timing & selectors when the value is a password. The share page and the captions then keep it masked.
4. To reuse an address, type `{{email}}` in Text to type. On Draft, open **Login, environments, and variables** and fill **{{email}} value**. Record substitutes the value. The stored step still shows `{{email}}`.
5. Click **Record demo**. The line under the button shows how many recordings you have used this month and about how many seconds this run will spend in the browser.

### If Capture clicks fails

| What you see | What it means | What to do |
| --- | --- | --- |
| Button disabled | Browserless is not connected in this API process | Settings → Test. Restart the API if the key is in `backend/.env` but Settings still says Not configured |
| Add a target URL first | The URL is empty or missing `http://` or `https://` | Fill Target app URL on Draft and wait until the save indicator says Saved |
| Could not open the page | Browserless could not load the URL | Open the URL in your own browser. If it is a challenge or an error page, point the target at a page a signed-out visitor can load |
| No chips | The page had no visible links, buttons, or fields | Scroll is not available during capture. Capture a URL whose first screen already shows the controls |
| Google `/sorry` during Record | The step searched Google | Change the first step to a direct `goto` of the product URL |

Capture reads at most 40 elements into the studio. The browser scan stops at 90 matches.

### Developer notes {#capture-clicks-dev}

| Piece | Where |
| --- | --- |
| Button | Draft tab, `data-testid="capture-elements-button"`, and Timeline toolbar `timeline-capture-button`. Each step has `step-capture-next-<step id>` |
| Help control | `data-testid="help-link-capture-clicks"` → `/help#capture-clicks` |
| Chips | `data-testid="capture-element-0"` and up, inside `capture-elements` |
| Studio handler | `frontend/src/pages/Studio.jsx` `capture` and `pickElement` |
| Request | `POST /api/projects/{id}/capture` with `{ "after": n }`. `n` is how many saved steps to replay before the scan. `0` opens the target URL |
| Browser scan | `backend/engine.py` `inspect_page` and `INSPECT_JS` |
| Selector order | `data-testid`, then `#id`, then `text="…"`, then `aria-label`, then the tag name |
| Step written | A `click` step. Changing it to `type` is a later edit. Capture does not record keystrokes |
| Auth | The route requires the signed-in session. It spends a short Browserless session, not a monthly recording |

`pickElement` only appends a step in the editor. It is included in the next autosave. It does not call Browserless again.

## How to use a deep link {#using-this-document}

- In the app, open `/help#capture-clicks` or click the `?` on the control.
- In this file, the heading suffix `{#capture-clicks}` is the anchor.
- In the DOM, the same id is on the heading and on `data-help` of the control.
- Support replies should send the `/help#…` link, not a screenshot of the whole studio.
- When you add a control, add a row to the index, a `data-help` value, and a `HelpLink` with the same topic id.

## Control index {#control-index}

| Label | Where | Test id | Topic |
| --- | --- | --- | --- |
| New demo | Dashboard | `create-new-demo-button` | [New demo](#new-demo) |
| Status, site, Broken | Dashboard | `projects-status-filter`, `projects-host-filter`, `projects-broken-filter` | [Filters](#dashboard-filters) |
| Script only | Draft | `generate-script-button` | [Script only](#generate-script) |
| From changelog | Draft | `changelog-script-button` | [Changelog](#changelog-script) |
| Capture clicks | Draft | `capture-elements-button` | [Capture clicks](#capture-clicks) |
| Generate & record | Draft | `autopilot-button` | [Generate and record](#autopilot) |
| Login, environments, and variables | Draft | `recording-setup` | [Login and hosts](#login-and-environments) |
| {{email}} value | Draft | `variable-email-input` | [Typed text](#type-step) |
| Viewport | Draft | `viewport-select` | [Desktop and phone](#viewport) |
| Import | Draft | `import-playwright-button` | [Playwright](#import-playwright) |
| Live browser | Studio preview | `live-start-button` | [Live browser](#live-browser) |
| Record demo | Timeline | `record-demo-button` | [Record](#record-demo) |
| Re-record failed steps | Timeline | `rerecord-failed-button` | [Failed steps](#rerecord-failed) |
| Timing & selectors | Step card | `step-advanced-toggle-<step id>` | [Step authoring](#step-authoring) |
| Add blur, Add arrow, Add zoom | Step card | `step-blur-<id>`, `step-arrow-<id>`, `step-zoom-<id>` | [Marks](#annotations) |
| Note | Step card | `step-comment-save-<id>` | [Review](#review) |
| Voiceover | Timeline | `generate-voiceover-button` | [Voiceover](#voiceover) |
| Animated GIF, MP4, Square GIF, Caption-off master | Export | `export-gif-docs-button`, `export-mp4-standard-button`, `export-gif-square-button`, `export-mp4-master-button` | [Export](#export-presets) |
| Publish freeze | Export | `publish-button` | [Publish](#publish) |
| Docs link, Email blurb, Caption file | Export | `copy-docs-snippet`, `copy-email-blurb`, `copy-vtt` | [Placement](#placement) |
| Call to action, webhook, product slug, Approved | Export | `cta-label-input`, `webhook-url-input`, `product-slug-input`, `review-status-button` | [Share extras](#share-extras) |
| Run check now | Export | `health-check-now-button` | [Health check](#health-check) |
| Book a demo (on the last frame) | Share player | `player-cta` | [Player](#share-player) |
| Email for a follow-up | Share page | `lead-email-input` | [Player](#share-player) |
| Download captions | Share page | `public-transcript` | [Transcript](#transcript) |
| File storage | Settings | `storage-status` | [Settings](#settings) |
| Check selectors | Draft tools | `preflight-button` | [Demo tools](#demo-tools) |
| Scan further down | Timeline | `capture-scroll-button` | [Capture clicks](#capture-clicks) |
| Save version | Draft tools | `save-version-button` | [Demo tools](#demo-tools) |
| Test | Settings | `test-browserless-button` | [Settings](#settings) |

## New demo {#new-demo}

**Projects → New demo** creates an empty project. Set the name, the target URL, and a short draft before Script only or Generate & record.

The draft is the spec the model reads. Write the path a person would take: where they start, what they click, and what they should see. The first generated step should open the target URL. The model is instructed not to search the web.

### Developer notes {#new-demo-dev}

`POST /api/projects` inserts a document in the `projects` collection. Rows live in NoCodeBackend table `demo_projects` with `tenant_id` `flowcast`. The document is JSON in `brief`. `status` on the row is the collection name, not the project status.

## Script only {#generate-script}

**Draft → Script only** asks the model for steps and leaves recording to you. When Browserless is connected, the server first scans the target page so selectors can match real elements. The scan is the same inspector Capture clicks uses.

After a successful script, the Timeline shows a review line:

- the first URL the script will open
- about how many seconds the later recording will spend in Browserless
- a warning when that host is not the target URL

Change the go-to step before you record when the warning is showing. Undo the generated script with ⌘Z.

### Developer notes {#generate-script-dev}

`POST /api/projects/{id}/generate`. The response adds `review`. History stores a snapshot, and the studio applies it with undo. A 424 means the model returned nothing usable or the provider rejected the call. The message is shortened. It does not include the API key.

## Changelog {#changelog-script}

**Draft → From changelog** uses the draft text as release notes and replaces the timeline with a script about those changes. The target URL is still required. Undo with ⌘Z.

### Developer notes {#changelog-script-dev}

`POST /api/projects/{id}/changelog` with `{ "source": "<draft>" }`. `backend/ai.py` `changelog_script` uses `CHANGELOG_SYSTEM`. This calls the model. It does not open Browserless.

## Generate and record {#autopilot}

**Draft → Generate & record** scripts, records, and builds the voiceover in one run. It needs Browserless and a draft of at least a few words. It counts against the monthly recording limit.

Watch **Automation console** at the bottom of the studio. Cancel is on the running console.

### Developer notes {#autopilot-dev}

`POST /api/projects/{id}/autopilot` starts a run of kind `autopilot`. Poll `GET /api/runs/{id}` or the event stream `GET /api/runs/{id}/stream`. One project can have one running job. A second start returns 409.

## Playwright {#import-playwright}

On Draft, open **Login, environments, and variables**. Paste a Playwright snippet in **Paste a Playwright test** and click **Import**.

The parser reads `page.goto`, `page.fill`, `get_by_role(...).click`, `page.click`, and `page.press`. Comments and blank lines are ignored. When the model is available, it fills captions and voiceover. The steps are still yours to undo.

A file with none of those calls returns 400: `No page.goto, click, or fill calls were found in that file`.

### Developer notes {#import-playwright-dev}

`POST /api/projects/{id}/import-playwright`. Parser: `backend/product.py` `parse_playwright`. The paste field is `playwright_source` and is not saved on the project. Only the resulting steps are saved.

## Login and hosts {#login-and-environments}

Open **Login, environments, and variables** on Draft.

- **Login page URL**, **Username**, and **Password** run before the first step during Record. The password is not returned to the browser after it is saved. The field then says “Password saved — type to replace”. The share page never receives it.
- **Production host** uses Target app URL. **Staging host** and **Local host** replace that host on `goto` steps when you select them. Other sites in the script stay unchanged.
- **Desktop and phone** records a second pass at 390×844 and stores `screenshot_mobile_path`. The player then shows a Desktop / Phone toggle.

The password is stored in the project JSON. Treat project exports and database dumps as secret.

### Developer notes {#login-and-environments-dev}

`PUT /api/projects/{id}` accepts `login_url`, `login_username`, `login_password`, `clear_login`, `environments`, `active_environment`, and `viewport`. Recording reloads the stored login inside `job_record`, because the GET used by the studio strips `login.password`. `prepare_step` applies `{{variables}}` and the host swap before Browserless runs.

Sign-in uses `input[type=email], input[name=email], input[type=text]`, then `input[type=password]`, then `button[type=submit]` or a button whose text is “Sign in”. A custom widget needs those selectors changed in `engine._sign_in`.

## Live browser {#live-browser}

**Live browser** opens the target page in a pane on the right side of the studio. Clicks and typing in that pane are performed in Browserless and appended to the timeline.

- A click on a link or button adds a Click step, using the element’s test id, id, name, label, or visible text. A mark appears at the press immediately. The remote page follows about half a second later.
- Click a field, then type. The keystrokes stay in one Type step. Backspace updates that step. A password field is marked sensitive.
- Enter, Tab, Escape, and the arrow keys add a Press step.
- Scroll inside the pane. The page follows the wheel right away, and the movement becomes one Scroll step. Another scroll on that step adds to the same distance. The slow glide, and the pause to read, happen when you play or export the demo.
- The pane replays the steps already on the timeline, then waits. Close it when you are done. Leaving the project closes it too.
- Browserless closes a connection after about two minutes. Shortly before that, the pane opens a fresh connection and replays the steps captured in the session, so the walkthrough continues on the same page. The picture stays on the last frame while that happens, and the address line says “Continuing this session…”.
- A Google, Cloudflare, or CAPTCHA page stops the pane. It does not try to get past that page.

The session is separate from the monthly recording count. **Record demo** is still what saves the screenshots. A scroll step recorded after this glide stores the in-between frames, and the player moves through them before it holds the scene.

### Developer notes {#live-browser-dev}

| Piece | Where |
| --- | --- |
| Button | `data-testid="live-start-button"`, `data-help="live-browser"` |
| Pane | `frontend/src/components/LivePane.jsx`. A click paints `data-testid="live-click-mark"` before the request returns |
| Session | `backend/live.py`. One session per project, in memory, closed on stop |
| Start | `POST /api/projects/{id}/live/start` with `{ "after": n }` replays n steps, then returns the page URL |
| Picture | `GET /api/projects/{id}/live/frame` is a JPEG. The pane requests a new one several times a second |
| Click | `POST /live/click` with viewport coordinates. 1280×800 maps onto the pane |
| Type and keys | `POST /live/type` and `POST /live/key` |
| Scroll | `POST /live/scroll` moves the page immediately. The step coalesces with the previous scroll. The slow glide is in the recording, not in this pane |
| Continue | About 95 seconds in, `live.py` reconnects and replays `session.steps`. `LIVE_RENEW_SECONDS` can lower that for a test, between 20 and 110 |
| Stop | `POST /live/stop` |

The step is added in the browser’s timeline state and saved with the normal autosave. The live routes do not write the step list themselves.

## Record {#record-demo}

**Record demo** plays every step in Browserless and stores a screenshot for each one. The button label includes the estimate, for example `Record demo · ~72s`. The line under it is the monthly count. The default limit is 20 recordings. A run past the limit returns 402 and does not start.

Re-record all resets step status and records every step. **Re-record** on one card replays earlier steps only to reach that card, then captures it.

A page whose URL is a Google `/sorry` page, a Cloudflare challenge, or a CAPTCHA URL stops the whole run. Ordinary login pages do not. Do not add stealth, a CAPTCHA solver, or a proxy to get past those pages. Point the script at the product.

### Developer notes {#record-demo-dev}

`POST /api/projects/{id}/record` → `job_record` → `engine.run_steps`. Screenshots go through `storage.put_object`. If Cloudflare R2 is not configured on NoCodeBackend, files land in `backend/.data/objects/`, which is gitignored. Settings says so.

`blocked_page` in `engine.py` is the only bot-wall check. Keep it as a stop, not a bypass.

## Failed steps {#rerecord-failed}

**Re-record failed steps** appears on the Timeline when any step status is failed. It records those indexes again and replays the earlier steps so the page is in the right state. It uses one recording from the monthly limit.

**Fix with AI** on a failed step asks the model for a better selector, using the error text. It does not spend a recording. Re-record the step after you accept the selector.

## Voiceover {#voiceover}

**Voiceover** speaks each step’s voiceover text. The project voice is on the Timeline toolbar. A step can override it under **Timing & selectors → Voice for this step**. Empty means the project voice. Changing the text or the voice marks that clip stale, and the next Voiceover run regenerates it.

**Hold this scene** is how long the player and the export stay on that step so it can be read. A step still set to the old 3 second default plays for about 5.5 seconds, and a scroll plays for about 7. The fade between scenes is about 0.8 seconds when the step still has the old 400ms fade. A scroll plays its captured glide first, then holds the settled frame.

## Step authoring {#step-authoring}

| Action | What Record does |
| --- | --- |
| `goto` | Opens the URL |
| `click`, `hover`, `type` | Finds the selector, then the fallbacks |
| `scroll` | Glides by the pixel amount, about 48 pixels at a time, and keeps up to 8 frames of the movement |
| `press` | Presses the named key |
| `wait` | Waits |
| `assert` | Fails the step unless the page HTML contains the text, case-insensitive |

**Chapter** groups the step in the player list. The same chapter name on several steps reads as one chapter.

## Marks {#annotations}

**Add blur**, **Add arrow**, and **Add zoom** attach a mark to that step. Blur pixelates a region in the exported frame. Arrow and zoom draw on the frame. The player also draws a simple overlay. **Clear marks** removes them. Marks are part of the export fingerprint, so the next export is a new file.

Positions are in a 1280×800 frame. The buttons place a default box. There is no drag handle yet.

## Review {#review}

**Note** on a step saves a comment with your name. Comments are for the person approving the demo. They are not spoken and they are not on the share page.

**Export → Mark approved** sets `review_status` to `approved`. Click again to return it to draft. Approval does not block Record.

## Export {#export-presets}

| Button | File | Frame |
| --- | --- | --- |
| Animated GIF | GIF, preset `docs` | 960×600, no audio |
| MP4 video | MP4, preset `standard` | 1280×800, captions and voice |
| Square GIF | GIF, preset `square` | 800×800 |
| Caption-off master | MP4, preset `master` | 1280×800, captions not burned in |

Export is a background job. Download appears in the list under the buttons when the console says the job completed. An unchanged timeline reuses the previous file for that format and preset.

## Publish {#publish}

**Publish freeze** copies the current steps, name, brand, narration, and call to action into `published`, and turns the public link on. The share page and the embed serve that copy. Later edits stay on the draft until you press **Republish**.

The line under the button shows when the live share was frozen.

### Developer notes {#publish-dev}

`POST /api/projects/{id}/publish`. `public_view` in `backend/product.py` swaps in `published.steps` when that list exists. Older shares with no snapshot still serve the live steps.

## Placement {#placement}

On Export:

- **Docs link** copies a markdown link for a README or changelog.
- **Email blurb** copies the name and the share URL.
- **Caption file** copies the WebVTT URL.

The public transcript is `GET /api/public/{share_id}/transcript?fmt=vtt`. `fmt=txt` is a numbered script. Chapters are included in the text form.

## Share extras {#share-extras}

| Field | Effect |
| --- | --- |
| Call to action label and URL | A button on the last frame of the player |
| Webhook URL | POST when a viewer finishes or submits the email form. The body includes `event`, `demo`, `share_id`, `step_index`, `email`, and `session` |
| Product slug | Public page at `/p/<slug>` listing public demos with that slug |
| Approved | Review flag for your team |

**Public link** must be on, or the share URL returns 404. A password and an expiry are on the same card. Ten wrong passwords lock that address for 15 minutes.

## Player {#share-player}

`/share/<share id>` is the interactive demo. `/embed/<share id>` is the same player without the page chrome.

- Space plays. Arrow keys move between steps. Each scene stays up long enough to read, then fades into the next one. A scroll scene glides through the captured frames before it holds.
- The hotspot is the click target from the recording. Click it to advance.
- **Desktop / Phone** appears only after a both-viewport recording stored a phone frame.
- The last frame shows the call to action when the URL is set.
- **Email for a follow-up** saves a lead and fires the webhook when one is set.
- Time on each step is stored as a `dwell` event. Analytics shows the average next to the drop-off bar.

### Developer notes {#share-player-dev}

`POST /api/public/{share_id}/events` accepts `view`, `step`, `complete`, `dwell`, and `lead`. Dwell under 400ms is not sent. Events upsert on project, session, type, and step index.

## Health check {#health-check}

**Run check now** re-records the demo and compares it with the frames you already have. A step that used to succeed and now fails is marked **Broke after UI change**. The previous screenshot stays. The new failed frame is kept beside it on the step card.

**Weekly health check** uses the same job for projects with auto-refresh on. The cron route is `POST /api/cron/refresh-demos`. It expects the cron secret when that environment variable is set.

## Dashboard filters {#dashboard-filters}

The project list can be narrowed by name, status, site host, and **Broken**. Broken means the last health check stored at least one failed step. The list is a light index: name, URL, status, health, and step count. Opening a project loads the full document.

## Analytics {#analytics}

**Analytics** shows views, completions, completion rate, viewers who reached each step, average seconds on the step, and lead emails. Views come from the share page, not from the studio player.

### Developer notes {#analytics-dev}

`GET /api/projects/{id}/analytics` reads the `events` collection. Leads are events of type `lead`.

## Settings {#settings}

| Row | Meaning |
| --- | --- |
| Browserless Connected | This API process has a key and could import the browser engine |
| Test | Opens a Browserless session and closes it |
| AI script engine | The model named here is what Script only and changelog call |
| AI voiceover | Speech synthesis for Voiceover and the preview button |
| File storage Not configured | R2 is not connected. Media stays in `backend/.data/objects/` |
| File storage Connected | NoCodeBackend accepted file storage |

Keys stay in `backend/.env`. The root `.env` is not loaded. The browser never receives them.

Defaults for narration and voice apply to demos created after the change.

## Transcript {#transcript}

Captions on the share page are the step voiceover, or the caption when there is no voiceover. Download from **Download captions**. The studio can also request `GET /api/projects/{id}/transcript?fmt=txt` while signed in.

## Support map {#support-map}

### Processes

- API: `backend/.venv` , `uvicorn server:app` on `127.0.0.1:8000`. Code changes load only after that process restarts.
- Web: `frontend` , `npm start`. It proxies `/api` to port 8000. The printed port changes when 3000 is already taken. Port 3000 may be another app. Do not use it for AppShowcase.
- Sign-in is email and password through NoCodeBackend. The session cookie is a Better Auth cookie rewritten for local HTTP.

### Where to look when a job fails

1. Studio **Automation console**, then `GET /api/runs/{id}`.
2. API log `/tmp/flowcast-api.log` on this machine.
3. Step `error` on the card. `resolved_selector` shows which fallback worked.
4. Settings for Browserless, the model, and file storage.

### Data

Projects, profiles, runs, history, and analytics events are collections in `backend/ncb_store.py`. They share one NoCodeBackend table. Do not write another product’s rows with `tenant_id` `flowcast`.

Datetimes in the JSON may be ISO strings. Columns `created_at` and `updated_at` are MySQL `YYYY-MM-DD HH:MM:SS`.

### Files that own a behavior

| Behavior | File |
| --- | --- |
| Routes and jobs | `backend/server.py` |
| Browser steps, capture, bot-wall stop | `backend/engine.py` |
| Scripts and speech | `backend/ai.py` |
| GIF and MP4 | `backend/render.py` |
| Variables, hosts, transcript, Playwright parse, presets | `backend/product.py` |
| Files | `backend/storage.py` |
| Studio screen | `frontend/src/pages/Studio.jsx` |
| Draft controls | `frontend/src/components/StudioParts.jsx` |
| Step card | `frontend/src/components/StepCard.jsx` |
| Export, share, analytics | `frontend/src/components/ExportPanel.jsx` |
| Player | `frontend/src/components/DemoPlayer.jsx` |
| This guide | `docs/KNOWLEDGE.md`, served from `frontend/public/knowledge.md` |

## Demo tools {#demo-tools}

On Draft, open **Demo tools**.

- **Save version** stores a named snapshot in History. Restore still uses the History sheet.
- **Check selectors** replays the script and reports each selector as found, ambiguous, or missing. It does not spend a recording.
- **Scan further down** on the Timeline chip list scrolls the captured page and lists the next screen.
- **Login recipe** replaces the default email/password form when you need a different sign-in. **Save signed-in browser** keeps that session for later recordings. A challenge page still stops the run.
- **Pronunciation** rewrites a product name only when voiceover is generated.
- **Saved sequences** insert a copied step list into the open demo.
- **Customer variants** keep a variable set and a share link. Use a variant before you record if the screens change.
- **Watch a releases page** reads a public URL. A private or redirected address is refused. When the text changes, the draft updates.
- **Guided tour** holds a scene until the viewer clicks the hotspot. **Narration track** switches the alternate caption and voice. **Notify URL** receives a POST when a run finishes.
- Recordings longer than 120 seconds continue in a new browser session. The monthly meter counts runs and browser seconds.
- Export adds a vertical video, a 15-second hook, an image pack, and an optional music bed under the voice.
- **Review link** lets someone comment and approve without a studio seat. The public player can take `autoplay=1`, `muted=1`, `step`, `hideChapters=1`, and `track=alt`.
- The library searches captions, and it can show archived demos and the trash.

### Changing this guide

1. Edit `docs/KNOWLEDGE.md`.
2. Copy it to `frontend/public/knowledge.md`.
3. Use the same `{#topic-id}` on the heading, `data-help`, and `HelpLink`.
4. Add a row to the control index.
5. Open `/help#<topic-id>` and confirm the heading scrolls into view.
