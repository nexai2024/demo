import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useAuth as useClerkAuth, useClerk } from "@clerk/react";
import { api, errMsg, setAuthTokenGetter } from "@/lib/api";
import { clerkEnabled } from "@/lib/clerk";

const AuthContext = createContext(null);

function LegacyAuthProvider({ children }) {
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

  return (
    <AuthContext.Provider value={{ user, setUser, logout, checkAuth, authProvider: "legacy", authError: null, clerkSignedIn: false }}>
      {children}
    </AuthContext.Provider>
  );
}

function ClerkAuthProvider({ children }) {
  const { isLoaded, isSignedIn, userId, getToken } = useClerkAuth();
  const clerk = useClerk();
  const [user, setUser] = useState(null);
  const [authError, setAuthError] = useState(null);
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const checkAuth = useCallback(async () => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setAuthTokenGetter(null);
      setAuthError(null);
      setUser(false);
      return;
    }
    // Use Clerk's cached JWT. skipCache:true on every axios call (preview poll,
    // thumbs, autosave) hammered /tokens and produced production 429s.
    setAuthTokenGetter(async () => {
      const token = await getTokenRef.current();
      return token || null;
    });
    try {
      const token = await getTokenRef.current();
      if (!token) {
        setAuthError("Clerk session token was empty. Try signing out and back in.");
        setUser(null);
        return;
      }
      const { data } = await api.get("/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAuthError(null);
      setUser(data);
    } catch (err) {
      const message = errMsg(err);
      setAuthError(message);
      if (err?.response?.status === 403) {
        // Ban/suspension must clear the Clerk session so we don't bounce
        // between /login and /dashboard.
        setUser(false);
        await clerk.signOut().catch(() => {});
        return;
      }
      // Keep user === null while Clerk is signed in so Protected stays on a
      // splash/error instead of sending us to /login (where <SignIn /> would
      // immediately redirect back to /dashboard and create a loop).
      setUser(null);
    }
  }, [clerk, isLoaded, isSignedIn]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth, userId]);

  const logout = useCallback(async () => {
    setAuthTokenGetter(null);
    setAuthError(null);
    await clerk.signOut().catch(() => {});
    setUser(false);
  }, [clerk]);

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        logout,
        checkAuth,
        authProvider: "clerk",
        authError,
        clerkSignedIn: Boolean(isLoaded && isSignedIn),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function AuthProvider({ children }) {
  if (clerkEnabled) return <ClerkAuthProvider>{children}</ClerkAuthProvider>;
  return <LegacyAuthProvider>{children}</LegacyAuthProvider>;
}

export const useAuth = () => useContext(AuthContext);
