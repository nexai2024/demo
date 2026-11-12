import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, errMsg } from "@/lib/api";

export const TEMPLATES = [
  {
    label: "Task app tour",
    name: "TodoMVC — Quick tour",
    target_url: "https://demo.playwright.dev/todomvc",
    draft: `Release notes v2.4 — Faster task capture
- Open the app and show the empty task list
- Add a task "Write release notes" and press Enter
- Add another task "Record product demo" and press Enter
- Mark "Write release notes" as completed using its checkbox
- Switch to the "Completed" filter to show finished work
- End by showing the "All" view again`,
  },
  {
    label: "Login flow",
    name: "Secure login walkthrough",
    target_url: "https://the-internet.herokuapp.com/login",
    draft: `Feature spec: Secure login
- Show the login page
- Type username "tomsmith"
- Type password "SuperSecretPassword!" (sensitive)
- Click the Login button
- Highlight the success message in the secure area
- Click Logout to finish`,
  },
  {
    label: "Docs search",
    name: "Docs navigation",
    target_url: "https://playwright.dev",
    draft: `Show new users how to find docs
- Open the homepage and point at the hero
- Click "Get started"
- Scroll down through the installation guide
- Hover over the sidebar navigation`,
  },
];

export const NewProjectDialog = ({ trigger }) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", target_url: "", draft: "" });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post("/projects", form);
      navigate(`/projects/${data.id}`);
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-xl bg-slate-950 border-slate-800" data-testid="new-project-dialog">
        <DialogHeader><DialogTitle className="font-display text-xl">New demo project</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5"><Label>Project name</Label>
            <Input value={form.name} onChange={set("name")} required placeholder="Q3 analytics launch" data-testid="new-project-name-input" /></div>
          <div className="space-y-1.5"><Label>Target app URL</Label>
            <Input value={form.target_url} onChange={set("target_url")} placeholder="https://app.yourproduct.com" data-testid="new-project-url-input" /></div>
          <div className="space-y-1.5"><Label>Draft, release notes or spec</Label>
            <Textarea rows={7} value={form.draft} onChange={set("draft")} className="font-mono text-xs"
              placeholder="- Log in&#10;- Open the analytics dashboard&#10;- Hover over the revenue chart" data-testid="new-project-draft-input" /></div>
          <div className="flex items-center justify-between gap-3 pt-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <Sparkles className="h-4 w-4 text-cyan-400" />
              {TEMPLATES.map((t, i) => (
                <button key={t.label} type="button" onClick={() => setForm({ name: t.name, target_url: t.target_url, draft: t.draft })}
                  className="text-xs rounded-full border border-slate-700 px-2.5 py-1 hover:border-cyan-500/50 hover:text-cyan-300 transition-colors" data-testid={i === 0 ? "use-example-button" : `template-${i}`}>
                  {t.label}
                </button>
              ))}
            </div>
            <button type="submit" disabled={busy} data-testid="create-project-submit-button"
              className="h-10 px-5 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-medium transition-colors flex items-center gap-2 disabled:opacity-60">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Create project
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
