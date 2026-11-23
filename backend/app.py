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

# Vercel Functions are request-scoped: a background worker loop started here
# would be frozen mid-job and its lease reclaimed by a real worker. Default
# the embedded worker off on Vercel (run `python worker.py` on a long-lived
# host, or set EMBEDDED_WORKER=true to opt back in). Local runs through
# `uvicorn server:app` are untouched.
if os.environ.get("VERCEL"):
    os.environ.setdefault("EMBEDDED_WORKER", "false")

from server import app  # noqa: E402,F401
