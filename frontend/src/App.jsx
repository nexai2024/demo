import "@/App.css";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { lazy, Suspense } from "react";
const AuthPage = lazy(() => import("@/pages/AuthPage"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Studio = lazy(() => import("@/pages/Studio"));
const Settings = lazy(() => import("@/pages/Settings"));
const AdminPage = lazy(() => import("@/pages/AdminPage"));
const SharePage = lazy(() => import("@/pages/SharePage"));
const ProductPage = lazy(() => import("@/pages/ProductPage"));
const ReviewPage = lazy(() => import("@/pages/ReviewPage"));
const HelpPage = lazy(() => import("@/pages/HelpPage"));
const LandingPage = lazy(() => import("@/pages/LandingPage"));
import { Loader2 } from "lucide-react";
import { ActivityDock } from "@/components/ActivityDock";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const Splash = () => (
  <div className="min-h-screen grid place-items-center" data-testid="app-loading">
    <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
  </div>
);

function Protected({ children }) {
  const { user, authError, clerkSignedIn, logout, checkAuth } = useAuth();
  if (user === null) {
    // Clerk is signed in but /auth/me failed — stay put with a recovery UI
    // instead of bouncing to /login (which redirects straight back here).
    if (clerkSignedIn && authError) {
      return (
        <div className="min-h-screen grid place-items-center px-6" data-testid="auth-sync-error">
          <div className="surface max-w-md p-6 space-y-4 text-center">
            <h1 className="text-xl font-bold">Couldn’t finish signing you in</h1>
            <p className="text-sm text-slate-400">{authError}</p>
            <div className="flex justify-center gap-2">
              <button type="button" className="btn-primary" onClick={() => checkAuth()}>Retry</button>
              <button type="button" className="h-10 px-4 rounded-lg border border-slate-700 hover:bg-slate-800" onClick={logout}>Sign out</button>
            </div>
          </div>
        </div>
      );
    }
    return <Splash />;
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function ActivityGate() {
  const { user } = useAuth();
  if (!user) return null;
  return <ActivityDock />;
}

// Per-route boundary: a crash (render error, failed lazy chunk) in one
// screen shows that route's recoverable fallback instead of unmounting
// the whole app. The root boundary in App() remains as the last resort.
const guarded = (element, label) => (
  <ErrorBoundary variant="route" label={label}>{element}</ErrorBoundary>
);

function AppRouter() {
  return (
    <Suspense fallback={<Splash />}>
    <Routes>
      <Route path="/" element={guarded(<LandingPage />, "Home")} />
      <Route path="/login" element={guarded(<AuthPage />, "Sign in")} />
      <Route path="/share/:shareId" element={guarded(<SharePage />, "Shared demo")} />
      <Route path="/p/:slug" element={guarded(<ProductPage />, "Product page")} />
      <Route path="/review/:token" element={guarded(<ReviewPage />, "Review")} />
      <Route path="/help" element={guarded(<HelpPage />, "Help")} />
      <Route path="/embed/:shareId" element={guarded(<SharePage embed />, "Embedded demo")} />
      <Route path="/dashboard" element={guarded(<Protected><Dashboard /></Protected>, "Dashboard")} />
      <Route path="/projects/:pid" element={guarded(<Protected><Studio /></Protected>, "Studio")} />
      <Route path="/settings" element={guarded(<Protected><Settings /></Protected>, "Settings")} />
      <Route path="/admin" element={guarded(<Protected><AdminPage /></Protected>, "Admin")} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <div className="App grain studio-root">
      <BrowserRouter>
        <ErrorBoundary>
          <AuthProvider>
            <AppRouter />
            <ErrorBoundary quiet label="Activity dock">
              <ActivityGate />
            </ErrorBoundary>
            <Toaster theme="dark" position="bottom-right" richColors closeButton />
          </AuthProvider>
        </ErrorBoundary>
      </BrowserRouter>
    </div>
  );
}
