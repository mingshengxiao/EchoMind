"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { api } from "@/lib/api";
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedUser = window.localStorage.getItem("echomind-user");
    const storedGuest = window.localStorage.getItem("echomind-guest") === "true";
    if (storedUser) setUser(JSON.parse(storedUser));
    setIsGuest(storedGuest);
    setIsLoading(false);
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
        window.localStorage.removeItem("echomind-token");
        window.localStorage.removeItem("echomind-user");
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
