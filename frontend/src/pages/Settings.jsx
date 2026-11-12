import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, Play, PlugZap, XCircle } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { VOICES } from "@/components/StudioParts";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, errMsg } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const card = "rounded-xl border border-slate-800 bg-slate-900/60 p-6";
const Status = ({ ok, testId }) => ok
  ? <span className="flex items-center gap-1.5 text-emerald-400 text-sm" data-testid={testId}><CheckCircle2 className="h-4 w-4" /> Connected</span>
  : <span className="flex items-center gap-1.5 text-amber-400 text-sm" data-testid={testId}><XCircle className="h-4 w-4" /> Not configured</span>;

export default function Settings() {
  const { user } = useAuth();
  const [s, setS] = useState(null);
  const [prefs, setPrefs] = useState(null);
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
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-400 mb-3">Workspace</p>
          <h1 className="text-4xl font-extrabold tracking-tight">Settings</h1>
        </div>
        <section className={card}>
          <div className="flex items-center justify-between mb-3"><h3 className="font-semibold">Plan & usage</h3><span className="font-mono text-xs rounded-full border border-slate-700 px-2.5 py-0.5" data-testid="plan-badge">{s.usage.plan}</span></div>
          <Progress value={pct} className="h-2 bg-slate-800" data-testid="usage-progress" />
          <p className="text-sm text-slate-400 mt-2" data-testid="usage-text">{s.usage.recordings_this_month} of {s.usage.limit} recordings used this month</p>
        </section>
        <section className={`${card} space-y-5`}>
          <h3 className="font-semibold">Integrations</h3>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div><p className="font-medium">Browserless</p><p className="text-xs text-slate-400 font-mono">{s.browserless_region}</p></div>
            <div className="flex items-center gap-4"><Status ok={s.browserless_configured} testId="browserless-status" />
              <button onClick={testBrowserless} disabled={!s.browserless_configured || busy === "test"} className="h-9 px-3 rounded-lg border border-slate-700 hover:bg-slate-800 text-sm flex items-center gap-2 disabled:opacity-40" data-testid="test-browserless-button">
                {busy === "test" ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4" />} Test</button></div>
          </div>
          <div className="flex items-center justify-between"><div><p className="font-medium">AI script engine</p><p className="text-xs text-slate-400">{s.ai_model}</p></div><Status ok={s.llm_configured} testId="llm-status" /></div>
          <div className="flex items-center justify-between"><div><p className="font-medium">AI voiceover</p><p className="text-xs text-slate-400">{s.tts_model}</p></div><Status ok={s.llm_configured} testId="tts-status" /></div>
          <p className="text-xs text-slate-500">API keys are stored server-side only and never reach the browser.</p>
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
        <section className={card}>
          <h3 className="font-semibold mb-2">Account</h3>
          <p className="text-sm text-slate-300" data-testid="account-email">{user?.name} · {user?.email}</p>
          <p className="text-xs text-slate-500 mt-1">Signed in with {user?.auth_provider === "google" ? "Google" : "email & password"}</p>
        </section>
      </main>
    </div>
  );
}
