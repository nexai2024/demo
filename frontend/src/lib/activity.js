const MAX = 40;
let items = [];
const listeners = new Set();

export function recordActivity(entry) {
  const item = {
    id: `${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 6)}`,
    at: new Date().toISOString(),
    level: "info",
    source: "app",
    message: "",
    ...entry,
  };
  items = [item, ...items].slice(0, MAX);
  listeners.forEach((fn) => fn(items));
  if (item.level === "error") console.error("[appshowcase]", item.source, item.message);
  return item;
}

export function subscribeActivity(fn) {
  fn(items);
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function clearActivity() {
  items = [];
  listeners.forEach((fn) => fn(items));
}
