"""Durable job dispatch, atomic project leases, atomic quota reservations, and persisted cancellation.

Every background job (record, rerecord, autopilot, voiceover, export, health, cron_refresh) is written
to ``db.runs`` with ``status="queued"`` and a serialisable ``job_spec``. Workers (embedded in the API
process for single-node dev, or standalone ``python worker.py`` processes in production) claim queued
jobs or reclaim expired leases, renew their lease on a heartbeat, check persisted ``cancel_requested``,
and write at most one terminal outcome.

Quotas are reserved atomically by ``run_id`` before a job is admitted, so concurrent requests cannot
overshoot the monthly cap and a crashed worker retrying the same ``run_id`` never double-charges.
"""
import asyncio
import logging
import os
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException

from core import DB_BACKEND, DuplicateKeyError, db, new_id, now, now_iso

logger = logging.getLogger(__name__)

INSTANCE_ID = new_id("wrk_")
LEASE_SECONDS = int(os.environ.get("JOB_LEASE_SECONDS", "120"))
MAX_JOB_ATTEMPTS = int(os.environ.get("JOB_MAX_ATTEMPTS", "2"))
QUOTA_KINDS = {"record", "rerecord", "autopilot"}


def _lease_until(seconds: int | None = None) -> str:
    return (now() + timedelta(seconds=seconds or LEASE_SECONDS)).isoformat()


def _month_key() -> str:
    return now().strftime("%Y-%m")


def _month_start() -> str:
    return now().replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()


# ---------- atomic project lease ----------
async def acquire_project_lease(pid: str, run_id: str) -> bool:
    """Atomically bind ``active_run_id`` on the project only when idle (or stale).

    Returns True if this run now owns the project lease, False if another active run holds it.
    """
    cutoff = now_iso()
    # First check if a stale active_run_id is pointing to a non-active run (cleanup)
    proj = await db.projects.find_one({"id": pid}, {"_id": 0})
    if not proj:
        raise HTTPException(404, "Project not found")
    current_rid = proj.get("active_run_id")
    if current_rid:
        existing = await db.runs.find_one({"id": current_rid}, {"_id": 0})
        if existing and existing.get("status") in {"queued", "running"}:
            return False
        # Existing run already finished or vanished; try to atomically swap it out
        res = await db.projects.update_one(
            {"id": pid, "active_run_id": current_rid},
            {"$set": {"active_run_id": run_id, "lease_expires_at": _lease_until(), "updated_at": cutoff}},
        )
        return getattr(res, "modified_count", 1) == 1

    res = await db.projects.update_one(
        {"id": pid, "active_run_id": None},
        {"$set": {"active_run_id": run_id, "lease_expires_at": _lease_until(), "updated_at": cutoff}},
    )
    return getattr(res, "modified_count", 1) == 1


async def release_project_lease(pid: str, run_id: str) -> None:
    await db.projects.update_one(
        {"id": pid, "active_run_id": run_id},
        {"$set": {"active_run_id": None, "lease_expires_at": None, "updated_at": now_iso()}},
    )


# ---------- atomic quota reservation ----------
async def usage_summary(user_id: str) -> tuple[int, int]:
    """Return (recordings_this_month, seconds_this_month) from the durable reservation ledger."""
    month = _month_key()
    rows = await db["quota_reservations"].find(
        {"user_id": user_id, "month": month, "status": {"$ne": "released"}}, {"_id": 0}
    ).to_list(1000)
    if rows:
        return len(rows), sum(int(r.get("seconds") or 0) for r in rows)
    # Backwards-compatible fallback for historical runs before quota_reservations existed
    runs = await db.runs.find(
        {"user_id": user_id, "kind": {"$in": list(QUOTA_KINDS)}, "started_at": {"$gte": _month_start()}}, {"_id": 0}
    ).to_list(500)
    return len(runs), sum(int(r.get("seconds") or 0) for r in runs)


