import { Loader2, Mic, Redo2, Sparkles, Undo2, Plus, Languages, WandSparkles, Zap } from "lucide-react";
import { HelpLink } from "@/components/HelpLink";
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
  resolved_selector: null, text: null, sensitive: false, amount: 640, wait_ms: 1200, caption: "", voiceover: "",
  duration_ms: 6000, transition: "fade", transition_ms: 800, screenshot_path: null, thumb_path: null, audio_voice: null,
  audio_path: null, audio_text: null, audio_duration_ms: null, hotspot: null, status: "pending", error: null, attempts: 0, page_url: null,
  voice: null, chapter: "", callout: "", treatment: "", annotations: [], comments: [], health_failed_path: null, screenshot_mobile_path: null,
});

export const ElementChips = ({ elements, pageUrl, onPickElement, onScanDown }) => elements?.length > 0 ? (
  <div className="rounded-xl border border-slate-800 p-4 space-y-2" data-testid="capture-elements">
    <p className="text-sm font-medium">Click an element to add the next step{pageUrl ? ` on ${pageUrl}` : ""}</p>
    <div className="flex flex-wrap gap-2">
      {elements.slice(0, 24).map((el, i) => (
        <button key={`${el.testid || el.id || el.text || "el"}-${i}`} onClick={() => onPickElement(el)} className="rounded-md border border-slate-700 px-2 py-1 text-xs hover:border-cyan-500" data-testid={`capture-element-${i}`}>
          {(el.text || el.aria || el.placeholder || el.tag || "element").slice(0, 42)}
        </button>
      ))}
      {onScanDown && <button type="button" onClick={onScanDown} className="rounded-md border border-cyan-500/40 px-2 py-1 text-xs text-cyan-200" data-testid="capture-scroll-button">Scan further down</button>}
    </div>
  </div>
) : null;

export const DraftTab = ({ meta, setMeta, onGenerate, onAutopilot, onChangelog, onImport, onCapture, busy, autoBusy, browserless, aiModel, elements, captureUrl, onPickElement }) => (
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
        {aiModel || "AI"} turns the draft into browser actions with captions & voiceover. {browserless ? "Browserless first scans the live page so selectors match real elements." : "Connect Browserless in Settings for selectors grounded in the live page."}
      </p>
      <div className="flex flex-wrap gap-2 shrink-0">
        <span className="inline-flex items-center">
          <button onClick={onGenerate} disabled={busy || autoBusy} data-testid="generate-script-button" data-help="generate-script"
            className="h-11 px-4 rounded-lg border border-indigo-500/40 bg-slate-950 hover:bg-indigo-500/10 font-medium flex items-center gap-2 disabled:opacity-60">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} {busy ? "Scripting…" : "Script only"}
          </button>
          <HelpLink topic="generate-script" label="Script only" />
        </span>
        <span className="inline-flex items-center">
          <button onClick={onChangelog} disabled={busy || autoBusy} data-testid="changelog-script-button" data-help="changelog-script"
            className="h-11 px-4 rounded-lg border border-slate-700 hover:bg-slate-800 text-sm disabled:opacity-60">From changelog</button>
          <HelpLink topic="changelog-script" label="From changelog" />
        </span>
        <span className="inline-flex items-center">
          <button onClick={() => onCapture()} disabled={autoBusy || !browserless} data-testid="capture-elements-button" data-help="capture-clicks"
            className="h-11 px-4 rounded-lg border border-slate-700 hover:bg-slate-800 text-sm disabled:opacity-60">Capture clicks</button>
          <HelpLink topic="capture-clicks" label="Capture clicks" />
        </span>
        <button onClick={onAutopilot} disabled={busy || autoBusy || !browserless} data-testid="autopilot-button" title={browserless ? "" : "Connect Browserless first"}
          className="h-11 px-5 rounded-lg bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-400 hover:to-cyan-400 font-semibold shadow-lg shadow-cyan-500/20 flex items-center gap-2 disabled:opacity-60 transition-[filter]">
          {autoBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />} Generate & record
        </button>
      </div>
    </div>
    <details className="rounded-xl border border-slate-800 bg-slate-900/40 p-4" data-testid="recording-setup">
      <summary className="cursor-pointer text-sm font-medium">Login, environments, and variables</summary>
      <div className="grid sm:grid-cols-2 gap-3 mt-4">
        <Input value={meta.login_url || ""} onChange={(e) => setMeta({ login_url: e.target.value })} placeholder="Login page URL" className="bg-slate-950 text-xs" data-testid="login-url-input" />
        <Input value={meta.login_username || ""} onChange={(e) => setMeta({ login_username: e.target.value })} placeholder="Username" className="bg-slate-950 text-xs" data-testid="login-username-input" />
        <Input type="password" value={meta.login_password || ""} onChange={(e) => setMeta({ login_password: e.target.value })} placeholder={meta.has_login ? "Password saved — type to replace" : "Password"} className="bg-slate-950 text-xs" data-testid="login-password-input" />
        <Select value={meta.active_environment || "production"} onValueChange={(v) => setMeta({ active_environment: v })}>
          <SelectTrigger className="bg-slate-950 h-9" data-testid="environment-select"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="production">Production host</SelectItem>
            <SelectItem value="staging">Staging host</SelectItem>
            <SelectItem value="local">Local host</SelectItem>
          </SelectContent>
        </Select>
        <Input value={(meta.environments || {}).staging || ""} onChange={(e) => setMeta({ environments: { ...(meta.environments || {}), staging: e.target.value } })} placeholder="https://staging.example.com" className="bg-slate-950 text-xs" data-testid="staging-url-input" />
        <Input value={(meta.environments || {}).local || ""} onChange={(e) => setMeta({ environments: { ...(meta.environments || {}), local: e.target.value } })} placeholder="http://localhost:3000" className="bg-slate-950 text-xs" data-testid="local-url-input" />
        <Input value={meta.variable_email || ""} onChange={(e) => setMeta({ variable_email: e.target.value, variables: { ...(meta.variables || {}), email: e.target.value } })} placeholder="{{email}} value" className="bg-slate-950 text-xs" data-testid="variable-email-input" />
        <Select value={meta.viewport || "desktop"} onValueChange={(v) => setMeta({ viewport: v })}>
          <SelectTrigger className="bg-slate-950 h-9" data-testid="viewport-select"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="desktop">Desktop 1280×800</SelectItem>
            <SelectItem value="mobile">Phone 390×844</SelectItem>
            <SelectItem value="both">Desktop and phone</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <p className="text-xs text-slate-500 mt-3">Typed steps can use {"{{email}}"}. The active host replaces the target URL’s host on go-to steps. A saved login runs before the first step and is not shown on the share page.</p>
      <div className="mt-3 flex gap-2">
        <Input value={meta.playwright_source || ""} onChange={(e) => setMeta({ playwright_source: e.target.value })} placeholder="Paste a Playwright test" className="bg-slate-950 text-xs" data-testid="playwright-source-input" />
        <span className="inline-flex items-center shrink-0">
          <button onClick={onImport} className="h-9 px-3 rounded-lg border border-slate-700 text-sm" data-testid="import-playwright-button" data-help="import-playwright">Import</button>
          <HelpLink topic="import-playwright" label="Import a Playwright test" />
        </span>
      </div>
    </details>
    <ElementChips elements={elements} pageUrl={captureUrl} onPickElement={onPickElement} />
  </div>
);

