# AppShowcase compositor (Remotion)

Renders an AppShowcase **EDL** (see `backend/edl.py`) into a polished MP4:
spring-zoom camera moves into each step's hotspot, click-ripple rings timed
to the recorded action moment, animated callouts, karaoke captions when the
narration has word timings, and scene cards for title/CTA/form steps.

## Setup (worker host)

```bash
cd compositor
npm ci            # or npm install
```

The first render downloads a headless Chromium build (~150MB, cached by
Remotion). Nothing else to configure: the backend finds this directory
automatically and uses it for MP4 exports when `node_modules/@remotion/renderer`
exists. Force it off with `COMPOSITOR=off`, or check `/api/ready`
(`"compositor": "remotion" | "ffmpeg"`). If a Remotion render fails, the
export job falls back to the ffmpeg compositor automatically.

Note: on Vercel the bundle is not installed, so exports there keep using
ffmpeg; run `worker.py` on a host with Node + this bundle for Remotion
exports.

## Render by hand

```bash
node render.mjs --edl /path/to/edl.json --out out.mp4
```

The EDL JSON must include `assetsDir` (absolute path to the media files the
segments reference). Preview in Remotion Studio with `npm run studio`
(supply the same props: `{edl, assetBase}`).
