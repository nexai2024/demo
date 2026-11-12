import axios from "axios";

export const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

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

export const stepAsset = (pid, step, kind) =>
  `${API}/projects/${pid}/steps/${step.id}/${kind}?v=${encodeURIComponent(
    (kind === "audio" ? step.audio_path : step.screenshot_path || "").slice(-14)
  )}`;

export const publicAsset = (shareId, step, kind, token) =>
  `${API}/public/${shareId}/steps/${step.id}/${kind}?v=${step.v}${token ? `&t=${encodeURIComponent(token)}` : ""}`;
