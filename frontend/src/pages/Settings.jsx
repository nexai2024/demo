import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, Play, PlugZap, XCircle } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { VOICES } from "@/components/StudioParts";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, errMsg } from "@/lib/api";
import { HelpLink } from "@/components/HelpLink";
import { useAuth } from "@/context/AuthContext";
import { clerkEnabled } from "@/lib/clerk";
import { ClerkAccountTools, ClerkBilling } from "@/components/ClerkTools";

const card = "surface p-6";
const Status = ({ ok, testId }) => ok
  ? <span className="flex items-center gap-1.5 text-emerald-400 text-sm" data-testid={testId}><CheckCircle2 className="h-4 w-4" /> Connected</span>
  : <span className="flex items-center gap-1.5 text-amber-400 text-sm" data-testid={testId}><XCircle className="h-4 w-4" /> Not configured</span>;

export default function Settings() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [s, setS] = useState(null);
  const [prefs, setPrefs] = useState(null);
  const [probe, setProbe] = useState(null);
  const [busy, setBusy] = useState("");
  const audio = useRef(null);

  useEffect(() => { api.get("/settings").then(({ data }) => { setS(data); setPrefs(data.preferences); }); }, []);

  const savePrefs = async (patch) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    try { await api.put("/settings", next); toast.success("Preferences saved"); } catch (e) { toast.error(errMsg(e)); }
  };
  const testBrowserless = async () => {
    setBusy("test");
    try { await api.post("/settings/test-browserless"); toast.success("Browserless session opened and closed successfully"); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(""); }
  };
  const testStorage = async () => {
    setBusy("storage");
    try {
      const { data } = await api.post("/settings/test-storage");
      setProbe(data);
      if (data.ok && !data.error) toast.success("Storage round-trip succeeded");
      else if (data.ok) toast.warning("Storage works via local fallback — the configured remote is failing");
      else toast.error("Storage test failed");
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(""); }
  };
  const preview = async () => {
    setBusy("voice");
    try {
      const { data } = await api.post("/tts/preview", prefs, { responseType: "blob" });
      audio.current.src = URL.createObjectURL(data);
      audio.current.play();
    } catch (e) { toast.error("Voice preview failed"); } finally { setBusy(""); }
  };

  if (!s) return <div className="min-h-screen grid place-items-center"><Loader2 className="h-6 w-6 animate-spin text-indigo-400" /></div>;
  const pct = Math.min(100, Math.round((s.usage.recordings_this_month / s.usage.limit) * 100));

  return (
    <div className="min-h-screen relative z-10">
      <AppHeader />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-6" data-testid="settings-page">
        <div>
          <p className="eyebrow mb-3">Account</p>
          <h1 className="text-4xl font-extrabold tracking-tight">Your settings</h1>
          <p className="text-sm text-slate-400 mt-2">Profile, preferences, and plan for your studio.</p>
        </div>

        <section className={card}>
          <h3 className="font-semibold mb-2">Profile</h3>
          <p className="text-sm text-slate-300" data-testid="account-email">{user?.name} · {user?.email}</p>
          <p className="text-xs text-slate-500 mt-1">
            Signed in with {user?.auth_provider === "clerk" ? "Clerk" : user?.auth_provider === "google" ? "Google" : "email & password"}
            {user?.role ? ` · ${user.role}` : ""}
          </p>
          {clerkEnabled && <ClerkAccountTools />}
        </section>

        <section className={card}>
          <div className="flex items-center justify-between mb-3"><h3 className="font-semibold">Plan & usage</h3><span className="font-mono text-xs rounded-full border border-slate-700 px-2.5 py-0.5" data-testid="plan-badge">{s.usage.plan}</span></div>
          <Progress value={pct} className="h-2 bg-slate-800" data-testid="usage-progress" />
          <p className="text-sm text-slate-400 mt-2" data-testid="usage-text">{s.usage.recordings_this_month} of {s.usage.limit} recordings used this month{s.usage.seconds_limit ? ` · ${s.usage.seconds_this_month || 0} of ${s.usage.seconds_limit}s browser time` : ""}. A single browser session ends at {s.usage.session_cap || 120}s; longer demos continue in parts.</p>
          {clerkEnabled ? <ClerkBilling /> : (
            <p className="text-xs text-slate-500 mt-4" data-testid="billing-not-configured">
              Billing is not configured in this environment. Set Clerk keys and enable Clerk Billing to offer upgrades.
            </p>
          )}
        </section>

        <section className={`${card} space-y-4`}>
          <h3 className="font-semibold">Defaults for new projects</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5"><p className="font-mono text-[10px] uppercase text-slate-500">Narration</p>
              <Select value={prefs.narration_mode} onValueChange={(v) => savePrefs({ narration_mode: v })}>
                <SelectTrigger className="bg-slate-950" data-testid="settings-narration-select"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="both">Captions + voiceover</SelectItem><SelectItem value="captions">Captions only</SelectItem><SelectItem value="voiceover">Voiceover only</SelectItem></SelectContent>
              </Select></div>
            <div className="space-y-1.5"><p className="font-mono text-[10px] uppercase text-slate-500">Voice</p>
              <div className="flex gap-2">
                <Select value={prefs.voice} onValueChange={(v) => savePrefs({ voice: v })}>
                  <SelectTrigger className="bg-slate-950 capitalize" data-testid="settings-voice-select"><SelectValue /></SelectTrigger>
                  <SelectContent>{VOICES.map((v) => <SelectItem key={v} value={v} className="capitalize">{v}</SelectItem>)}</SelectContent>
                </Select>
                <button onClick={preview} aria-label="Preview voice" className="px-3 rounded-lg bg-slate-800 hover:bg-slate-700" data-testid="voice-preview-button">{busy === "voice" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}</button>
              </div></div>
          </div>
          <audio ref={audio} className="hidden" />
        </section>

        {isAdmin && (
          <section className={`${card} space-y-5`} data-testid="admin-system-settings">
            <div>
              <h3 className="font-semibold">System integrations</h3>
              <p className="text-xs text-slate-500 mt-1">Admin only — Browserless, AI, and storage probes for this deployment.</p>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div><p className="font-medium">Browserless</p><p className="text-xs text-slate-400 font-mono">{s.browserless_region}</p></div>
              <div className="flex items-center gap-4"><Status ok={s.browserless_configured} testId="browserless-status" />
                <button onClick={testBrowserless} disabled={!s.browserless_configured || busy === "test"} className="h-9 px-3 rounded-lg border border-slate-700 hover:bg-slate-800 text-sm flex items-center gap-2 disabled:opacity-40" data-testid="test-browserless-button">
                  {busy === "test" ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4" />} Test</button></div>
            </div>
            <div className="flex items-center justify-between"><div><p className="font-medium">AI script engine</p><p className="text-xs text-slate-400">{s.ai_model}</p></div><Status ok={s.llm_configured} testId="llm-status" /></div>
            <div className="flex items-center justify-between"><div><p className="font-medium">AI voiceover</p><p className="text-xs text-slate-400">{s.tts_model}</p></div><Status ok={s.llm_configured} testId="tts-status" /></div>
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div><p className="font-medium flex items-center gap-1">File storage <HelpLink topic="settings" label="File storage" /></p><p className="text-xs text-slate-400">{s.storage?.detail}</p></div>
                <div className="flex items-center gap-4"><Status ok={["s3", "remote", "local"].includes(s.storage?.mode)} testId="storage-status" />
                  <button onClick={testStorage} disabled={busy === "storage"} className="h-9 px-3 rounded-lg border border-slate-700 hover:bg-slate-800 text-sm flex items-center gap-2 disabled:opacity-40" data-testid="test-storage-button">
                    {busy === "storage" ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4" />} Test</button></div>
              </div>
              {probe && (
                <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3.5 font-mono text-xs space-y-1.5" data-testid="storage-probe-result">
                  <p data-testid="storage-probe-verdict" className={probe.ok ? "text-emerald-400" : "text-red-300"}>
                    {probe.ok ? (probe.fallback_used ? "Working via local-disk fallback" : "Round-trip OK") : "Round-trip failed"}
                    {probe.latency_ms != null ? ` · ${probe.latency_ms}ms` : ""}
                  </p>
                  <p className="text-slate-400">Configured: <span className="text-slate-200">{probe.configured}</span>
                    {probe.bucket ? <> · bucket <span className="text-slate-200">{probe.bucket}</span></> : null}
                    {probe.region ? <> · region <span className="text-slate-200">{probe.region}</span></> : null}
                    {probe.endpoint ? <> · endpoint <span className="text-slate-200">{probe.endpoint}</span></> : null}
                  </p>
                  <p className="text-slate-400">Served by: <span className="text-slate-200">{probe.served_by || "—"}</span>{probe.fallback_used ? <span className="text-amber-300"> (configured remote failed; dev fallback engaged)</span> : null}</p>
                  {(probe.problems || []).map((p, i) => <p key={i} className="text-amber-300/90" data-testid={`storage-probe-problem-${i}`}>{p}</p>)}
                  {probe.error && <p className="text-red-300 whitespace-pre-wrap break-words" data-testid="storage-probe-error">{probe.error}</p>}
                </div>
              )}
            </div>
            <p className="text-xs text-slate-500">API keys are stored server-side only and never reach the browser.</p>
          </section>
        )}
      </main>
    </div>
  );
}
