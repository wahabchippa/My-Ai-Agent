"use client";

import { useState, useEffect } from "react";

export interface AppUser {
  email: string;
  name: string;
  isAdmin: boolean;
}

const STORAGE_KEY = "Nexora_user";

/** Dead-simple auth: email stored in localStorage. No server, no DB, no cookies. */
export function useAuth() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setUser(JSON.parse(raw));
    } catch {}
    setLoading(false);
  }, []);

  const loginUser = (u: AppUser) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    setUser(u);
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  };

  return { user, loading, setUser: loginUser, logout };
}
