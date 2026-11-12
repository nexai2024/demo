const STYLES = {
  draft: "bg-slate-800 text-slate-300 border-slate-700",
  scripted: "bg-indigo-500/10 text-indigo-300 border-indigo-500/30",
  recording: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  ready: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  partial: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  failed: "bg-red-500/10 text-red-300 border-red-500/30",
  pending: "bg-slate-800 text-slate-400 border-slate-700",
  running: "bg-cyan-500/10 text-cyan-300 border-cyan-500/30",
  done: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
};

export const StatusBadge = ({ status, testId }) => (
  <span data-testid={testId} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${STYLES[status] || STYLES.draft}`}>
    {status === "running" || status === "recording" ? <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" /> : null}
    {status}
  </span>
);
