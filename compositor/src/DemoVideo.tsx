import React from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  OffthreadVideo,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

/* EDL shape — built by backend/edl.py. Kept loose on purpose: the Python
   side owns the contract, this file only renders it. */
export interface EdlSegment {
  id: string;
  type: "video" | "still" | "scene" | "blank";
  durationInFrames: number;
  transitionInFrames: number;
  src?: string;
  poster?: string;
  trimBeforeFrames?: number;
  sourceFrames?: number;
  playbackRate?: number;
  actionFrame?: number | null;
  audio?: string | null;
  caption?: { text: string; words?: { w: string; start_ms: number; end_ms: number }[] | null; position?: string } | null;
  hotspot?: { x: number; y: number; width: number; height: number } | null;
  annotations?: { kind: string; x?: number; y?: number; w?: number; h?: number; text?: string }[];
  camera?: { fx: number; fy: number; zoom: number; inFrames: number; outFrames: number } | null;
  scene?: Record<string, string>;
  label?: string;
}

export interface EdlDoc {
  fps: number;
  width: number;
  height: number;
  durationInFrames: number;
  sourceWidth: number;
  sourceHeight: number;
  brand: { accent: string; watermark: boolean };
  segments: EdlSegment[];
}

export interface DemoProps {
  edl: EdlDoc;
  assetBase: string;
  [key: string]: unknown;
}

const SPRING = { damping: 17, mass: 0.8, stiffness: 95 };

/** Maps a point from source (recording) pixels into composition pixels,
 *  matching the objectFit: cover crop applied to the media. */
function useCover(edl: EdlDoc) {
  const scale = Math.max(edl.width / edl.sourceWidth, edl.height / edl.sourceHeight);
  return {
    x: (v: number) => v * scale + (edl.width - edl.sourceWidth * scale) / 2,
    y: (v: number) => v * scale + (edl.height - edl.sourceHeight * scale) / 2,
    s: scale,
  };
}

