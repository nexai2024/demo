import { Reorder, useDragControls } from "framer-motion";
import { ArrowDown, ArrowUp, Copy, GripVertical, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const lbl = "font-mono text-[10px] uppercase tracking-wider text-slate-500";
const SCENE_LABEL = { title: "Title scene", credits: "Credits scene", email: "Email scene", waitlist: "Waitlist scene", cta: "CTA scene" };
const isForm = (t) => t === "email" || t === "waitlist";
const hasButton = (t) => ["credits", "cta", "email", "waitlist"].includes(t);

export const SceneCard = ({ s, i, total, active, locked, onChange, onMove, onDelete, onDuplicate, onSelect }) => {
  const drag = useDragControls();
  const cfg = s.scene || {};
  const set = (patch) => onChange(s.id, patch);
  const setCfg = (patch) => {
    const scene = { ...cfg, ...patch };
    set(patch.title !== undefined ? { scene, caption: patch.title } : { scene });
  };
  return (
    <Reorder.Item value={s} dragListener={false} dragControls={drag} as="div"
      className={`rounded-xl border bg-slate-900/70 transition-colors ${active ? "border-indigo-500/60" : "border-indigo-500/25"}`}
      data-testid={`scene-card-${i}`} onFocus={() => onSelect(i)} onClick={() => onSelect(i)}>
      <fieldset disabled={locked} className="p-4 space-y-3 min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onPointerDown={(e) => drag.start(e)} aria-label="Drag to reorder" className="cursor-grab text-slate-600 hover:text-slate-300 touch-none"><GripVertical className="h-4 w-4" /></button>
          <span className="font-mono text-xs text-slate-500 w-6">{String(i + 1).padStart(2, "0")}</span>
          <span className="rounded-full border border-indigo-500/40 bg-indigo-500/10 px-2.5 py-1 text-xs font-medium text-indigo-200" data-testid={`scene-type-${s.id}`}>{SCENE_LABEL[s.scene_type] || "Scene"}</span>
          <span className="text-xs text-slate-500">Rendered by the player — not recorded</span>
          <div className="flex-1" />
          <button type="button" aria-label="Move scene up" disabled={i === 0} onClick={() => onMove(i, -1)} className="h-8 w-8 rounded-md hover:bg-slate-800 grid place-items-center disabled:opacity-30" data-testid={`scene-up-${s.id}`}><ArrowUp className="h-3.5 w-3.5" /></button>
          <button type="button" aria-label="Move scene down" disabled={i === total - 1} onClick={() => onMove(i, 1)} className="h-8 w-8 rounded-md hover:bg-slate-800 grid place-items-center disabled:opacity-30" data-testid={`scene-down-${s.id}`}><ArrowDown className="h-3.5 w-3.5" /></button>
          <button type="button" aria-label="Duplicate scene" onClick={() => onDuplicate(i)} className="h-8 w-8 rounded-md hover:bg-slate-800 grid place-items-center" data-testid={`scene-duplicate-${s.id}`}><Copy className="h-3.5 w-3.5" /></button>
          <button type="button" aria-label="Delete scene" onClick={() => onDelete(s.id)} className="h-8 w-8 rounded-md hover:bg-red-500/20 text-red-400 grid place-items-center" data-testid={`scene-delete-${s.id}`}><Trash2 className="h-3.5 w-3.5" /></button>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <div className="space-y-1"><p className={lbl}>Headline</p>
            <Input value={cfg.title || ""} onChange={(e) => setCfg({ title: e.target.value })} placeholder="Your product, in two minutes" className="bg-slate-950 text-sm h-9" data-testid={`scene-title-${s.id}`} /></div>
          <div className="space-y-1"><p className={lbl}>Subheadline / body</p>
            <Input value={cfg.subtitle || ""} onChange={(e) => setCfg({ subtitle: e.target.value })} placeholder="One line of context" className="bg-slate-950 text-sm h-9" data-testid={`scene-subtitle-${s.id}`} /></div>
        </div>

        {hasButton(s.scene_type) && (
          <div className="grid md:grid-cols-2 gap-3">
            <div className="space-y-1"><p className={lbl}>Button label</p>
              <Input value={cfg.button_label || ""} onChange={(e) => setCfg({ button_label: e.target.value })} placeholder="Continue" className="bg-slate-950 text-sm h-9" data-testid={`scene-button-${s.id}`} /></div>
            {(s.scene_type === "credits" || s.scene_type === "cta") && (
              <div className="space-y-1"><p className={lbl}>Button link (optional)</p>
                <Input value={cfg.cta_url || ""} onChange={(e) => setCfg({ cta_url: e.target.value })} placeholder="https://…" className="bg-slate-950 font-mono text-xs h-9" data-testid={`scene-cta-url-${s.id}`} /></div>
            )}
          </div>
        )}

        {isForm(s.scene_type) && (
          <div className="grid md:grid-cols-2 gap-3">
            <div className="space-y-1"><p className={lbl}>Email placeholder</p>
              <Input value={cfg.placeholder || ""} onChange={(e) => setCfg({ placeholder: e.target.value })} placeholder="you@company.com" className="bg-slate-950 text-sm h-9" data-testid={`scene-placeholder-${s.id}`} /></div>
            <div className="space-y-1"><p className={lbl}>Success headline</p>
              <Input value={cfg.success_title || ""} onChange={(e) => setCfg({ success_title: e.target.value })} placeholder="You're in" className="bg-slate-950 text-sm h-9" data-testid={`scene-success-${s.id}`} /></div>
            <div className="space-y-1 md:col-span-2"><p className={lbl}>Success message</p>
              <Textarea rows={2} value={cfg.success_body || ""} onChange={(e) => setCfg({ success_body: e.target.value })} className="bg-slate-950 text-sm resize-none" data-testid={`scene-success-body-${s.id}`} /></div>
            {s.scene_type === "waitlist" && (
              <label className="flex items-center gap-2 text-sm text-slate-300"><Switch checked={cfg.collect_name !== false} onCheckedChange={(c) => setCfg({ collect_name: c })} data-testid={`scene-collect-name-${s.id}`} /> Also ask for a name</label>
            )}
            <label className="flex items-center gap-2 text-sm text-slate-300"><Switch checked={!!cfg.notify_owner} onCheckedChange={(c) => setCfg({ notify_owner: c })} data-testid={`scene-notify-${s.id}`} /> Notify me on signup (project notification URL)</label>
            <div className="space-y-1 md:col-span-2"><p className={lbl}>Lead webhook URL (optional, per scene)</p>
              <Input value={cfg.webhook_url || ""} onChange={(e) => setCfg({ webhook_url: e.target.value })} placeholder="https://hooks.example.com/leads" className="bg-slate-950 font-mono text-xs h-9" data-testid={`scene-webhook-${s.id}`} /></div>
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-4 pt-3 border-t border-slate-800">
          <div className="space-y-2"><p className={lbl}>How this scene ends</p>
            <Select value={s.exit_trigger || "timer"} onValueChange={(v) => set({ exit_trigger: v })}>
              <SelectTrigger className="bg-slate-950 h-9" data-testid={`scene-trigger-${s.id}`}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="timer">After a timer</SelectItem>
                <SelectItem value="continue">When the viewer clicks Continue</SelectItem>
                <SelectItem value="submit">After a valid email is submitted</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-500">
              {s.exit_trigger === "submit" ? "Playback pauses here until a valid email arrives. The lead lands in Analytics." : s.exit_trigger === "continue" ? "Playback pauses here until the viewer clicks." : "Playback moves on by itself after the duration below."}
            </p>
          </div>
          <div className="space-y-3">
            <div className="space-y-2"><p className={lbl}>On screen · {((s.duration_ms || 4000) / 1000).toFixed(1)}s {s.exit_trigger !== "timer" && "(exports only)"}</p>
              <Slider min={1000} max={30000} step={500} value={[s.duration_ms || 4000]} onValueChange={([v]) => set({ duration_ms: v })} data-testid={`scene-duration-${s.id}`} /></div>
            <label className="flex items-center gap-2 text-sm text-slate-300"><Switch checked={!!s.skippable} onCheckedChange={(c) => set({ skippable: c })} data-testid={`scene-skippable-${s.id}`} /> Let viewers skip this scene</label>
          </div>
        </div>
      </fieldset>
    </Reorder.Item>
  );
};
