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
  const tokenKey = `fc_token_${shareId}`;
  const [token, setToken] = useState(sessionStorage.getItem(tokenKey) || "");
  const headers = token ? { "X-Viewer-Token": token } : {};
  const sent = useRef(new Set());
  const session = useMemo(sessionId, []);
  const initial = Math.max(0, (parseInt(params.get("step"), 10) || 1) - 1);

  useEffect(() => {
    axios.get(`${API}/public/${shareId}`, { headers })
      .then(({ data }) => { setDemo(data); setLocked(false); })
      .catch((e) => {
        if (e.response?.status === 401) { setLocked(true); sessionStorage.removeItem(tokenKey); }
        else setError(e.response?.data?.detail || "Demo not found");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareId, token]);

  const unlock = async (e) => {
    e.preventDefault();
    setPwError("");
    try {
      const { data } = await axios.post(`${API}/public/${shareId}/unlock`, { password: pw });
      sessionStorage.setItem(tokenKey, data.token || "");
      setToken(data.token || "");
    } catch (err) { setPwError(err.response?.data?.detail || "Could not unlock"); }
  };

  const track = (type, step_index = 0) => {
    const key = `${type}-${step_index}`;
    if (sent.current.has(key)) return;
    sent.current.add(key);
    axios.post(`${API}/public/${shareId}/events`, { type, session, step_index }, { headers }).catch(() => {});
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

  const player = (
    <DemoPlayer steps={demo.steps} src={(s, k) => publicAsset(shareId, s, k, token)} narrationMode={demo.narration_mode} brand={demo.brand}
      initialStep={initial} chapters={!embed} globalKeys shareUrl={`${window.location.origin}/share/${shareId}`} onEvent={(t, i) => track(t, i)} />
  );
  if (embed) return <div className="p-3 bg-slate-950 min-h-screen relative z-10" data-testid="public-demo-player">{player}</div>;
  return (
    <div className="min-h-screen relative z-10">
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10" data-testid="public-demo-player">
        <div className="flex items-center gap-2 text-sm text-slate-400 mb-6"><Clapperboard className="h-4 w-4 text-cyan-400" /> Interactive demo</div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-8" data-testid="public-demo-title">{demo.name}</h1>
        {player}
        <p className="text-xs text-slate-500 mt-8">Tip: press Space to play, ← → to move between steps, click the pulsing hotspot to continue.</p>
      </main>
    </div>
  );
}
