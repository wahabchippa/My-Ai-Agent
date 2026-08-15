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
      // Clear server session
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    localStorage.removeItem(STORAGE_KEY);
    setUserState(null);
  }, []);

  return { user, loading, setUser, logout };
}
