"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { AUTH_UNAUTHORIZED_EVENT, ApiError, api } from "@/lib/api";
import type { User } from "@/types";

interface AuthContextValue {
  user: User | null;
  isGuest: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (payload: { username: string; password: string; email?: string }) => Promise<void>;
  logout: () => void;
  continueAsGuest: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function clearStoredAuth() {
  window.localStorage.removeItem("echomind-token");
  window.localStorage.removeItem("echomind-user");
  window.localStorage.removeItem("echomind-guest");
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isActive = true;

    const handleUnauthorized = () => {
      clearStoredAuth();
      if (!isActive) return;
      setUser(null);
      setIsGuest(false);
    };

    async function restoreSession() {
      const storedToken = window.localStorage.getItem("echomind-token");
      const storedGuest = window.localStorage.getItem("echomind-guest") === "true";

      if (!storedToken) {
        window.localStorage.removeItem("echomind-user");
        if (isActive) {
          setUser(null);
          setIsGuest(storedGuest);
          setIsLoading(false);
        }
        return;
      }

      try {
        const currentUser = await api.me();
        if (!isActive) return;
        window.localStorage.setItem("echomind-user", JSON.stringify(currentUser));
        window.localStorage.removeItem("echomind-guest");
        setUser(currentUser);
        setIsGuest(false);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          handleUnauthorized();
          return;
        }
        if (!isActive) return;
        setUser(null);
        setIsGuest(false);
      } finally {
        if (isActive) setIsLoading(false);
      }
    }

    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
    void restoreSession();

    return () => {
      isActive = false;
      window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isGuest,
      isLoading,
      login: async (username, password) => {
        const response = await api.login({ username, password });
        window.localStorage.setItem("echomind-token", response.access_token);
        window.localStorage.setItem("echomind-user", JSON.stringify(response.user));
        window.localStorage.removeItem("echomind-guest");
        setUser(response.user);
        setIsGuest(false);
      },
      register: async (payload) => {
        const response = await api.register(payload);
        window.localStorage.setItem("echomind-token", response.access_token);
        window.localStorage.setItem("echomind-user", JSON.stringify(response.user));
        window.localStorage.removeItem("echomind-guest");
        setUser(response.user);
        setIsGuest(false);
      },
      logout: () => {
        clearStoredAuth();
        setUser(null);
        setIsGuest(false);
      },
      continueAsGuest: () => {
        window.localStorage.removeItem("echomind-token");
        window.localStorage.removeItem("echomind-user");
        window.localStorage.setItem("echomind-guest", "true");
        setUser(null);
        setIsGuest(true);
      },
    }),
    [isGuest, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
