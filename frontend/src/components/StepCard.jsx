import { useEffect, useState } from "react";
import { Reorder, useDragControls } from "framer-motion";
import { AuthedImg } from "@/components/AuthedImg";
import { AlertTriangle, ArrowDown, ArrowUp, ChevronDown, Copy, GripVertical, Loader2, RotateCcw, Trash2, Wand2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";

const ACTIONS = ["goto", "click", "type", "hover", "scroll", "press", "wait", "assert"];
const VOICES = ["", "alloy", "ash", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer"];
const lbl = "font-mono text-[10px] uppercase tracking-wider text-slate-500";

function Target({ s, set }) {
  if (s.action === "goto") return <Input value={s.url || ""} onChange={(e) => set({ url: e.target.value })} placeholder="https://…" className="bg-slate-950 font-mono text-xs h-9" data-testid={`step-url-${s.id}`} />;
  if (s.action === "scroll") return <Input type="number" value={s.amount} onChange={(e) => set({ amount: Number(e.target.value) })} className="bg-slate-950 font-mono text-xs h-9" data-testid={`step-amount-${s.id}`} />;
  if (s.action === "wait") return <Input type="number" value={s.wait_ms} onChange={(e) => set({ wait_ms: Number(e.target.value) })} className="bg-slate-950 font-mono text-xs h-9" data-testid={`step-wait-${s.id}`} />;
  if (s.action === "press") return <Input value={s.text || ""} onChange={(e) => set({ text: e.target.value })} placeholder="Enter" className="bg-slate-950 font-mono text-xs h-9" data-testid={`step-key-${s.id}`} />;
  if (s.action === "assert") return <Input value={s.text || ""} onChange={(e) => set({ text: e.target.value })} placeholder="Text the page must contain" className="bg-slate-950 font-mono text-xs h-9" data-testid={`step-assert-${s.id}`} />;
  return <Input value={s.selector || ""} onChange={(e) => set({ selector: e.target.value })} placeholder='text="Sign in"' className="bg-slate-950 font-mono text-xs h-9" data-testid={`step-selector-${s.id}`} />;
}

function ChoiceInput({ s, set }) {
  const text = (s.choices || []).map((c) => `${c.label}|${c.branch}`).join(", ");
  const [raw, setRaw] = useState(text);
  useEffect(() => { setRaw(text); }, [text]);
  const commit = () => set({ choices: raw.split(",").map((pair) => pair.split("|").map((part) => part.trim())).filter((pair) => pair[0] && pair[1]).map(([label, branch]) => ({ label, branch })) });
  return <Input value={raw} onChange={(e) => setRaw(e.target.value)} onBlur={commit} placeholder="Admin|admin, Reports|reports" className="bg-slate-950 text-xs h-8" data-testid={`step-choices-${s.id}`} />;
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
      <div className="space-y-2"><p className={lbl}>Hold this scene · {(s.duration_ms / 1000).toFixed(1)}s</p>
        <Slider min={500} max={15000} step={250} value={[s.duration_ms]} onValueChange={([v]) => set({ duration_ms: v })} data-testid={`step-duration-${s.id}`} /></div>
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
      <div className="space-y-2"><p className={lbl}>Chapter</p>
        <Input value={s.chapter || ""} onChange={(e) => set({ chapter: e.target.value })} placeholder="Getting started" className="bg-slate-950 text-xs h-9" data-testid={`step-chapter-${s.id}`} /></div>
      <div className="space-y-2"><p className={lbl}>Voice for this step</p>
        <Select value={s.voice || "project"} onValueChange={(v) => set({ voice: v === "project" ? null : v })}>
          <SelectTrigger className="bg-slate-950 h-9 capitalize" data-testid={`step-voice-${s.id}`}><SelectValue /></SelectTrigger>
          <SelectContent>{VOICES.map((v) => <SelectItem key={v || "project"} value={v || "project"} className="capitalize">{v || "Project default"}</SelectItem>)}</SelectContent>
        </Select></div>
      <div className="sm:col-span-2 flex flex-wrap gap-2">
        <button type="button" onClick={() => set({ annotations: [...(s.annotations || []), { kind: "blur", x: 480, y: 280, w: 240, h: 80 }] })} className="h-8 px-2 rounded-md border border-slate-700 text-xs" data-testid={`step-blur-${s.id}`}>Add blur</button>
        <button type="button" onClick={() => set({ annotations: [...(s.annotations || []), { kind: "arrow", x: 640, y: 360 }] })} className="h-8 px-2 rounded-md border border-slate-700 text-xs" data-testid={`step-arrow-${s.id}`}>Add arrow</button>
        <button type="button" onClick={() => set({ annotations: [...(s.annotations || []), { kind: "zoom", x: 520, y: 240, w: 220, h: 140 }] })} className="h-8 px-2 rounded-md border border-slate-700 text-xs" data-testid={`step-zoom-${s.id}`}>Add zoom</button>
        {(s.annotations || []).length > 0 && <button type="button" onClick={() => set({ annotations: [] })} className="h-8 px-2 rounded-md text-xs text-slate-400">Clear marks</button>}
      </div>
      {(s.annotations || []).length > 0 && (
        <div className="relative h-28 w-44 rounded-md border border-slate-700 bg-slate-950 overflow-hidden" data-testid={`mark-stage-${s.id}`}
          onPointerDown={(e) => {
            const box = e.currentTarget.getBoundingClientRect();
            const x = Math.round(((e.clientX - box.left) / box.width) * 1280);
            const y = Math.round(((e.clientY - box.top) / box.height) * 800);
            const next = (s.annotations || []).map((ann, index) => index === 0 ? { ...ann, x, y } : ann);
            set({ annotations: next });
          }}>
          {(s.annotations || []).map((ann, index) => (
            <span key={index} className="absolute border border-cyan-300" style={{ left: `${(ann.x / 1280) * 100}%`, top: `${(ann.y / 800) * 100}%`, width: ann.w ? `${(ann.w / 1280) * 100}%` : 8, height: ann.h ? `${(ann.h / 800) * 100}%` : 8 }} />
          ))}
        </div>
      )}
      <div className="sm:col-span-2 grid sm:grid-cols-2 gap-2">
        <Input value={s.branch || ""} onChange={(e) => set({ branch: e.target.value })} placeholder="Branch name (blank = always show)" className="bg-slate-950 text-xs h-8" data-testid={`step-branch-${s.id}`} />
        <ChoiceInput s={s} set={set} />
        <Input value={s.caption_alt || ""} onChange={(e) => set({ caption_alt: e.target.value })} placeholder="Alternate caption" className="bg-slate-950 text-xs h-8" data-testid={`step-caption-alt-${s.id}`} />
        <Input value={s.voiceover_alt || ""} onChange={(e) => set({ voiceover_alt: e.target.value })} placeholder="Alternate voiceover" className="bg-slate-950 text-xs h-8" data-testid={`step-voiceover-alt-${s.id}`} />
      </div>
      {s.resolved_selector && s.resolved_selector !== s.selector && <p className="text-xs text-amber-300 sm:col-span-2">Last run self-healed with fallback <code>{s.resolved_selector}</code></p>}
    </div>
  );
}

export const StepCard = ({ s, i, total, thumb, failedThumb, active, locked, busy, onChange, onMove, onDelete, onDuplicate, onSelect, onRerecord, onRepair, onComment, onCaptureAfter }) => {
  const [note, setNote] = useState("");
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
          <div className={`hidden sm:flex h-10 ${failedThumb ? "w-32" : "w-16"} rounded-md overflow-hidden bg-slate-950 border border-slate-800 shrink-0`}>
            {thumb && <AuthedImg src={thumb} alt="" loading="lazy" decoding="async" className={`h-full ${failedThumb ? "w-1/2" : "w-full"} object-cover object-top`} />}
            {failedThumb && <AuthedImg src={failedThumb} alt="Frame from the failed health check" className="h-full w-1/2 object-cover object-top border-l border-red-500/50" data-testid={`step-health-diff-${s.id}`} />}
          </div>
          <Select value={s.action} onValueChange={(v) => set({ action: v })}>
            <SelectTrigger className="w-28 h-9 bg-slate-950 font-mono text-xs" data-testid={`step-action-select-${s.id}`}><SelectValue /></SelectTrigger>
            <SelectContent>{ACTIONS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
          </Select>
          <div className="order-last sm:order-none basis-full sm:basis-auto flex-1 min-w-0"><Target s={s} set={set} /></div>
          {s.regression && <span className="rounded-full border border-red-500/40 bg-red-500/10 px-2 py-0.5 font-mono text-[10px] uppercase text-red-300" data-testid={`step-regression-${s.id}`}>Broke after UI change</span>}
          {s.visual_change && <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] uppercase text-amber-200" data-testid={`step-visual-${s.id}`}>Picture changed</span>}
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
        <div className="grid md:grid-cols-[1fr_11rem] gap-3">
          <div className="space-y-1"><p className={lbl}>On-screen callout</p>
            <Input value={s.callout || ""} onChange={(e) => set({ callout: e.target.value })} placeholder="The promise" className="bg-slate-950 text-sm h-9" data-testid={`step-callout-${s.id}`} /></div>
          <div className="space-y-1"><p className={lbl}>Shot</p>
            <Select value={s.treatment || "none"} onValueChange={(v) => set({ treatment: v === "none" ? "" : v })}>
              <SelectTrigger className="bg-slate-950 h-9" data-testid={`step-treatment-${s.id}`}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Recorder decides</SelectItem>
                <SelectItem value="establish">Establish</SelectItem>
                <SelectItem value="highlight">Highlight</SelectItem>
                <SelectItem value="callout">Callout</SelectItem>
                <SelectItem value="hover">Hover</SelectItem>
              </SelectContent>
            </Select></div>
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
            {onCaptureAfter && <button type="button" onClick={() => onCaptureAfter(i)} disabled={busy} className="h-8 px-2 rounded-md text-xs text-slate-300 hover:bg-slate-800" data-testid={`step-capture-next-${s.id}`}>Capture next</button>}
            <button type="button" onClick={() => onRerecord(s.id)} disabled={busy} className="h-8 px-2 rounded-md text-xs text-slate-300 hover:bg-slate-800 flex items-center gap-1" data-testid={`step-rerecord-${s.id}`}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />} Re-record
            </button>
            <button type="button" aria-label="Move step up" disabled={i === 0} onClick={() => onMove(i, -1)} className="h-8 w-8 rounded-md hover:bg-slate-800 grid place-items-center disabled:opacity-30" data-testid={`step-up-${s.id}`}><ArrowUp className="h-3.5 w-3.5" /></button>
            <button type="button" aria-label="Move step down" disabled={i === total - 1} onClick={() => onMove(i, 1)} className="h-8 w-8 rounded-md hover:bg-slate-800 grid place-items-center disabled:opacity-30" data-testid={`step-down-${s.id}`}><ArrowDown className="h-3.5 w-3.5" /></button>
            <button type="button" aria-label="Duplicate step" onClick={() => onDuplicate(i)} className="h-8 w-8 rounded-md hover:bg-slate-800 grid place-items-center" data-testid={`step-duplicate-${s.id}`}><Copy className="h-3.5 w-3.5" /></button>
            <button type="button" aria-label="Delete step" onClick={() => onDelete(s.id)} className="h-8 w-8 rounded-md hover:bg-red-500/20 text-red-400 grid place-items-center" data-testid={`step-delete-${s.id}`}><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        </div>
        {(s.comments || []).length > 0 && <ul className="text-xs text-slate-400 space-y-1" data-testid={`step-comments-${s.id}`}>{s.comments.map((c) => <li key={c.id}><span className="text-slate-200">{c.author}:</span> {c.text}</li>)}</ul>}
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (!note.trim()) return; onComment(s.id, note.trim()); setNote(""); }}>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Comment for review" className="bg-slate-950 h-8 text-xs" data-testid={`step-comment-input-${s.id}`} />
          <button className="h-8 px-2 rounded-md border border-slate-700 text-xs" data-testid={`step-comment-save-${s.id}`}>Note</button>
        </form>
        {open && <Advanced s={s} set={set} />}
      </fieldset>
    </Reorder.Item>
  );
};
