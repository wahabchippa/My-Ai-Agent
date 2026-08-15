"use client";

import { useState } from "react";
import { NexoraLogo, SparklesIcon, BrainIcon, CodeIcon, GlobeIcon } from "../ui/icons";
import { useAuth } from "@/lib/useAuth";
import { cn } from "@/utils/cn";

const ADMIN_EMAILS = ["wahab.chippa@joinfleek.com", "wahabchippa@joinfleek.com"];

const features = [
  { icon: BrainIcon, title: "Multi-Agent AI", description: "9+ AI models working in parallel" },
  { icon: GlobeIcon, title: "Web Research", description: "Real-time search & verification" },
  { icon: CodeIcon, title: "Code Workspace", description: "Edit, preview, and deploy" },
  { icon: SparklesIcon, title: "Smart Modes", description: "Fast, balanced, or deep research" },
];

export function LoginScreen() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const { setUser } = useAuth();

  const handleLogin = async () => {
    const e = email.trim().toLowerCase();
    if (!e || !e.includes("@")) return;

    setLoading(true);
    try {
      // Create server session
      await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: e }),
      });
    } catch {}

    // Set local user
    setUser({
      email: e,
      name: e.split("@")[0],
      isAdmin: ADMIN_EMAILS.includes(e),
    });
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen w-full bg-void">
      {/* Left: Branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-surface border-r border-border p-8">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <NexoraLogo size={40} />
          <div>
            <span className="text-xl font-bold text-text">Nexora</span>
            <span className="ml-2 text-xs text-text-muted">AI Platform</span>
          </div>
        </div>

        {/* Features */}
        <div className="flex-1 flex flex-col justify-center max-w-md">
          <h2 className="text-3xl font-bold text-text mb-2">
            Your AI-powered
            <span className="gradient-text"> workspace</span>
          </h2>
          <p className="text-text-secondary mb-8">
            Multiple AI agents working together. Real-time research. Code generation. All in one place.
          </p>

          <div className="grid grid-cols-2 gap-4">
            {features.map((feature, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-xl border border-border bg-elevated p-4 transition hover:border-accent-soft"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-soft text-accent">
                  <feature.icon size={20} />
                </div>
                <div>
                  <div className="text-sm font-semibold text-text">{feature.title}</div>
                  <div className="text-xs text-text-muted">{feature.description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="text-xs text-text-dim">
          © 2024 Nexora. Built with ❤️ for the AI community.
        </div>
      </div>

      {/* Right: Login Form */}
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="w-full max-w-sm">
          {/* Mobile Logo */}
          <div className="mb-8 flex items-center justify-center gap-3 lg:hidden">
            <NexoraLogo size={48} />
            <div>
              <span className="text-2xl font-bold text-text">Nexora</span>
            </div>
          </div>

          {/* Form */}
          <div className="rounded-2xl border border-border bg-surface p-8 shadow-lg">
            <div className="mb-6 text-center">
              <h1 className="text-xl font-bold text-text mb-1">Welcome back</h1>
              <p className="text-sm text-text-secondary">
                Enter your email to start
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  Email address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  placeholder="you@example.com"
                  autoFocus
                  className="input"
                  disabled={loading}
                />
              </div>

              <button
                onClick={handleLogin}
                disabled={!email.trim() || !email.includes("@") || loading}
                className={cn(
                  "btn w-full py-3",
                  email.trim() && email.includes("@")
                    ? "btn-primary"
                    : "bg-subtle text-text-muted cursor-not-allowed"
                )}
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-void/20 border-t-void" />
                    Signing in...
                  </div>
                ) : (
                  "Continue"
                )}
              </button>
            </div>

            <p className="mt-6 text-center text-xs text-text-dim">
              No password needed · Your chats stay private
            </p>
          </div>

          {/* AI Status */}
          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-text-muted">
            <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
            <span>9+ AI models ready</span>
            <span className="text-text-dim">·</span>
            <span>Multi-agent consensus</span>
          </div>
        </div>
      </div>
    </div>
  );
}
