import { useEffect, useRef } from "react";
import { Square, Terminal } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/StatusBadge";

const LEVEL = { info: "text-slate-300", success: "text-emerald-400", warn: "text-amber-400", error: "text-red-400" };

export const RunConsole = ({ run, onCancel }) => {
  const ref = useRef(null);
  useEffect(() => { ref.current?.scrollTo({ top: ref.current.scrollHeight }); }, [run?.logs?.length]);
  if (!run) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 font-mono text-xs text-slate-500 flex items-center gap-2" data-testid="run-console-idle">
        <Terminal className="h-3.5 w-3.5" /> Automation console idle — record, voice or export to see live progress.
      </div>
    );
  }
  const pct = run.total ? Math.round((run.current / run.total) * 100) : 0;
  const running = run.status === "running";
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/80 backdrop-blur-xl overflow-hidden" data-testid="run-console">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-800">
        <div className="flex items-center gap-2 min-w-0">
          <StatusBadge status={running ? "running" : run.status === "completed" ? "done" : run.status} testId="run-status-badge" />
          <span className="text-sm truncate" data-testid="run-current-message">{run.message}</span>
        </div>
        {running && onCancel && (
          <button onClick={onCancel} className="shrink-0 flex items-center gap-1.5 text-xs text-red-300 hover:text-red-200 border border-red-500/30 rounded-md px-2 py-1" data-testid="run-cancel-button">
            <Square className="h-3 w-3" /> Cancel
          </button>
        )}
      </div>
      {running && <Progress value={pct} className="h-1 rounded-none bg-slate-900" data-testid="run-progress-bar" />}
      <div ref={ref} role="log" aria-live="polite" className="max-h-48 overflow-y-auto scrollbar-thin p-4 space-y-1.5 font-mono text-[11px]" data-testid="run-log">
        {run.logs.map((l, i) => (
          <div key={i} className="flex gap-3">
            <span className="text-slate-600 shrink-0">{new Date(l.t).toLocaleTimeString([], { hour12: false })}</span>
            <span className={LEVEL[l.level] || LEVEL.info}>{l.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
