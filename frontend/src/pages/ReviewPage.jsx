import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { Loader2 } from "lucide-react";
import { DemoPlayer } from "@/components/DemoPlayer";
import { API } from "@/lib/api";

export default function ReviewPage() {
  const { token } = useParams();
  const [demo, setDemo] = useState(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [stepId, setStepId] = useState("");
  const [author, setAuthor] = useState("");
  const [done, setDone] = useState("");

  useEffect(() => {
    axios.get(`${API}/review/${token}`).then(({ data }) => { setDemo(data); setStepId(data.steps[0]?.id || ""); }).catch((e) => setError(e.response?.data?.detail || "Review link unavailable"));
  }, [token]);

  if (error) return <div className="min-h-screen grid place-items-center text-slate-400 p-6" data-testid="review-error">{error}</div>;
  if (!demo) return <div className="min-h-screen grid place-items-center"><Loader2 className="h-6 w-6 animate-spin text-indigo-400" /></div>;

  const send = async (e) => {
    e.preventDefault();
    await axios.post(`${API}/review/${token}/comments`, { step_id: stepId, text: note, author: author || "Reviewer" });
    setNote("");
    setDone("Comment saved on that step.");
  };
  const approve = async () => {
    await axios.post(`${API}/review/${token}/approve`);
    setDone("Marked approved.");
  };

  return (
    <main className="max-w-5xl mx-auto px-4 py-10" data-testid="review-page">
      <p className="text-sm text-slate-400 mb-2">Review draft · not the public share</p>
      <h1 className="text-3xl font-extrabold mb-6">{demo.name}</h1>
      <DemoPlayer steps={demo.steps} src={(s, k) => `${API}/review/${token}/steps/${s.id}/${k}`} chapters />
      <form onSubmit={send} className="surface mt-6 p-4 space-y-3 max-w-xl" data-testid="review-comment-form">
        <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Your name" className="w-full h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm" data-testid="review-author-input" />
        <select value={stepId} onChange={(e) => setStepId(e.target.value)} className="w-full h-10 rounded-lg border border-slate-700 bg-slate-950 px-2 text-sm" data-testid="review-step-select">
          {demo.steps.map((s, i) => <option key={s.id} value={s.id}>Step {i + 1}: {s.caption || s.action}</option>)}
        </select>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} required placeholder="Comment for the author" className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm" data-testid="review-note-input" />
        <div className="flex gap-2">
          <button className="h-10 px-3 rounded-lg bg-indigo-600 text-sm" data-testid="review-comment-submit">Save comment</button>
          <button type="button" onClick={approve} className="h-10 px-3 rounded-lg border border-slate-700 text-sm" data-testid="review-approve-button">{demo.review_status === "approved" ? "Approved" : "Mark approved"}</button>
        </div>
        {done && <p className="text-sm text-emerald-300" data-testid="review-done">{done}</p>}
      </form>
    </main>
  );
}
