"""Vercel entrypoint for the AppShowcase API.

Vercel auto-detects `app.py` at the project root (Root Directory = backend)
and loads the top-level `app` variable; pyproject.toml also points
[tool.vercel] entrypoint here.

server.py imports its sibling modules (core, engine, ai, ...) as top-level
modules, which only works when this directory is on sys.path. Local runs get
that from the working directory; this shim guarantees it on Vercel too.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# On Vercel, Studio's SSE `/runs/{id}/stream` claims and executes the job on
# that long-lived request (maxDuration 300). The embedded loop is a backup for
# cron/export when traffic warms an isolate. Local `uvicorn server:app` is
# untouched; jobs.worker_may_claim() blocks APP_ENV=development from stealing
# production Mongo jobs.
if os.environ.get("VERCEL"):
    os.environ.setdefault("EMBEDDED_WORKER", "true")

from server import app  # noqa: E402,F401
