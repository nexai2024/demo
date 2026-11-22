import "@/App.css";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { lazy, Suspense } from "react";
const AuthPage = lazy(() => import("@/pages/AuthPage"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Studio = lazy(() => import("@/pages/Studio"));
const Settings = lazy(() => import("@/pages/Settings"));
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
  const { user } = useAuth();
  if (user === null) return <Splash />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function ActivityGate() {
  const { user } = useAuth();
  if (!user) return null;
  return <ActivityDock />;
}

function AppRouter() {
  return (
    <Suspense fallback={<Splash />}>
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<AuthPage />} />
      <Route path="/share/:shareId" element={<SharePage />} />
      <Route path="/p/:slug" element={<ProductPage />} />
      <Route path="/review/:token" element={<ReviewPage />} />
      <Route path="/help" element={<HelpPage />} />
      <Route path="/embed/:shareId" element={<SharePage embed />} />
      <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
      <Route path="/projects/:pid" element={<Protected><Studio /></Protected>} />
      <Route path="/settings" element={<Protected><Settings /></Protected>} />
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
            <ActivityGate />
            <Toaster theme="dark" position="bottom-right" richColors closeButton />
          </AuthProvider>
        </ErrorBoundary>
      </BrowserRouter>
    </div>
  );
}
