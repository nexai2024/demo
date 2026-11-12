import { useEffect, useState } from "react";
import { Reorder, useDragControls } from "framer-motion";
import { AlertTriangle, ArrowDown, ArrowUp, ChevronDown, Copy, GripVertical, Loader2, RotateCcw, Trash2, Wand2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";

const ACTIONS = ["goto", "click", "type", "hover", "scroll", "press", "wait"];
const lbl = "font-mono text-[10px] uppercase tracking-wider text-slate-500";

function Target({ s, set }) {
  if (s.action === "goto") return <Input value={s.url || ""} onChange={(e) => set({ url: e.target.value })} placeholder="https://…" className="bg-slate-950 font-mono text-xs h-9" data-testid={`step-url-${s.id}`} />;
  if (s.action === "scroll") return <Input type="number" value={s.amount} onChange={(e) => set({ amount: Number(e.target.value) })} className="bg-slate-950 font-mono text-xs h-9" data-testid={`step-amount-${s.id}`} />;
  if (s.action === "wait") return <Input type="number" value={s.wait_ms} onChange={(e) => set({ wait_ms: Number(e.target.value) })} className="bg-slate-950 font-mono text-xs h-9" data-testid={`step-wait-${s.id}`} />;
  if (s.action === "press") return <Input value={s.text || ""} onChange={(e) => set({ text: e.target.value })} placeholder="Enter" className="bg-slate-950 font-mono text-xs h-9" data-testid={`step-key-${s.id}`} />;
  return <Input value={s.selector || ""} onChange={(e) => set({ selector: e.target.value })} placeholder='text="Sign in"' className="bg-slate-950 font-mono text-xs h-9" data-testid={`step-selector-${s.id}`} />;
}

function FallbackInput({ s, set }) {
  const [raw, setRaw] = useState((s.fallback_selectors || []).join(", "));
  useEffect(() => { setRaw((s.fallback_selectors || []).join(", ")); }, [s.fallback_selectors]);
  const commit = () => set({ fallback_selectors: raw.split(",").map((x) => x.trim()).filter(Boolean) });
  return <Input value={raw} onChange={(e) => setRaw(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === "Enter" && commit()} className="bg-slate-950 font-mono text-xs h-9" data-testid={`step-fallbacks-${s.id}`} />;
}

function Advanced({ s, set }) {
  return (
    <div className="grid sm:grid-cols-2 gap-4 pt-4 border-t border-slate-800">
      <div className="space-y-2"><p className={lbl}>Display time · {(s.duration_ms / 1000).toFixed(1)}s</p>
        <Slider min={500} max={10000} step={250} value={[s.duration_ms]} onValueChange={([v]) => set({ duration_ms: v })} data-testid={`step-duration-${s.id}`} /></div>
      <div className="space-y-2"><p className={lbl}>Transition · {s.transition === "fade" ? `${s.transition_ms}ms fade` : "cut"}</p>
        <div className="flex items-center gap-3">
          <Switch checked={s.transition === "fade"} onCheckedChange={(c) => set({ transition: c ? "fade" : "none" })} data-testid={`step-transition-toggle-${s.id}`} />
          <Slider disabled={s.transition !== "fade"} min={100} max={2000} step={50} value={[s.transition_ms]} onValueChange={([v]) => set({ transition_ms: v })} data-testid={`step-transition-ms-${s.id}`} />
        </div></div>
      <div className="space-y-2"><p className={lbl}>Settle wait after action (ms)</p>
        <Input type="number" value={s.wait_ms} onChange={(e) => set({ wait_ms: Number(e.target.value) })} className="bg-slate-950 font-mono text-xs h-9" data-testid={`step-settle-${s.id}`} /></div>
      {["click", "type", "hover"].includes(s.action) && (
        <div className="space-y-2"><p className={lbl}>Fallback selectors (comma separated)</p>
          <FallbackInput s={s} set={set} /></div>
      )}
      {s.action === "type" && (
        <label className="flex items-center gap-2 text-sm text-slate-300"><Switch checked={!!s.sensitive} onCheckedChange={(c) => set({ sensitive: c })} data-testid={`step-sensitive-${s.id}`} /> Sensitive input (mask value)</label>
      )}
      {s.resolved_selector && s.resolved_selector !== s.selector && <p className="text-xs text-amber-300 sm:col-span-2">Last run self-healed with fallback <code>{s.resolved_selector}</code></p>}
    </div>
  );
}

export const StepCard = ({ s, i, total, thumb, active, locked, busy, onChange, onMove, onDelete, onDuplicate, onSelect, onRerecord, onRepair }) => {
  const [open, setOpen] = useState(false);
  const drag = useDragControls();
  const set = (patch) => onChange(s.id, patch);
  return (
    <Reorder.Item value={s} dragListener={false} dragControls={drag} as="div"
      className={`rounded-xl border bg-slate-900/70 transition-colors ${active ? "border-indigo-500/60" : s.status === "failed" ? "border-red-500/40" : "border-slate-800"}`}
      data-testid={`step-card-${i}`} onFocus={() => onSelect(i)} onClick={() => onSelect(i)}>
      <fieldset disabled={locked} className="p-4 space-y-3 min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onPointerDown={(e) => drag.start(e)} aria-label="Drag to reorder" className="cursor-grab text-slate-600 hover:text-slate-300 touch-none"><GripVertical className="h-4 w-4" /></button>
          <span className="font-mono text-xs text-slate-500 w-6">{String(i + 1).padStart(2, "0")}</span>
          <div className="hidden sm:block h-10 w-16 rounded-md overflow-hidden bg-slate-950 border border-slate-800 shrink-0">
            {thumb && <img src={thumb} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover object-top" />}
          </div>
          <Select value={s.action} onValueChange={(v) => set({ action: v })}>
            <SelectTrigger className="w-28 h-9 bg-slate-950 font-mono text-xs" data-testid={`step-action-select-${s.id}`}><SelectValue /></SelectTrigger>
            <SelectContent>{ACTIONS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
          </Select>
          <div className="order-last sm:order-none basis-full sm:basis-auto flex-1 min-w-0"><Target s={s} set={set} /></div>
          <StatusBadge status={s.status} testId={`step-status-${s.id}`} />
        </div>
        {s.action === "type" && (
          <Input type={s.sensitive ? "password" : "text"} value={s.text || ""} onChange={(e) => set({ text: e.target.value })} placeholder="Text to type" className="bg-slate-950 font-mono text-xs h-9" data-testid={`step-text-${s.id}`} />
        )}
        <div className="grid md:grid-cols-2 gap-3">
          <div className="space-y-1"><p className={lbl}>Caption</p>
            <Textarea rows={2} value={s.caption} onChange={(e) => set({ caption: e.target.value })} className="bg-slate-950 text-sm resize-none" data-testid={`step-caption-${s.id}`} /></div>
          <div className="space-y-1"><p className={lbl}>AI voiceover {s.audio_path && s.audio_text === s.voiceover ? "· ready" : ""}</p>
            <Textarea rows={2} value={s.voiceover} onChange={(e) => set({ voiceover: e.target.value })} className="bg-slate-950 text-sm resize-none" data-testid={`step-voiceover-${s.id}`} /></div>
        </div>
        {s.error && (
          <div className="flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-xs text-red-300" data-testid={`step-error-${s.id}`}>
            <AlertTriangle className="h-4 w-4 shrink-0" /><span className="flex-1 font-mono break-all">{s.error}</span>
            {s.selector && <button type="button" onClick={() => onRepair(s.id)} disabled={busy} className="shrink-0 flex items-center gap-1 text-cyan-300 hover:text-cyan-200" data-testid={`step-repair-${s.id}`}><Wand2 className="h-3.5 w-3.5" /> Fix with AI</button>}
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button type="button" onClick={() => setOpen((o) => !o)} className="text-xs text-slate-400 hover:text-white flex items-center gap-1" data-testid={`step-advanced-toggle-${s.id}`}>
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} /> Timing & selectors
          </button>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => onRerecord(s.id)} disabled={busy} className="h-8 px-2 rounded-md text-xs text-slate-300 hover:bg-slate-800 flex items-center gap-1" data-testid={`step-rerecord-${s.id}`}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />} Re-record
            </button>
            <button type="button" aria-label="Move step up" disabled={i === 0} onClick={() => onMove(i, -1)} className="h-8 w-8 rounded-md hover:bg-slate-800 grid place-items-center disabled:opacity-30" data-testid={`step-up-${s.id}`}><ArrowUp className="h-3.5 w-3.5" /></button>
            <button type="button" aria-label="Move step down" disabled={i === total - 1} onClick={() => onMove(i, 1)} className="h-8 w-8 rounded-md hover:bg-slate-800 grid place-items-center disabled:opacity-30" data-testid={`step-down-${s.id}`}><ArrowDown className="h-3.5 w-3.5" /></button>
            <button type="button" aria-label="Duplicate step" onClick={() => onDuplicate(i)} className="h-8 w-8 rounded-md hover:bg-slate-800 grid place-items-center" data-testid={`step-duplicate-${s.id}`}><Copy className="h-3.5 w-3.5" /></button>
            <button type="button" aria-label="Delete step" onClick={() => onDelete(s.id)} className="h-8 w-8 rounded-md hover:bg-red-500/20 text-red-400 grid place-items-center" data-testid={`step-delete-${s.id}`}><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        </div>
        {open && <Advanced s={s} set={set} />}
      </fieldset>
    </Reorder.Item>
  );
};