const CameraView: React.FC<{ seg: EdlSegment; children: React.ReactNode }> = ({ seg, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cam = seg.camera;
  if (!cam) return <AbsoluteFill>{children}</AbsoluteFill>;
  const inn = spring({ frame, fps, config: SPRING, durationInFrames: Math.max(1, cam.inFrames) });
  let out = 0;
  if (cam.outFrames > 0 && frame > seg.durationInFrames - cam.outFrames) {
    out = spring({
      frame: frame - (seg.durationInFrames - cam.outFrames),
      fps,
      config: SPRING,
      durationInFrames: cam.outFrames,
    });
  }
  const z = 1 + (cam.zoom - 1) * inn * (1 - out);
  return (
    <AbsoluteFill
      style={{
        transform: `scale(${z})`,
        transformOrigin: `${cam.fx * 100}% ${cam.fy * 100}%`,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

const HotspotRing: React.FC<{ seg: EdlSegment; edl: EdlDoc; accent: string }> = ({ seg, edl, accent }) => {
  const frame = useCurrentFrame();
  const cover = useCover(edl);
  if (!seg.hotspot) return null;
  const { x, y, width, height } = seg.hotspot;
  const box = {
    left: cover.x(x) - 6,
    top: cover.y(y) - 6,
    width: width * cover.s + 12,
    height: height * cover.s + 12,
  };
  const pulses = [0, 1].map((k) => {
    if (seg.actionFrame == null) return null;
    const local = frame - (seg.actionFrame + k * 9);
    if (local < 0 || local > 20) return null;
    return (
      <div
        key={k}
        style={{
          position: "absolute",
          ...box,
          borderRadius: 14,
          border: `3px solid ${accent}`,
          transform: `scale(${interpolate(local, [0, 20], [0.7, 2.1])})`,
          opacity: interpolate(local, [0, 20], [0.9, 0]),
        }}
      />
    );
  });
  return (
    <>
      <div style={{ position: "absolute", ...box, borderRadius: 12, border: `3px solid ${accent}`, opacity: 0.75 }} />
      {pulses}
    </>
  );
};

const Annotations: React.FC<{ seg: EdlSegment; edl: EdlDoc; accent: string }> = ({ seg, edl, accent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cover = useCover(edl);
  const enter = spring({ frame, fps, config: { damping: 15, stiffness: 120 } });
  return (
    <>
      {(seg.annotations || []).map((ann, i) => {
        const x = cover.x(ann.x || 0);
        const y = cover.y(ann.y || 0);
        const w = Math.max(8, (ann.w || 80) * cover.s);
        const h = Math.max(8, (ann.h || 32) * cover.s);
        if (ann.kind === "blur") {
          return (
            <div key={i} style={{ position: "absolute", left: x, top: y, width: w, height: h, backdropFilter: "blur(14px)", background: "rgba(15,23,42,0.25)", borderRadius: 6 }} />
          );
        }
        if (ann.kind === "arrow") {
          return (
            <div key={i} style={{ position: "absolute", left: x - 9, top: y, width: 18, height: 48, opacity: enter }}>
              <div style={{ margin: "0 auto", width: 0, height: 0, borderLeft: "9px solid transparent", borderRight: "9px solid transparent", borderBottom: `14px solid ${accent}` }} />
              <div style={{ margin: "0 auto", width: 4, height: 34, background: accent }} />
            </div>
          );
        }
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x - 10,
              top: y - 10,
              width: w + 20,
              height: h + 20,
              borderRadius: 14,
              border: `4px solid ${accent}`,
              background: ann.kind === "hover" ? `${accent}28` : "transparent",
              opacity: enter,
              transform: `scale(${0.92 + 0.08 * enter})`,
            }}
          >
            {ann.kind === "callout" && ann.text ? (
              <span style={{ position: "absolute", top: -38, left: 0, whiteSpace: "nowrap", background: accent, color: "#fff", fontSize: 21, fontWeight: 600, padding: "5px 12px", borderRadius: 8, fontFamily: "system-ui, sans-serif" }}>
                {ann.text}
              </span>
            ) : null}
          </div>
        );
      })}
    </>
  );
};

const Caption: React.FC<{ seg: EdlSegment; accent: string }> = ({ seg, accent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (!seg.caption?.text && !seg.caption?.words?.length) return null;
  const nowMs = (frame / fps) * 1000;
  const top = seg.caption.position === "top";
  return (
    <div
      style={{
        position: "absolute",
        left: "6%",
        right: "6%",
        ...(top ? { top: "5%" } : { bottom: "5%" }),
        background: "rgba(3,7,18,0.86)",
        borderLeft: `5px solid ${accent}`,
        borderRadius: 14,
        padding: "14px 22px",
        color: "#f8fafc",
        fontSize: 30,
        fontWeight: 500,
        lineHeight: 1.35,
        fontFamily: "system-ui, sans-serif",
        boxShadow: "0 18px 50px rgba(0,0,0,0.45)",
      }}
    >
      {seg.caption.words?.length
        ? seg.caption.words.map((w, i) => {
            const active = nowMs >= w.start_ms && nowMs < w.end_ms;
            return (
              <span key={i} style={{ color: active ? accent : nowMs >= w.end_ms ? "#e2e8f0" : "#94a3b8", fontWeight: active ? 700 : 500 }}>
                {w.w}
                {i < (seg.caption?.words?.length || 0) - 1 ? " " : ""}
              </span>
            );
          })
        : seg.caption.text}
    </div>
  );
};

const SceneCard: React.FC<{ seg: EdlSegment; accent: string }> = ({ seg, accent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cfg = seg.scene || {};
  const rise = spring({ frame, fps, config: { damping: 16, stiffness: 90 } });
  const isForm = cfg.kind === "email" || cfg.kind === "waitlist";
  const button = cfg.button_label || (cfg.kind === "waitlist" ? "Join the waitlist" : cfg.kind === "email" ? "Continue" : "");
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(720px 380px at 85% -10%, ${accent}40, transparent 60%), radial-gradient(560px 340px at 0% 110%, ${accent}30, transparent 55%), linear-gradient(180deg, rgb(10 12 24), rgb(5 6 14))`,
        fontFamily: "system-ui, sans-serif",
        color: "#f8fafc",
      }}
    >
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 8, background: accent }} />
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 90px",
          textAlign: "center",
          opacity: rise,
          transform: `translateY(${interpolate(rise, [0, 1], [26, 0])}px)`,
        }}
      >
        <div style={{ fontSize: 54, fontWeight: 700, letterSpacing: -1, lineHeight: 1.12 }}>{cfg.title || seg.label || ""}</div>
        {cfg.subtitle || cfg.body ? (
          <div style={{ marginTop: 18, fontSize: 27, color: "#94a3b8", lineHeight: 1.45, maxWidth: 760 }}>{cfg.subtitle || cfg.body}</div>
        ) : null}
        {isForm ? (
          <>
            <div style={{ marginTop: 34, width: 520, height: 56, borderRadius: 12, border: "2px solid #334155", background: "rgba(2,6,23,0.8)", color: "#64748b", fontSize: 21, display: "flex", alignItems: "center", padding: "0 18px" }}>
              {cfg.placeholder || "you@company.com"}
            </div>
            {button ? (
              <div style={{ marginTop: 16, background: accent, color: "#fff", fontSize: 23, fontWeight: 600, padding: "14px 34px", borderRadius: 12 }}>{button}</div>
            ) : null}
          </>
        ) : button ? (
          <div style={{ marginTop: 34, background: accent, color: "#fff", fontSize: 23, fontWeight: 600, padding: "14px 34px", borderRadius: 12 }}>{button}</div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

const Media: React.FC<{ seg: EdlSegment; edl: EdlDoc; assetBase: string }> = ({ seg, edl, assetBase }) => {
  const frame = useCurrentFrame();
  const accent = edl.brand.accent;
  if (seg.type === "scene") return <SceneCard seg={seg} accent={accent} />;
  if (seg.type === "blank") {
    return (
      <AbsoluteFill style={{ background: "#0f172a", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 26, fontFamily: "system-ui, sans-serif" }}>
        {seg.label || "Step"}
      </AbsoluteFill>
    );
  }
  const playedFrames = seg.type === "video" ? Math.floor((seg.sourceFrames || 0) / (seg.playbackRate || 1)) : 0;
  return (
    <CameraView seg={seg}>
      <AbsoluteFill style={{ background: "#0b1120" }}>
        {seg.type === "video" && seg.poster ? (
          <Img src={`${assetBase}/${seg.poster}`} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        ) : null}
        {seg.type === "video" ? (
          <OffthreadVideo
            src={`${assetBase}/${seg.src}`}
            startFrom={seg.trimBeforeFrames || 0}
            endAt={(seg.trimBeforeFrames || 0) + (seg.sourceFrames || 0)}
            playbackRate={seg.playbackRate || 1}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <Img src={`${assetBase}/${seg.src}`} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        )}
        {/* Freeze tail: once the recorded action ends, rest on the poster. */}
        {seg.type === "video" && seg.poster && frame > playedFrames ? (
          <Img
            src={`${assetBase}/${seg.poster}`}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: interpolate(frame, [playedFrames, playedFrames + 3], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}
          />
        ) : null}
        <HotspotRing seg={seg} edl={edl} accent={accent} />
        <Annotations seg={seg} edl={edl} accent={accent} />
      </AbsoluteFill>
    </CameraView>
  );
};

export const DemoVideo: React.FC<DemoProps> = ({ edl, assetBase }) => {
  let cursor = 0;
  return (
    <AbsoluteFill style={{ background: "#05060e" }}>
      {edl.segments.map((seg) => {
        const from = cursor;
        cursor += seg.durationInFrames - seg.transitionInFrames;
        return (
          <Sequence key={seg.id} from={from} durationInFrames={seg.durationInFrames}>
            <FadeIn frames={seg.transitionInFrames}>
              <Media seg={seg} edl={edl} assetBase={assetBase} />
              <Caption seg={seg} accent={edl.brand.accent} />
            </FadeIn>
            {seg.audio ? <Audio src={`${assetBase}/${seg.audio}`} /> : null}
          </Sequence>
        );
      })}
      {edl.brand.watermark ? (
        <div style={{ position: "absolute", top: 16, right: 16, background: "rgba(3,7,18,0.68)", color: "#e2e8f0", fontSize: 15, padding: "6px 12px", borderRadius: 8, fontFamily: "system-ui, sans-serif" }}>
          Made with AppShowcase
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

const FadeIn: React.FC<{ frames: number; children: React.ReactNode }> = ({ frames, children }) => {
  const frame = useCurrentFrame();
  const opacity = frames > 0 ? interpolate(frame, [0, frames], [0, 1], { extrapolateRight: "clamp" }) : 1;
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
};
