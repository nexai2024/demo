"""Standalone durable job worker for multi-replica production deployments.

Run API replicas with ``EMBEDDED_WORKER=false`` and run one or more instances of:
    python worker.py

Graceful shutdown: SIGINT/SIGTERM stops claiming new jobs and waits for the in-flight job to finish
its current step before exiting. If killed abruptly, another worker reclaims the job once its lease
expires and resumes from persisted step checkpoints.
"""
import asyncio
import logging
import signal

import server
from core import validate_config
from storage import init_storage

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("AppShowcase.worker")


async def run_worker() -> None:
    validate_config()
    await asyncio.to_thread(init_storage)
    await server.ensure_indexes()
    try:
        await server.record_storage_probe("startup")
    except Exception:
        logger.warning("Startup storage probe failed", exc_info=True)
    stop = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, stop.set)
        except NotImplementedError:
            pass
    logger.info("Worker %s started", server.INSTANCE_ID)
    while not stop.is_set():
        try:
            await server.jobs.note_worker_presence()
            run = await server.jobs.claim_next_run()
            if run:
                logger.info("Claimed run %s (%s, attempt %s)", run["id"], run["kind"], run.get("attempt"))
                await server.execute_run(run)
                continue
        except Exception:
            logger.exception("Worker iteration failed")
        try:
            await asyncio.wait_for(stop.wait(), timeout=1.0)
        except asyncio.TimeoutError:
            pass
    logger.info("Worker %s stopped cleanly", server.INSTANCE_ID)


if __name__ == "__main__":
    asyncio.run(run_worker())
