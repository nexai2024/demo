"""Minimal load test for a STAGING deployment (never point at production data).

  python loadtest/load_test.py https://staging.example.com --users 25 --seconds 60 --cookie "session=..."

Reports p50/p95 latency and error rate for the read paths that hit the data layer.
"""
import argparse
import asyncio
import statistics
import time

import httpx

PATHS = ["/api/health", "/api/ready", "/api/projects", "/api/settings", "/api/notifications"]


async def worker(client, base, deadline, stats):
    i = 0
    while time.monotonic() < deadline:
        path = PATHS[i % len(PATHS)]
        i += 1
        start = time.perf_counter()
        try:
            response = await client.get(base + path)
            ok = response.status_code < 500
        except httpx.HTTPError:
            ok = False
        stats.setdefault(path, []).append((time.perf_counter() - start, ok))


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("base")
    parser.add_argument("--users", type=int, default=20)
    parser.add_argument("--seconds", type=int, default=30)
    parser.add_argument("--cookie", default="")
    args = parser.parse_args()
    stats: dict = {}
    deadline = time.monotonic() + args.seconds
    headers = {"cookie": args.cookie} if args.cookie else {}
    async with httpx.AsyncClient(timeout=30, headers=headers) as client:
        await asyncio.gather(*[worker(client, args.base.rstrip("/"), deadline, stats) for _ in range(args.users)])
    print(f"{'path':28}{'n':>7}{'p50 ms':>9}{'p95 ms':>9}{'errors':>8}")
    for path, rows in stats.items():
        times = sorted(t * 1000 for t, _ in rows)
        p95 = times[min(len(times) - 1, int(len(times) * 0.95))]
        print(f"{path:28}{len(rows):>7}{statistics.median(times):>9.0f}{p95:>9.0f}{sum(1 for _, ok in rows if not ok):>8}")


if __name__ == "__main__":
    asyncio.run(main())
