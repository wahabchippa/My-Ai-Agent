"use client";

import { useEffect, useState } from "react";
import { cn } from "../utils/cn";

interface Props {
  onOpenSidebar?: () => void;
}

export function SettingsView({ onOpenSidebar }: Props) {
  const [user, setUser] = useState<any>(null);
  const [theme, setTheme] = useState<string>("light");

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setUser(d.user))
      .catch(() => {});
    setTheme(localStorage.getItem("nexora-theme") || "light");
  }, []);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("nexora-theme", next);
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(next);
  };

  return (
    <div className="flex h-full flex-col bg-cream dark:bg-night">
      <header className="flex items-center gap-2 px-3 py-2.5 sm:px-5">
        <button
          onClick={onOpenSidebar}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-soft transition hover:bg-cream-deep lg:hidden dark:text-cream"
        >
          ☰
        </button>
        <div>
          <div className="text-[15px] font-semibold text-ink dark:text-cream">Settings</div>
          <div className="text-[11px] text-muted">Account & preferences</div>
        </div>
      </header>

      <div className="flex-1 overflow-auto px-3 pb-4 sm:px-5">
        <div className="max-w-xl space-y-4">
          {/* Appearance */}
          <div className="rounded-xl border border-line bg-cream-surface p-4 dark:border-night-surface dark:bg-night-surface">
            <div className="text-sm font-semibold text-ink dark:text-cream">Appearance</div>
            <p className="mb-3 text-xs text-muted">Switch between light and dark theme.</p>
            <button
              onClick={toggleTheme}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-medium transition",
                "bg-coral text-white hover:bg-coral-hover"
              )}
            >
              {theme === "light" ? "🌙 Switch to Dark" : "☀️ Switch to Light"}
            </button>
          </div>

          {/* Account */}
          <div className="rounded-xl border border-line bg-cream-surface p-4 dark:border-night-surface dark:bg-night-surface">
            <div className="mb-3 text-sm font-semibold text-ink dark:text-cream">Account</div>
            {user ? (
              <div className="space-y-2 text-sm">
                <div><span className="text-muted">Name:</span> <span className="text-ink dark:text-cream">{user.name || "—"}</span></div>
                <div><span className="text-muted">Email:</span> <span className="text-ink dark:text-cream">{user.email}</span></div>
                <div><span className="text-muted">Plan:</span> <span className="text-ink dark:text-cream">{user.plan}</span></div>
                <div><span className="text-muted">Credits:</span> <span className="text-ink dark:text-cream">{user.credits}</span></div>
              </div>
            ) : (
              <p className="text-xs text-muted">Loading account info...</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
