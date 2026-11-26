import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { resolveAuthUrl } from "@/lib/api";
import { ChevronLeft, ChevronRight, Link2, Maximize, MousePointerClick, Pause, Play, Volume2, VolumeX } from "lucide-react";

const ACTION_LABEL = { goto: "Navigate", click: "Click", type: "Type", hover: "Hover", scroll: "Scroll", press: "Key press", wait: "Wait", assert: "Check" };

const sceneMs = (s, withAudio) => {
  const chosen = Number(s?.duration_ms) || 3000;
  const audio = withAudio && s?.audio_duration_ms ? s.audio_duration_ms + 700 : 0;
  if (s?.scene_type) return Math.max(chosen === 3000 ? 4000 : chosen, audio);
  const floor = s?.action === "scroll" ? 7000 : 5500;
  const base = chosen === 3000 ? floor : chosen;
  return Math.max(base, audio);
};
export const SCENE_LABEL = { title: "Title", credits: "Credits", email: "Email", waitlist: "Waitlist", cta: "Call to action" };
const stepLabel = (s) => (s?.scene_type ? (s.scene?.title || s.caption || SCENE_LABEL[s.scene_type]) : (s?.caption || ACTION_LABEL[s?.action] || "Step"));
const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function SceneStage({ step, accent, onAdvance, onLead }) {
  const cfg = step.scene || {};
  const kind = step.scene_type;
  const isForm = kind === "email" || kind === "waitlist";
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!done) return undefined;
    const t = setTimeout(onAdvance, 1600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  const submit = async (e) => {
    e.preventDefault();
    if (!EMAIL_OK.test(email.trim())) { setError("Enter a valid email to continue."); return; }
    if (kind === "waitlist" && cfg.collect_name !== false && !name.trim()) { setError("Enter your name to join the waitlist."); return; }
    setError("");
    setSending(true);
    try {
      if (onLead) await onLead(step, { email: email.trim(), name: name.trim() });
      setDone(true);
    } catch {
      setError("That didn't go through. Check the email and try again.");
    } finally {
      setSending(false);
    }
  };

  const buttonCls = "h-11 px-5 rounded-xl text-sm font-semibold text-white inline-flex items-center justify-center gap-2 disabled:opacity-50";
  return (
    <div className="absolute inset-0 grid place-items-center overflow-hidden" data-testid={`player-scene-${kind}`}
      style={{ background: `radial-gradient(720px 380px at 85% -10%, ${accent}40, transparent 60%), radial-gradient(560px 340px at 0% 110%, ${accent}30, transparent 55%), linear-gradient(180deg, rgb(10 12 24), rgb(5 6 14))` }}>
      <div className="absolute inset-x-0 top-0 h-1.5" style={{ background: accent }} />
      <div className="w-full max-w-xl px-6 sm:px-10 text-center">
        {done ? (
          <>
            <p className="font-display text-2xl sm:text-4xl font-bold tracking-tight" data-testid="scene-success-title">{cfg.success_title || "You're in"}</p>
            <p className="mt-3 text-sm sm:text-base text-slate-400">{cfg.success_body || "Continuing the demo…"}</p>
          </>
        ) : (
          <>
            <p className="font-mono text-[10px] sm:text-xs uppercase tracking-[0.2em]" style={{ color: accent }}>{SCENE_LABEL[kind]}</p>
            <h3 className="mt-3 font-display text-2xl sm:text-4xl font-bold tracking-tight leading-tight">{cfg.title || step.caption}</h3>
            {(cfg.subtitle || cfg.body) && <p className="mt-3 text-sm sm:text-base text-slate-400 leading-relaxed">{cfg.subtitle || cfg.body}</p>}
            {isForm ? (
              <form onSubmit={submit} noValidate className="mt-6 space-y-2.5 max-w-md mx-auto" data-testid="scene-form">
                {kind === "waitlist" && cfg.collect_name !== false && (
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="name"
                    className="w-full h-11 rounded-xl border border-slate-700 bg-slate-950/80 px-3.5 text-sm outline-none focus:border-indigo-400" data-testid="scene-name-input" />
                )}
                <input value={email} onChange={(e) => setEmail(e.target.value)} type="text" inputMode="email" placeholder={cfg.placeholder || "you@company.com"} autoComplete="email"
                  className="w-full h-11 rounded-xl border border-slate-700 bg-slate-950/80 px-3.5 text-sm outline-none focus:border-indigo-400" data-testid="scene-email-input" />
                {error && <p className="text-sm text-red-300" role="alert" data-testid="scene-form-error">{error}</p>}
                <button type="submit" disabled={sending} className={`${buttonCls} w-full`} style={{ background: accent }} data-testid="scene-submit">
                  {sending ? "Sending…" : (cfg.button_label || (kind === "waitlist" ? "Join the waitlist" : "Continue"))}
                </button>
              </form>
            ) : (cfg.button_label || kind === "cta") && step.exit_trigger !== "timer" ? (
              <div className="mt-6">
                {cfg.cta_url ? (
                  <a href={cfg.cta_url} target="_blank" rel="noreferrer" onClick={onAdvance} className={buttonCls} style={{ background: accent }} data-testid="scene-cta-button">{cfg.button_label || "Continue"}</a>
                ) : (
                  <button type="button" onClick={onAdvance} className={buttonCls} style={{ background: accent }} data-testid="scene-continue-button">{cfg.button_label || "Continue"}</button>
                )}
              </div>
            ) : null}
            {step.skippable && (
              <button type="button" onClick={onAdvance} className="mt-4 text-sm text-slate-400 hover:text-white underline underline-offset-4" data-testid="scene-skip">Skip</button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
const fadeSec = (s) => (s?.transition === "none" ? 0 : (Number(s?.transition_ms) === 400 ? 800 : (s?.transition_ms || 800)) / 1000);
const motionCount = (s) => s?.motion_count || (s?.motion_paths || []).length;
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

function SceneFrame({ step, src, shot, playing, onMediaError }) {
  const count = step.action === "scroll" ? motionCount(step) : 0;
  const [frame, setFrame] = useState(count);
  const [shown, setShown] = useState("");
  const [under, setUnder] = useState("");
  const shownRef = useRef("");
  useEffect(() => {
    if (count < 1) return;
    let cancel = false;
    (async () => {
      for (let i = 0; i < count; i += 1) {
        try {
          const url = await resolveAuthUrl(src(step, "motion", i));
          if (cancel || !url) return;
          const pic = new Image();
          pic.src = url;
        } catch { /* prefetch best-effort */ }
      }
    })();
    return () => { cancel = true; };
  }, [step, count, src]);
  useEffect(() => {
    if (!playing || count < 1) { setFrame(count); return; }
    setFrame(0);
    const glide = Math.min(3600, Math.max(2200, count * 280));
    const each = glide / count;
    let i = 0;
    const timer = setInterval(() => {
      i += 1;
      if (i >= count) { clearInterval(timer); setFrame(count); return; }
      setFrame(i);
    }, each);
    return () => clearInterval(timer);
  }, [step.id, playing, count]);
  const image = count && frame < count ? src(step, "motion", frame) : shot;
  useEffect(() => {
    if (!image || image === shownRef.current) return;
    let cancel = false;
    const reveal = (url) => {
      if (cancel || url === shownRef.current) return;
      setUnder(shownRef.current);
      shownRef.current = url;
      setShown(url);
    };
    (async () => {
      try {
        const url = await resolveAuthUrl(image);
        if (cancel) return;
        if (!url) { onMediaError?.(); return; }
        const pic = new Image();
        pic.onload = () => reveal(url);
        pic.onerror = () => { if (!cancel) onMediaError?.(); };
        pic.src = url;
        if (pic.complete) reveal(url);
      } catch {
        if (!cancel) onMediaError?.();
      }
    })();
    return () => { cancel = true; };
  }, [image, onMediaError]);
  useEffect(() => {
    if (!under) return undefined;
    const timer = setTimeout(() => setUnder(""), 260);
    return () => clearTimeout(timer);
  }, [under, shown]);
  return (
    <>
      {under && <img src={under} alt="" className="absolute inset-0 h-full w-full object-cover object-top" />}
      {shown ? (
        <img src={shown} alt={step.caption || "Demo step"} data-testid="player-frame"
          className={`absolute inset-0 h-full w-full object-cover object-top ${under ? "player-dissolve" : ""}`} />
      ) : (
        <div className="absolute inset-0 bg-slate-950" data-testid="player-frame-loading" />
      )}
    </>
  );
}

function Stage({ step, mobile, fade, playing, src, onMediaError }) {
  const [layers, setLayers] = useState([step]);
  useEffect(() => {
    setLayers((list) => {
      const last = list[list.length - 1];
      if (last === step) return list;
      return last?.id === step.id ? [...list.slice(0, -1), step] : [...list, step].slice(-3);
    });
  }, [step]);
  useEffect(() => {
    const timer = setTimeout(() => setLayers((list) => (list.length > 1 ? list.slice(-1) : list)), Math.round((fade || 0) * 1000) + 60);
    return () => clearTimeout(timer);
  }, [step.id, fade]);
  const shotFor = (item) => src(item, mobile && (item.has_mobile || item.screenshot_mobile_path) ? "mobile" : "screenshot");
  return layers.map((item, index) => {
    const onTop = index === layers.length - 1;
    const dissolve = onTop && layers.length > 1 && fade > 0;
    return (
      <motion.div key={item.id} className="absolute inset-0" style={{ zIndex: index + 1 }}
        initial={{ opacity: dissolve ? 0 : 1 }} animate={{ opacity: 1 }}
        transition={{ duration: dissolve ? Math.min(fade, 0.45) : 0, ease: "easeInOut" }}>
        {hasShot(item) ? (
          <SceneFrame step={item} src={src} playing={playing && onTop} shot={shotFor(item)} onMediaError={onTop ? onMediaError : undefined} />
        ) : (
          <div className="absolute inset-0 grid place-items-center grid-bg">
            <div className="text-center px-6 mt-32">
              <p className="font-mono text-[10px] uppercase tracking-widest text-cyan-400">{ACTION_LABEL[item.action]} · not recorded yet</p>
              <p className="mt-2 text-slate-400 text-sm">{item.selector || item.url || ""}</p>
            </div>
          </div>
        )}
      </motion.div>
    );
  });
}

function Caption({ text, accent, top, words, audioT }) {
  const timed = Array.isArray(words) && words.length > 0;
  if (!text && !timed) return null;
  const nowMs = (audioT || 0) * 1000;
  return (
    <motion.div key={timed ? "karaoke" : text} initial={false} animate={{ opacity: 1 }} data-testid="player-caption"
      className={`absolute left-[6%] right-[6%] ${top ? "top-[5%]" : "bottom-[5%]"} rounded-xl bg-slate-950/85 backdrop-blur-md px-4 py-2.5 sm:px-5 sm:py-3 text-xs sm:text-base font-medium border-l-4 shadow-2xl`}
      style={{ borderColor: accent }}>
      {timed ? (
        words.map((w, i) => (
          <span key={i} data-testid={nowMs >= w.start_ms && nowMs < w.end_ms ? "caption-word-active" : undefined}
            style={nowMs >= w.start_ms && nowMs < w.end_ms ? { color: accent, fontWeight: 700 } : nowMs >= w.end_ms ? { color: "#e2e8f0" } : { color: "#94a3b8" }}>
            {w.w}{i < words.length - 1 ? " " : ""}
          </span>
        ))
      ) : text}
    </motion.div>
  );
}

function VideoStage({ step, src, playing, rate, poster, holdMs, onMediaError }) {
  const ref = useRef(null);
  const [media, setMedia] = useState({ src: "", poster: "" });
  const [failed, setFailed] = useState(false);
  const v = step.video || {};
  const start = (v.start_ms || 0) / 1000;
  const end = Math.max(start + 0.1, (v.end_ms || 0) / 1000);
  // Fit the recorded action window into the narration hold: speed long
  // actions up instead of cutting them mid-motion (freeze covers short ones).
  const windowS = end - start;
  const fit = holdMs ? Math.min(Math.max((windowS * rate * 1000) / holdMs, rate), 4) : rate;
  useEffect(() => {
    let cancel = false;
    setFailed(false);
    (async () => {
      try {
        const [videoUrl, posterUrl] = await Promise.all([
          resolveAuthUrl(src(step, "video")),
          poster ? resolveAuthUrl(poster) : Promise.resolve(""),
        ]);
        if (cancel) return;
        if (!videoUrl) {
          setFailed(true);
          onMediaError?.();
          setMedia({ src: "", poster: "" });
          return;
        }
        setMedia({ src: videoUrl, poster: posterUrl || "" });
      } catch {
        if (!cancel) {
          setFailed(true);
          onMediaError?.();
          setMedia({ src: "", poster: "" });
        }
      }
    })();
    return () => { cancel = true; };
  }, [step, src, poster, onMediaError]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const seek = () => { if (el.currentTime < start || el.currentTime >= end) { try { el.currentTime = start; } catch { /* not ready */ } } };
    seek();
    el.addEventListener("loadedmetadata", seek);
    return () => el.removeEventListener("loadedmetadata", seek);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.id, media.src]);
  useEffect(() => {
    const el = ref.current;
    if (!el || !media.src) return;
    el.playbackRate = fit || 1;
    if (playing) {
      if (el.currentTime >= end - 0.03 || el.currentTime < start) { try { el.currentTime = start; } catch { /* noop */ } }
      el.play().catch(() => {});
    } else {
      el.pause();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, fit, step.id, media.src]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const iv = setInterval(() => {
      if (el.currentTime >= end) el.pause();
      else if (el.currentTime < start) { try { el.currentTime = start; } catch { /* noop */ } }
    }, 120);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.id]);
  if (failed) {
    return <div className="absolute inset-0 bg-slate-950" data-testid="player-video-failed" />;
  }
  if (!media.src) {
    return <div className="absolute inset-0 grid place-items-center bg-slate-950" data-testid="player-video-loading" />;
  }
  return (
    <video ref={ref} src={media.src} poster={media.poster || undefined} muted playsInline preload="auto"
      className="absolute inset-0 h-full w-full object-cover object-top" data-testid="player-video" />
  );
}

const remembered = (key, fallback) => {
  try { const v = sessionStorage.getItem(key); return v == null ? fallback : v === "1"; } catch { return fallback; }
};

export const DemoPlayer = ({ steps, src, narrationMode = "both", brand = {}, initialStep = 0, onStepChange, onEvent, onDwell, chapters = false, shareUrl, globalKeys = false, cta, guided = false, autoplay = false, startMuted = false, onCta, onLead }) => {
  const [branch, setBranch] = useState("");
  const visible = steps.filter((s) => !s.branch || s.branch === branch);
  const [idx, setIdx] = useState(Math.min(initialStep, Math.max(visible.length - 1, 0)));
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(() => startMuted || remembered("fc_muted", false));
  const [captionsOn, setCaptionsOn] = useState(() => remembered("fc_cc", true));
  const [rate, setRate] = useState(1);
  const audioRef = useRef(null);
  const boxRef = useRef(null);
  const accent = brand.accent || "#6366F1";
  const showCaption = narrationMode !== "voiceover" && captionsOn;
  const withAudio = narrationMode !== "captions";
  const step = visible[idx];
  const isScene = !!step?.scene_type;
  const choices = isScene ? [] : (step?.choices || []);
  const hold = isScene ? step.exit_trigger !== "timer"
    : (guided && step?.hotspot && ["click", "hover", "type"].includes(step?.action)) || choices.length > 0;
  const [mobile, setMobile] = useState(false);
  const [audioT, setAudioT] = useState(0);
  const [mediaError, setMediaError] = useState(false);
  const entered = useRef(Date.now());
  const reportMediaError = useCallback(() => setMediaError(true), []);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return undefined;
    const h = () => setAudioT(a.currentTime);
    a.addEventListener("timeupdate", h);
    return () => a.removeEventListener("timeupdate", h);
  }, []);

  const go = useCallback((i) => {
    if (!visible.length) return;
    const n = Math.max(0, Math.min(visible.length - 1, i));
    setIdx(n);
    onStepChange?.(n);
  }, [visible.length, onStepChange]);

  useEffect(() => { if (initialStep !== undefined) setIdx(Math.min(initialStep, Math.max(visible.length - 1, 0))); }, [initialStep, visible.length]);
  useEffect(() => { if (autoplay) setPlaying(true); }, [autoplay]);
  useEffect(() => { try { sessionStorage.setItem("fc_muted", muted ? "1" : "0"); } catch { /* private mode */ } }, [muted]);
  useEffect(() => { try { sessionStorage.setItem("fc_cc", captionsOn ? "1" : "0"); } catch { /* private mode */ } }, [captionsOn]);
  useEffect(() => { setMediaError(false); }, [step?.id]);

  useEffect(() => {
    entered.current = Date.now();
    return () => onDwell?.(idx, Date.now() - entered.current);
  }, [idx]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!playing || !step) return;
    const audio = audioRef.current;
    let cancel = false;
    (async () => {
      if (!(withAudio && hasAudio(step) && audio && !muted)) return;
      try {
        const url = await resolveAuthUrl(src(step, "audio"));
        if (cancel || !url) return;
        audio.src = url;
        audio.playbackRate = rate;
        await audio.play().catch(() => {});
      } catch {
        if (!cancel) setMediaError(true);
      }
    })();
    if (hold) return () => { cancel = true; audio?.pause(); };
    const t = setTimeout(() => {
      if (idx < visible.length - 1) go(idx + 1);
      else { setPlaying(false); onEvent?.("complete", idx); }
    }, sceneMs(step, withAudio && hasAudio(step)) / rate);
    return () => { cancel = true; clearTimeout(t); audio?.pause(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, idx, muted, rate, hold, visible.length]);

  useEffect(() => {
    const next = visible[idx + 1];
    if (next && hasShot(next)) resolveAuthUrl(src(next, "screenshot")).then((url) => { if (url) { const pic = new Image(); pic.src = url; } }).catch(() => {});
    if (next && withAudio && hasAudio(next)) resolveAuthUrl(src(next, "audio")).then((url) => { if (url) { const a = new Audio(); a.preload = "auto"; a.src = url; } }).catch(() => {});
    if (step) onEvent?.("step", idx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, visible]);

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

  const advanceFromScene = useCallback(() => {
    if (idx < visible.length - 1) { setPlaying(true); go(idx + 1); }
    else { setPlaying(false); onEvent?.("complete", idx); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, visible.length, go]);

  const pickBranch = (option) => {
    onEvent?.("branch", idx, option.branch);
    const next = steps.filter((s) => !s.branch || s.branch === option.branch);
    setBranch(option.branch);
    setIdx(Math.min(idx + 1, Math.max(next.length - 1, 0)));
    setPlaying(true);
  };

  if (!visible.length) {
    return <div className="aspect-[16/10] rounded-xl border border-dashed border-slate-700 grid place-items-center text-sm text-slate-500" data-testid="player-empty">No steps yet</div>;
  }

  return (
    <div className="space-y-3">
      <div ref={boxRef} tabIndex={0} onKeyDown={onKey} aria-label="Demo player. Space to play, arrows to navigate"
        className="relative aspect-[16/10] rounded-xl overflow-hidden border border-slate-800 bg-slate-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 group" data-testid="demo-player">
        {isScene ? (
          <SceneStage key={step.id} step={step} accent={accent} onAdvance={advanceFromScene}
            onLead={onLead ? (s, payload) => onLead(s, idx, payload) : undefined} />
        ) : step.video?.end_ms ? (
          <VideoStage key={step.id} step={step} src={src} playing={playing} rate={rate}
            holdMs={hold ? 0 : sceneMs(step, withAudio && hasAudio(step))}
            poster={hasShot(step) ? src(step, "screenshot") : undefined}
            onMediaError={reportMediaError} />
        ) : (
          <Stage step={step} mobile={mobile} fade={fadeSec(step)} playing={playing} src={src} onMediaError={reportMediaError} />
        )}
        {!isScene && hasShot(step) && ["click", "hover", "type"].includes(step.action) && <Hotspot box={step.hotspot} accent={accent} onClick={() => go(idx + 1)} />}
        {choices.length > 0 && (
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex gap-2" data-testid="player-choices">
            {choices.map((option) => (
              <button key={option.branch} onClick={() => pickBranch(option)} className="rounded-lg px-3 py-2 text-sm font-semibold text-white" style={{ background: accent }} data-testid={`player-choice-${option.branch}`}>{option.label}</button>
            ))}
          </div>
        )}
        {!isScene && (step.annotations || []).map((ann, i) => (
          <span key={i} className="pointer-events-none absolute" style={{ left: `${(ann.x / 1280) * 100}%`, top: `${(ann.y / 800) * 100}%`, width: ann.w ? `${(ann.w / 1280) * 100}%` : 12, height: ann.h ? `${(ann.h / 800) * 100}%` : 18, background: ann.kind === "blur" ? "rgba(15,23,42,0.72)" : "transparent", borderBottom: ann.kind === "arrow" ? `2px solid ${accent}` : undefined, boxShadow: ann.kind === "hover" ? `0 0 0 8px ${accent}55` : undefined, outline: ["highlight", "callout", "hover"].includes(ann.kind) ? `2px solid ${accent}` : undefined, borderRadius: ["highlight", "callout", "hover"].includes(ann.kind) ? 12 : undefined }} data-testid={ann.kind === "callout" ? "player-callout" : `player-annotation-${i}`}>
            {ann.kind === "callout" && ann.text && <span className="absolute -top-7 left-0 whitespace-nowrap rounded-md px-2 py-1 text-xs font-semibold text-white" style={{ background: accent }}>{ann.text}</span>}
          </span>
        ))}
        {!isScene && showCaption && <Caption text={step.caption} accent={accent} top={brand.caption_position === "top"} words={step.words} audioT={audioT} />}
        {cta?.url && idx === visible.length - 1 && choices.length === 0 && (
          <a href={cta.url} onClick={() => onCta?.(idx)} className="absolute bottom-16 left-1/2 -translate-x-1/2 rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ background: accent }} data-testid="player-cta">{cta.label || "Continue"}</a>
        )}
        {mediaError && (
          <div
            role="alert"
            data-testid="player-media-error"
            className="absolute inset-x-3 top-3 z-20 rounded-lg border border-amber-400/40 bg-slate-950/90 px-3 py-2 text-center text-sm text-amber-100 shadow-lg backdrop-blur"
          >
            Couldn’t load step media
          </div>
        )}
        {brand.watermark !== false && (
          <span className="absolute top-3 right-3 rounded-md bg-slate-950/70 backdrop-blur px-2 py-1 text-[10px] font-mono text-slate-300" data-testid="player-watermark">Made with AppShowcase</span>
        )}
        {!isScene && (
          <button onClick={() => setPlaying((p) => !p)} aria-label={playing ? "Pause" : "Play"} data-testid="player-overlay-play"
            className={`absolute inset-0 grid place-items-center transition-opacity ${playing ? "opacity-0" : "opacity-100 bg-slate-950/30"}`}>
            {!playing && <span className="h-14 w-14 rounded-full grid place-items-center shadow-2xl" style={{ background: accent }}><Play className="h-6 w-6 ml-0.5 fill-white" /></span>}
          </button>
        )}
      </div>
      <div className="flex gap-1" aria-hidden="true">
        {visible.map((s, i) => (
          <button key={s.id} onClick={() => go(i)} tabIndex={-1} className="h-1.5 flex-1 rounded-full transition-colors" style={{ background: i <= idx ? accent : "rgb(30 41 59)" }} data-testid={`player-segment-${i}`} />
        ))}
      </div>
      <div className="player-dock flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button onClick={() => go(idx - 1)} aria-label="Previous step" className="h-9 w-9 rounded-lg hover:bg-slate-800 grid place-items-center" data-testid="player-prev-button"><ChevronLeft className="h-4 w-4" /></button>
          <button onClick={() => setPlaying((p) => !p)} aria-label={playing ? "Pause" : "Play"} className="h-9 w-9 rounded-lg bg-slate-800 hover:bg-slate-700 grid place-items-center" data-testid="player-play-button">
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <button onClick={() => go(idx + 1)} aria-label="Next step" className="h-9 w-9 rounded-lg hover:bg-slate-800 grid place-items-center" data-testid="player-next-button"><ChevronRight className="h-4 w-4" /></button>
          <span className="font-mono text-xs text-slate-400 ml-2" data-testid="player-step-counter">{idx + 1} / {visible.length}</span>
          {withAudio && !hasAudio(step) && <span className="hidden sm:inline text-[10px] text-slate-500" data-testid="player-no-audio">No voice on this step</span>}
        </div>
        <div className="flex items-center gap-1">
          {step.action && <span className="hidden sm:flex items-center gap-1 font-mono text-[10px] uppercase text-slate-500 mr-2"><MousePointerClick className="h-3 w-3" />{isScene ? SCENE_LABEL[step.scene_type] : ACTION_LABEL[step.action]}</span>}
          {visible.some((s) => s.has_mobile || s.screenshot_mobile_path) && (
            <button onClick={() => setMobile((m) => !m)} className="h-9 px-2 rounded-lg hover:bg-slate-800 text-xs" data-testid="player-viewport-toggle">{mobile ? "Phone" : "Desktop"}</button>
          )}
          <button onClick={() => setRate((r) => (r === 1 ? 1.5 : r === 1.5 ? 2 : 1))} className="h-9 px-2 rounded-lg hover:bg-slate-800 text-xs font-mono" data-testid="player-speed-button">{rate}x</button>
          <button onClick={() => setCaptionsOn((c) => !c)} aria-pressed={captionsOn} className={`h-9 px-2 rounded-lg text-xs font-semibold ${captionsOn ? "bg-slate-800" : "text-slate-500"}`} data-testid="player-captions-button">CC</button>
          <button onClick={() => setMuted((m) => !m)} aria-label={muted ? "Unmute" : "Mute"} className="h-9 w-9 rounded-lg hover:bg-slate-800 grid place-items-center" data-testid="player-mute-button">
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <button onClick={() => boxRef.current?.requestFullscreen?.()} aria-label="Fullscreen" className="h-9 w-9 rounded-lg hover:bg-slate-800 grid place-items-center" data-testid="player-fullscreen-button"><Maximize className="h-4 w-4" /></button>
        </div>
      </div>
      {chapters && (
        <ol className="grid sm:grid-cols-2 gap-2 pt-2" data-testid="player-chapters">
          {visible.map((s, i) => (
            <li key={s.id} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer transition-colors ${i === idx ? "border-indigo-500/50 bg-indigo-500/10" : "border-slate-800 hover:border-slate-700"}`} onClick={() => go(i)} data-testid={`chapter-${i}`}>
              <span className="font-mono text-xs text-slate-500 w-5">{String(i + 1).padStart(2, "0")}</span>
              <span className="flex-1 truncate">{s.chapter ? `${s.chapter} · ` : ""}{stepLabel(s)}</span>
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
