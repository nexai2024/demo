import { useEffect, useState } from "react";
import { History, Loader2, RotateCcw } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { api } from "@/lib/api";

export const HistorySheet = ({ pid, onRestore, open, onOpenChange }) => {
  const [items, setItems] = useState(null);
  useEffect(() => {
    if (open) api.get(`/projects/${pid}/history`).then((r) => setItems(r.data)).catch(() => setItems([]));
  }, [open, pid]);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <button className="h-9 px-3 rounded-lg border border-slate-700 hover:bg-slate-800 text-sm flex items-center gap-2" data-testid="history-open-button"><History className="h-4 w-4" /><span className="hidden md:inline">History</span></button>
      </SheetTrigger>
      <SheetContent className="bg-slate-950 border-slate-800 w-full sm:max-w-md" data-testid="history-sheet">
        <SheetHeader><SheetTitle className="font-display">Version history</SheetTitle></SheetHeader>
        <div className="mt-6 space-y-1 overflow-y-auto max-h-[85vh] scrollbar-thin pr-2">
          {items === null ? <Loader2 className="h-5 w-5 animate-spin text-slate-500" /> : items.map((h) => (
            <div key={h.id} className="relative pl-5 py-3 border-l border-slate-800" data-testid={`history-item-${h.id}`}>
              <span className="absolute -left-1 top-4 h-2 w-2 rounded-full bg-indigo-500" />
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{h.event}</p>
                  <p className="text-xs text-slate-500">{h.detail} · {new Date(h.created_at).toLocaleString()}</p>
                </div>
                {h.has_snapshot && (
                  <button onClick={() => onRestore(h.id)} className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 shrink-0" data-testid={`history-restore-${h.id}`}>
                    <RotateCcw className="h-3 w-3" /> Restore
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
};
