"use client";

import { BrainIcon, GlobeIcon, CodeIcon, SparklesIcon } from "../ui/icons";

const features = [
  { icon: BrainIcon, title: "Multi-Agent AI", description: "9+ AI models working in parallel consensus" },
  { icon: GlobeIcon, title: "Real-time Research", description: "Web search with source verification" },
  { icon: CodeIcon, title: "Full-Stack Coding", description: "Build, preview, and deploy apps" },
  { icon: SparklesIcon, title: "Smart Modes", description: "Fast, balanced, or deep research" },
];

interface AuthLayoutProps {
  children: React.ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen w-full bg-void">
      {/* Left: Branding (desktop) */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-surface border-r border-border p-8">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <img src="/nexora-logo.png" alt="Nexora" className="h-10 w-10 rounded-full object-cover" />
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
          © 2024 Nexora. Built for the AI community.
        </div>
      </div>

      {/* Right: Auth Form */}
      <div className="flex flex-1 items-center justify-center p-6 lg:p-8">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="mb-8 flex items-center justify-center gap-3 lg:hidden">
            <img src="/nexora-logo.png" alt="Nexora" className="h-12 w-12 rounded-full object-cover" />
            <span className="text-2xl font-bold text-text">Nexora</span>
          </div>

          {children}

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
