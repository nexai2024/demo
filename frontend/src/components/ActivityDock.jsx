import { useEffect, useState } from "react";
import { Activity, X } from "lucide-react";
import { clearActivity, subscribeActivity } from "@/lib/activity";

export function ActivityDock() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  useEffect(() => subscribeActivity(setItems), []);
  const errors = items.filter((item) => item.level === "error").length;

  return (
    <div className="activity-dock" data-testid="activity-dock">
      <button type="button" className="activity-toggle" onClick={() => setOpen((v) => !v)} aria-expanded={open} data-testid="activity-toggle">
        <Activity className="h-4 w-4" />
        <span>Activity</span>
        {errors > 0 && <em data-testid="activity-error-count">{errors}</em>}
      </button>
      {open && (
        <section className="activity-panel rise" data-testid="activity-panel">
          <header>
            <strong>What the studio just did</strong>
            <button type="button" onClick={() => { clearActivity(); setOpen(false); }} aria-label="Clear activity" data-testid="activity-clear"><X className="h-3.5 w-3.5" /></button>
          </header>
          {items.length === 0 ? (
            <p className="activity-empty">Quiet for now. Saves, recordings, and errors show up here.</p>
          ) : (
            <ol>
              {items.map((item) => (
                <li key={item.id} className={`is-${item.level}`}>
                  <time>{new Date(item.at).toLocaleTimeString([], { hour12: false })}</time>
                  <span>{item.message}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
    </div>
  );
}
