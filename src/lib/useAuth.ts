"use client";

import { useState, useEffect, useCallback } from "react";

export interface AppUser {
  id: number;
  email: string;
  name: string;
  role: string;
  plan: string;
  isAdmin: boolean;
  avatarUrl?: string | null;
}

const CACHE_KEY = "nexora_user_cache";

/**
 * useAuth — validates the session against the server on every mount.
 * localStorage is ONLY a cache for instant UI rendering; the server
 * cookie is the real authentication proof.
 */
export function useAuth() {
  // Cached user ko effect me set karne ke bajaye lazily init karo —
  // same result (instant UI), lekin effect me sync setState nahi
  // (react-hooks/set-state-in-effect lint fix).
  const [user, setUserState] = useState<AppUser | null>(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.email) return parsed as AppUser;
      }
    } catch {}
    return null;
  });
  const [loading, setLoading] = useState(true);

  // On mount: show cached user instantly, then verify with server
  useEffect(() => {
    let cancelled = false;

    // 2. Verify session with server (source of truth)
    fetch("/api/auth/me", { credentials: "include" })
      .then(async (res) => {
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            const u: AppUser = {
              id: data.user.id,
              email: data.user.email,
              name: data.user.name || data.user.email.split("@")[0],
              role: data.user.role,
              plan: data.user.plan,
              isAdmin: data.user.role === "admin" || data.user.role === "super_admin",
              avatarUrl: data.user.avatarUrl || null,
            };
            localStorage.setItem(CACHE_KEY, JSON.stringify(u));
            setUserState(u);
          } else {
            // Server says no session — clear everything
            localStorage.removeItem(CACHE_KEY);
            setUserState(null);
          }
        } else {
          localStorage.removeItem(CACHE_KEY);
          setUserState(null);
        }
      })
      .catch(() => {
        // Network error — keep cached user if any, don't log out
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  const setUser = useCallback((u: AppUser) => {
    localStorage.setItem(CACHE_KEY, JSON.stringify(u));
    setUserState(u);
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {}
    localStorage.removeItem(CACHE_KEY);
    setUserState(null);
    // ⚠ Poora page dobara load karna ZAROORI hai.
    // StoreProvider apna userId sirf mount par /api/auth/me se leta hai.
    // Bina reload ke wo purane user ki chat memory me pakre rehta, aur
    // agla login karne wala wohi chat dekhta — bilkul wohi shakayat.
    // (Har user ka localStorage apni key par mehfooz rehta hai, mit'ta nahi.)
    if (typeof window !== "undefined") window.location.href = "/";
  }, []);

  return { user, loading, setUser, logout };
}
