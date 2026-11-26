import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, API, errMsg } from "@/lib/api";
import { Input } from "@/components/ui/input";

const btn = "h-8 px-2 rounded-md border border-slate-700 text-xs hover:bg-slate-800 disabled:opacity-40";

export function StudioExtras({ project, meta, setMeta, onReload, onInsert }) {
  const [snippets, setSnippets] = useState([]);
  const [variants, setVariants] = useState(project.variants || []);
  const [preflight, setPreflight] = useState(null);
  const [version, setVersion] = useState("");
  const [snippetName, setSnippetName] = useState("");
  const [variantName, setVariantName] = useState("");
  const [variantVars, setVariantVars] = useState("company=Acme");
  const [watchUrl, setWatchUrl] = useState(project.watch_url || "");
  const [word, setWord] = useState("");
  const [spoken, setSpoken] = useState("");
  const [busy, setBusy] = useState("");

  useEffect(() => { api.get("/snippets").then((r) => setSnippets(r.data)).catch(() => {}); }, [project.id]);
  useEffect(() => { setVariants(project.variants || []); setWatchUrl(project.watch_url || ""); }, [project.id, project.variants, project.watch_url]);

  const run = async (key, fn, ok) => {
    setBusy(key);
    try { await fn(); if (ok) toast.success(ok); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(""); }
  };

  const glossary = meta.glossary || [];
  const recipe = meta.login_recipe || [];

  return (
    <details className="surface p-4" data-testid="studio-extras">
      <summary className="cursor-pointer text-sm font-medium">Demo tools — versions, login, variants, and checks</summary>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="space-y-2" data-testid="named-version">
          <p className="text-xs uppercase tracking-wider text-slate-500">Named version</p>
          <div className="flex gap-2">
            <Input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="Before launch review" className="bg-slate-950 h-8 text-xs" data-testid="version-label-input" />
            <button className={btn} disabled={!version.trim() || busy === "version"} onClick={() => run("version", async () => { await api.post(`/projects/${project.id}/versions`, { label: version.trim() }); setVersion(""); }, "Version saved in history")} data-testid="save-version-button">Save version</button>
          </div>
        </section>
        <section className="space-y-2" data-testid="selector-preflight">
          <p className="text-xs uppercase tracking-wider text-slate-500">Selector check</p>
          <button className={btn} disabled={busy === "preflight"} onClick={() => run("preflight", async () => { const { data } = await api.post(`/projects/${project.id}/preflight`); setPreflight(data.steps || []); }, "Selector check finished")} data-testid="preflight-button">Check selectors</button>
          {preflight && (
            <ul className="text-xs space-y-1 text-slate-300">
              {preflight.map((row) => <li key={row.index} data-testid={`preflight-${row.index}`}>Step {row.index + 1}: {row.status}{row.count != null ? ` (${row.count})` : ""}</li>)}
            </ul>
          )}
        </section>
        <section className="space-y-2" data-testid="login-recipe">
          <p className="text-xs uppercase tracking-wider text-slate-500">Login recipe</p>
          <p className="text-xs text-slate-500">Fallback when no signed-in browser is saved. Tip: open Live browser, sign in once, then Save signed-in session — cookies are reused on Record demo. A password in a type step stays in the project.</p>
          {recipe.map((step, i) => (
            <div key={i} className="flex gap-2">
              <Input value={step.action} onChange={(e) => setMeta({ login_recipe: recipe.map((row, j) => j === i ? { ...row, action: e.target.value } : row) })} className="bg-slate-950 h-8 text-xs w-20" data-testid={`recipe-action-${i}`} />
              <Input value={step.selector || step.url || ""} onChange={(e) => setMeta({ login_recipe: recipe.map((row, j) => j === i ? { ...row, selector: e.target.value } : row) })} placeholder="selector" className="bg-slate-950 h-8 text-xs" data-testid={`recipe-selector-${i}`} />
              <Input value={step.text || ""} onChange={(e) => setMeta({ login_recipe: recipe.map((row, j) => j === i ? { ...row, text: e.target.value } : row) })} placeholder="text" className="bg-slate-950 h-8 text-xs" data-testid={`recipe-text-${i}`} />
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <button className={btn} onClick={() => setMeta({ login_recipe: [...recipe, { action: "type", selector: "input[type=email]", text: "{{email}}" }] })} data-testid="recipe-add-button">Add login step</button>
            <button className={btn} disabled={busy === "profile"} onClick={() => run("profile", () => api.post(`/projects/${project.id}/auth-profile`).then(onReload), "Signed-in browser saved")} data-testid="save-auth-profile">Save signed-in browser</button>
            {project.has_storage && <button className={btn} onClick={() => run("clear-profile", () => api.delete(`/projects/${project.id}/auth-profile`).then(onReload), "Signed-in browser cleared")} data-testid="clear-auth-profile">Clear browser</button>}
          </div>
        </section>
        <section className="space-y-2" data-testid="glossary-editor">
          <p className="text-xs uppercase tracking-wider text-slate-500">Pronunciation</p>
          {glossary.map((item, i) => <p key={i} className="text-xs text-slate-300">{item.word} → {item.spoken}</p>)}
          <div className="flex gap-2">
            <Input value={word} onChange={(e) => setWord(e.target.value)} placeholder="appshowcase" className="bg-slate-950 h-8 text-xs" data-testid="glossary-word-input" />
            <Input value={spoken} onChange={(e) => setSpoken(e.target.value)} placeholder="flow cast" className="bg-slate-950 h-8 text-xs" data-testid="glossary-spoken-input" />
            <button className={btn} disabled={!word.trim() || !spoken.trim()} onClick={() => { setMeta({ glossary: [...glossary, { word: word.trim(), spoken: spoken.trim() }] }); setWord(""); setSpoken(""); }} data-testid="glossary-add-button">Add</button>
          </div>
        </section>
        <section className="space-y-2" data-testid="snippet-library">
          <p className="text-xs uppercase tracking-wider text-slate-500">Saved sequences</p>
          <div className="flex gap-2">
            <Input value={snippetName} onChange={(e) => setSnippetName(e.target.value)} placeholder="Sign in and open billing" className="bg-slate-950 h-8 text-xs" data-testid="snippet-name-input" />
            <button className={btn} disabled={!snippetName.trim()} onClick={() => run("snippet", async () => { await api.post("/snippets", { name: snippetName.trim(), steps: project.steps || [] }); setSnippetName(""); const { data } = await api.get("/snippets"); setSnippets(data); }, "Sequence saved")} data-testid="save-snippet-button">Save steps</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {snippets.map((sn) => <button key={sn.id} className={btn} onClick={() => run("insert", async () => { const { data } = await api.post(`/projects/${project.id}/snippets/${sn.id}/insert`); onInsert(data); }, "Sequence inserted")} data-testid={`insert-snippet-${sn.id}`}>{sn.name}</button>)}
          </div>
        </section>
        <section className="space-y-2" data-testid="variant-editor">
          <p className="text-xs uppercase tracking-wider text-slate-500">Customer variants</p>
          <div className="flex gap-2">
            <Input value={variantName} onChange={(e) => setVariantName(e.target.value)} placeholder="Acme" className="bg-slate-950 h-8 text-xs" data-testid="variant-name-input" />
            <Input value={variantVars} onChange={(e) => setVariantVars(e.target.value)} placeholder="company=Acme, plan=Pro" className="bg-slate-950 h-8 text-xs" data-testid="variant-vars-input" />
            <button className={btn} disabled={!variantName.trim()} onClick={() => run("variant", async () => {
              const variables = Object.fromEntries(variantVars.split(",").map((pair) => pair.split("=").map((part) => part.trim())).filter((pair) => pair[0] && pair[1]));
              const { data } = await api.post(`/projects/${project.id}/variants`, { name: variantName.trim(), variables });
              setVariants((list) => [...list, data]);
              setVariantName("");
            }, "Variant added")} data-testid="add-variant-button">Add</button>
          </div>
          {variants.map((variant) => (
            <div key={variant.id} className="flex items-center justify-between gap-2 text-xs">
              <span>{variant.name}</span>
              <span className="flex gap-2">
                <button className={btn} onClick={() => run("use-variant", () => api.post(`/projects/${project.id}/variants/${variant.id}/activate`).then(({ data }) => onInsert(data)), "Variant variables are active")} data-testid={`activate-variant-${variant.id}`}>Use</button>
                <button className={btn} onClick={() => navigator.clipboard.writeText(`${window.location.origin}/share/${variant.share_id}`)} data-testid={`copy-variant-${variant.id}`}>Copy link</button>
              </span>
            </div>
          ))}
        </section>
        <section className="space-y-2" data-testid="release-watch">
          <p className="text-xs uppercase tracking-wider text-slate-500">Watch a releases page</p>
          <div className="flex gap-2">
            <Input value={watchUrl} onChange={(e) => setWatchUrl(e.target.value)} placeholder="https://example.com/releases" className="bg-slate-950 h-8 text-xs" data-testid="watch-url-input" />
            <button className={btn} disabled={busy === "watch"} onClick={() => run("watch", async () => {
              const { data } = await api.post(`/projects/${project.id}/watch`, { url: watchUrl });
              if (!data.changed) { toast.message("The page has not changed"); return; }
              onReload();
              toast.success(data.scripted ? "New notes became a script" : "New notes saved in the draft");
            })} data-testid="watch-button">Check page</button>
          </div>
        </section>
        <section className="space-y-2 text-sm" data-testid="share-behavior">
          <label className="flex items-center gap-2"><input type="checkbox" checked={!!meta.guided} onChange={(e) => setMeta({ guided: e.target.checked })} data-testid="guided-toggle" /> Guided tour — wait for the hotspot click</label>
          <label className="flex items-center gap-2">Narration track
            <select value={meta.active_track || "primary"} onChange={(e) => setMeta({ active_track: e.target.value })} className="h-8 rounded-md border border-slate-700 bg-slate-950 px-2 text-xs" data-testid="narration-track-select">
              <option value="primary">Primary</option>
              <option value="alt">Alternate</option>
            </select>
          </label>
          <Input value={meta.notify_url || ""} onChange={(e) => setMeta({ notify_url: e.target.value })} placeholder="Slack or email webhook when a run finishes" className="bg-slate-950 h-8 text-xs" data-testid="notify-url-input" />
          <label className="flex items-center gap-2">Tour order
            <Input type="number" value={meta.tour_order || 0} onChange={(e) => setMeta({ tour_order: Number(e.target.value) })} className="bg-slate-950 h-8 text-xs w-20" data-testid="tour-order-input" />
          </label>
          <a className="text-cyan-400 text-xs" href={`${API}/projects/${project.id}/pack`} data-testid="download-pack">Download image pack</a>
        </section>
      </div>
    </details>
  );
}
