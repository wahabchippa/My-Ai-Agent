"use client";

import { useState } from "react";
import { ClaudeLogo } from "./icons";
import { cn } from "../utils/cn";
import type { AppUser } from "../lib/useAuth";

const ADMIN_EMAILS = ["wahab.chippa@joinfleek.com", "wahabchippa@joinfleek.com"];

export function LoginModal({ onLogin }: { onLogin: (user: AppUser) => void }) {
  const [email, setEmail] = useState("");
  const [logging, setLogging] = useState(false);

  const login = async () => {
    const e = email.trim().toLowerCase();
    if (!e || !e.includes("@")) return;
    setLogging(true);
    try {
      // Call server login to create session + cookie
      await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: e }),
      });
    } catch {}
    // Always proceed with localStorage login for client
    onLogin({
      email: e,
      name: e.split("@")[0],
      isAdmin: ADMIN_EMAILS.includes(e),
    });
    setLogging(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="animate-rise mx-4 w-full max-w-sm rounded-3xl border border-line bg-cream p-8 shadow-2xl dark:border-night-surface dark:bg-night">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-coral text-white">
            <ClaudeLogo size={26} />
          </div>
          <h2 className="text-xl font-semibold text-ink dark:text-cream">
            Nexora
          </h2>
          <p className="mt-1 text-[13px] text-muted">
            Enter your email to start — your chats stay private
          </p>
        </div>

        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && login()}
          placeholder="you@example.com"
          autoFocus
          className="mb-3 w-full rounded-xl border border-line bg-cream-deep/50 px-4 py-3 text-[15px] text-ink focus:border-coral focus:outline-none dark:border-night-surface dark:bg-night-surface dark:text-cream"
        />
        <button
          onClick={login}
          disabled={!email.trim() || !email.includes("@") || logging}
          className={cn(
            "w-full rounded-xl py-3 text-[15px] font-semibold transition",
            email.trim() && email.includes("@")
              ? "bg-coral text-white hover:bg-coral-hover"
              : "cursor-not-allowed bg-cream-deep text-muted-2 dark:bg-night-surface"
          )}
        >
          {logging ? "Logging in..." : "Login"}
        </button>
        <p className="mt-4 text-center text-[11px] text-muted-2">
          No password needed · Each user gets private chats
        </p>
      </div>
    </div>
  );
}
