import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { AlertTriangle, RefreshCw, X } from "lucide-react";
import { API } from "@/lib/api";

// Polls GET /api/ready and, when the backend reports itself not ready
// (bad/missing config, database or storage down, API unreachable or
// misrouted), turns the response into a readable checklist instead of
// leaving the user with failed requests and console errors. Healthy
// backends render nothing. Uses bare axios on purpose: a 503 here is an
// expected answer, not an app error to log via the api interceptors.
export function BackendHealthBanner() {
  const [health, setHealth] = useState(null); // null = healthy / not checked yet
  const [checking, setChecking] = useState(false);
  const [dismissed, setDismissed] = useState("");

  const check = useCallback(async () => {
    setChecking(true);
    try {
      const res = await axios.get(`${API}/ready`, {
        withCredentials: true,
        timeout: 8000,
        validateStatus: () => true,
      });
      const data = res.data;
      if (!data || typeof data !== "object" || Array.isArray(data)) {
        // SPA fallback / proxy misroute: we got a page, not JSON.
        setHealth({
          kind: "misrouted",
          problems: [
            `The API at ${API} returned a web page instead of JSON. Check VITE_BACKEND_URL (it must include https://) or the /api rewrite.`,
          ],
        });
        return;
      }
      const problems = [];
      if (Array.isArray(data.config_problems)) {
        for (const p of data.config_problems) {
          if (typeof p === "string" && p.trim()) problems.push(p);
        }
      }
      if (typeof data.startup_error === "string" && data.startup_error.trim()) {
        problems.push(`Startup: ${data.startup_error}`);
      }
      if (data.database_ok === false && !problems.some((p) => /MONGO|database/i.test(p))) {
        problems.push("Database is not reachable from the API server. Check MONGO_URL and network access.");
      }
      if (data.storage_ok === false && !problems.some((p) => /STORAGE|S3/i.test(p))) {
        problems.push(`Object storage is not ready (mode: ${data.storage || "unknown"}). Configure S3 or the remote store.`);
      }
      // A recorded probe (startup/nightly/manual) that failed is a live
      // storage breakage even when static config looks fine.
      const probe = data.storage_probe;
      const probeFailed = !!probe && probe.ok === false;
      if (probeFailed) {
        problems.push(
          `Storage probe failed${probe.source ? ` (${probe.source})` : ""}${probe.at ? ` at ${probe.at}` : ""}: ${probe.error || "the put/get round-trip did not complete"}`,
        );
      }
      const notReady =
        res.status !== 200 || data.config_ok === false || data.database_ok === false || data.storage_ok === false || probeFailed;
      setHealth(
        notReady
          ? { kind: data.config_ok === false ? "config" : "degraded", problems: [...new Set(problems)] }
          : null,
      );
    } catch {
      setHealth({
        kind: "unreachable",
        problems: [
          `Could not reach the API at ${API}. Is the backend deployed and running? Requests below will fail until it responds.`,
        ],
      });
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, [check]);

  if (!health) return null;
  const fingerprint = `${health.kind}:${health.problems.join("|")}`;
  if (dismissed === fingerprint) return null;

  const title =
    health.kind === "config"
      ? "Backend not ready — configuration problems"
      : health.kind === "misrouted"
        ? "Backend not ready — API misrouted"
        : health.kind === "degraded"
          ? "Backend not ready — dependency problems"
          : "Backend not reachable";

  return (
    <div
      className="mb-8 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4"
      role="alert"
      data-testid="backend-not-ready-banner"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-300 mt-0.5" aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-semibold text-amber-100">{title}</p>
            <p className="text-sm text-amber-200/80 mt-0.5">
              The API reported these problems via <span className="font-mono text-xs">{`${API}/ready`}</span>. Fix
              them in the backend environment, redeploy, then re-check.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={check}
            disabled={checking}
            className="h-8 px-3 rounded-lg border border-amber-500/40 text-sm text-amber-100 inline-flex items-center gap-1.5 disabled:opacity-50"
            data-testid="backend-health-retry"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${checking ? "animate-spin" : ""}`} /> Re-check
          </button>
          <button
            type="button"
            onClick={() => setDismissed(fingerprint)}
            className="h-8 w-8 rounded-lg border border-amber-500/40 text-amber-100 grid place-items-center"
            aria-label="Dismiss backend health warning"
            data-testid="backend-health-dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      {health.problems.length > 0 && (
        <ul className="mt-3 space-y-1.5 pl-8 list-disc text-sm text-amber-100/90" data-testid="backend-health-problems">
          {health.problems.map((p) => (
            <li key={p} className="break-words">{p}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
