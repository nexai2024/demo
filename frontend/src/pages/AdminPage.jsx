import { useCallback, useEffect, useState } from "react";
import { Ban, CheckCircle2, KeyRound, Loader2, RefreshCw, Search, Shield, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { Input } from "@/components/ui/input";
import { api, errMsg } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const card = "surface p-6";
const PLAN_OPTIONS = ["free", "starter", "pro", "team", "business", "enterprise"];

const fmtDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString();
};

function Stat({ label, value, testId }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
      <p className="text-[11px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className="text-2xl font-bold mt-1" data-testid={testId}>{value ?? 0}</p>
    </div>
  );
}

export default function AdminPage() {
  const { user: currentUser } = useAuth();
  const [summary, setSummary] = useState(null);
  const [users, setUsers] = useState([]);
  const [audit, setAudit] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async (search = "") => {
    setLoading(true);
    setError("");
    try {
      const [summaryRes, usersRes, auditRes] = await Promise.all([
        api.get("/admin/summary"),
        api.get("/admin/users", { params: { query: search, limit: 100, offset: 0 } }),
        api.get("/admin/audit", { params: { limit: 50 } }),
      ]);
      setSummary(summaryRes.data);
      setUsers(usersRes.data.users || []);
      setAudit(auditRes.data.entries || []);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(""); }, [load]);

  const act = async (row, action) => {
    if (action === "cancel" && !window.confirm(`Cancel and delete ${row.email}? This removes their Clerk account and blocks access.`)) return;
    if (action === "suspend" && !window.confirm(`Suspend ${row.email}? They will be signed out and blocked until reactivated.`)) return;
    setBusy(`${row.user_id}:${action}`);
    try {
      await api.post(`/admin/users/${row.user_id}/${action}`);
      toast.success(action === "revoke-sessions" ? "Sessions revoked" : `User ${action}d`);
      await load(query);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy("");
    }
  };

  const patch = async (row, fields, label) => {
    setBusy(`${row.user_id}:patch`);
    try {
      await api.patch(`/admin/users/${row.user_id}`, fields);
      toast.success(label);
      await load(query);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="min-h-screen relative z-10">
      <AppHeader />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-6" data-testid="admin-page">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow mb-3">Administration</p>
            <h1 className="text-4xl font-extrabold tracking-tight">Users & utilization</h1>
            <p className="text-slate-400 mt-2">Identity and billing are managed in Clerk; this console mirrors usage and records every admin action.</p>
          </div>
          <button onClick={() => load(query)} className="h-9 px-3 rounded-lg border border-slate-700 hover:bg-slate-800 text-sm flex items-center gap-2" data-testid="admin-refresh">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>

        {error && <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-4 text-rose-200" data-testid="admin-error">{error}</div>}

        <section className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          <Stat label="Users" value={summary?.users} testId="admin-stat-users" />
          <Stat label="Active" value={summary?.active_users} testId="admin-stat-active" />
          <Stat label="Suspended" value={summary?.suspended_users} testId="admin-stat-suspended" />
          <Stat label="Projects" value={summary?.projects} testId="admin-stat-projects" />
          <Stat label="Recordings / mo" value={summary?.recordings_this_month} testId="admin-stat-recordings" />
          <Stat label="Browser sec / mo" value={summary?.seconds_this_month} testId="admin-stat-seconds" />
        </section>

        <section className={card}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5">
            <h2 className="font-semibold flex items-center gap-2"><Shield className="h-4 w-4 text-cyan-300" /> User management</h2>
            <form
              className="flex gap-2"
              onSubmit={(e) => { e.preventDefault(); load(query); }}
            >
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name or email" className="bg-slate-950 pl-9 w-72" data-testid="admin-user-search" />
              </div>
              <button className="btn-primary h-10 px-4" data-testid="admin-search-button">Search</button>
            </form>
          </div>

          {loading ? (
            <div className="py-14 grid place-items-center"><Loader2 className="h-6 w-6 animate-spin text-indigo-400" /></div>
          ) : users.length === 0 ? (
            <p className="text-slate-400" data-testid="admin-users-empty">No users found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[980px]" data-testid="admin-users-table">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b border-slate-800">
                    <th className="py-3 pr-4">User</th>
                    <th className="py-3 pr-4">Status</th>
                    <th className="py-3 pr-4">Role</th>
                    <th className="py-3 pr-4">Plan</th>
                    <th className="py-3 pr-4">Utilization</th>
                    <th className="py-3 pr-4">Activity</th>
                    <th className="py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((row) => {
                    const self = row.user_id === currentUser?.user_id;
                    const rowBusy = busy.startsWith(`${row.user_id}:`);
                    return (
                      <tr key={row.user_id} className="border-b border-slate-900 align-top" data-testid={`admin-user-${row.user_id}`}>
                        <td className="py-4 pr-4">
                          <p className="font-medium text-slate-100">{row.name || "—"}</p>
                          <p className="text-xs text-slate-500 break-all">{row.email || row.user_id}</p>
                          <p className="text-[11px] text-slate-600 mt-1">{row.auth_provider} · joined {fmtDate(row.created_at)}</p>
                        </td>
                        <td className="py-4 pr-4">
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${row.status === "active" ? "border-emerald-500/40 text-emerald-300" : "border-rose-500/40 text-rose-300"}`}>
                            {row.status}
                          </span>
                          <p className="text-[11px] text-slate-600 mt-1">{row.billing_status || "free"}</p>
                        </td>
                        <td className="py-4 pr-4">
                          <select
                            value={row.role || "user"}
                            disabled={rowBusy || self}
                            onChange={(e) => patch(row, { role: e.target.value }, "Role updated")}
                            className="bg-slate-950 border border-slate-700 rounded-lg h-9 px-2 text-sm"
                            data-testid={`admin-role-${row.user_id}`}
                          >
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                          </select>
                        </td>
                        <td className="py-4 pr-4">
                          <select
                            value={row.plan || "free"}
                            disabled={rowBusy}
                            onChange={(e) => patch(row, { plan_override: e.target.value }, "Plan override updated")}
                            className="bg-slate-950 border border-slate-700 rounded-lg h-9 px-2 text-sm capitalize"
                            data-testid={`admin-plan-${row.user_id}`}
                          >
                            {PLAN_OPTIONS.map((plan) => <option key={plan} value={plan}>{plan}</option>)}
                          </select>
                          <p className="text-[11px] text-slate-600 mt-1">limit {row.usage?.limit ?? "—"}/mo</p>
                        </td>
                        <td className="py-4 pr-4 text-slate-300">
                          <p>{row.usage?.projects ?? 0} projects · {row.usage?.runs ?? 0} runs</p>
                          <p className="text-xs text-slate-500 mt-1">
                            {row.usage?.recordings_this_month ?? 0} recordings · {row.usage?.seconds_this_month ?? 0}s browser time
                          </p>
                          <p className="text-xs text-slate-600">{row.usage?.active_runs ?? 0} active · {row.usage?.failed_runs ?? 0} failed/cancelled</p>
                        </td>
                        <td className="py-4 pr-4 text-slate-400">
                          <p>Last run</p>
                          <p className="text-xs text-slate-500 mt-1">{fmtDate(row.usage?.last_run_at)}</p>
                          <p className="text-xs text-slate-600">Seen {fmtDate(row.last_seen_at)}</p>
                        </td>
                        <td className="py-4">
                          <div className="flex flex-wrap gap-1.5 min-w-44">
                            {row.status === "active" ? (
                              <button disabled={rowBusy || self} onClick={() => act(row, "suspend")} className="h-8 px-2.5 rounded-lg border border-amber-500/40 text-amber-200 hover:bg-amber-500/10 text-xs flex items-center gap-1 disabled:opacity-40" data-testid={`admin-suspend-${row.user_id}`}>
                                <Ban className="h-3.5 w-3.5" /> Suspend
                              </button>
                            ) : row.status !== "deleted" ? (
                              <button disabled={rowBusy} onClick={() => act(row, "reactivate")} className="h-8 px-2.5 rounded-lg border border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/10 text-xs flex items-center gap-1 disabled:opacity-40" data-testid={`admin-reactivate-${row.user_id}`}>
                                <CheckCircle2 className="h-3.5 w-3.5" /> Reactivate
                              </button>
                            ) : null}
                            <button disabled={rowBusy} onClick={() => act(row, "revoke-sessions")} className="h-8 px-2.5 rounded-lg border border-slate-700 hover:bg-slate-800 text-xs flex items-center gap-1 disabled:opacity-40" data-testid={`admin-revoke-${row.user_id}`}>
                              <KeyRound className="h-3.5 w-3.5" /> Restart sessions
                            </button>
                            {row.status !== "deleted" && (
                              <button disabled={rowBusy || self} onClick={() => act(row, "cancel")} className="h-8 px-2.5 rounded-lg border border-rose-500/40 text-rose-200 hover:bg-rose-500/10 text-xs flex items-center gap-1 disabled:opacity-40" data-testid={`admin-cancel-${row.user_id}`}>
                                <Trash2 className="h-3.5 w-3.5" /> Cancel user
                              </button>
                            )}
                            {rowBusy && <Loader2 className="h-4 w-4 animate-spin text-indigo-300" />}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className={card}>
          <h2 className="font-semibold mb-4">Admin audit trail</h2>
          {audit.length === 0 ? (
            <p className="text-sm text-slate-500" data-testid="admin-audit-empty">No admin actions recorded yet.</p>
          ) : (
            <div className="space-y-2" data-testid="admin-audit-list">
              {audit.map((entry) => (
                <div key={entry.id} className="flex flex-wrap gap-x-4 gap-y-1 rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-sm">
                  <span className="text-slate-200 font-medium">{entry.action}</span>
                  <span className="text-slate-500">target {entry.target_user_id}</span>
                  <span className="text-slate-500">by {entry.actor_email || entry.actor_id}</span>
                  <span className="text-slate-600 ml-auto">{fmtDate(entry.at)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
