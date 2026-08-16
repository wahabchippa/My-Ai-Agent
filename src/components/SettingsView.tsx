"use client";

import { useEffect, useState } from "react";
import { cn } from "../utils/cn";

interface Props {
  onOpenSidebar?: () => void;
}

export function SettingsView({ onOpenSidebar }: Props) {
  const [user, setUser] = useState<any>(null);
  const [theme, setTheme] = useState<string>("light");
  // Nexora Brain — user ko dikhna chahiye ke yaadasht me kya hai, aur
  // ghalat yaad mitane ka raasta bhi ho. Warna wo "jadoo ka dabba" hai.
  const [brain, setBrain] = useState<{
    stats: { count: number; chars: number; oldest: string | null };
    items: { id: number; question: string; preview: string; chars: number; source: string; at: string }[];
  } | null>(null);
  const [brainOpen, setBrainOpen] = useState(false);

  const loadBrain = () => {
    fetch("/api/brain", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => d.ok && setBrain({ stats: d.stats, items: d.items }))
      .catch(() => {});
  };

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setUser(d.user))
      .catch(() => {});
    setTheme(localStorage.getItem("nexora-theme") || "light");
    loadBrain();
  }, []);

  const forget = async (id: number | "all") => {
    await fetch(`/api/brain?id=${id}`, { method: "DELETE", credentials: "include" }).catch(() => {});
    loadBrain();
  };

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
          {/* Nexora Brain */}
          <div className="rounded-xl border border-line bg-cream-surface p-4 dark:border-night-surface dark:bg-night-surface">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-ink dark:text-cream">🧠 Nexora Brain</span>
              <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[10.5px] font-medium text-violet-600 dark:text-violet-400">
                {brain?.stats.count ?? 0} yaadein
              </span>
            </div>
            <p className="mb-3 text-xs text-muted">
              Har achha jawab yahan mehfooz hota hai. Agla waisa sawal aaye to jawab
              Nexora ki apni yaadasht se aata hai — koi API call nahi, koi intezar nahi.
            </p>

            {brain && brain.stats.count > 0 ? (
              <>
                <div className="mb-3 flex gap-4 text-[11.5px] text-muted">
                  <span>
                    <b className="text-ink dark:text-cream">{brain.stats.count}</b> jawab
                  </span>
                  <span>
                    <b className="text-ink dark:text-cream">
                      {(brain.stats.chars / 1000).toFixed(1)}k
                    </b>{" "}
                    characters
                  </span>
                </div>

                {brainOpen && (
                  <div className="mb-3 max-h-64 space-y-1.5 overflow-y-auto">
                    {brain.items.map((it) => (
                      <div
                        key={it.id}
                        className="group rounded-lg border border-line px-2.5 py-2 dark:border-night-surface"
                      >
                        <div className="flex items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[12px] font-medium text-ink dark:text-cream">
                              {it.question}
                            </div>
                            <div className="line-clamp-2 text-[11px] text-muted">{it.preview}</div>
                            <div className="mt-0.5 text-[10px] text-muted-2">
                              {it.source} · {new Date(it.at).toLocaleDateString()}
                            </div>
                          </div>
                          <button
                            onClick={() => forget(it.id)}
                            title="Ye yaad mita do"
                            className="shrink-0 rounded px-1.5 py-0.5 text-[11px] text-muted opacity-0 transition hover:bg-rose-500/10 hover:text-rose-500 group-hover:opacity-100"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => setBrainOpen((v) => !v)}
                    className="rounded-lg border border-line px-3 py-1.5 text-[12px] font-medium text-ink-soft transition hover:border-coral/40 hover:text-coral dark:border-night-surface dark:text-cream/80"
                  >
                    {brainOpen ? "Chhupao" : "Dekho"}
                  </button>
                  <button
                    onClick={() => {
                      if (confirm("Poori yaadasht mit jayegi. Pakka?")) forget("all");
                    }}
                    className="rounded-lg border border-rose-500/30 px-3 py-1.5 text-[12px] font-medium text-rose-500 transition hover:bg-rose-500/10"
                  >
                    Sab bhool jao
                  </button>
                </div>
              </>
            ) : (
              <p className="text-[11.5px] text-muted-2">
                Abhi khali hai. Chat karte raho — Nexora khud seekhta jayega.
              </p>
            )}
          </div>

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
