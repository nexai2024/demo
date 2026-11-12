import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Link2, Maximize, MousePointerClick, Pause, Play, Volume2, VolumeX } from "lucide-react";

const ACTION_LABEL = { goto: "Navigate", click: "Click", type: "Type", hover: "Hover", scroll: "Scroll", press: "Key press", wait: "Wait" };

const stepMs = (s, withAudio) => Math.max(s.duration_ms || 3000, withAudio && s.audio_duration_ms ? s.audio_duration_ms + 400 : 0);
const hasShot = (s) => s.has_screenshot ?? !!s.screenshot_path;
const hasAudio = (s) => s.has_audio ?? !!s.audio_path;

function Hotspot({ box, onClick, accent }) {
  if (!box) return null;
  const style = { left: `${((box.x + box.width / 2) / 1280) * 100}%`, top: `${((box.y + box.height / 2) / 800) * 100}%` };
  return (
    <button onClick={onClick} aria-label="Continue to next step" data-testid="player-hotspot" style={style}
      className="absolute -translate-x-1/2 -translate-y-1/2 h-7 w-7 rounded-full border-2 border-white hotspot-dot grid place-items-center">
      <span className="h-3 w-3 rounded-full" style={{ background: accent }} />
    </button>
  );
}

function Caption({ text, accent, top }) {
  if (!text) return null;
  return (
    <motion.div key={text} initial={{ opacity: 0, y: top ? -8 : 8 }} animate={{ opacity: 1, y: 0 }} data-testid="player-caption"
      className={`absolute left-[6%] right-[6%] ${top ? "top-[5%]" : "bottom-[5%]"} rounded-xl bg-slate-950/85 backdrop-blur-md px-4 py-2.5 sm:px-5 sm:py-3 text-xs sm:text-base font-medium border-l-4 shadow-2xl`}
      style={{ borderColor: accent }}>
      {text}
    </motion.div>
  );
}

