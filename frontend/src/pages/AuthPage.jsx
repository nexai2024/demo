import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Loader2, Clapperboard } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, errMsg } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const LOG = [
  ["00:00", "Parsing release notes with Claude…"],
  ["00:02", "Step 1/6: Navigating to app.acme.io"],
  ["00:05", "Step 2/6: Clicking text=Sign in"],
  ["00:07", "Step 3/6: Typing into #email"],
  ["00:11", "Step 4/6: Navigating to settings…"],
  ["00:14", "Voiceover synthesized · 6 clips"],
  ["00:19", "MP4 export ready ✓"],
];

const googleLogin = () => {
  // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
  const redirectUrl = window.location.origin + "/dashboard";
  window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
};

function Showcase() {
  return (
    <div className="hidden lg:flex flex-col justify-between p-12 border-r border-slate-800/80 grid-bg relative overflow-hidden">
      <div className="flex items-center gap-2 font-display text-lg font-bold"><Clapperboard className="h-5 w-5 text-cyan-400" /> Flowcast</div>
      <div className="max-w-lg">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-400 mb-5">Spec → Script → Screen</p>
        <h1 className="text-5xl font-extrabold tracking-tight leading-[1.05]">Paste a spec.<br />Get a product demo<br /><span className="text-indigo-400">that records itself.</span></h1>
        <p className="mt-6 text-slate-400 leading-relaxed">AI turns your draft into browser actions, Browserless drives a real Chromium, and you leave with a narrated MP4, GIF or embeddable player.</p>
      </div>
      <div className="rounded-xl border border-slate-800 bg-slate-950/80 backdrop-blur-xl p-5 font-mono text-xs space-y-2 max-w-lg">
        {LOG.map(([t, m], i) => (
          <div key={t} className="rise flex gap-4" style={{ animationDelay: `${i * 0.25}s` }}>
            <span className="text-slate-600">{t}</span>
            <span className={i === LOG.length - 1 ? "text-emerald-400" : "text-slate-300"}>{m}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AuthPage() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (user) return <Navigate to="/dashboard" replace />;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = mode === "login" ? { email: form.email, password: form.password } : form;
      const { data } = await api.post(`/auth/${mode === "login" ? "login" : "register"}`, body);
      setUser(data);
      navigate("/dashboard");
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 relative z-10">
      <Showcase />
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm rise" data-testid="auth-form-container">
          <h2 className="text-3xl font-bold tracking-tight">{mode === "login" ? "Welcome back" : "Create your studio"}</h2>
          <p className="text-sm text-slate-400 mt-2 mb-8">Build, record and share AI product demos.</p>
          <Tabs value={mode} onValueChange={(v) => { setMode(v); setError(""); }} className="mb-6">
            <TabsList className="grid grid-cols-2 w-full bg-slate-900">
              <TabsTrigger value="login" data-testid="auth-tab-login">Sign in</TabsTrigger>
              <TabsTrigger value="register" data-testid="auth-tab-register">Create account</TabsTrigger>
            </TabsList>
          </Tabs>
          <form onSubmit={submit} className="space-y-4">
            {mode === "register" && (
              <div className="space-y-1.5"><Label htmlFor="name">Name</Label>
                <Input id="name" value={form.name} onChange={set("name")} required data-testid="auth-name-input" className="bg-slate-950" /></div>
            )}
            <div className="space-y-1.5"><Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={form.email} onChange={set("email")} required data-testid="auth-email-input" className="bg-slate-950" /></div>
            <div className="space-y-1.5"><Label htmlFor="password">Password</Label>
              <Input id="password" type="password" minLength={6} value={form.password} onChange={set("password")} required data-testid="auth-password-input" className="bg-slate-950" /></div>
            {error && <p className="text-sm text-red-400" data-testid="auth-error">{error}</p>}
            <button type="submit" disabled={busy} data-testid="auth-submit-button"
              className="w-full h-11 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-medium shadow-lg shadow-indigo-600/20 transition-[background-color,transform] active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-60">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}{mode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>
          <div className="flex items-center gap-3 my-6 text-xs text-slate-500"><div className="h-px flex-1 bg-slate-800" />OR<div className="h-px flex-1 bg-slate-800" /></div>
          <button onClick={googleLogin} data-testid="google-login-button"
            className="w-full h-11 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 font-medium transition-colors flex items-center justify-center gap-3">
            <svg className="h-4 w-4" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
            Continue with Google
          </button>
        </div>
      </div>
    </div>
  );
}
