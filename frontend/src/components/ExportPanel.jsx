import { useEffect, useState } from "react";
import { Activity, Copy, Download, FileVideo, Image as ImageIcon, Loader2, Lock, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { API, api } from "@/lib/api";

const copy = (text, label) => { navigator.clipboard.writeText(text); toast.success(`${label} copied`); };
const card = "rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4";
const EXPIRY = [["never", "Never"], ["1", "24 hours"], ["7", "7 days"], ["30", "30 days"], ["custom", "Custom date"]];
const toLocal = (iso) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");

function ShareProtection({ project, onShareSettings }) {
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState(project.share_expires_at ? "custom" : "never");
  const [custom, setCustom] = useState(toLocal(project.share_expires_at));
  const expired = project.share_expires_at && new Date(project.share_expires_at) < new Date();
  const expiryIso = () => {
    if (mode === "never") return null;
    if (mode === "custom") return custom ? new Date(custom).toISOString() : null;
    return new Date(Date.now() + Number(mode) * 86400000).toISOString();
  };
  const keepExpiry = project.share_expires_at || null;
  return (
    <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-950/60 p-4" data-testid="share-protection">
      <div className="flex items-center gap-2 text-sm font-medium"><Lock className="h-4 w-4 text-cyan-400" /> Access
        {project.has_share_password && <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] uppercase text-emerald-300" data-testid="share-password-badge">Password on</span>}
        {project.share_expires_at && <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase ${expired ? "border-red-500/30 text-red-300" : "border-amber-500/30 text-amber-300"}`} data-testid="share-expiry-badge">{expired ? "Expired" : `Expires ${new Date(project.share_expires_at).toLocaleString()}`}</span>}
      </div>
      <div className="flex flex-wrap gap-2">
        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={project.has_share_password ? "New password" : "Set a password (min 4)"} className="bg-slate-950 h-9 flex-1 min-w-[10rem]" data-testid="share-password-input" />
        <button disabled={password.length < 4} onClick={() => { onShareSettings({ password, expires_at: keepExpiry }); setPassword(""); }} className="h-9 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm disabled:opacity-40" data-testid="share-password-save">Save password</button>
        {project.has_share_password && <button onClick={() => onShareSettings({ remove_password: true, expires_at: keepExpiry })} className="h-9 px-3 rounded-lg border border-slate-700 hover:bg-slate-800 text-sm" data-testid="share-password-remove">Remove</button>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={mode} onValueChange={setMode}>
          <SelectTrigger className="bg-slate-950 h-9 w-40" data-testid="share-expiry-select"><SelectValue /></SelectTrigger>
          <SelectContent>{EXPIRY.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
        </Select>
        {mode === "custom" && <input type="datetime-local" value={custom} onChange={(e) => setCustom(e.target.value)} className="h-9 rounded-md border border-slate-700 bg-slate-950 px-2 text-sm [color-scheme:dark]" data-testid="share-expiry-date" />}
        <button onClick={() => onShareSettings({ expires_at: expiryIso() })} className="h-9 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm" data-testid="share-expiry-save">Apply expiry</button>
      </div>
    </div>
  );
}

function HealthSection({ project, onPatch, onHealthCheck, busy }) {
  const h = project.health;
  return (
    <section className={card} data-testid="health-section">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold flex items-center gap-2"><Activity className="h-4 w-4" /> Weekly health check</h3>
        <Switch checked={!!project.auto_refresh} onCheckedChange={(c) => onPatch({ auto_refresh: c })} data-testid="auto-refresh-toggle" />
      </div>
      <p className="text-sm text-slate-400">Every Monday at 09:00 UTC the demo is re-recorded. Steps that broke after a UI change are flagged and their previous frames are kept, so the shared demo stays intact.</p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-mono text-slate-500" data-testid="health-last-check">
          {h ? `Last check ${new Date(h.checked_at).toLocaleString()} · ${h.ok}/${h.total} ok · ${h.broken.length} broken` : "No health check yet"}
        </p>
        <button onClick={onHealthCheck} disabled={busy || !project.steps?.length} className="h-9 px-3 rounded-lg border border-slate-700 hover:bg-slate-800 text-sm disabled:opacity-40" data-testid="health-check-now-button">Run check now</button>
      </div>
    </section>
  );
}

export const ExportPanel = ({ project, onExport, busy, onPatch, onShareSettings, onHealthCheck }) => {
  const shareUrl = `${window.location.origin}/share/${project.share_id}`;
  const embed = `<iframe src="${window.location.origin}/embed/${project.share_id}" width="960" height="680" style="border:0;border-radius:12px" allow="fullscreen; autoplay"></iframe>`;
  const brand = project.brand || {};
  const setBrand = (patch) => onPatch({ brand: { ...brand, ...patch } });
  return (
    <div className="space-y-6" data-testid="export-share-panel">
      <section className={card}>
        <h3 className="font-semibold">Export</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          {[["gif", ImageIcon, "Animated GIF", "Silent, loops. Great for docs & changelogs."], ["mp4", FileVideo, "MP4 video", "1280×800 with voiceover & captions."]].map(([fmt, Icon, title, desc]) => (
            <button key={fmt} disabled={busy} onClick={() => onExport(fmt)} data-testid={`export-${fmt}-button`}
              className="text-left rounded-lg border border-slate-800 bg-slate-950 p-4 hover:border-indigo-500/50 transition-colors disabled:opacity-50">
              <div className="flex items-center gap-2 font-medium">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4 text-cyan-400" />}{title}</div>
              <p className="text-xs text-slate-400 mt-1">{desc}</p>
            </button>
          ))}
        </div>
        {(project.exports || []).length > 0 && (
          <ul className="divide-y divide-slate-800 border border-slate-800 rounded-lg" data-testid="exports-list">
            {[...project.exports].reverse().map((e) => (
              <li key={e.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="font-mono text-xs uppercase">{e.format} · {Math.round(e.size / 1024)} KB · {new Date(e.created_at).toLocaleString()}</span>
                <a href={`${API}/projects/${project.id}/exports/${e.id}/download`} className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300" data-testid={`export-download-${e.id}`}><Download className="h-4 w-4" /> Download</a>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className={card}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2"><Share2 className="h-4 w-4" /> Share & embed</h3>
          <label className="flex items-center gap-2 text-sm">Public link <Switch checked={!!project.is_public} onCheckedChange={(c) => onPatch({ is_public: c })} data-testid="share-public-toggle" /></label>
        </div>
        {project.is_public ? (
          <div className="space-y-3">
            <div className="flex gap-2"><Input readOnly value={shareUrl} className="bg-slate-950 font-mono text-xs" data-testid="share-url-input" />
              <button onClick={() => copy(shareUrl, "Share link")} className="px-3 rounded-lg bg-slate-800 hover:bg-slate-700" aria-label="Copy share link" data-testid="share-copy-button"><Copy className="h-4 w-4" /></button></div>
            <div className="flex gap-2"><Input readOnly value={embed} className="bg-slate-950 font-mono text-xs" data-testid="embed-code-input" />
              <button onClick={() => copy(embed, "Embed code")} className="px-3 rounded-lg bg-slate-800 hover:bg-slate-700" aria-label="Copy embed code" data-testid="embed-copy-button"><Copy className="h-4 w-4" /></button></div>
            <a href={shareUrl} target="_blank" rel="noreferrer" className="text-sm text-cyan-400 hover:text-cyan-300" data-testid="share-open-link">Open interactive player ↗</a>
            <ShareProtection key={`${project.has_share_password}-${project.share_expires_at}`} project={project} onShareSettings={onShareSettings} />
          </div>
        ) : <p className="text-sm text-slate-400">Turn on the public link to get a shareable URL and an embeddable interactive player.</p>}
      </section>
      <HealthSection project={project} onPatch={onPatch} onHealthCheck={onHealthCheck} busy={busy} />
      <section className={card}>
        <h3 className="font-semibold">Brand kit</h3>
        <div className="grid sm:grid-cols-4 gap-4">
          <label className="space-y-1.5 text-sm"><span className="font-mono text-[10px] uppercase text-slate-500">Accent</span>
            <div className="flex items-center gap-2"><input type="color" value={brand.accent || "#6366F1"} onChange={(e) => setBrand({ accent: e.target.value })} className="h-9 w-12 rounded bg-transparent" data-testid="brand-accent-input" /><span className="font-mono text-xs">{brand.accent}</span></div></label>
          <label className="space-y-1.5 text-sm"><span className="font-mono text-[10px] uppercase text-slate-500">Caption position</span>
            <Select value={brand.caption_position || "bottom"} onValueChange={(v) => setBrand({ caption_position: v })}>
              <SelectTrigger className="bg-slate-950 h-9" data-testid="brand-caption-position"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="bottom">Bottom</SelectItem><SelectItem value="top">Top</SelectItem></SelectContent>
            </Select></label>
          <label className="space-y-1.5 text-sm"><span className="font-mono text-[10px] uppercase text-slate-500">Watermark</span>
            <div className="h-9 flex items-center"><Switch checked={brand.watermark !== false} onCheckedChange={(c) => setBrand({ watermark: c })} data-testid="brand-watermark-toggle" /></div></label>
          <label className="space-y-1.5 text-sm"><span className="font-mono text-[10px] uppercase text-slate-500">Zoom on clicks (MP4)</span>
            <div className="h-9 flex items-center"><Switch checked={brand.zoom !== false} onCheckedChange={(c) => setBrand({ zoom: c })} data-testid="brand-zoom-toggle" /></div></label>
        </div>
      </section>
    </div>
  );
};

export const AnalyticsPanel = ({ project }) => {
  const [data, setData] = useState(null);
  useEffect(() => { api.get(`/projects/${project.id}/analytics`).then((r) => setData(r.data)).catch(() => setData(false)); }, [project.id]);
  if (data === null) return <Loader2 className="h-5 w-5 animate-spin text-slate-500" />;
  if (!data) return <p className="text-sm text-slate-400">Analytics unavailable.</p>;
  const max = Math.max(1, ...data.per_step);
  return (
    <div className="space-y-6" data-testid="analytics-panel">
      <div className="grid grid-cols-3 gap-3">
        {[["Views", data.views], ["Completed", data.completions], ["Completion", `${data.completion_rate}%`]].map(([k, v]) => (
          <div key={k} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"><p className="font-mono text-[10px] uppercase text-slate-500">{k}</p><p className="text-2xl font-display font-bold mt-1" data-testid={`analytics-${k.toLowerCase()}`}>{v}</p></div>
        ))}
      </div>
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <h3 className="font-semibold mb-4">Viewer drop-off by step</h3>
        {data.per_step.length === 0 || data.views === 0 ? <p className="text-sm text-slate-400">No views yet. Share the public link to start collecting data.</p> : (
          <div className="space-y-2">
            {data.per_step.map((n, i) => (
              <div key={i} className="flex items-center gap-3 text-xs"><span className="font-mono w-6 text-slate-500">{i + 1}</span>
                <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden"><div className="h-full bg-cyan-500 transition-[width] duration-700" style={{ width: `${(n / max) * 100}%` }} /></div>
                <span className="font-mono w-8 text-right">{n}</span></div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