export const DemoPlayer = ({ steps, src, narrationMode = "both", brand = {}, initialStep = 0, onStepChange, onEvent, chapters = false, shareUrl, globalKeys = false }) => {
  const [idx, setIdx] = useState(Math.min(initialStep, Math.max(steps.length - 1, 0)));
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const audioRef = useRef(null);
  const boxRef = useRef(null);
  const accent = brand.accent || "#6366F1";
  const showCaption = narrationMode !== "voiceover";
  const withAudio = narrationMode !== "captions";
  const step = steps[idx];

  const go = useCallback((i) => {
    if (!steps.length) return;
    const n = Math.max(0, Math.min(steps.length - 1, i));
    setIdx(n);
    onStepChange?.(n);
  }, [steps.length, onStepChange]);

  useEffect(() => { if (initialStep !== undefined) setIdx(Math.min(initialStep, Math.max(steps.length - 1, 0))); }, [initialStep, steps.length]);

  useEffect(() => {
    if (!playing || !step) return;
    const audio = audioRef.current;
    if (withAudio && hasAudio(step) && audio && !muted) {
      audio.src = src(step, "audio");
      audio.play().catch(() => {});
    }
    const t = setTimeout(() => {
      if (idx < steps.length - 1) go(idx + 1);
      else { setPlaying(false); onEvent?.("complete", idx); }
    }, stepMs(step, withAudio && hasAudio(step)));
    return () => { clearTimeout(t); audio?.pause(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, idx, muted]);

  useEffect(() => {
    const next = steps[idx + 1];
    if (next && hasShot(next)) new Image().src = src(next, "screenshot");
    if (next && withAudio && hasAudio(next)) { const a = new Audio(); a.preload = "auto"; a.src = src(next, "audio"); }
    if (step) onEvent?.("step", idx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, steps]);

  const onKey = (e) => {
    if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName) || e.metaKey || e.ctrlKey) return;
    if (e.key === " " && e.target.tagName === "BUTTON" && !boxRef.current?.contains(e.target)) return;
    if (e.key === " ") { e.preventDefault(); setPlaying((p) => !p); }
    if (e.key === "ArrowRight") go(idx + 1);
    if (e.key === "ArrowLeft") go(idx - 1);
    if (e.key === "m") setMuted((m) => !m);
  };

  const keyRef = useRef(onKey);
  keyRef.current = onKey;
  useEffect(() => {
    if (!globalKeys) return;
    const h = (e) => { if (!boxRef.current?.contains(e.target)) keyRef.current(e); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [globalKeys]);

  if (!steps.length) {
    return <div className="aspect-[16/10] rounded-xl border border-dashed border-slate-700 grid place-items-center text-sm text-slate-500" data-testid="player-empty">No steps yet</div>;
  }

  return (
    <div className="space-y-3">
      <div ref={boxRef} tabIndex={0} onKeyDown={onKey} aria-label="Demo player. Space to play, arrows to navigate"
        className="relative aspect-[16/10] rounded-xl overflow-hidden border border-slate-800 bg-slate-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 group" data-testid="demo-player">
        <AnimatePresence mode="popLayout" initial={false}>
          {hasShot(step) ? (
            <motion.img key={`${step.id}-${src(step, "screenshot")}`} src={src(step, "screenshot")} alt={step.caption || "Demo step"}
              initial={{ opacity: step.transition === "fade" ? 0 : 1 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: (step.transition === "fade" ? step.transition_ms || 400 : 0) / 1000 }}
              className="absolute inset-0 h-full w-full object-cover object-top" data-testid="player-frame" />
          ) : (
            <motion.div key={step.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 grid place-items-center grid-bg">
              <div className="text-center px-6 mt-32">
                <p className="font-mono text-[10px] uppercase tracking-widest text-cyan-400">{ACTION_LABEL[step.action]} · not recorded yet</p>
                <p className="mt-2 text-slate-400 text-sm">{step.selector || step.url || ""}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {hasShot(step) && ["click", "hover", "type"].includes(step.action) && <Hotspot box={step.hotspot} accent={accent} onClick={() => go(idx + 1)} />}
        {showCaption && <Caption text={step.caption} accent={accent} top={brand.caption_position === "top"} />}
        {brand.watermark !== false && (
          <span className="absolute top-3 right-3 rounded-md bg-slate-950/70 backdrop-blur px-2 py-1 text-[10px] font-mono text-slate-300" data-testid="player-watermark">Made with Flowcast</span>
        )}
        <button onClick={() => setPlaying((p) => !p)} aria-label={playing ? "Pause" : "Play"} data-testid="player-overlay-play"
          className={`absolute inset-0 grid place-items-center transition-opacity ${playing ? "opacity-0" : "opacity-100 bg-slate-950/30"}`}>
          {!playing && <span className="h-14 w-14 rounded-full grid place-items-center shadow-2xl" style={{ background: accent }}><Play className="h-6 w-6 ml-0.5 fill-white" /></span>}
        </button>
      </div>
      <div className="flex gap-1" aria-hidden="true">
        {steps.map((s, i) => (
          <button key={s.id} onClick={() => go(i)} tabIndex={-1} className="h-1.5 flex-1 rounded-full transition-colors" style={{ background: i <= idx ? accent : "rgb(30 41 59)" }} data-testid={`player-segment-${i}`} />
        ))}
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button onClick={() => go(idx - 1)} aria-label="Previous step" className="h-9 w-9 rounded-lg hover:bg-slate-800 grid place-items-center" data-testid="player-prev-button"><ChevronLeft className="h-4 w-4" /></button>
          <button onClick={() => setPlaying((p) => !p)} aria-label={playing ? "Pause" : "Play"} className="h-9 w-9 rounded-lg bg-slate-800 hover:bg-slate-700 grid place-items-center" data-testid="player-play-button">
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <button onClick={() => go(idx + 1)} aria-label="Next step" className="h-9 w-9 rounded-lg hover:bg-slate-800 grid place-items-center" data-testid="player-next-button"><ChevronRight className="h-4 w-4" /></button>
          <span className="font-mono text-xs text-slate-400 ml-2" data-testid="player-step-counter">{idx + 1} / {steps.length}</span>
        </div>
        <div className="flex items-center gap-1">
          {step.action && <span className="hidden sm:flex items-center gap-1 font-mono text-[10px] uppercase text-slate-500 mr-2"><MousePointerClick className="h-3 w-3" />{ACTION_LABEL[step.action]}</span>}
          <button onClick={() => setMuted((m) => !m)} aria-label={muted ? "Unmute" : "Mute"} className="h-9 w-9 rounded-lg hover:bg-slate-800 grid place-items-center" data-testid="player-mute-button">
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <button onClick={() => boxRef.current?.requestFullscreen?.()} aria-label="Fullscreen" className="h-9 w-9 rounded-lg hover:bg-slate-800 grid place-items-center" data-testid="player-fullscreen-button"><Maximize className="h-4 w-4" /></button>
        </div>
      </div>
      {chapters && (
        <ol className="grid sm:grid-cols-2 gap-2 pt-2" data-testid="player-chapters">
          {steps.map((s, i) => (
            <li key={s.id} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer transition-colors ${i === idx ? "border-indigo-500/50 bg-indigo-500/10" : "border-slate-800 hover:border-slate-700"}`} onClick={() => go(i)} data-testid={`chapter-${i}`}>
              <span className="font-mono text-xs text-slate-500 w-5">{String(i + 1).padStart(2, "0")}</span>
              <span className="flex-1 truncate">{s.caption || ACTION_LABEL[s.action]}</span>
              {shareUrl && (
                <button aria-label={`Copy link to step ${i + 1}`} onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(`${shareUrl}?step=${i + 1}`); }} className="text-slate-500 hover:text-white" data-testid={`chapter-copy-${i}`}>
                  <Link2 className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ol>
      )}
      <audio ref={audioRef} className="hidden" />
    </div>
  );
};
