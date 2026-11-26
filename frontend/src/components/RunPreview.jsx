import { useEffect, useState } from "react";
import { Loader2, Radio } from "lucide-react";
import { api } from "@/lib/api";

/** Live low-res JPEG from the recording worker while a run is active. */
export function RunPreview({ rid, message = "", pageUrl = "" }) {
  const [src, setSrc] = useState("");
  const [url, setUrl] = useState(pageUrl || "");
  const [waiting, setWaiting] = useState(true);

  useEffect(() => {
    setUrl(pageUrl || "");
  }, [pageUrl]);

  useEffect(() => {
    if (!rid) return undefined;
    let stop = false;
    let shown = "";
    const frames = async () => {
      while (!stop) {
        try {
          const response = await api.get(`/runs/${rid}/preview`, {
            responseType: "blob",
            // 404 is expected until the first frame lands.
            validateStatus: (s) => (s >= 200 && s < 300) || s === 404,
          });
          if (stop) return;
          if (response.status === 200 && response.data?.size > 0) {
            const headerUrl = response.headers?.["x-preview-url"];
            if (headerUrl) setUrl(headerUrl);
            const next = URL.createObjectURL(response.data);
            if (stop) {
              URL.revokeObjectURL(next);
              return;
            }
            await new Promise((resolve) => {
              const pic = new Image();
              pic.onload = () => resolve();
              pic.onerror = () => resolve();
              pic.src = next;
            });
            if (stop) {
              URL.revokeObjectURL(next);
              return;
            }
            const retire = shown;
            setSrc(next);
            setWaiting(false);
            shown = next;
            if (retire) setTimeout(() => URL.revokeObjectURL(retire), 400);
          }
        } catch {
          /* next tick retries */
        }
        await new Promise((resolve) => setTimeout(resolve, 350));
      }
    };
    frames();
    return () => {
      stop = true;
      if (shown) URL.revokeObjectURL(shown);
    };
  }, [rid]);

  return (
    <div className="space-y-2" data-testid="run-preview">
      <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
        <span className="inline-flex items-center gap-1.5 text-amber-200">
          <Radio className="h-3.5 w-3.5 animate-pulse" />
          Live recording
        </span>
        <span className="truncate" data-testid="run-preview-url">{url || message || "Opening the target page…"}</span>
      </div>
      <div
        className="relative aspect-[1280/800] overflow-hidden rounded-2xl border border-amber-400/40 bg-slate-950 shadow-[0_0_0_6px_rgba(251,191,36,0.06)]"
        data-testid="run-preview-screen"
      >
        {src ? (
          <img src={src} alt="" className="h-full w-full object-fill" data-testid="run-preview-frame" />
        ) : (
          <div className="grid h-full place-items-center gap-2 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin text-amber-300" />
            <p className="text-xs">{waiting ? "Waiting for the first frame…" : "Reconnecting…"}</p>
          </div>
        )}
        {message ? (
          <p className="absolute bottom-0 inset-x-0 bg-slate-950/80 px-3 py-2 text-[11px] text-slate-200 truncate" data-testid="run-preview-message">
            {message}
          </p>
        ) : null}
      </div>
    </div>
  );
}
