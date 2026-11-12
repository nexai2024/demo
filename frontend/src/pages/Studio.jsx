import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Reorder, motion } from "framer-motion";
import { toast } from "sonner";
import { ArrowLeft, Check, Clapperboard, Command, Film, Image as ImageIcon, Loader2, Mic, Plus, Sparkles, Square, WifiOff, History as HistoryIcon, Share2 } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { DemoPlayer } from "@/components/DemoPlayer";
import { RunConsole } from "@/components/RunConsole";
import { StepCard } from "@/components/StepCard";
import { ExportPanel, AnalyticsPanel } from "@/components/ExportPanel";
import { HistorySheet } from "@/components/HistorySheet";
import { StatusBadge } from "@/components/StatusBadge";
import { CommandPalette, DraftTab, TimelineToolbar, newStep } from "@/components/StudioParts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, API, errMsg, stepAsset } from "@/lib/api";
import { useOnline, useRun, useUndoable } from "@/hooks/useStudio";

const pickMeta = (p) => ({ name: p.name, draft: p.draft, target_url: p.target_url, voice: p.voice, narration_mode: p.narration_mode, brand: p.brand || {} });
const isField = (el) => ["INPUT", "TEXTAREA"].includes(el?.tagName) || el?.isContentEditable;

function SaveIndicator({ state }) {
  const map = { saving: [Loader2, "Saving…", "animate-spin"], saved: [Check, "Saved", ""], dirty: [Loader2, "Unsaved", ""], error: [WifiOff, "Save failed", ""], offline: [WifiOff, "Offline", ""] };
  const [Icon, label, cls] = map[state] || map.saved;
  return <span className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 font-mono" data-testid="save-indicator"><Icon className={`h-3 w-3 ${cls}`} />{label}</span>;
}

