import { Loader2, Mic, Redo2, Sparkles, Undo2, Plus, Languages, WandSparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

export const VOICES = ["alloy", "ash", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer"];
const TONES = ["Make it more concise", "Make it friendlier and warmer", "Make it more technical for developers", "Make it sales-focused with clear benefits"];
const LANGS = ["Spanish", "German", "French", "Japanese", "Portuguese", "Hindi"];

export const newStep = () => ({
  id: `st_${Math.random().toString(16).slice(2, 14)}`, action: "click", url: null, selector: "", fallback_selectors: [],
  resolved_selector: null, text: null, sensitive: false, amount: 600, wait_ms: 800, caption: "", voiceover: "",
  duration_ms: 3000, transition: "fade", transition_ms: 400, screenshot_path: null, thumb_path: null, audio_voice: null,
  audio_path: null, audio_text: null, audio_duration_ms: null, hotspot: null, status: "pending", error: null, attempts: 0, page_url: null,
});

export const DraftTab = ({ meta, setMeta, onGenerate, busy, browserless }) => (
  <div className="space-y-5" data-testid="draft-script-engine">
    <div className="space-y-1.5">
      <p className="font-mono text-[10px] uppercase tracking-wider text-slate-500">Target app URL</p>
      <Input value={meta.target_url} onChange={(e) => setMeta({ target_url: e.target.value })} placeholder="https://app.yourproduct.com" className="bg-slate-950 font-mono text-sm" data-testid="draft-target-url-input" />
    </div>
    <div className="space-y-1.5">
      <p className="font-mono text-[10px] uppercase tracking-wider text-slate-500">Draft · feature spec · release notes</p>
      <Textarea rows={14} value={meta.draft} onChange={(e) => setMeta({ draft: e.target.value })} className="bg-slate-950 font-mono text-xs leading-relaxed"
        placeholder={"- Log in with demo@acme.io\n- Open Settings → Billing\n- Hover the usage chart"} data-testid="draft-textarea" />
    </div>
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4">
      <p className="text-xs text-slate-400 max-w-md">
        Claude Sonnet 5.5 turns the draft into browser actions with captions & voiceover. {browserless ? "Browserless first scans the live page so selectors match real elements." : "Connect Browserless in Settings for selectors grounded in the live page."}
      </p>
      <button onClick={onGenerate} disabled={busy} data-testid="generate-script-button"
        className="shrink-0 h-11 px-5 rounded-lg bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-400 hover:to-cyan-400 font-semibold shadow-lg shadow-cyan-500/20 flex items-center gap-2 disabled:opacity-60 transition-[filter]">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} {busy ? "Scripting…" : "Generate script"}
      </button>
    </div>
  </div>
);

export const TimelineToolbar = ({ meta, setMeta, undo, redo, canUndo, canRedo, onAdd, onRewrite, rewriting, locked }) => (
  <div className="flex flex-wrap items-center gap-2 pb-4">
    <button onClick={undo} disabled={!canUndo || locked} aria-label="Undo" className="h-9 w-9 rounded-lg border border-slate-700 hover:bg-slate-800 grid place-items-center disabled:opacity-30" data-testid="timeline-undo-button"><Undo2 className="h-4 w-4" /></button>
    <button onClick={redo} disabled={!canRedo || locked} aria-label="Redo" className="h-9 w-9 rounded-lg border border-slate-700 hover:bg-slate-800 grid place-items-center disabled:opacity-30" data-testid="timeline-redo-button"><Redo2 className="h-4 w-4" /></button>
    <button onClick={onAdd} disabled={locked} className="h-9 px-3 rounded-lg border border-slate-700 hover:bg-slate-800 text-sm flex items-center gap-1.5 disabled:opacity-30" data-testid="timeline-add-step-button"><Plus className="h-4 w-4" /> Step</button>
    <DropdownMenu>
      <DropdownMenuTrigger disabled={locked || rewriting} className="h-9 px-3 rounded-lg border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10 text-sm flex items-center gap-1.5 disabled:opacity-40" data-testid="timeline-ai-rewrite-button">
        {rewriting ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />} AI rewrite
      </DropdownMenuTrigger>
      <DropdownMenuContent className="bg-slate-950 border-slate-800 w-64">
        <DropdownMenuLabel className="text-xs text-slate-500">Tone</DropdownMenuLabel>
        {TONES.map((t) => <DropdownMenuItem key={t} onClick={() => onRewrite(t)} data-testid={`rewrite-${t.split(" ")[2]}`}>{t}</DropdownMenuItem>)}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-slate-500 flex items-center gap-1"><Languages className="h-3 w-3" /> Translate</DropdownMenuLabel>
        {LANGS.map((l) => <DropdownMenuItem key={l} onClick={() => onRewrite(`Translate captions and voiceover to ${l}`)} data-testid={`translate-${l}`}>{l}</DropdownMenuItem>)}
      </DropdownMenuContent>
    </DropdownMenu>
    <div className="flex-1" />
    <Select value={meta.narration_mode} onValueChange={(v) => setMeta({ narration_mode: v })}>
      <SelectTrigger className="w-40 h-9 bg-slate-950 text-xs" data-testid="narration-mode-select"><SelectValue /></SelectTrigger>
      <SelectContent><SelectItem value="both">Captions + voice</SelectItem><SelectItem value="captions">Captions only</SelectItem><SelectItem value="voiceover">Voiceover only</SelectItem></SelectContent>
    </Select>
    <Select value={meta.voice} onValueChange={(v) => setMeta({ voice: v })}>
      <SelectTrigger className="w-28 h-9 bg-slate-950 text-xs capitalize" data-testid="voice-select"><Mic className="h-3.5 w-3.5" /><SelectValue /></SelectTrigger>
      <SelectContent>{VOICES.map((v) => <SelectItem key={v} value={v} className="capitalize">{v}</SelectItem>)}</SelectContent>
    </Select>
  </div>
);

export const CommandPalette = ({ open, onOpenChange, actions }) => (
  <CommandDialog open={open} onOpenChange={onOpenChange}>
    <CommandInput placeholder="Type a command…" data-testid="command-palette-input" />
    <CommandList>
      <CommandEmpty>No command found.</CommandEmpty>
      <CommandGroup heading="Studio">
        {actions.map((a) => (
          <CommandItem key={a.label} onSelect={() => { onOpenChange(false); a.run(); }} data-testid={`command-${a.id}`}>
            <a.icon className="h-4 w-4 mr-2" />{a.label}
          </CommandItem>
        ))}
      </CommandGroup>
    </CommandList>
  </CommandDialog>
);
