import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Clapperboard, Loader2 } from "lucide-react";
import axios from "axios";
import { API } from "@/lib/api";

export default function ProductPage() {
  const { slug } = useParams();
  const [page, setPage] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    axios.get(`${API}/public/products/${slug}`)
      .then(({ data }) => setPage(data))
      .catch(() => setError("This product page is not available"));
  }, [slug]);

  if (error) return <div className="min-h-screen grid place-items-center text-slate-400">{error}</div>;
  if (!page) return <div className="min-h-screen grid place-items-center"><Loader2 className="h-6 w-6 animate-spin text-indigo-400" /></div>;

  return (
    <main className="max-w-3xl mx-auto px-4 py-12" data-testid="product-page">
      <p className="eyebrow mb-3">Demos</p>
      <h1 className="text-4xl font-extrabold tracking-tight mb-4">{page.slug}</h1>
      {page.demos.length > 1 && <Link to={`/share/${page.demos[0].share_id}`} className="inline-flex mb-6 h-10 items-center rounded-lg bg-indigo-600 px-4 text-sm font-medium" data-testid="product-tour-start">Start the tour</Link>}
      {page.demos.length === 0 ? <p className="text-slate-400">No published demos yet.</p> : (
        <ul className="space-y-3">
          {page.demos.map((demo, index) => (
            <li key={demo.share_id}>
              <Link to={`/share/${demo.share_id}`} className="surface flex items-center justify-between px-4 py-3 hover:-translate-y-0.5" data-testid={`product-demo-${demo.share_id}`}>
                <span className="flex items-center gap-2"><Clapperboard className="h-4 w-4 text-cyan-400" />{demo.name}</span>
                <span className="text-xs text-slate-500">{index < page.demos.length - 1 ? "Then the next demo · " : ""}{demo.step_count} steps</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
