import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null = checking, false = signed out

  const checkAuth = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
    } catch {
      try {
        await api.post("/auth/refresh");
        const { data } = await api.get("/auth/me");
        setUser(data);
      } catch {
        setUser(false);
      }
    }
  }, []);

  useEffect(() => {
    // Returning from Google OAuth: AuthCallback establishes the session first.
    if (window.location.hash?.includes("session_id=")) return;
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (!user) return;
    const t = setInterval(() => api.post("/auth/refresh").catch(() => {}), 10 * 60 * 1000);
    return () => clearInterval(t);
  }, [user]);

  const logout = async () => {
    await api.post("/auth/logout").catch(() => {});
    setUser(false);
  };

  return <AuthContext.Provider value={{ user, setUser, logout, checkAuth }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
