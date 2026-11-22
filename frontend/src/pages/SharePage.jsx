import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Clapperboard, Loader2, Lock } from "lucide-react";
import axios from "axios";
import { DemoPlayer } from "@/components/DemoPlayer";
import { API, publicAsset } from "@/lib/api";

const sessionId = () => {
  let s = sessionStorage.getItem("fc_view");
  if (!s) { s = Math.random().toString(36).slice(2, 14); sessionStorage.setItem("fc_view", s); }
  return s;
};

export default function SharePage({ embed = false }) {
  const { shareId } = useParams();
  const [params] = useSearchParams();
  const [demo, setDemo] = useState(null);
  const [error, setError] = useState("");
  const [locked, setLocked] = useState(false);
  const [pw, setPw] = useState("");
  const [pwError, setPwError] = useState("");
  const [lead, setLead] = useState("");
  const [leadSent, setLeadSent] = useState(false);
  const tokenKey = `fc_token_${shareId}`;
  const [token, setToken] = useState(sessionStorage.getItem(tokenKey) || "");
  const headers = token ? { "X-Viewer-Token": token } : {};
  const sent = useRef(new Set());
  const session = useMemo(sessionId, []);
  const initial = Math.max(0, (parseInt(params.get("step"), 10) || 1) - 1);
  const autoplay = params.get("autoplay") === "1";
  const startMuted = params.get("muted") === "1" || autoplay;
  const hideChapters = params.get("hideChapters") === "1";
  const trackQuery = params.get("track") === "alt" ? "alt" : "";

  useEffect(() => {
    axios.get(`${API}/public/${shareId}${trackQuery ? "?track=alt" : ""}`, { headers })
      .then(({ data }) => { setDemo(data); setLocked(false); })
      .catch((e) => {
        if (e.response?.status === 401) { setLocked(true); sessionStorage.removeItem(tokenKey); }
        else setError(e.response?.data?.detail || "Demo not found");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareId, token, trackQuery]);

  const unlock = async (e) => {
    e.preventDefault();
    setPwError("");
    try {
      const { data } = await axios.post(`${API}/public/${shareId}/unlock`, { password: pw });
      sessionStorage.setItem(tokenKey, data.token || "");
      setToken(data.token || "");
    } catch (err) { setPwError(err.response?.data?.detail || "Could not unlock"); }
  };

  const track = (type, step_index = 0, branch) => {
    const key = `${type}-${step_index}-${branch || ""}`;
    if (sent.current.has(key)) return;
    sent.current.add(key);
    const device = window.innerWidth < 760 ? "phone" : "desktop";
    axios.post(`${API}/public/${shareId}/events`, { type, session, step_index, referrer: document.referrer || "", device, branch: branch || undefined }, { headers }).catch(() => {});
  };
  useEffect(() => {
    if (demo) track("view");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo]);

  if (error) return <div className="min-h-screen grid place-items-center text-slate-400 p-6 text-center" data-testid="public-demo-error">{error}</div>;
  if (locked) return (
    <div className="min-h-screen grid place-items-center p-6 relative z-10">
      <form onSubmit={unlock} className="w-full max-w-sm rounded-xl border border-slate-800 bg-slate-900/70 backdrop-blur-xl p-6 space-y-4" data-testid="share-password-gate">
        <div className="flex items-center gap-2 font-display text-lg font-semibold"><Lock className="h-4 w-4 text-cyan-400" /> This demo is password protected</div>
        <input type="password" autoFocus value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Password" className="w-full h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm outline-none focus:border-indigo-500" data-testid="share-gate-password-input" />
        {pwError && <p className="text-sm text-red-400" data-testid="share-gate-error">{pwError}</p>}
        <button type="submit" className="w-full h-10 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-medium" data-testid="share-gate-submit">View demo</button>
      </form>
    </div>
  );
  if (!demo) return <div className="min-h-screen grid place-items-center"><Loader2 className="h-6 w-6 animate-spin text-indigo-400" /></div>;

  const dwell = (step_index, dwell_ms) => {
    if (dwell_ms < 400) return;
    axios.post(`${API}/public/${shareId}/events`, { type: "dwell", session, step_index, dwell_ms }, { headers }).catch(() => {});
  };
  const sendLead = (e) => {
    e.preventDefault();
    axios.post(`${API}/public/${shareId}/events`, { type: "lead", session, step_index: 0, email: lead }, { headers })
      .then(() => setLeadSent(true)).catch(() => {});
  };
  const player = (
    <DemoPlayer steps={demo.steps} src={(s, k, i) => publicAsset(shareId, { ...s, audio_track: demo.track }, k, token, i)} narrationMode={demo.narration_mode} brand={demo.brand} cta={demo.cta}
      initialStep={initial} chapters={!embed && !hideChapters} globalKeys shareUrl={`${window.location.origin}/share/${shareId}`} onEvent={(t, i, branch) => track(t, i, branch)} onDwell={dwell}
      guided={!!demo.guided} autoplay={autoplay} startMuted={startMuted} onCta={(i) => track("cta", i)} />
  );
  if (embed) return <div className="p-3 bg-slate-950 min-h-screen relative z-10" data-testid="public-demo-player">{player}</div>;
  return (
    <div className="min-h-screen relative z-10">
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10" data-testid="public-demo-player">
        <div className="flex items-center gap-2 text-sm text-slate-400 mb-6"><Clapperboard className="h-4 w-4 text-cyan-300" /> Interactive demo</div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-8" data-testid="public-demo-title">{demo.name}</h1>
        {player}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <a className="text-sm text-cyan-400" href={`${API}/public/${shareId}/transcript?fmt=vtt`} data-testid="public-transcript">Download captions</a>
          {demo.product_slug && <a className="text-sm text-cyan-400" href={`/p/${demo.product_slug}`}>More demos</a>}
          {demo.next?.share_id && <a className="text-sm text-cyan-400" href={`/share/${demo.next.share_id}`} data-testid="player-next-demo">Next: {demo.next.name}</a>}
          {(demo.tracks || []).includes("alt") && (
            <a className="text-sm text-cyan-400" href={`?track=${demo.track === "alt" ? "primary" : "alt"}`} data-testid="player-track-toggle">{demo.track === "alt" ? "Docs narration" : "Alternate narration"}</a>
          )}
        </div>
        <form onSubmit={sendLead} className="surface mt-4 flex gap-2 max-w-md p-2" data-testid="lead-form">
          <input value={lead} onChange={(e) => setLead(e.target.value)} type="email" required placeholder="Email for a follow-up" className="flex-1 h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm" data-testid="lead-email-input" />
          <button className="h-10 px-3 rounded-lg bg-indigo-600 text-sm" data-testid="lead-submit">{leadSent ? "Sent" : "Send"}</button>
        </form>
        <p className="text-xs text-slate-500 mt-8">Tip: press Space to play, ← → to move between steps, click the pulsing hotspot to continue.</p>
      </main>
    </div>
  );
}