async def reserve_quota(user_id: str, run_id: str, seconds: int, monthly_limit: int) -> None:
    """Atomically reserve one recording slot and ``seconds`` of browser budget for ``run_id``.

    Idempotent on ``run_id``: a retry of the same run does not create a second reservation.
    """
    month = _month_key()
    cap_seconds = monthly_limit * 120
    counter_id = f"{user_id}:{month}"

    existing = await db["quota_reservations"].find_one({"id": run_id}, {"_id": 0})
    if existing and existing.get("status") != "released":
        return  # already reserved for this run_id (idempotent retry)

    # Ensure monthly counter document exists
    try:
        await db["quota_counters"].insert_one({
            "id": counter_id, "user_id": user_id, "month": month, "count": 0, "seconds": 0, "updated_at": now_iso()
        })
    except DuplicateKeyError:
        pass

    # Atomic conditional increment on the monthly counter
    res = await db["quota_counters"].update_one(
        {"id": counter_id, "count": {"$lt": monthly_limit}, "seconds": {"$lte": cap_seconds - seconds}},
        {"$inc": {"count": 1, "seconds": seconds}, "$set": {"updated_at": now_iso()}},
    )
    if getattr(res, "modified_count", 0) != 1:
        counter = await db["quota_counters"].find_one({"id": counter_id}, {"_id": 0}) or {}
        if int(counter.get("count") or 0) >= monthly_limit:
            raise HTTPException(402, f"Monthly limit of {monthly_limit} recordings reached. Upgrade to keep recording.")
        used = int(counter.get("seconds") or 0)
        raise HTTPException(402, f"This run is about {seconds}s. The monthly browser budget is {cap_seconds}s and {used}s is already used.")

    try:
        await db["quota_reservations"].insert_one({
            "id": run_id, "run_id": run_id, "user_id": user_id, "month": month,
            "seconds": seconds, "status": "reserved", "created_at": now_iso(),
        })
    except DuplicateKeyError:
        # Roll back the extra increment if a concurrent duplicate raced us
        await db["quota_counters"].update_one(
            {"id": counter_id}, {"$inc": {"count": -1, "seconds": -seconds}, "$set": {"updated_at": now_iso()}}
        )


async def release_quota(user_id: str, run_id: str) -> None:
    """Release a reservation if admission failed before the run could be queued."""
    res = await db["quota_reservations"].find_one({"id": run_id, "status": "reserved"}, {"_id": 0})
    if not res:
        return
    upd = await db["quota_reservations"].update_one(
        {"id": run_id, "status": "reserved"}, {"$set": {"status": "released", "released_at": now_iso()}}
    )
    if getattr(upd, "modified_count", 1) == 1:
        counter_id = f"{user_id}:{res['month']}"
        await db["quota_counters"].update_one(
            {"id": counter_id},
            {"$inc": {"count": -1, "seconds": -int(res.get("seconds") or 0)}, "$set": {"updated_at": now_iso()}},
        )


# ---------- durable enqueue, claim, cancel, complete ----------
async def enqueue_run(project: dict, kind: str, total: int, message: str, job_spec: dict,
                      seconds: int = 0, monthly_limit: int | None = None) -> dict:
    """Atomically admit, reserve quota (if applicable), lease the project, and persist a queued run."""
    run_id = new_id("run_")
    pid = project["id"]
    uid = project["user_id"]

    if not await acquire_project_lease(pid, run_id):
        raise HTTPException(409, "Another job is already running for this project")

    quota_reserved = False
    try:
        if kind in QUOTA_KINDS and monthly_limit is not None:
            await reserve_quota(uid, run_id, seconds, monthly_limit)
            quota_reserved = True
        run = {
            "id": run_id,
            "project_id": pid,
            "user_id": uid,
            "kind": kind,
            "status": "queued",
            "total": total,
            "current": 0,
            "message": message,
            "logs": [{"t": now_iso(), "level": "info", "msg": message}],
            "result": None,
            "seconds": seconds,
            "job_spec": job_spec,
            "attempt": 0,
            "max_attempts": MAX_JOB_ATTEMPTS,
            "cancel_requested": False,
            "checkpoints": {"completed_steps": []},
            "started_at": now_iso(),
            "finished_at": None,
            "heartbeat_at": now_iso(),
            "lease_expires_at": None,
            "owner": None,
        }
        await db.runs.insert_one(dict(run))
        run.pop("_id", None)
        return run
    except Exception:
        if quota_reserved:
            await release_quota(uid, run_id)
        await release_project_lease(pid, run_id)
        raise


async def request_cancel(run_id: str, user_id: str) -> dict:
    """Persist cancellation in the database so any worker replica observes it."""
    run = await db.runs.find_one({"id": run_id, "user_id": user_id}, {"_id": 0})
    if not run:
        raise HTTPException(404, "Run not found")
    if run["status"] == "queued":
        res = await db.runs.update_one(
            {"id": run_id, "status": "queued"},
            {"$set": {"status": "cancelled", "cancel_requested": True, "finished_at": now_iso(),
                      "message": "Cancelled before start"},
             "$push": {"logs": {"t": now_iso(), "level": "warn", "msg": "Cancelled before start"}}},
        )
        if getattr(res, "modified_count", 1) == 1:
            await release_project_lease(run["project_id"], run_id)
        return {"ok": True, "status": "cancelled"}
    if run["status"] == "running":
        await db.runs.update_one(
            {"id": run_id, "status": "running"},
            {"$set": {"cancel_requested": True, "message": "Cancellation requested — stopping after current step..."},
             "$push": {"logs": {"t": now_iso(), "level": "warn",
                                "msg": "Cancellation requested — stopping after current step..."}}},
        )
    return {"ok": True}


