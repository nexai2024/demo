import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { SignIn, SignUp } from "@clerk/react";
import { CLERK_APPEARANCE, clerkEnabled } from "@/lib/clerk";
import { Loader2, Clapperboard } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, errMsg } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const LOG = [
  ["00:00", "Parsing release notes with AI…"],
  ["00:02", "Step 1/6: Navigating to app.acme.io"],
  ["00:05", "Step 2/6: Clicking text=Sign in"],
  ["00:07", "Step 3/6: Typing into #email"],
  ["00:11", "Step 4/6: Navigating to settings…"],
  ["00:14", "Voiceover synthesized · 6 clips"],
  ["00:19", "MP4 export ready ✓"],
];

function Showcase() {
  return (
    <div className="hidden lg:flex flex-col justify-between p-12 border-r border-slate-800/80 grid-bg relative overflow-hidden">
      <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold"><Clapperboard className="h-5 w-5 text-cyan-400" /> AppShowcase</Link>
      <div className="max-w-lg">
        <p className="eyebrow mb-5">Spec → Script → Screen</p>
        <h1 className="text-5xl font-extrabold tracking-tight leading-[1.05]">Paste a spec.<br />Get a product demo<br /><span className="text-indigo-300">that records itself.</span></h1>
        <p className="mt-6 text-slate-400 leading-relaxed">AI turns your draft into browser actions, Browserless drives a real Chromium, and you leave with a narrated MP4, GIF or embeddable player.</p>
      </div>
      <div className="surface p-5 font-mono text-xs space-y-2 max-w-lg">
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
  const { user, setUser, clerkSignedIn, authError, logout, checkAuth } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [mode, setMode] = useState(params.get("mode") === "register" ? "register" : "login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setMode(params.get("mode") === "register" ? "register" : "login");
  }, [params]);

  if (user) return <Navigate to="/dashboard" replace />;

  // Clerk already has a session but the app profile hasn't loaded (or failed).
  // Never mount <SignIn /> here — it would force-redirect to /dashboard and loop.
  if (clerkSignedIn) {
    return (
      <div className="min-h-screen grid place-items-center px-6" data-testid="auth-clerk-pending">
        <div className="surface max-w-md p-6 space-y-4 text-center">
          <h1 className="text-xl font-bold">{authError ? "Couldn’t finish signing you in" : "Signing you in…"}</h1>
          {authError ? <p className="text-sm text-slate-400">{authError}</p> : null}
          <div className="flex justify-center gap-2">
            <button type="button" className="btn-primary" onClick={() => checkAuth()}>Retry</button>
            <button type="button" className="h-10 px-4 rounded-lg border border-slate-700 hover:bg-slate-800" onClick={logout}>Sign out</button>
          </div>
        </div>
      </div>
    );
  }
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
        <div className={`w-full max-w-sm rise surface p-6 ${error ? "ring-1 ring-rose-400/50" : ""}`} data-testid="auth-form-container">
          <h2 className="text-3xl font-bold tracking-tight">{mode === "login" ? "Welcome back" : "Create your studio"}</h2>
          <p className="text-sm text-slate-400 mt-2 mb-8">Build, record and share AI product demos.</p>
          <Tabs value={mode} onValueChange={(v) => { setMode(v); setError(""); }} className="mb-6">
            <TabsList className="grid grid-cols-2 w-full bg-slate-900">
              <TabsTrigger value="login" data-testid="auth-tab-login">Sign in</TabsTrigger>
              <TabsTrigger value="register" data-testid="auth-tab-register">Create account</TabsTrigger>
            </TabsList>
          </Tabs>
          {clerkEnabled ? (
            <div className="flex justify-center" data-testid="clerk-auth-widget">
              {mode === "login" ? (
                <SignIn
                  routing="hash"
                  appearance={CLERK_APPEARANCE}
                  signUpUrl="/login?mode=register"
                  fallbackRedirectUrl="/dashboard"
                />
              ) : (
                <SignUp
                  routing="hash"
                  appearance={CLERK_APPEARANCE}
                  signInUrl="/login"
                  fallbackRedirectUrl="/dashboard"
                />
              )}
            </div>
          ) : (
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
            <button type="submit" disabled={busy} data-testid="auth-submit-button" className="btn-primary w-full">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}{mode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>
          )}
        </div>
      </div>
    </div>
  );
}