export const TimelineToolbar = ({ meta, setMeta, undo, redo, canUndo, canRedo, onAdd, onRewrite, rewriting, locked, onCapture, captureBusy, browserless }) => (
  <div className="flex flex-wrap items-center gap-2 pb-4">
    <button onClick={undo} disabled={!canUndo || locked} aria-label="Undo" className="h-9 w-9 rounded-lg border border-slate-700 hover:bg-slate-800 grid place-items-center disabled:opacity-30" data-testid="timeline-undo-button"><Undo2 className="h-4 w-4" /></button>
    <button onClick={redo} disabled={!canRedo || locked} aria-label="Redo" className="h-9 w-9 rounded-lg border border-slate-700 hover:bg-slate-800 grid place-items-center disabled:opacity-30" data-testid="timeline-redo-button"><Redo2 className="h-4 w-4" /></button>
    <button onClick={onAdd} disabled={locked} className="h-9 px-3 rounded-lg border border-slate-700 hover:bg-slate-800 text-sm flex items-center gap-1.5 disabled:opacity-30" data-testid="timeline-add-step-button"><Plus className="h-4 w-4" /> Step</button>
    <span className="inline-flex items-center">
      <button onClick={onCapture} disabled={locked || captureBusy || !browserless} className="h-9 px-3 rounded-lg border border-slate-700 hover:bg-slate-800 text-sm disabled:opacity-40" data-testid="timeline-capture-button" data-help="capture-clicks">{captureBusy ? "Scanning…" : "Capture clicks"}</button>
      <HelpLink topic="capture-clicks" label="Capture clicks" />
    </span>
    <DropdownMenu>
      <DropdownMenuTrigger disabled={locked || rewriting} className="h-9 px-3 rounded-lg border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10 text-sm flex items-center gap-1.5 disabled:opacity-40" data-testid="timeline-ai-rewrite-button">
        {rewriting ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />} AI rewrite
      </DropdownMenuTrigger>
      <DropdownMenuContent className="bg-slate-950 border-slate-800 w-64">
        <DropdownMenuLabel className="text-xs text-slate-500">Tone</DropdownMenuLabel>
        {TONES.map((t, i) => <DropdownMenuItem key={t} onClick={() => onRewrite(t)} data-testid={`rewrite-tone-${i}`}>{t}</DropdownMenuItem>)}
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
