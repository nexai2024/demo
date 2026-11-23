#!/usr/bin/env node
/**
 * Renders an AppShowcase EDL (backend/edl.py) to MP4.
 *
 *   node render.mjs --edl edl.json --out out.mp4
 *
 * The EDL references media by file name; `assetsDir` (absolute path in the
 * EDL JSON) is served over a tiny range-capable HTTP server so Remotion's
 * OffthreadVideo/ffmpeg can seek into clips without copying anything.
 */
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i += 2) out[argv[i].replace(/^--/, "")] = argv[i + 1];
  return out;
}

const MIME = {
  ".mp4": "video/mp4",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
};

function serveDir(dir) {
  const server = http.createServer((req, res) => {
    const name = decodeURIComponent((req.url || "/").split("?")[0].slice(1));
    const file = path.join(dir, path.basename(name));
    if (!name || !fs.existsSync(file)) {
      res.writeHead(404).end("not found");
      return;
    }
    const size = fs.statSync(file).size;
    const type = MIME[path.extname(file).toLowerCase()] || "application/octet-stream";
    const range = req.headers.range;
    if (range) {
      const m = /bytes=(\d*)-(\d*)/.exec(range);
      const start = m && m[1] ? parseInt(m[1], 10) : 0;
      const end = m && m[2] ? Math.min(parseInt(m[2], 10), size - 1) : size - 1;
      res.writeHead(206, {
        "Content-Type": type,
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Accept-Ranges": "bytes",
        "Content-Length": end - start + 1,
      });
      fs.createReadStream(file, { start, end }).pipe(res);
      return;
    }
    res.writeHead(200, { "Content-Type": type, "Accept-Ranges": "bytes", "Content-Length": size });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.edl || !args.out) {
    console.error("usage: node render.mjs --edl <edl.json> --out <out.mp4>");
    process.exit(2);
  }
  const doc = JSON.parse(fs.readFileSync(args.edl, "utf8"));
  const { assetsDir, ...edl } = doc;
  if (!assetsDir || !fs.existsSync(assetsDir)) {
    console.error(`assetsDir missing or not found: ${assetsDir}`);
    process.exit(2);
  }
  const server = await serveDir(assetsDir);
  const port = server.address().port;
  try {
    const serveUrl = await bundle({
      entryPoint: path.join(here, "src", "index.ts"),
      outDir: path.join(here, ".bundle"),
    });
    const inputProps = { edl, assetBase: `http://127.0.0.1:${port}` };
    const composition = await selectComposition({ serveUrl, id: "DemoVideo", inputProps });
    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      outputLocation: args.out,
      inputProps,
      onProgress: ({ progress }) => {
        if (Math.round(progress * 100) % 20 === 0) console.log(`render ${(progress * 100).toFixed(0)}%`);
      },
    });
    console.log(`done: ${args.out}`);
  } finally {
    server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
