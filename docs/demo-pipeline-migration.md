# Demo pipeline migration: stills → video-first

Goal: demos that flow like a narrated slideshow — real UI motion, a visible
cursor performing each action, narration-timed pacing, word-synced captions —
instead of one screenshot per step with crossfades.

## What was wrong

- Capture stored 1 JPEG per step (scroll: ≤8 stills). All real motion
  (typing, animations, transitions) was discarded between posters.
- No cursor was ever visible; actions had no performer.
- Step holds were a flat 5.5s floor (7s scroll) or audio length + 0.7s —
  never timed to phrases or to when an action lands.
- Exports re-composed stills with PIL (zoompan-on-a-poster, ≤0.45s fades).
- Narration used OpenAI `tts-1-hd` (deprecated; shutdown Jan 6, 2027) with
  no word timings, so captions could not sync to speech.

## Target design (implemented in this change)

### Capture (engine.run_steps)
- The replay is recorded with Playwright's CDP screencast
  (`page.screencast.start(on_frame=...)`, quality 88). Frames arrive with
  epoch timestamps only when the page repaints; JS-driven motion yields
  ~20fps over Browserless. Frames stream to temp files on the worker —
  never held in memory.
- An animated cursor overlay is injected into every page
  (`engine.CURSOR_JS`): it lerps toward the real mouse with rAF easing,
  presses on mousedown, and emits a click ripple. `_perform` glides the
  mouse (24 steps) to the target before click/hover/type, so every action
  is performed on camera. The same cursor appears in poster screenshots.
- Each captured step records `video = {clip, start_ms, end_ms}` (epoch-ms
  marks taken around `_perform`, rebased to the clip's first frame).
  Steps still get their poster screenshot, hotspot, and annotations —
  the Arcade model: video for motion, stills for posters/fallback.
- On session renewal the recorder starts a new clip; steps point at the
  clip they were captured in. Clips are encoded to H.264 MP4 (30fps,
  concat-demuxer from frame timestamps) and uploaded as
  `.../{project}_clip{n}.mp4`. The project stores `video_clips: [paths]`.
- Screencast failure never fails a recording: steps simply have no video
  and the player/export fall back to stills.

### Timing / narration (ai.synthesize_timed)
- Provider order: ElevenLabs `with-timestamps` when `ELEVENLABS_API_KEY`
  is set (model `ELEVENLABS_MODEL`, default `eleven_v4`; voice
  `ELEVENLABS_VOICE_ID`), else OpenAI as today.
- ElevenLabs alignment is grouped into `words: [{w, start_ms, end_ms}]`,
  stored on the step with `audio_duration_ms`. The player highlights the
  spoken word in captions (karaoke) when words exist.

### Player (DemoPlayer)
- Steps with video render a `<video>` windowed to `[start_ms, end_ms]`
  of their clip (freezes on the last frame at the window end until the
  narration timer advances). Long action windows are sped up (≤3–4×) to
  fit the narration hold instead of being cut mid-motion. Chapters,
  hotspots, annotations, scenes, and the narration timer are unchanged;
  steps without video use the still stage.
- The step video endpoints honor HTTP `Range` (206 + `Content-Range`):
  browsers require it to seek, and without it a seek past the buffered
  region restarts the element at 0.

### Export (render.build_mp4)
- Steps with video use the real clip segment (sped up with `setpts` to
  fit the step hold when longer, last frame cloned if narration runs
  longer), with the existing caption overlay burned in and the existing
  xfade/acrossfade chain. Steps without video keep the still/zoom path.
  GIFs stay still-based.

## Phase 4: Remotion compositor (implemented)

- `backend/edl.py` builds an explicit EDL JSON from the project: per-step
  segments (video window / still / scene) with durations, trim/playback
  rate, camera moves, captions (karaoke words when present), callouts,
  narration, and crossfades — the same timing rules as the player and the
  ffmpeg exporter.
- The recorder now also stores `video.action_ms` (when the click/press/
  first keystroke landed) so renderers can time effects to the action.
- `compositor/` is a Remotion app (React + `@remotion/renderer`): spring
  camera zooms toward each step's hotspot with a release before the cut,
  click-ripple rings at `action_ms`, animated callouts/highlights/arrows,
  karaoke captions, and scene cards. `compositor/render.mjs` serves the
  asset dir over a range-capable localhost server and renders H.264.
- `backend/compositor.py` materializes assets, writes the EDL, and runs
  the Node renderer. Export jobs use it for MP4 whenever the bundle is
  installed (`COMPOSITOR=off` forces ffmpeg; `/api/ready` reports the
  active engine; the engine is part of the export cache fingerprint).
  Any failure falls back to `render.build_mp4`, so exports never depend
  on Node. On Vercel the bundle is absent → ffmpeg; run `worker.py` on a
  host with Node + `npm ci` in `compositor/` for Remotion exports.

## Deferred

- rrweb-style HTML capture for interactive tours.
- S3-presigned video delivery (video endpoints currently serve objects
  through the API, with Range support).
- Remotion Lambda (the EDL + composition are already portable to it).

## Env

- `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, `ELEVENLABS_MODEL` (optional)
- `VIDEO_CAPTURE=false` disables screencast capture (stills-only mode).
