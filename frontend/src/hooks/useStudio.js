import { useCallback, useEffect, useRef, useState } from "react";
import { api, API } from "@/lib/api";

export function useRun({ onUpdate, onDone } = {}) {
  const [run, setRun] = useState(null);
  const cbs = useRef({ onUpdate, onDone });
  cbs.current = { onUpdate, onDone };

  useEffect(() => {
    if (!run?.id || run.status !== "running") return;
    let es;
    let timer;
    let closed = false;
    const cleanup = () => {
      closed = true;
      es?.close();
      clearTimeout(timer);
    };
    const handle = (data) => {
      setRun(data);
      cbs.current.onUpdate?.(data);
      if (data.status !== "running") {
        cleanup();
        cbs.current.onDone?.(data);
      }
    };
    const poll = async () => {
      if (closed) return;
      try {
        const { data } = await api.get(`/runs/${run.id}`);
        handle(data);
      } catch (_) {
        /* retry */
      }
      if (!closed) timer = setTimeout(poll, 1200);
    };
    es = new EventSource(`${API}/runs/${run.id}/stream`, { withCredentials: true });
    es.onmessage = (e) => handle(JSON.parse(e.data));
    es.onerror = () => {
      es.close();
      if (!closed) poll();
    };
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run?.id]);

  return { run, setRun, running: run?.status === "running" };
}

export function useUndoable(initial) {
  const [s, setS] = useState({ past: [], present: initial, future: [] });
  const lastRecord = useRef(0);

  const set = useCallback((updater, { coalesce = false } = {}) => {
    setS((st) => {
      const next = typeof updater === "function" ? updater(st.present) : updater;
      const t = Date.now();
      const merge = coalesce && t - lastRecord.current < 700;
      lastRecord.current = t;
      if (merge) return { ...st, present: next, future: [] };
      return { past: [...st.past.slice(-49), st.present], present: next, future: [] };
    });
  }, []);
  const reset = useCallback((v) => setS({ past: [], present: v, future: [] }), []);
  const replace = useCallback((v) => setS((st) => ({ ...st, present: v })), []);
  const undo = useCallback(() => setS((st) => (st.past.length ? {
    past: st.past.slice(0, -1), present: st.past[st.past.length - 1], future: [st.present, ...st.future],
  } : st)), []);
  const redo = useCallback(() => setS((st) => (st.future.length ? {
    past: [...st.past, st.present], present: st.future[0], future: st.future.slice(1),
  } : st)), []);

  return { value: s.present, set, reset, replace, undo, redo, canUndo: s.past.length > 0, canRedo: s.future.length > 0 };
}

export function useOnline() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}
