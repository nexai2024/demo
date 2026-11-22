import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { knowledgeNav, parseKnowledge } from "@/help/parseKnowledge";

function Inline({ text }) {
  const parts = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g;
  let last = 0;
  let match;
  let n = 0;
  while ((match = re.exec(text))) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const token = match[0];
    if (token.startsWith("**")) parts.push(<strong key={n} className="text-white font-semibold">{token.slice(2, -2)}</strong>);
    else if (token.startsWith("`")) parts.push(<code key={n} className="rounded bg-slate-800 px-1 py-0.5 text-[0.85em] text-cyan-200">{token.slice(1, -1)}</code>);
    else {
      const labeled = /\[([^\]]+)\]\(([^)]+)\)/.exec(token);
      const href = labeled[2];
      parts.push(href.startsWith("/")
        ? <Link key={n} to={href} className="text-cyan-400 hover:text-cyan-300">{labeled[1]}</Link>
        : <a key={n} href={href} className="text-cyan-400 hover:text-cyan-300">{labeled[1]}</a>);
    }
    n += 1;
    last = match.index + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function Block({ block }) {
  if (block.type === "heading") {
    const Tag = `h${block.level}`;
    const cls = block.level === 1
      ? "text-3xl font-extrabold tracking-tight"
      : block.level === 2
        ? "text-xl font-semibold mt-10 scroll-mt-24"
        : "text-base font-semibold mt-6 scroll-mt-24 text-slate-100";
    return <Tag id={block.id} className={cls} data-testid={`help-${block.id}`}><Inline text={block.text} /></Tag>;
  }
  if (block.type === "paragraph") return <p className="text-sm leading-6 text-slate-300"><Inline text={block.text} /></p>;
  if (block.type === "list") {
    return <ul className="list-disc pl-5 space-y-1 text-sm leading-6 text-slate-300">{block.items.map((item) => <li key={item}><Inline text={item} /></li>)}</ul>;
  }
  if (block.type === "steps") {
    return <ol className="list-decimal pl-5 space-y-1 text-sm leading-6 text-slate-300">{block.items.map((item) => <li key={item}><Inline text={item} /></li>)}</ol>;
  }
  if (block.type === "code") {
    return <pre className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs text-slate-200"><code>{block.text}</code></pre>;
  }
  if (block.type === "table") {
    return (
      <div className="overflow-x-auto rounded-lg border border-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-900 text-slate-400">
            <tr>{block.header.map((cell) => <th key={cell} className="px-3 py-2 font-medium">{cell}</th>)}</tr>
          </thead>
          <tbody>
            {block.rows.map((row) => (
              <tr key={row.join("|")} className="border-t border-slate-800">
                {row.map((cell, index) => <td key={`${index}-${cell}`} className="px-3 py-2 align-top text-slate-300"><Inline text={cell} /></td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return null;
}

export default function HelpPage() {
  const { hash } = useLocation();
  const [markdown, setMarkdown] = useState("");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetch("/knowledge.md")
      .then((response) => {
        if (!response.ok) throw new Error("missing");
        return response.text();
      })
      .then(setMarkdown)
      .catch(() => setError("The knowledge document could not be loaded."));
  }, []);

  const blocks = useMemo(() => parseKnowledge(markdown), [markdown]);
  const nav = useMemo(() => knowledgeNav(blocks), [blocks]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return blocks;
    const keep = new Set();
    let current = null;
    blocks.forEach((block, index) => {
      if (block.type === "heading" && block.level <= 2) current = index;
      const hay = JSON.stringify(block).toLowerCase();
      if (hay.includes(q) && current !== null) keep.add(current);
    });
    let section = null;
    return blocks.filter((block, index) => {
      if (block.type === "heading" && block.level === 1) return true;
      if (block.type === "heading" && block.level === 2) { section = index; return keep.has(index); }
      return section !== null && keep.has(section);
    });
  }, [blocks, query]);

  useEffect(() => {
    const id = decodeURIComponent((hash || "").replace("#", ""));
    if (!id || !blocks.length) return;
    const node = document.getElementById(id);
    if (node) node.scrollIntoView({ block: "start" });
  }, [hash, blocks]);

  return (
    <div className="min-h-screen" data-testid="help-page">
      <AppHeader />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 grid lg:grid-cols-[16rem_1fr] gap-8">
        <aside className="lg:sticky lg:top-20 lg:self-start space-y-3">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search help" className="w-full h-10 rounded-lg border border-slate-700 bg-slate-950/80 px-3 text-sm" data-testid="help-search" />
          <nav className="flex lg:flex-col gap-1 overflow-x-auto text-sm" data-testid="help-nav">
            {nav.map((item) => (
              <a key={item.id} href={`#${item.id}`} className={`whitespace-nowrap rounded-md px-2 py-1 ${hash === `#${item.id}` ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white"}`}>{item.text}</a>
            ))}
          </nav>
        </aside>
        <article className="surface space-y-3 min-w-0 p-5 sm:p-8" data-testid="help-article">
          {!markdown && !error && <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />}
          {error && <p className="text-sm text-amber-200">{error} The source file is <code>docs/KNOWLEDGE.md</code>.</p>}
          {shown.map((block, index) => <Block key={`${block.type}-${block.id || index}`} block={block} />)}
        </article>
      </div>
    </div>
  );
}
