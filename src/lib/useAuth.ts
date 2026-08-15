"use client";

import { useState, useEffect, useCallback } from "react";

export interface AppUser {
  email: string;
  name: string;
  isAdmin: boolean;
}

const STORAGE_KEY = "nexora_user";

export function useAuth() {
  const [user, setUserState] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Load user from localStorage on mount
  useEffect(() => {
    try {
      // 1. Check for OAuth bootstrap cookie first
      if (typeof document !== "undefined") {
        const bootstrapCookie = document.cookie
          .split("; ")
          .find((c) => c.startsWith("nexora_user_bootstrap="));
        if (bootstrapCookie) {
          try {
            const val = decodeURIComponent(bootstrapCookie.split("=").slice(1).join("="));
            const parsed = JSON.parse(val);
            const user: AppUser = {
              email: parsed.email,
              name: parsed.name || parsed.email?.split("@")[0] || "",
              isAdmin: !!parsed.isAdmin,
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
            setUserState(user);
            // Clear bootstrap cookie
            document.cookie = "nexora_user_bootstrap=; path=/; max-age=0";
            setLoading(false);
            return;
          } catch {}
        }
      }

      // 2. Read from localStorage
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setUserState(parsed);
      }
    } catch {}
    setLoading(false);
  }, []);

  const setUser = useCallback((u: AppUser) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    setUserState(u);
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    localStorage.removeItem(STORAGE_KEY);
    setUserState(null);
  }, []);

  return { user, loading, setUser, logout };
}
