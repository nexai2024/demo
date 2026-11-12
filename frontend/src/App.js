import "@/App.css";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { lazy, Suspense } from "react";
import AuthCallback from "@/pages/AuthCallback";

const AuthPage = lazy(() => import("@/pages/AuthPage"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Studio = lazy(() => import("@/pages/Studio"));
const Settings = lazy(() => import("@/pages/Settings"));
const SharePage = lazy(() => import("@/pages/SharePage"));
import { Loader2 } from "lucide-react";

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

function AppRouter() {
  const location = useLocation();
  if (location.hash?.includes("session_id=")) return <AuthCallback />;
  return (
    <Suspense fallback={<Splash />}>
    <Routes>
      <Route path="/login" element={<AuthPage />} />
      <Route path="/share/:shareId" element={<SharePage />} />
      <Route path="/embed/:shareId" element={<SharePage embed />} />
      <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
      <Route path="/projects/:pid" element={<Protected><Studio /></Protected>} />
      <Route path="/settings" element={<Protected><Settings /></Protected>} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <div className="App grain">
      <BrowserRouter>
        <AuthProvider>
          <AppRouter />
          <Toaster theme="dark" position="bottom-right" richColors />
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}
