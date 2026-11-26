import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Copy, Film, MoreHorizontal, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { AppHeader } from "@/components/AppHeader";
import { AuthedImg } from "@/components/AuthedImg";
import { BackendHealthBanner } from "@/components/BackendHealthBanner";
import { NewProjectDialog } from "@/components/NewProjectDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { api, API, errMsg } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { WorkflowRail } from "@/components/WorkflowRail";

function ProjectCard({ p, onDuplicate, onDelete, onArchive, onRestore, i }) {
  return (
    <div className="group rise relative rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden hover:border-indigo-500/40 transition-[border-color,transform] duration-200 hover:-translate-y-0.5" style={{ animationDelay: `${i * 0.05}s` }} data-testid={`project-card-${p.id}`}>
      <Link to={`/projects/${p.id}`} className="block" data-testid={`project-open-${p.id}`}>
        <div className="aspect-[16/10] bg-slate-950 grid-bg border-b border-slate-800 overflow-hidden">
          {p.thumbnail_path ? (
            <AuthedImg src={`${API}/projects/${p.id}/thumbnail?v=${p.thumbnail_path.slice(-12)}`} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover object-top group-hover:scale-[1.03] transition-transform duration-500" />
          ) : (
            <div className="h-full grid place-items-center text-slate-600"><Film className="h-8 w-8" /></div>
          )}
        </div>
        <div className="p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold truncate pr-6">{p.name}</h3>
          </div>
          <p className="text-xs text-slate-500 truncate mt-1 font-mono">{p.target_url || "no target url"}</p>
          <div className="mt-3 flex gap-1" aria-hidden="true">
            {["Spec", "Script", "Record", "Share"].map((label, index) => {
              const on = index === 0 || (index === 1 && p.step_count > 0) || (index >= 2 && (p.thumbnail_path || p.status === "ready" || p.status === "partial"));
              return <span key={label} title={label} className={`h-1 flex-1 rounded-full ${on ? "bg-cyan-400/80" : "bg-slate-800"}`} />;
            })}
          </div>
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-2">
              <StatusBadge status={p.status} testId={`project-status-${p.id}`} />
              {p.health?.broken?.length > 0 && <span className="rounded-full border border-red-500/40 bg-red-500/10 px-2 py-0.5 font-mono text-[10px] uppercase text-red-300" data-testid={`project-broken-${p.id}`}>{p.health.broken.length} broken</span>}
            </div>
            <span className="text-xs text-slate-500">{p.step_count || 0} steps · {formatDistanceToNow(new Date(p.updated_at))} ago</span>
          </div>
        </div>
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger className="absolute top-3 right-3 h-8 w-8 rounded-md bg-slate-950/80 backdrop-blur border border-slate-700 grid place-items-center hover:bg-slate-800" data-testid={`project-menu-${p.id}`}>
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-slate-950 border-slate-800">
          {onDuplicate && <DropdownMenuItem onClick={() => onDuplicate(p)} data-testid={`project-duplicate-${p.id}`}><Copy className="h-4 w-4 mr-2" />Duplicate</DropdownMenuItem>}
          {onArchive && <DropdownMenuItem onClick={() => onArchive(p)} data-testid={`project-archive-${p.id}`}>Archive</DropdownMenuItem>}
          {onRestore && <DropdownMenuItem onClick={() => onRestore(p)} data-testid={`project-restore-${p.id}`}>Restore</DropdownMenuItem>}
          {onDelete && <DropdownMenuItem onClick={() => onDelete(p)} className="text-red-400" data-testid={`project-delete-${p.id}`}><Trash2 className="h-4 w-4 mr-2" />Delete</DropdownMenuItem>}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [projects, setProjects] = useState(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [brokenOnly, setBrokenOnly] = useState(false);
  const [host, setHost] = useState("all");
  const [view, setView] = useState("active");
  const [notes, setNotes] = useState([]);
  const [toDelete, setToDelete] = useState(null);
  const [loadError, setLoadError] = useState("");

  const load = () => {
    setLoadError("");
    api.get("/projects", { params: { view } }).then(({ data }) => setProjects(Array.isArray(data) ? data : [])).catch((e) => {
      setLoadError(errMsg(e));
      setProjects((current) => current || []);
    });
  };
  useEffect(() => { load(); }, [view]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { api.get("/notifications").then((r) => setNotes((Array.isArray(r.data) ? r.data : []).filter((n) => !n.read))).catch(() => {}); }, []);

  const hosts = useMemo(() => [...new Set((Array.isArray(projects) ? projects : []).map((p) => { try { return new URL(p.target_url).host; } catch { return ""; } }).filter(Boolean))], [projects]);
  const shown = useMemo(() => (Array.isArray(projects) ? projects : []).filter((p) => {
    if (q && !`${p.name} ${p.target_url || ""} ${p.search_text || ""}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (status !== "all" && p.status !== status) return false;
    if (brokenOnly && !(p.health?.broken?.length > 0)) return false;
    if (host !== "all") { try { if (new URL(p.target_url).host !== host) return false; } catch { return false; } }
    return true;
  }), [projects, q, status, brokenOnly, host]);

  const duplicate = async (p) => {
    await api.post(`/projects/${p.id}/duplicate`);
    toast.success(`Duplicated “${p.name}”`);
    load();
  };
  const archive = async (p) => { await api.put(`/projects/${p.id}`, { archived: true }); toast.success("Archived"); load(); };
  const restore = async (p) => { await api.post(`/projects/${p.id}/restore`); toast.success("Restored"); load(); };
  const remove = async () => {
    await api.delete(`/projects/${toDelete.id}`);
    toast.success("Project deleted");
    setToDelete(null);
    load();
  };

  const newBtn = (
    <button data-testid="create-new-demo-button" className="btn-primary self-start">
      <Plus className="h-4 w-4" /> New demo
    </button>
  );

  return (
    <div className="min-h-screen relative z-10">
      <AppHeader />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <BackendHealthBanner />
        <section className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-8">
          <div>
            <p className="eyebrow mb-3">Studio · {user?.name}</p>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">Your demos</h1>
            <p className="text-slate-400 mt-3 max-w-xl">Each demo moves through the same path: write the spec, let AI script it, record the live product, then share a player people can follow.</p>
          </div>
          <NewProjectDialog trigger={newBtn} />
        </section>
        <WorkflowRail items={[
          { id: "spec", label: "Spec", detail: "Paste the story", state: "current" },
          { id: "script", label: "Script", detail: "AI writes steps", state: "wait" },
          { id: "record", label: "Record", detail: "Cloud browser", state: "wait" },
          { id: "narrate", label: "Narrate", detail: "Voice on Play", state: "wait" },
          { id: "share", label: "Share", detail: "Player and export", state: "wait" },
        ]} />
        {loadError && (
          <div className="mt-6 surface flex flex-wrap items-center justify-between gap-3 p-4" role="alert" data-testid="projects-load-error">
            <p className="text-sm text-rose-200">{loadError}</p>
            <button type="button" onClick={load} className="h-9 px-3 rounded-lg border border-slate-700 text-sm" data-testid="projects-retry">Try again</button>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3 my-8">
          <div className="relative max-w-sm flex-1 min-w-[12rem]">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search names, sites, and captions" className="pl-9 bg-slate-950" data-testid="projects-search-input" />
          </div>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 rounded-md border border-slate-700 bg-slate-950 px-2 text-sm" data-testid="projects-status-filter">
            {["all", "draft", "scripted", "recording", "ready", "partial", "failed"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={host} onChange={(e) => setHost(e.target.value)} className="h-9 rounded-md border border-slate-700 bg-slate-950 px-2 text-sm" data-testid="projects-host-filter">
            <option value="all">All sites</option>
            {hosts.map((h) => <option key={h} value={h}>{h}</option>)}
          </select>
          <label className="text-sm text-slate-300 flex items-center gap-2"><input type="checkbox" checked={brokenOnly} onChange={(e) => setBrokenOnly(e.target.checked)} data-testid="projects-broken-filter" /> Broken</label>
          {["active", "archived", "trash"].map((name) => (
            <button key={name} onClick={() => setView(name)} className={`h-9 px-3 rounded-md border text-sm capitalize ${view === name ? "border-cyan-500 text-cyan-200" : "border-slate-700"}`} data-testid={`projects-view-${name}`}>{name}</button>
          ))}
        </div>
        {notes.length > 0 && (
          <div className="mb-6 surface p-4 text-sm" data-testid="run-notifications">
            <div className="flex items-center justify-between"><p className="font-medium">Finished runs</p><button className="text-xs text-cyan-400" onClick={() => { api.post("/notifications/read"); setNotes([]); }}>Mark read</button></div>
            <ul className="mt-2 space-y-1 text-slate-300">{notes.slice(0, 4).map((n) => <li key={n.id}>{n.project_name}: {n.message}</li>)}</ul>
          </div>
        )}
        {projects && projects.length === 0 && view === "active" && !q && (
          <div className="mb-6 surface p-5" data-testid="first-demo-coach">
            <h2 className="font-semibold">Make the first demo</h2>
            <ol className="mt-3 space-y-1 text-sm text-slate-300 list-decimal pl-5">
              <li>Create a demo from the TodoMVC example.</li>
              <li>If recording is disabled, ask an admin to confirm Browserless in System integrations.</li>
              <li>Generate the script, then Record demo.</li>
              <li>Publish freeze so the share link stays on that version.</li>
            </ol>
          </div>
        )}
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
            {shown.map((p, i) => <ProjectCard key={p.id} p={p} i={i} onDuplicate={view === "trash" ? null : duplicate} onDelete={view === "trash" ? null : setToDelete} onArchive={view === "active" ? archive : null} onRestore={view === "trash" ? restore : null} />)}
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
