"use client";

import { useState } from "react";
import { MenuIcon, BellIcon, ChevronDownIcon, SparklesIcon, BoltIcon, TargetIcon, ZapIcon } from "../ui/icons";
import { cn } from "@/utils/cn";
import type { ViewType } from "./Shell";
import type { AppUser } from "@/lib/useAuth";

interface TopBarProps {
  user: AppUser;
  view: ViewType;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onOpenMobileNav: () => void;
}

type AIMode = "fast" | "balanced" | "deep" | "code";

const modes: { id: AIMode; label: string; icon: React.FC<{ size?: number; className?: string }>; description: string; color: string }[] = [
  { id: "fast", label: "Fast", icon: ZapIcon, description: "Quick responses, 1-2 agents", color: "text-success" },
  { id: "balanced", label: "Balanced", icon: TargetIcon, description: "Multiple agents, web search", color: "text-accent" },
  { id: "deep", label: "Deep Research", icon: SparklesIcon, description: "Full pipeline, verification", color: "text-nebula" },
  { id: "code", label: "Coding", icon: BoltIcon, description: "Code-focused agents", color: "text-warning" },
];

export function TopBar({ user, view, sidebarOpen, onToggleSidebar, onOpenMobileNav }: TopBarProps) {
  const [mode, setMode] = useState<AIMode>("balanced");
  const [modeOpen, setModeOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const currentMode = modes.find((m) => m.id === mode)!;

  const viewTitles: Record<ViewType, string> = {
    chat: "AI Chat",
    projects: "Projects",
    workspace: "Coding Workspace",
    settings: "Settings",
    admin: "Admin Dashboard",
  };

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-surface px-3 lg:px-4">
      {/* Left: Mobile menu + Title */}
      <div className="flex items-center gap-3">
        {/* Mobile menu button */}
        <button
          onClick={onOpenMobileNav}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary hover:bg-subtle hover:text-text transition lg:hidden"
        >
          <MenuIcon size={20} />
        </button>

        {/* Sidebar toggle (desktop) */}
        {!sidebarOpen && (
          <button
            onClick={onToggleSidebar}
            className="hidden lg:flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary hover:bg-subtle hover:text-text transition"
          >
            <MenuIcon size={20} />
          </button>
        )}

        {/* View title */}
        <div>
          <h1 className="text-sm font-semibold text-text">{viewTitles[view]}</h1>
          {view === "chat" && (
            <p className="text-[11px] text-text-muted">Powered by multi-agent consensus</p>
          )}
        </div>
      </div>

      {/* Center: Mode Selector (chat view only) */}
      {view === "chat" && (
        <div className="hidden md:block relative">
          <button
            onClick={() => setModeOpen(!modeOpen)}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-3 py-1.5 transition",
              modeOpen
                ? "border-accent bg-accent-soft"
                : "border-border bg-subtle hover:border-border-glow"
            )}
          >
            <currentMode.icon size={16} className={currentMode.color} />
            <span className="text-sm font-medium text-text">{currentMode.label}</span>
            <ChevronDownIcon size={14} className="text-text-muted" />
          </button>

          {/* Mode Dropdown */}
          {modeOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setModeOpen(false)}
              />
              <div className="absolute left-1/2 top-full z-50 mt-2 w-64 -translate-x-1/2 rounded-xl border border-border bg-elevated p-2 shadow-lg animate-scale-in">
                {modes.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      setMode(m.id);
                      setModeOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition",
                      mode === m.id
                        ? "bg-accent-soft"
                        : "hover:bg-subtle"
                    )}
                  >
                    <div className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-lg",
                      mode === m.id ? "bg-accent text-void" : "bg-subtle text-text-secondary"
                    )}>
                      <m.icon size={18} />
                    </div>
                    <div className="flex-1">
                      <div className={cn(
                        "text-sm font-medium",
                        mode === m.id ? "text-accent" : "text-text"
                      )}>
                        {m.label}
                      </div>
                      <div className="text-[11px] text-text-muted">{m.description}</div>
                    </div>
                    {mode === m.id && (
                      <div className="h-2 w-2 rounded-full bg-accent" />
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {/* Notifications */}
        <button
          onClick={() => setNotificationsOpen(!notificationsOpen)}
          className="relative flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary hover:bg-subtle hover:text-text transition"
        >
          <BellIcon size={18} />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-accent animate-pulse" />
        </button>

        {/* User Avatar */}
        <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-subtle transition cursor-pointer">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-accent to-nebula text-sm font-semibold text-void">
            {user.email[0].toUpperCase()}
          </div>
          <div className="hidden sm:block">
            <div className="text-sm font-medium text-text">{user.name}</div>
            <div className="text-[11px] text-text-muted">
              {user.isAdmin ? "Admin" : "Free Plan"}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
