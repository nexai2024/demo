import axios from "axios";
import { recordActivity } from "@/lib/activity";

const configured = (process.env.REACT_APP_BACKEND_URL || "").replace(/\/$/, "");
export const API = configured ? `${configured}/api` : "/api";

export const api = axios.create({ baseURL: API, withCredentials: true });

api.interceptors.response.use(
  (r) => r,
  async (err) => {
    const cfg = err.config || {};
    if (err.response?.status === 401 && !cfg._retry && !String(cfg.url).includes("/auth/")) {
      cfg._retry = true;
      try {
        await axios.post(`${API}/auth/refresh`, {}, { withCredentials: true });
        return api(cfg);
      } catch (_) {
        /* fall through */
      }
    }
    const url = String(cfg.url || "");
    if (!url.includes("/live/frame") && err.response?.status !== 401) {
      recordActivity({ level: "error", source: `${(cfg.method || "get").toUpperCase()} ${url}`, message: errMsg(err) });
    }
    throw err;
  }
);

export function errMsg(e) {
  const detail = e?.response?.data?.detail;
  if (detail == null) return e?.message || "Something went wrong. Please try again.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((d) => d?.msg || JSON.stringify(d)).join(" ");
  return detail.msg || String(detail);
}

export const stepAsset = (pid, step, kind, index) => {
  if (kind === "motion") {
    const stamp = (step.motion_paths?.[index] || step.screenshot_path || "").slice(-14);
    return `${API}/projects/${pid}/steps/${step.id}/motion/${index}?v=${encodeURIComponent(stamp)}`;
  }
  const track = kind === "audio" && step.audio_track === "alt" ? "&track=alt" : "";
  return `${API}/projects/${pid}/steps/${step.id}/${kind}?v=${encodeURIComponent(
    (kind === "audio" ? step.audio_path : step.screenshot_path || "").slice(-14)
  )}${track}`;
};

export const publicAsset = (shareId, step, kind, token, index) => {
  const auth = token ? `&t=${encodeURIComponent(token)}` : "";
  if (kind === "motion") return `${API}/public/${shareId}/steps/${step.id}/motion/${index}?v=${step.v}${auth}`;
  const track = kind === "audio" && step.audio_track === "alt" ? "&track=alt" : "";
  return `${API}/public/${shareId}/steps/${step.id}/${kind}?v=${step.v}${auth}${track}`;
};
