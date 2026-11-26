import axios from "axios";
import { recordActivity } from "@/lib/activity";

// Normalize VITE_BACKEND_URL so common paste errors can't produce a
// relative URL like "api.example.com/api/..." (which the browser resolves
// against the frontend origin, yielding /api.example.com/api/...).
// Accepts: "api.example.com", "https://api.example.com", either with a
// mistaken trailing "/api" — all become "https://api.example.com".
const normalizeBackend = (raw) => {
  let v = (raw || "").trim().replace(/\/+$/, "");
  if (!v) return "";
  if (!/^(https?:)?\/\//i.test(v) && !v.startsWith("/")) v = `https://${v}`;
  if (/\/api$/i.test(v)) v = v.slice(0, -4).replace(/\/+$/, "");
  return v;
};
const configured = normalizeBackend(import.meta.env.VITE_BACKEND_URL);
export const API = configured ? `${configured}/api` : "/api";

export const api = axios.create({ baseURL: API, withCredentials: true });

let authTokenGetter = null;
export const setAuthTokenGetter = (getter) => {
  authTokenGetter = getter;
};

export async function getAuthToken() {
  if (!authTokenGetter) return null;
  try {
    return (await authTokenGetter()) || null;
  } catch {
    return null;
  }
}

/** Fetch that always attaches the Clerk Bearer when one is available. */
export async function authFetch(url, init = {}) {
  const headers = new Headers(init.headers || {});
  if (!headers.has("Authorization")) {
    const token = await getAuthToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch(url, { ...init, headers, credentials: init.credentials ?? "include" });
}

// Protected media (screenshots, thumbs, audio, video) cannot put an
// Authorization header on <img>/<audio>/<video>. Resolve once through
// axios (which does) and cache a blob: URL for the element to use.
const blobCache = new Map();

const isPublicMedia = (url) =>
  /\/(public|review)\//.test(url) || url.startsWith("blob:") || url.startsWith("data:");

/** Turn an absolute media URL (/api/projects/...) into an axios path (/projects/...). */
const toApiPath = (url) => {
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) {
    try {
      const parsed = new URL(url);
      const path = `${parsed.pathname}${parsed.search}`;
      if (path === API || path.startsWith(`${API}/`)) return path.slice(API.length) || "/";
      return path;
    } catch {
      return url;
    }
  }
  if (url === API || url.startsWith(`${API}/`)) return url.slice(API.length) || "/";
  return url;
};

export async function resolveAuthUrl(url) {
  if (!url || isPublicMedia(url)) return url;
  const hit = blobCache.get(url);
  if (hit?.blobUrl) return hit.blobUrl;
  if (hit?.promise) return hit.promise;
  // stepAsset() returns `${API}/projects/...`. axios already has baseURL=API,
  // so we must strip the prefix or requests become /api/api/projects/... (404).
  const path = toApiPath(url);
  const promise = api
    .get(path, { responseType: "blob" })
    .then(({ data }) => {
      // Axios may treat error JSON as a blob when responseType is blob.
      if (data?.type && data.type.includes("application/json")) {
        throw new Error("Media request failed");
      }
      const blobUrl = URL.createObjectURL(data);
      blobCache.set(url, { blobUrl });
      return blobUrl;
    })
    .catch((err) => {
      blobCache.delete(url);
      throw err;
    });
  blobCache.set(url, { promise });
  return promise;
}

api.interceptors.request.use(async (config) => {
  if (authTokenGetter && !config.headers?.Authorization && !config.headers?.authorization) {
    try {
      const token = await authTokenGetter();
      if (token) config.headers.Authorization = `Bearer ${token}`;
    } catch (_) {
      /* Clerk will surface session errors through /auth/me. */
    }
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  async (err) => {
    const cfg = err.config || {};
    const hasBearer = Boolean(cfg.headers?.Authorization || cfg.headers?.authorization);
    // Clerk mode attaches a Bearer via authTokenGetter — never fall back to the
    // legacy NoCodeBackend cookie refresh, which races with Clerk and confuses /auth/me.
    if (
      err.response?.status === 401 &&
      !hasBearer &&
      !authTokenGetter &&
      !cfg._retry &&
      !String(cfg.url).includes("/auth/")
    ) {
      cfg._retry = true;
      try {
        await axios.post(`${API}/auth/refresh`, {}, { withCredentials: true });
        return api(cfg);
      } catch (_) {
        /* fall through */
      }
    }
    const url = String(cfg.url || "");
    if (!url.includes("/live/frame") && !url.includes("/preview") && err.response?.status !== 401) {
      recordActivity({ level: "error", source: `${(cfg.method || "get").toUpperCase()} ${url}`, message: errMsg(err) });
    }
    throw err;
  }
);

export function errMsg(e) {
  const detail = e?.response?.data?.detail;
  if (detail == null) {
    // Blob responses (authenticated media) don't expose JSON detail.
    if (typeof Blob !== "undefined" && e?.response?.data instanceof Blob) {
      return e?.response?.status === 401 ? "Not authenticated" : "Request failed";
    }
    return e?.message || "Something went wrong. Please try again.";
  }
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((d) => d?.msg || JSON.stringify(d)).join(" ");
  return detail.msg || String(detail);
}

export const stepAsset = (pid, step, kind, index) => {
  if (kind === "video") {
    const v = step.video || {};
    return `${API}/projects/${pid}/steps/${step.id}/video?v=${v.clip || 0}-${v.start_ms || 0}`;
  }
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
  if (kind === "video") return `${API}/public/${shareId}/steps/${step.id}/video?v=${step.v}${auth}`;
  if (kind === "motion") return `${API}/public/${shareId}/steps/${step.id}/motion/${index}?v=${step.v}${auth}`;
  const track = kind === "audio" && step.audio_track === "alt" ? "&track=alt" : "";
  return `${API}/public/${shareId}/steps/${step.id}/${kind}?v=${step.v}${auth}${track}`;
};
