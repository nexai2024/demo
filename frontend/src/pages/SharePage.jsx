import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Clapperboard, Loader2 } from "lucide-react";
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
  const sent = useRef(new Set());
  const session = useMemo(sessionId, []);
  const initial = Math.max(0, (parseInt(params.get("step"), 10) || 1) - 1);

  useEffect(() => {
    axios.get(`${API}/public/${shareId}`).then(({ data }) => setDemo(data)).catch((e) => setError(e.response?.data?.detail || "Demo not found"));
  }, [shareId]);

  const track = (type, step_index = 0) => {
    const key = `${type}-${step_index}`;
    if (sent.current.has(key)) return;
    sent.current.add(key);
    axios.post(`${API}/public/${shareId}/events`, { type, session, step_index }).catch(() => {});
  };
  useEffect(() => {
    if (demo) track("view");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo]);

  if (error) return <div className="min-h-screen grid place-items-center text-slate-400 p-6 text-center" data-testid="public-demo-error">{error}</div>;
  if (!demo) return <div className="min-h-screen grid place-items-center"><Loader2 className="h-6 w-6 animate-spin text-indigo-400" /></div>;

  const player = (
    <DemoPlayer steps={demo.steps} src={(s, k) => publicAsset(shareId, s, k)} narrationMode={demo.narration_mode} brand={demo.brand}
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
