import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { API, api, errMsg } from "@/lib/api";

const KEYS = ["Enter", "Tab", "Escape", "Backspace", "Delete", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"];

export function LivePane({ pid, onEvent, onClose }) {
  const chain = useRef(Promise.resolve());
  const screenRef = useRef(null);
  const [src, setSrc] = useState("");
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [marks, setMarks] = useState([]);

  useEffect(() => {
    let stop = false;
    let shown = "";
    const frames = async () => {
      while (!stop) {
        try {
          const response = await fetch(`${API}/projects/${pid}/live/frame?t=${Date.now()}`, { credentials: "include" });
          if (response.ok) {
            const next = URL.createObjectURL(await response.blob());
            if (stop) { URL.revokeObjectURL(next); return; }
            await new Promise((resolve) => {
              const pic = new Image();
              pic.onload = () => resolve();
              pic.onerror = () => resolve();
              pic.src = next;
            });
            if (stop) { URL.revokeObjectURL(next); return; }
            const retire = shown;
            setSrc(next);
            shown = next;
            if (retire) setTimeout(() => URL.revokeObjectURL(retire), 500);
          }
        } catch { /* the next loop retries */ }
        await new Promise((resolve) => setTimeout(resolve, 180));
      }
    };
    frames();
    const state = setInterval(() => {
      api.get(`/projects/${pid}/live`).then(({ data }) => {
        setUrl(data.url || "");
        setNote(data.renewing ? "Continuing this session…" : "");
        if (data.error) setError(data.error);
        else if (data.warning) setError(data.warning);
      }).catch(() => {});
    }, 1500);
    return () => { stop = true; clearInterval(state); if (shown) URL.revokeObjectURL(shown); };
  }, [pid]);

  const wheelBuf = useRef(0);
  const scrollQueued = useRef(false);
  const send = (path, body) => {
    if (path !== "scroll") setPending(true);
    chain.current = chain.current.then(async () => {
      try {
        const payload = path === "scroll"
          ? { amount: Math.max(-900, Math.min(900, Math.round(wheelBuf.current))) }
          : body;
        if (path === "scroll") {
          wheelBuf.current = 0;
          scrollQueued.current = false;
          if (Math.abs(payload.amount) < 16) return;
        }
        const { data } = await api.post(`/projects/${pid}/live/${path}`, payload);
        onEvent(data);
        setError("");
      } catch (err) {
        setError(errMsg(err));
      } finally {
        if (path !== "scroll") setPending(false);
        if (path === "scroll" && Math.abs(wheelBuf.current) >= 16) queueScroll();
      }
    });
  };
  const queueScroll = () => {
    if (scrollQueued.current) return;
    scrollQueued.current = true;
    send("scroll", { amount: 0 });
  };

  const onClick = (event) => {
    event.preventDefault();
    event.currentTarget.focus();
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.min(1279, Math.max(0, Math.round(((event.clientX - rect.left) / rect.width) * 1280)));
    const y = Math.min(799, Math.max(0, Math.round(((event.clientY - rect.top) / rect.height) * 800)));
    const id = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    setMarks((list) => [...list.slice(-5), { id, left: (x / 1280) * 100, top: (y / 800) * 100 }]);
    window.setTimeout(() => setMarks((list) => list.filter((mark) => mark.id !== id)), 900);
    send("click", { x, y });
  };

  const onKeyDown = (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key.length === 1) {
      event.preventDefault();
      send("type", { text: event.key });
      return;
    }
    if (KEYS.includes(event.key)) {
      event.preventDefault();
      send("key", { key: event.key });
    }
  };

  const sendRef = useRef(queueScroll);
  sendRef.current = queueScroll;
  useEffect(() => {
    const node = screenRef.current;
    if (!node) return undefined;
    let timer = 0;
    const onWheel = (event) => {
      event.preventDefault();
      wheelBuf.current += event.deltaY;
      if (timer) return;
      timer = window.setTimeout(() => {
        timer = 0;
        if (Math.abs(wheelBuf.current) >= 16) sendRef.current();
      }, 50);
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => { node.removeEventListener("wheel", onWheel); window.clearTimeout(timer); };
  }, [pid]);

  const onPaste = (event) => {
    const text = event.clipboardData.getData("text").slice(0, 200);
    if (!text) return;
    event.preventDefault();
    send("type", { text });
  };

  return (
    <div className="space-y-2" data-testid="live-pane">
      <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
        <span className="truncate" data-testid="live-url">{note || url || "Opening the target page…"}</span>
        <button onClick={onClose} className="h-8 px-2 rounded-md border border-slate-700 text-slate-200" data-testid="live-stop-button">Close</button>
      </div>
      <div
        ref={screenRef}
        tabIndex={0}
        onMouseDown={onClick}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        className="relative aspect-[1280/800] overflow-hidden rounded-2xl border border-cyan-400/40 bg-slate-950 shadow-[0_0_0_6px_rgba(34,211,238,0.06)] outline-none focus:ring-2 focus:ring-cyan-400"
        data-testid="live-screen"
        role="application"
        aria-label="Live browser. Click and type to add steps."
      >
        {src ? <img src={src} alt="" className="h-full w-full object-fill pointer-events-none" data-testid="live-frame" /> : <div className="grid h-full place-items-center"><Loader2 className="h-5 w-5 animate-spin text-cyan-300" /></div>}
        {marks.map((mark) => (
          <span key={mark.id} data-testid="live-click-mark" className="pointer-events-none absolute z-10 h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-cyan-400/80 shadow-[0_0_0_8px_rgba(34,211,238,0.45)]" style={{ left: `${mark.left}%`, top: `${mark.top}%` }} />
        ))}
        {pending && <Loader2 className="absolute top-2 right-2 h-4 w-4 animate-spin text-cyan-300" />}
      </div>
      <p className="text-xs text-slate-500">Click, type, or scroll. A mark appears where you click while the page catches up. Record demo is what glides through a scroll and holds each scene so a viewer can read it. The session reconnects on its own before the two-minute limit.</p>
      {error && <p className="text-xs text-amber-200" data-testid="live-error">{error}</p>}
    </div>
  );
}
