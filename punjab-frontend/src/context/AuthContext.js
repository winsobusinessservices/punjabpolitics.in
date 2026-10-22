"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { AUTH_SESSION_EXPIRED_EVENT, authApi } from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const data = await authApi.me();
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Hydrate the client auth context from the backend session cookie.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    const clearExpiredSession = () => {
      setUser(null);
      setLoading(false);
    };
    window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, clearExpiredSession);
    return () => window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, clearExpiredSession);
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, setUser, refreshUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
