import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Reorder, motion } from "framer-motion";
import { toast } from "sonner";
import { ArrowLeft, Check, CircleHelp, Clapperboard, Command, Film, Image as ImageIcon, Loader2, Mic, Plus, Sparkles, Square, WifiOff, History as HistoryIcon, Share2 } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { DemoPlayer } from "@/components/DemoPlayer";
import { RunConsole } from "@/components/RunConsole";
import { StepCard } from "@/components/StepCard";
import { ExportPanel, AnalyticsPanel } from "@/components/ExportPanel";
import { HistorySheet } from "@/components/HistorySheet";
import { StatusBadge } from "@/components/StatusBadge";
import { CommandPalette, DraftTab, ElementChips, TimelineToolbar, newScene, newStep } from "@/components/StudioParts";
import { SceneCard } from "@/components/SceneCard";
import { StudioExtras } from "@/components/StudioExtras";
import { HelpLink } from "@/components/HelpLink";
import { LivePane } from "@/components/LivePane";
import { RunPreview } from "@/components/RunPreview";
import { AuthedImg } from "@/components/AuthedImg";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, API, errMsg, stepAsset } from "@/lib/api";
import { useOnline, useRun, useUndoable } from "@/hooks/useStudio";
import { WorkflowRail } from "@/components/WorkflowRail";
import { recordActivity } from "@/lib/activity";

const pickMeta = (p) => ({
  name: p.name, draft: p.draft, target_url: p.target_url, voice: p.voice, narration_mode: p.narration_mode, brand: p.brand || {},
  variables: p.variables || {}, environments: p.environments || {}, active_environment: p.active_environment || "production",
  viewport: p.viewport || "desktop", webhook_url: p.webhook_url || "", product_slug: p.product_slug || "",
  review_status: p.review_status || "draft", cta_label: p.cta?.label || "", cta_url: p.cta?.url || "",
  login_url: p.login?.url || "", login_username: p.login?.username || "", has_login: p.has_login,
  has_storage: !!p.has_storage, credential_expired: !!p.credential_expired, storage_expired: !!p.storage_expired,
  variable_email: (p.variables || {}).email || "",
  glossary: p.glossary || [], login_recipe: p.login?.recipe || [], guided: !!p.guided,
  notify_url: p.notify_url || "", active_track: p.active_track || "primary", tour_order: p.tour_order || 0,
});
const isField = (el) => ["INPUT", "TEXTAREA"].includes(el?.tagName) || el?.isContentEditable;

function SaveIndicator({ state }) {
  const map = { saving: [Loader2, "Saving…", "animate-spin"], saved: [Check, "Saved", ""], dirty: [Loader2, "Unsaved", ""], error: [WifiOff, "Save failed", ""], offline: [WifiOff, "Offline", ""] };
  const [Icon, label, cls] = map[state] || map.saved;
  return <span className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 font-mono" data-testid="save-indicator"><Icon className={`h-3 w-3 ${cls}`} />{label}</span>;
}

