import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Copy, Film, MoreHorizontal, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { AppHeader } from "@/components/AppHeader";
import { NewProjectDialog } from "@/components/NewProjectDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { api, API, errMsg } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

function ProjectCard({ p, onDuplicate, onDelete, i }) {
  return (
    <div className="group rise relative rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden hover:border-indigo-500/40 transition-[border-color,transform] duration-200 hover:-translate-y-0.5" style={{ animationDelay: `${i * 0.05}s` }} data-testid={`project-card-${p.id}`}>
      <Link to={`/projects/${p.id}`} className="block" data-testid={`project-open-${p.id}`}>
        <div className="aspect-[16/10] bg-slate-950 grid-bg border-b border-slate-800 overflow-hidden">
          {p.thumbnail_path ? (
            <img src={`${API}/projects/${p.id}/thumbnail?v=${p.thumbnail_path.slice(-12)}`} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover object-top group-hover:scale-[1.03] transition-transform duration-500" />
          ) : (
            <div className="h-full grid place-items-center text-slate-600"><Film className="h-8 w-8" /></div>
          )}
        </div>
        <div className="p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold truncate pr-6">{p.name}</h3>
          </div>
          <p className="text-xs text-slate-500 truncate mt-1 font-mono">{p.target_url || "no target url"}</p>
          <div className="flex items-center justify-between mt-4">
            <StatusBadge status={p.status} testId={`project-status-${p.id}`} />
            <span className="text-xs text-slate-500">{p.step_count || 0} steps · {formatDistanceToNow(new Date(p.updated_at))} ago</span>
          </div>
        </div>
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger className="absolute top-3 right-3 h-8 w-8 rounded-md bg-slate-950/80 backdrop-blur border border-slate-700 grid place-items-center hover:bg-slate-800" data-testid={`project-menu-${p.id}`}>
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-slate-950 border-slate-800">
          <DropdownMenuItem onClick={() => onDuplicate(p)} data-testid={`project-duplicate-${p.id}`}><Copy className="h-4 w-4 mr-2" />Duplicate</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onDelete(p)} className="text-red-400" data-testid={`project-delete-${p.id}`}><Trash2 className="h-4 w-4 mr-2" />Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [projects, setProjects] = useState(null);
  const [q, setQ] = useState("");
  const [toDelete, setToDelete] = useState(null);

  const load = () => api.get("/projects").then(({ data }) => setProjects(data)).catch((e) => toast.error(errMsg(e)));
  useEffect(() => { load(); }, []);

  const shown = useMemo(() => (projects || []).filter((p) => p.name.toLowerCase().includes(q.toLowerCase())), [projects, q]);

  const duplicate = async (p) => {
    await api.post(`/projects/${p.id}/duplicate`);
    toast.success(`Duplicated “${p.name}”`);
    load();
  };
  const remove = async () => {
    await api.delete(`/projects/${toDelete.id}`);
    toast.success("Project deleted");
    setToDelete(null);
    load();
  };

  const newBtn = (
    <button data-testid="create-new-demo-button" className="h-11 px-5 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-medium shadow-lg shadow-indigo-600/20 transition-[background-color,transform] active:scale-[0.98] flex items-center gap-2">
      <Plus className="h-4 w-4" /> New demo
    </button>
  );

  return (
    <div className="min-h-screen relative z-10">
      <AppHeader />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <section className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-400 mb-3">Studio · {user?.name}</p>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">Your demos</h1>
            <p className="text-slate-400 mt-3 max-w-xl">Paste a spec, let AI script it, and record a real walkthrough in a cloud browser.</p>
          </div>
          <NewProjectDialog trigger={newBtn} />
        </section>
        <div className="relative max-w-sm mb-8">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search projects" className="pl-9 bg-slate-950" data-testid="projects-search-input" />
        </div>
        {projects === null ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{[0, 1, 2].map((i) => <Skeleton key={i} className="aspect-[16/13] rounded-xl bg-slate-900" />)}</div>
        ) : shown.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-700 p-16 text-center" data-testid="projects-empty-state">
            <Film className="h-10 w-10 mx-auto text-slate-600" />
            <h3 className="mt-4 text-lg font-semibold">{q ? "No matching projects" : "No demos yet"}</h3>
            <p className="text-slate-400 text-sm mt-1 mb-6">Start with the working TodoMVC example to see the full flow.</p>
            <div className="inline-flex"><NewProjectDialog trigger={newBtn} /></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="projects-dashboard-grid">
            {shown.map((p, i) => <ProjectCard key={p.id} p={p} i={i} onDuplicate={duplicate} onDelete={setToDelete} />)}
          </div>
        )}
      </main>
      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent className="bg-slate-950 border-slate-800">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{toDelete?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>Its share link will stop working.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="delete-cancel-button">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={remove} className="bg-red-600 hover:bg-red-500" data-testid="delete-confirm-button">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
