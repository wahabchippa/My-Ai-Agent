"use client";

import { MenuIcon, BellIcon } from "../ui/icons";
import type { ViewType } from "@/App";
import type { AppUser } from "@/lib/useAuth";

interface TopBarProps {
  user: AppUser;
  view: ViewType;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onOpenMobileNav: () => void;
}

export function TopBar({ user, view, sidebarOpen, onToggleSidebar, onOpenMobileNav }: TopBarProps) {
  const viewTitles: Record<ViewType, string> = {
    chat: "AI Chat",
    workspace: "Project Builder",
    studio: "Studio",
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

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {/* Notifications */}
        <button
          className="relative flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary hover:bg-subtle hover:text-text transition"
          title="Notifications"
        >
          <BellIcon size={18} />
        </button>

        {/* User Avatar */}
        <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-subtle transition cursor-pointer">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-accent to-nebula text-sm font-semibold text-void">
            {user.email[0].toUpperCase()}
          </div>
          <div className="hidden sm:block">
            <div className="text-sm font-medium text-text">{user.name}</div>
            <div className="text-[11px] text-text-muted capitalize">
              {user.isAdmin ? "Admin" : `${user.plan} Plan`}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