export default function Studio() {
  const { pid } = useParams();
  const navigate = useNavigate();
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
  const [review, setReview] = useState(null);
  const [elements, setElements] = useState([]);
  const [captureUrl, setCaptureUrl] = useState("");
  const [live, setLive] = useState(false);
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
      if (["record", "rerecord", "voiceover", "autopilot", "health"].includes(r.kind)) refetch();
      if (["record", "autopilot", "health"].includes(r.kind) && r.current) setSelected(r.current - 1);
      if (r.kind === "autopilot" && r.total > 3) setTab("timeline");
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
    setSaveState("saving");
    const {
      playwright_source, variable_email, has_login, has_storage, credential_expired, storage_expired,
      login_password, ...rest
    } = meta;
    const body = { ...rest, steps: steps.value };
    if (login_password) body.login_password = login_password;
    try {
      const { data } = await api.put(`/projects/${pid}`, body);
      // Sync flags from the server and clear the typed password so the field
      // shows “Password saved — type to replace” instead of looking unsaved.
      const nextMeta = {
        ...pickMeta(data),
        login_password: "",
        playwright_source: playwright_source || "",
      };
      setProject(data);
      setMetaState(nextMeta);
      savedRef.current = JSON.stringify({ meta: nextMeta, steps: steps.value });
      setSaveState("saved");
    } catch (e) {
      setSaveState("error");
      recordActivity({ level: "error", source: "save", message: errMsg(e) });
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
    if ("is_public" in patch || "auto_refresh" in patch) {
      try { const { data } = await api.put(`/projects/${pid}`, patch); setProject(data); } catch (e) { toast.error(errMsg(e)); }
    } else setMeta(patch);
  };

  const generate = () => act("generate", async () => {
    const { data } = await api.post(`/projects/${pid}/generate`, {});
    applyServer(data, "set");
    setTab("timeline");
    setReview(data.review || null);
    toast.success(`Scripted ${data.steps.length} steps — undo with ⌘Z`);
  });
  const changelog = () => act("changelog", async () => {
    const { data } = await api.post(`/projects/${pid}/changelog`, { source: meta.draft });
    applyServer(data, "set");
    setTab("timeline");
    toast.success(`Changelog became ${data.steps.length} steps — undo with ⌘Z`);
  });
  const importTest = () => act("import", async () => {
    const { data } = await api.post(`/projects/${pid}/import-playwright`, { source: meta.playwright_source || "" });
    applyServer(data, "set");
    setTab("timeline");
    toast.success(`Imported ${data.steps.length} steps — undo with ⌘Z`);
  });
  const capture = (after = steps.value.length, scroll = 0) => act("capture", async () => {
    const count = typeof after === "number" ? after : steps.value.length;
    const { data } = await api.post(`/projects/${pid}/capture`, { after: count, scroll });
    setElements(data.elements || []);
    setCaptureUrl(data.url || "");
    setTab("timeline");
    toast.success(`${(data.elements || []).length} elements on ${data.url}`);
  });
  const startLive = () => act("live", async () => {
    const { data } = await api.post(`/projects/${pid}/live/start`, { after: steps.value.length });
    setLive(true);
    setTab("timeline");
    if (data.has_storage) toast.message("Reusing the saved signed-in session");
    if (data.warning) toast.message(data.warning);
  });
  const stopLive = () => {
    setLive(false);
    api.post(`/projects/${pid}/live/stop`).catch(() => {});
  };
  const applyLive = (data) => {
    const patch = {
      action: data.action, selector: data.selector || "", text: data.text ?? null,
      caption: data.caption || "", hotspot: data.hotspot || null, page_url: data.url || null,
      sensitive: !!data.sensitive, status: "pending",
      ...(data.amount != null ? { amount: data.amount } : {}),
      ...(data.duration_ms ? { duration_ms: data.duration_ms, transition: data.transition || "fade", transition_ms: data.transition_ms || 800 } : {}),
      ...(data.wait_ms != null ? { wait_ms: data.wait_ms } : {}),
    };
    steps.set((arr) => {
      const last = arr[arr.length - 1];
      if (data.coalesce && last && data.action === "scroll" && last.action === "scroll") {
        const next = [...arr];
        const amount = (Number(last.amount) || 0) + (Number(data.amount) || 0);
        next[next.length - 1] = { ...last, ...patch, amount, caption: "Scroll the page" };
        return next;
      }
      if (data.coalesce && last && last.selector === data.selector && (last.action === "type" || last.action === "click")) {
        const next = [...arr];
        next[next.length - 1] = { ...last, ...patch };
        return next;
      }
      return [...arr, { ...newStep(), ...patch }];
    }, { coalesce: !!data.coalesce });
  };
  useEffect(() => () => { api.post(`/projects/${pid}/live/stop`).catch(() => {}); }, [pid]);
  const pickElement = (el) => {
    const selector = el.testid ? `[data-testid=${el.testid}]` : el.id ? `#${el.id}` : el.text ? `text=${JSON.stringify(el.text.slice(0, 60))}` : el.aria ? `[aria-label=${JSON.stringify(el.aria)}]` : el.tag;
    const step = { ...newStep(), action: el.tag === "input" || el.tag === "textarea" ? "type" : "click", selector, text: el.tag === "input" || el.tag === "textarea" ? "" : null, caption: (el.text || el.aria || "Click").slice(0, 90) };
    steps.set((arr) => [...arr, step]);
    toast.success("Step added. Use Capture next on it to list the page that step opens.");
  };
  const startRun = (key, url, body) => act(key, async () => { const { data } = await api.post(url, body || {}); setRun(data); refetch(); });
  const record = () => startRun("record", `/projects/${pid}/record`);
  const autopilot = () => startRun("autopilot", `/projects/${pid}/autopilot`);
  const healthCheck = () => startRun("health", `/projects/${pid}/health-check`);
  const shareSettings = async (body) => {
    try { const { data } = await api.put(`/projects/${pid}/share-settings`, body); setProject(data); toast.success("Share settings saved"); } catch (e) { toast.error(errMsg(e)); }
  };
  const voiceover = () => startRun("voiceover", `/projects/${pid}/voiceover`);
  const exportAs = (fmt, preset = "standard") => startRun("export", `/projects/${pid}/export`, { format: fmt, preset });
  const rerecord = (sid) => startRun(`rerecord-${sid}`, `/projects/${pid}/steps/${sid}/rerecord`);
  const cancel = () => api.post(`/runs/${run.id}/cancel`).catch((e) => toast.error(errMsg(e)));
  const rewrite = (instruction) => act("rewrite", async () => { const { data } = await api.post(`/projects/${pid}/rewrite`, { instruction }); applyServer(data, "set"); toast.success("Narration rewritten — undo with ⌘Z"); });
  const repair = (sid) => act(`repair-${sid}`, async () => { const { data } = await api.post(`/projects/${pid}/steps/${sid}/repair`, {}); applyServer(data, "set"); toast.success(data.repair_reason || "Selector repaired — undo with ⌘Z"); });
  const rerecordFailed = () => startRun("rerecord-failed", `/projects/${pid}/rerecord-failed`);
  const publish = () => act("publish", async () => { const { data } = await api.post(`/projects/${pid}/publish`, {}); setProject(data); toast.success("Published. The share link now serves this version."); });
  const comment = (sid, text) => act(`comment-${sid}`, async () => { const { data } = await api.post(`/projects/${pid}/steps/${sid}/comments`, { text }); applyServer(data, "replace"); });
  const restore = (hid) => act("restore", async () => { const { data } = await api.post(`/projects/${pid}/history/${hid}/restore`); applyServer(data, "set"); setHistoryOpen(false); toast.success("Version restored"); });

  const editStep = (id, patch) => steps.set((arr) => arr.map((s) => (s.id === id ? { ...s, ...patch } : s)), { coalesce: true });
  const moveStep = (i, d) => steps.set((arr) => { const a = [...arr]; [a[i], a[i + d]] = [a[i + d], a[i]]; return a; });
  const delStep = (id) => steps.set((arr) => arr.filter((s) => s.id !== id));
  const dupStep = (i) => steps.set((arr) => {
    const fresh = newStep();
    const copy = { ...arr[i], id: fresh.id, scene: arr[i].scene ? { ...arr[i].scene } : {} };
    ["screenshot_path", "thumb_path", "audio_path", "audio_text", "audio_voice", "audio_duration_ms", "hotspot", "error", "page_url", "resolved_selector"].forEach((k) => { copy[k] = fresh[k]; });
    Object.assign(copy, { status: "pending", attempts: 0 });
    const a = [...arr];
    a.splice(i + 1, 0, copy);
    return a;
  });
  const addStep = () => { steps.set((arr) => [...arr, newStep()]); setSelected(steps.value.length); };
  const addScene = (type) => {
    const at = Math.min(selected + 1, steps.value.length);
    steps.set((arr) => { const a = [...arr]; a.splice(at, 0, newScene(type)); return a; });
    setSelected(at);
  };

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
  const playerSteps = (meta?.active_track === "alt"
    ? list.map((s) => (s.caption_alt || s.voiceover_alt ? { ...s, caption: s.caption_alt || s.caption, voiceover: s.voiceover_alt || s.voiceover, audio_path: s.audio_path_alt || s.audio_path, audio_track: "alt" } : s))
    : list);
  const captured = list.filter((s) => s.screenshot_path);
  const shareUrl = `${window.location.origin}/share/${project.share_id}`;
  const paletteActions = [
    { id: "generate", label: "Generate script with AI", icon: Sparkles, run: generate },
    { id: "record", label: "Record demo in Browserless", icon: Clapperboard, run: record },
    { id: "autopilot", label: "Generate & record in one click", icon: Sparkles, run: autopilot },
    { id: "voiceover", label: "Generate voiceover", icon: Mic, run: voiceover },
    { id: "export-mp4", label: "Export MP4", icon: Film, run: () => exportAs("mp4") },
    { id: "export-gif", label: "Export GIF", icon: ImageIcon, run: () => exportAs("gif") },
    { id: "add-step", label: "Add step", icon: Plus, run: () => { setTab("timeline"); addStep(); } },
    { id: "share", label: "Copy share link", icon: Share2, run: () => { navigator.clipboard.writeText(shareUrl); toast.success(project.is_public ? "Share link copied" : "Copied — enable the public link to share"); } },
    { id: "help-capture", label: "Help: capture clicks and typed text", icon: CircleHelp, run: () => navigate("/help#capture-clicks") },
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

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <WorkflowRail items={[
          { id: "spec", label: "Spec", detail: meta.draft?.trim() ? "Draft saved" : "Write the story", state: meta.draft?.trim() ? "done" : "current", onClick: () => setTab("draft") },
          { id: "script", label: "Script", detail: list.length ? `${list.length} steps` : "Ask AI", state: list.length ? "done" : "current", onClick: () => setTab(list.length ? "timeline" : "draft") },
          { id: "record", label: "Record", detail: captured.length ? `${captured.length} frames` : "Cloud browser", state: captured.length ? "done" : list.length ? "current" : "wait", onClick: () => setTab("timeline") },
          { id: "narrate", label: "Narrate", detail: list.some((s) => s.audio_path) ? "Voice ready" : list.some((s) => s.voiceover?.trim()) ? "Lines waiting" : "Optional", state: list.some((s) => s.audio_path) || meta.narration_mode === "captions" ? "done" : list.some((s) => s.voiceover?.trim()) ? "current" : "wait", onClick: () => setTab("timeline") },
          { id: "share", label: "Share", detail: project.is_public ? "Public link on" : "Export", state: project.is_public ? "done" : captured.length ? "current" : "wait", onClick: () => setTab("export") },
        ]} />
      </div>
      {project.health?.changed?.length > 0 && (
        <div className="mx-4 sm:mx-6 lg:mx-8 mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100" data-testid="health-changed-banner">
          {project.health.changed.length} step(s) still succeed but the picture changed. Previous frames were kept.
        </div>
      )}
      {project.health?.broken?.length > 0 && (
        <div className="mx-4 sm:mx-6 lg:mx-8 mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200 flex flex-wrap items-center gap-2" role="alert" data-testid="health-broken-banner">
          <strong className="font-semibold">{project.health.kind === "scheduled" ? "Weekly check" : "Health check"} · {new Date(project.health.checked_at).toLocaleString()}:</strong>
          {project.health.broken.length} step(s) broke after a UI change (steps {project.health.broken.map((b) => b.index + 1).join(", ")}). Previous frames were kept. Use "Fix with AI" on the step, then re-record.
        </div>
      )}
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
            <TabsContent value="draft">
              <DraftTab meta={meta} setMeta={setMeta} onGenerate={generate} onAutopilot={autopilot} onChangelog={changelog} onImport={importTest} onCapture={() => capture(0)} elements={elements} captureUrl={captureUrl} onPickElement={pickElement} busy={busy === "generate" || busy === "changelog"} autoBusy={busy === "autopilot" || busy === "capture" || (running && run?.kind === "autopilot")} browserless={settings?.browserless_configured} aiModel={settings?.ai_model} />
              <div className="mt-4"><StudioExtras project={{ ...project, steps: list, has_storage: project.has_storage, variants: project.variants, watch_url: project.watch_url }} meta={meta} setMeta={setMeta} onReload={() => refetch("replace")} onInsert={(data) => applyServer(data, "set")} /></div>
            </TabsContent>
            <TabsContent value="timeline">
              {review && (
                <div className={`mb-3 rounded-lg border px-3 py-2 text-xs ${review.host_mismatch ? "border-amber-500/40 bg-amber-500/10 text-amber-100" : "border-slate-700 text-slate-300"}`} data-testid="script-review">
                  First URL {review.first_url || "not set"} · about {review.seconds}s of Browserless time.
                  {review.host_mismatch ? " That host is not the target URL. Change the go-to step before recording." : " Confirm the steps, then record."}
                </div>
              )}
              {list.some((s) => s.status === "failed") && (
                <button onClick={rerecordFailed} disabled={running} className="mb-3 h-9 px-3 rounded-lg border border-red-500/40 text-red-200 text-sm" data-testid="rerecord-failed-button">Re-record failed steps</button>
              )}
              <TimelineToolbar meta={meta} setMeta={setMeta} undo={steps.undo} redo={steps.redo} canUndo={steps.canUndo} canRedo={steps.canRedo}
                onAdd={addStep} onAddScene={addScene} onRewrite={rewrite} rewriting={busy === "rewrite"} locked={running}
                onCapture={() => capture(list.length)} captureBusy={busy === "capture"} browserless={settings?.browserless_configured} />
              <div className="mb-3"><ElementChips elements={elements} pageUrl={captureUrl} onPickElement={pickElement} onScanDown={() => capture(list.length, 900)} /></div>
              {list.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-700 p-12 text-center" data-testid="timeline-empty">
                  <p className="text-slate-400 text-sm">No steps yet. Generate them from your draft or add one manually.</p>
                  <button onClick={() => setTab("draft")} className="mt-4 text-cyan-400 text-sm hover:text-cyan-300" data-testid="timeline-go-draft">Go to draft →</button>
                </div>
              ) : (
                <Reorder.Group axis="y" values={list} onReorder={(v) => steps.set(v, { coalesce: true })} as="div" className="space-y-3" data-testid="timeline-list">
                  {list.map((s, i) => s.scene_type ? (
                    <SceneCard key={s.id} s={s} i={i} total={list.length} active={i === selected} locked={running}
                      onChange={editStep} onMove={moveStep} onDelete={delStep} onDuplicate={dupStep} onSelect={setSelected} />
                  ) : (
                    <StepCard key={s.id} s={s} i={i} total={list.length} active={i === selected} locked={running}
                      thumb={s.screenshot_path ? stepAsset(pid, { ...s, screenshot_path: s.thumb_path || s.screenshot_path }, s.thumb_path ? "thumb" : "screenshot") : null}
                      failedThumb={s.health_failed_path ? stepAsset(pid, { ...s, screenshot_path: s.health_failed_path }, "screenshot") : null}
                      busy={busy === `rerecord-${s.id}` || busy === `repair-${s.id}` || busy === "capture" || running}
                      onChange={editStep} onMove={moveStep} onDelete={delStep} onDuplicate={dupStep} onSelect={setSelected} onRerecord={rerecord} onRepair={repair} onComment={comment} onCaptureAfter={(index) => capture(index + 1)} />
                  ))}
                </Reorder.Group>
              )}
            </TabsContent>
            <TabsContent value="export"><ExportPanel project={{ ...project, ...meta, brand: meta.brand, cta: { label: meta.cta_label, url: meta.cta_url } }} onExport={exportAs} busy={running || busy === "export"} onPatch={onPatch} onShareSettings={shareSettings} onHealthCheck={healthCheck} onPublish={publish} usage={settings?.usage} /></TabsContent>
            <TabsContent value="analytics"><AnalyticsPanel project={project} /></TabsContent>
          </Tabs>
        </section>

        <aside className="lg:col-span-5 space-y-4 lg:sticky lg:top-20 self-start">
          {!live && (
            <div className="flex items-center gap-1">
              <button onClick={startLive} disabled={running || !!busy || settings?.browserless_configured === false} data-testid="live-start-button" data-help="live-browser"
                className="h-11 flex-1 rounded-lg border border-cyan-500/40 text-cyan-200 hover:bg-cyan-500/10 font-medium disabled:opacity-50">
                {busy === "live" ? "Opening browser…" : "Live browser"}
              </button>
              <HelpLink topic="live-browser" label="Live browser" />
            </div>
          )}
          {running && run?.id && ["record", "rerecord", "autopilot", "health"].includes(run.kind) ? (
            <RunPreview rid={run.id} message={run.message} pageUrl={run.preview_url || ""} />
          ) : live ? (
            <LivePane
              pid={pid}
              onEvent={applyLive}
              onClose={stopLive}
              hasStorage={!!project?.has_storage}
              onProject={(data) => {
                if (data) {
                  applyServer(data, "set");
                  toast.success("Signed-in session saved. This page is now the demo start — click Record demo when ready.");
                } else {
                  refetch("replace");
                  toast.success("Signed-in session saved for later recordings");
                }
              }}
            />
          ) : (
            <DemoPlayer steps={playerSteps} src={(s, k, i) => stepAsset(pid, s, k, i)} narrationMode={meta.narration_mode} brand={meta.brand} cta={{ label: meta.cta_label, url: meta.cta_url }}
              guided={!!meta.guided} initialStep={selected} onStepChange={setSelected} />
          )}
          {settings && !settings.browserless_configured && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200" data-testid="browserless-missing-banner">
              Browserless isn't connected yet — recording is disabled. <Link to="/settings" className="underline">Open settings</Link>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            {running && run?.kind !== "export" ? (
              <button onClick={cancel} className="h-11 rounded-lg border border-red-500/40 text-red-300 hover:bg-red-500/10 font-medium flex items-center justify-center gap-2" data-testid="cancel-run-button"><Square className="h-4 w-4" /> Stop</button>
            ) : (
              <div className="flex items-center gap-1">
                <button onClick={record} disabled={!list.length || running || !!busy || settings?.browserless_configured === false} data-testid="record-demo-button" data-help="record-demo"
                  className="h-11 flex-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-medium shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 disabled:opacity-50 transition-[background-color,transform] active:scale-[0.98]">
                  {busy === "record" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clapperboard className="h-4 w-4" />} {captured.length ? "Re-record all" : "Record demo"}{project.estimate_seconds ? ` · ~${project.estimate_seconds}s` : ""}
                </button>
                <HelpLink topic="record-demo" label="Record demo" />
              </div>
            )}
            <button onClick={voiceover} disabled={!list.length || running || !!busy || meta.narration_mode === "captions"} data-testid="generate-voiceover-button"
              className="h-11 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 font-medium flex items-center justify-center gap-2 disabled:opacity-50">
              {busy === "voiceover" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />} Voiceover
            </button>
          </div>
          {list.some((s) => s.voiceover?.trim()) && !list.some((s) => s.audio_path) && meta.narration_mode !== "captions" && (
            <p className="text-xs text-cyan-200/90" data-testid="voiceover-waiting">Lines are written. Press Voiceover, then Play, to hear them.</p>
          )}
          {settings?.usage && (
            <p className="text-xs text-slate-500" data-testid="record-cost">
              {settings.usage.recordings_this_month} of {settings.usage.limit} recordings used this month
              {settings.usage.seconds_this_month != null ? ` · ${settings.usage.seconds_this_month}/${settings.usage.seconds_limit}s browser time` : ""}
              {project.estimate_seconds ? ` · this run is about ${project.estimate_seconds}s` : ""}
              {project.over_cap ? " · longer than one 120s session, so recording continues in parts" : ""}.
            </p>
          )}
          <RunConsole run={run} onCancel={cancel} />
          {captured.length > 0 && (
            <div className="flex gap-2 overflow-x-auto scrollbar-thin pb-1" data-testid="capture-filmstrip">
              {list.map((s, i) => s.screenshot_path && (
                <motion.button key={s.id + s.screenshot_path} layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} onClick={() => setSelected(i)}
                  className={`shrink-0 h-14 w-24 rounded-md overflow-hidden border ${i === selected ? "border-indigo-500" : "border-slate-800"}`} aria-label={`Show step ${i + 1}`} data-testid={`filmstrip-${i}`}>
                  <AuthedImg src={stepAsset(pid, { ...s, screenshot_path: s.thumb_path || s.screenshot_path }, s.thumb_path ? "thumb" : "screenshot")} alt="" loading="lazy" className="h-full w-full object-cover object-top" />
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