export default function Studio() {
  const { pid } = useParams();
  const [project, setProject] = useState(null);
  const [meta, setMetaState] = useState(null);
  const steps = useUndoable([]);
  const savedRef = useRef("");
  const [saveState, setSaveState] = useState("saved");
  const [selected, setSelected] = useState(0);
  const [tab, setTab] = useState("draft");
  const [busy, setBusy] = useState("");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [settings, setSettings] = useState(null);
  const online = useOnline();

  const snapshot = useMemo(() => (meta ? JSON.stringify({ meta, steps: steps.value }) : ""), [meta, steps.value]);
  const dirty = !!meta && snapshot !== savedRef.current;

  const applyServer = useCallback((p, mode = "reset") => {
    const m = pickMeta(p);
    setProject(p);
    setMetaState(m);
    steps[mode](p.steps);
    savedRef.current = JSON.stringify({ meta: m, steps: p.steps });
    setSaveState("saved");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps.reset, steps.set, steps.replace]);

  const refetch = useCallback((mode = "replace") => api.get(`/projects/${pid}`).then(({ data }) => applyServer(data, mode)), [pid, applyServer]);

  const { run, setRun, running } = useRun({
    onUpdate: (r) => {
      if (["record", "rerecord", "voiceover"].includes(r.kind)) refetch();
      if (r.kind === "record" && r.current) setSelected(r.current - 1);
    },
    onDone: (r) => {
      refetch();
      if (r.status === "completed") toast.success(r.message, r.result?.id ? { action: { label: "Download", onClick: () => (window.location.href = `${API}/projects/${pid}/exports/${r.result.id}/download`) } } : undefined);
      else if (r.status === "cancelled") toast.message(r.message);
      else toast.error(r.message);
    },
  });

  useEffect(() => {
    api.get(`/projects/${pid}`).then(({ data }) => {
      applyServer(data);
      if (data.steps.length) setTab("timeline");
      if (data.active_run_id) api.get(`/runs/${data.active_run_id}`).then((r) => setRun(r.data)).catch(() => {});
    }).catch((e) => toast.error(errMsg(e)));
    api.get("/settings").then((r) => setSettings(r.data)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pid]);

  const save = useCallback(async () => {
    if (!meta || snapshot === savedRef.current) return;
    const sent = snapshot;
    setSaveState("saving");
    try {
      const { data } = await api.put(`/projects/${pid}`, { ...meta, steps: steps.value });
      setProject(data);
      savedRef.current = sent;
      setSaveState("saved");
    } catch (e) {
      setSaveState("error");
      throw e;
    }
  }, [meta, snapshot, pid, steps.value]);

  useEffect(() => {
    if (!dirty || running) return;
    if (!online) { setSaveState("offline"); return; }
    setSaveState("dirty");
    const t = setTimeout(() => save().catch(() => {}), 1200);
    return () => clearTimeout(t);
  }, [dirty, online, running, save]);

  useEffect(() => {
    const h = (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const act = async (key, fn) => {
    setBusy(key);
    try { await save(); await fn(); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(""); }
  };

  const setMeta = (patch) => setMetaState((m) => ({ ...m, ...patch }));
  const onPatch = async (patch) => {
    if ("is_public" in patch) {
      try { const { data } = await api.put(`/projects/${pid}`, { is_public: patch.is_public }); setProject(data); } catch (e) { toast.error(errMsg(e)); }
    } else setMeta(patch);
  };

  const generate = () => act("generate", async () => {
    const { data } = await api.post(`/projects/${pid}/generate`, {});
    applyServer(data, "set");
    setTab("timeline");
    toast.success(`Scripted ${data.steps.length} steps${data.inspected_elements ? ` · ${data.inspected_elements} live elements scanned` : ""}`);
  });
  const startRun = (key, url, body) => act(key, async () => { const { data } = await api.post(url, body || {}); setRun(data); refetch(); });
  const record = () => startRun("record", `/projects/${pid}/record`);
  const voiceover = () => startRun("voiceover", `/projects/${pid}/voiceover`);
  const exportAs = (fmt) => startRun("export", `/projects/${pid}/export`, { format: fmt });
  const rerecord = (sid) => startRun(`rerecord-${sid}`, `/projects/${pid}/steps/${sid}/rerecord`);
  const cancel = () => api.post(`/runs/${run.id}/cancel`).catch((e) => toast.error(errMsg(e)));
  const rewrite = (instruction) => act("rewrite", async () => { const { data } = await api.post(`/projects/${pid}/rewrite`, { instruction }); applyServer(data, "set"); toast.success("Narration rewritten — undo with ⌘Z"); });
  const repair = (sid) => act(`repair-${sid}`, async () => { const { data } = await api.post(`/projects/${pid}/steps/${sid}/repair`, {}); applyServer(data, "set"); toast.success(data.repair_reason || "Selector repaired"); });
  const restore = (hid) => act("restore", async () => { const { data } = await api.post(`/projects/${pid}/history/${hid}/restore`); applyServer(data, "set"); setHistoryOpen(false); toast.success("Version restored"); });

  const editStep = (id, patch) => steps.set((arr) => arr.map((s) => (s.id === id ? { ...s, ...patch } : s)), { coalesce: true });
  const moveStep = (i, d) => steps.set((arr) => { const a = [...arr]; [a[i], a[i + d]] = [a[i + d], a[i]]; return a; });
  const delStep = (id) => steps.set((arr) => arr.filter((s) => s.id !== id));
  const dupStep = (i) => steps.set((arr) => { const a = [...arr]; a.splice(i + 1, 0, { ...arr[i], ...newStep(), action: arr[i].action, selector: arr[i].selector, url: arr[i].url, caption: arr[i].caption, voiceover: arr[i].voiceover }); return a; });
  const addStep = () => { steps.set((arr) => [...arr, newStep()]); setSelected(steps.value.length); };

  useEffect(() => {
    const h = (e) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") { e.preventDefault(); setPaletteOpen((o) => !o); }
      else if (mod && e.key.toLowerCase() === "z" && !isField(e.target)) { e.preventDefault(); e.shiftKey ? steps.redo() : steps.undo(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [steps]);

  if (!project || !meta) return <div className="min-h-screen grid place-items-center"><Loader2 className="h-6 w-6 animate-spin text-indigo-400" /></div>;

  const list = steps.value;
  const playerSteps = list;
  const captured = list.filter((s) => s.screenshot_path);
  const shareUrl = `${window.location.origin}/share/${project.share_id}`;
  const paletteActions = [
    { id: "generate", label: "Generate script with AI", icon: Sparkles, run: generate },
    { id: "record", label: "Record demo in Browserless", icon: Clapperboard, run: record },
    { id: "voiceover", label: "Generate voiceover", icon: Mic, run: voiceover },
    { id: "export-mp4", label: "Export MP4", icon: Film, run: () => exportAs("mp4") },
    { id: "export-gif", label: "Export GIF", icon: ImageIcon, run: () => exportAs("gif") },
    { id: "add-step", label: "Add step", icon: Plus, run: () => { setTab("timeline"); addStep(); } },
    { id: "share", label: "Copy share link", icon: Share2, run: () => { navigator.clipboard.writeText(shareUrl); toast.success(project.is_public ? "Share link copied" : "Copied — enable the public link to share"); } },
    { id: "history", label: "Open version history", icon: HistoryIcon, run: () => setHistoryOpen(true) },
  ];

  return (
    <div className="min-h-screen relative z-10">
      {!online && <div className="bg-amber-500/15 text-amber-200 text-xs text-center py-1.5 border-b border-amber-500/30" role="status" data-testid="offline-banner">You're offline — edits are kept locally and will save when you reconnect.</div>}
      <AppHeader>
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/dashboard" className="text-slate-400 hover:text-white" aria-label="Back to projects" data-testid="studio-back-link"><ArrowLeft className="h-4 w-4" /></Link>
          <input value={meta.name} onChange={(e) => setMeta({ name: e.target.value })} aria-label="Project name"
            className="bg-transparent font-display font-semibold text-base outline-none border-b border-transparent focus:border-indigo-500 min-w-0 w-36 sm:w-64 truncate" data-testid="studio-project-name-input" />
          <StatusBadge status={project.status} testId="studio-project-status" />
          <SaveIndicator state={saveState} />
        </div>
      </AppHeader>

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-7 min-w-0" data-testid="studio-timeline-editor">
          <Tabs value={tab} onValueChange={setTab}>
            <div className="flex items-center justify-between gap-3 mb-5">
              <TabsList className="bg-slate-900 overflow-x-auto">
                <TabsTrigger value="draft" data-testid="tab-draft">Draft</TabsTrigger>
                <TabsTrigger value="timeline" data-testid="tab-timeline">Timeline <span className="ml-1.5 font-mono text-[10px] text-slate-500">{list.length}</span></TabsTrigger>
                <TabsTrigger value="export" data-testid="tab-export">Export & share</TabsTrigger>
                <TabsTrigger value="analytics" data-testid="tab-analytics">Analytics</TabsTrigger>
              </TabsList>
              <div className="flex items-center gap-2">
                <button onClick={() => setPaletteOpen(true)} className="h-9 px-3 rounded-lg border border-slate-700 hover:bg-slate-800 text-sm hidden md:flex items-center gap-2 text-slate-400" data-testid="command-palette-button"><Command className="h-3.5 w-3.5" />K</button>
                <HistorySheet pid={pid} onRestore={restore} open={historyOpen} onOpenChange={setHistoryOpen} />
              </div>
            </div>
            <TabsContent value="draft"><DraftTab meta={meta} setMeta={setMeta} onGenerate={generate} busy={busy === "generate"} browserless={settings?.browserless_configured} /></TabsContent>
            <TabsContent value="timeline">
              <TimelineToolbar meta={meta} setMeta={setMeta} undo={steps.undo} redo={steps.redo} canUndo={steps.canUndo} canRedo={steps.canRedo}
                onAdd={addStep} onRewrite={rewrite} rewriting={busy === "rewrite"} locked={running} />
              {list.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-700 p-12 text-center" data-testid="timeline-empty">
                  <p className="text-slate-400 text-sm">No steps yet. Generate them from your draft or add one manually.</p>
                  <button onClick={() => setTab("draft")} className="mt-4 text-cyan-400 text-sm hover:text-cyan-300" data-testid="timeline-go-draft">Go to draft →</button>
                </div>
              ) : (
                <Reorder.Group axis="y" values={list} onReorder={(v) => steps.set(v, { coalesce: true })} as="div" className="space-y-3" data-testid="timeline-list">
                  {list.map((s, i) => (
                    <StepCard key={s.id} s={s} i={i} total={list.length} active={i === selected} locked={running}
                      thumb={s.screenshot_path ? stepAsset(pid, { ...s, screenshot_path: s.thumb_path || s.screenshot_path }, s.thumb_path ? "thumb" : "screenshot") : null}
                      busy={busy === `rerecord-${s.id}` || busy === `repair-${s.id}` || running}
                      onChange={editStep} onMove={moveStep} onDelete={delStep} onDuplicate={dupStep} onSelect={setSelected} onRerecord={rerecord} onRepair={repair} />
                  ))}
                </Reorder.Group>
              )}
            </TabsContent>
            <TabsContent value="export"><ExportPanel project={{ ...project, brand: meta.brand }} onExport={exportAs} busy={running || busy === "export"} onPatch={onPatch} /></TabsContent>
            <TabsContent value="analytics"><AnalyticsPanel project={project} /></TabsContent>
          </Tabs>
        </section>

        <aside className="lg:col-span-5 space-y-4 lg:sticky lg:top-20 self-start">
          <DemoPlayer steps={playerSteps} src={(s, k) => stepAsset(pid, s, k)} narrationMode={meta.narration_mode} brand={meta.brand}
            initialStep={selected} onStepChange={setSelected} />
          {settings && !settings.browserless_configured && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200" data-testid="browserless-missing-banner">
              Browserless isn't connected yet — recording is disabled. <Link to="/settings" className="underline">Open settings</Link>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            {running && run?.kind !== "export" ? (
              <button onClick={cancel} className="h-11 rounded-lg border border-red-500/40 text-red-300 hover:bg-red-500/10 font-medium flex items-center justify-center gap-2" data-testid="cancel-run-button"><Square className="h-4 w-4" /> Stop</button>
            ) : (
              <button onClick={record} disabled={!list.length || running || !!busy} data-testid="record-demo-button"
                className="h-11 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-medium shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 disabled:opacity-50 transition-[background-color,transform] active:scale-[0.98]">
                {busy === "record" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clapperboard className="h-4 w-4" />} {captured.length ? "Re-record all" : "Record demo"}
              </button>
            )}
            <button onClick={voiceover} disabled={!list.length || running || !!busy || meta.narration_mode === "captions"} data-testid="generate-voiceover-button"
              className="h-11 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 font-medium flex items-center justify-center gap-2 disabled:opacity-50">
              {busy === "voiceover" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />} Voiceover
            </button>
          </div>
          <RunConsole run={run} onCancel={cancel} />
          {captured.length > 0 && (
            <div className="flex gap-2 overflow-x-auto scrollbar-thin pb-1" data-testid="capture-filmstrip">
              {list.map((s, i) => s.screenshot_path && (
                <motion.button key={s.id + s.screenshot_path} layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} onClick={() => setSelected(i)}
                  className={`shrink-0 h-14 w-24 rounded-md overflow-hidden border ${i === selected ? "border-indigo-500" : "border-slate-800"}`} aria-label={`Show step ${i + 1}`} data-testid={`filmstrip-${i}`}>
                  <img src={stepAsset(pid, { ...s, screenshot_path: s.thumb_path || s.screenshot_path }, s.thumb_path ? "thumb" : "screenshot")} alt="" loading="lazy" className="h-full w-full object-cover object-top" />
                </motion.button>
              ))}
            </div>
          )}
        </aside>
      </main>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} actions={paletteActions} />
    </div>
  );
}