async def is_cancelled(run_id: str) -> bool:
    doc = await db.runs.find_one({"id": run_id}, {"_id": 0, "cancel_requested": 1, "status": 1})
    return bool(doc and (doc.get("cancel_requested") or doc.get("status") == "cancelled"))


async def record_checkpoint(run_id: str, step_id: str) -> None:
    """Persist a completed step checkpoint so a restarted worker does not redo finished steps."""
    run = await db.runs.find_one({"id": run_id}, {"_id": 0})
    if not run:
        return
    cp = dict(run.get("checkpoints") or {})
    done = list(cp.get("completed_steps") or [])
    if step_id not in done:
        done.append(step_id)
        cp["completed_steps"] = done
        await db.runs.update_one({"id": run_id}, {"$set": {"checkpoints": cp, "heartbeat_at": now_iso(),
                                                           "lease_expires_at": _lease_until()}})


async def completed_checkpoint_steps(run_id: str) -> set[str]:
    run = await db.runs.find_one({"id": run_id}, {"_id": 0})
    return set(((run or {}).get("checkpoints") or {}).get("completed_steps") or [])


async def renew_lease(run_id: str, owner: str = INSTANCE_ID) -> None:
    await db.runs.update_one(
        {"id": run_id, "status": "running", "owner": owner},
        {"$set": {"heartbeat_at": now_iso(), "lease_expires_at": _lease_until()}},
    )


async def claim_next_run(owner: str = INSTANCE_ID) -> dict | None:
    """Atomically claim one queued run, or reclaim one running run whose lease expired."""
    cutoff = now_iso()
    # 1. Try queued runs first (oldest first)
    queued = await db.runs.find({"status": "queued"}, {"_id": 0}).sort("started_at", 1).to_list(20)
    for run in queued:
        if run.get("cancel_requested"):
            await finalize_run(run["id"], run["project_id"], "cancelled", "Cancelled before start")
            continue
        res = await db.runs.update_one(
            {"id": run["id"], "status": "queued"},
            {"$set": {"status": "running", "owner": owner, "heartbeat_at": cutoff,
                      "lease_expires_at": _lease_until()},
             "$inc": {"attempt": 1}},
        )
        if getattr(res, "modified_count", 0) == 1:
            return await db.runs.find_one({"id": run["id"]}, {"_id": 0})

    # 2. Reclaim expired running runs (crashed workers)
    running = await db.runs.find({"status": "running"}, {"_id": 0}).to_list(50)
    for run in running:
        lease_exp = run.get("lease_expires_at")
        if not lease_exp:
            # Legacy run doc without lease_expires_at: fall back to heartbeat_at
            beat = run.get("heartbeat_at") or run.get("started_at")
            try:
                if (now() - datetime.fromisoformat(beat)).total_seconds() <= LEASE_SECONDS:
                    continue
            except (TypeError, ValueError):
                pass
        elif lease_exp > cutoff:
            continue

        attempts = int(run.get("attempt") or 1)
        max_attempts = int(run.get("max_attempts") or MAX_JOB_ATTEMPTS)
        if run.get("cancel_requested"):
            await finalize_run(run["id"], run["project_id"], "cancelled", "Cancelled after worker interruption")
            continue
        if attempts >= max_attempts:
            await finalize_run(run["id"], run["project_id"], "failed",
                               "Interrupted: the worker stopped responding and retries were exhausted")
            continue
        # Atomically claim the expired lease
        filt = {"id": run["id"], "status": "running", "attempt": attempts}
        res = await db.runs.update_one(
            filt,
            {"$set": {"owner": owner, "heartbeat_at": cutoff, "lease_expires_at": _lease_until(),
                      "message": f"Resuming after worker restart (attempt {attempts + 1}/{max_attempts})..."},
             "$inc": {"attempt": 1},
             "$push": {"logs": {"t": cutoff, "level": "warn",
                                "msg": f"Worker restarted — resuming from checkpoint (attempt {attempts + 1}/{max_attempts})"}}},
        )
        if getattr(res, "modified_count", 0) == 1:
            return await db.runs.find_one({"id": run["id"]}, {"_id": 0})
    return None


async def finalize_run(run_id: str, pid: str, status: str, msg: str, result=None) -> bool:
    """Atomically transition a run to one terminal state (completed/failed/cancelled).

    Returns True only for the single caller that won the terminal transition (preventing duplicate
    notifications or duplicate terminal updates).
    """
    res = await db.runs.update_one(
        {"id": run_id, "status": {"$in": ["queued", "running"]}},
        {"$set": {"status": status, "message": msg, "finished_at": now_iso(), "result": result,
                  "lease_expires_at": None},
         "$push": {"logs": {"t": now_iso(), "level": "error" if status == "failed" else "success", "msg": msg}}},
    )
    won = getattr(res, "modified_count", 1) == 1
    await release_project_lease(pid, run_id)
    return won
