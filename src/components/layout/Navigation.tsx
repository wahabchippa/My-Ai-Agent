"use client";

import { ChatIcon, FolderIcon, CodeIcon, SettingsIcon, ShieldIcon, SunIcon, MoonIcon, LogOutIcon, HistoryIcon, HelpCircleIcon } from "../ui/icons";
import { cn } from "@/utils/cn";
import type { ViewType } from "./Shell";

interface NavigationProps {
  view: ViewType;
  onViewChange: (view: ViewType) => void;
  isAdmin?: boolean;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  onLogout: () => void;
  expanded?: boolean;
}

interface NavItem {
  id: ViewType;
  label: string;
  icon: React.FC<{ size?: number }>;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { id: "chat", label: "Chat", icon: ChatIcon },
  { id: "projects", label: "Projects", icon: FolderIcon },
  { id: "workspace", label: "Workspace", icon: CodeIcon },
  { id: "settings", label: "Settings", icon: SettingsIcon },
  { id: "admin", label: "Admin", icon: ShieldIcon, adminOnly: true },
];

export function Navigation({
  view,
  onViewChange,
  isAdmin,
  theme,
  onToggleTheme,
  onLogout,
  expanded,
}: NavigationProps) {
  const filteredItems = navItems.filter((item) => !item.adminOnly || isAdmin);

  return (
    <nav
      className={cn(
        "flex flex-col bg-surface border-r border-border",
        expanded ? "w-56" : "w-16"
      )}
    >
      {/* Logo */}
      <div className={cn(
        "flex items-center gap-3 border-b border-border",
        expanded ? "px-4 py-4" : "justify-center py-4"
      )}>
        <div className="relative">
          <img src="/nexora-logo.png" alt="Nexora" className="h-8 w-8 rounded-full object-cover" />
          <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-success ring-2 ring-surface" />
        </div>
        {expanded && (
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-text">Nexora</span>
            <span className="text-[10px] text-text-muted">AI Workspace</span>
          </div>
        )}
      </div>

      {/* Main Nav Items */}
      <div className="flex-1 py-3">
        <div className={cn("space-y-1", expanded ? "px-2" : "px-2")}>
          {filteredItems.map((item) => {
            const isActive = view === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id)}
                className={cn(
                  "group flex items-center gap-3 rounded-lg transition-all duration-150",
                  expanded
                    ? "w-full px-3 py-2.5 text-left"
                    : "mx-auto h-11 w-11 justify-center",
                  isActive
                    ? "bg-accent-soft text-accent"
                    : "text-text-secondary hover:bg-subtle hover:text-text"
                )}
                title={expanded ? undefined : item.label}
              >
                <Icon size={20} />
                {expanded && (
                  <span className="text-sm font-medium">{item.label}</span>
                )}
                {isActive && !expanded && (
                  <div className="absolute right-0 h-6 w-1 rounded-l-full bg-accent" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom Actions */}
      <div className={cn(
        "border-t border-border py-3",
        expanded ? "px-2 space-y-1" : "px-2 space-y-1"
      )}>
        {/* Help */}
        <button
          className={cn(
            "flex items-center gap-3 rounded-lg text-text-secondary hover:bg-subtle hover:text-text transition-all",
            expanded ? "w-full px-3 py-2" : "mx-auto h-10 w-10 justify-center"
          )}
          title="Help"
        >
          <HelpCircleIcon size={18} />
          {expanded && <span className="text-sm">Help</span>}
        </button>

        {/* Theme Toggle */}
        <button
          onClick={onToggleTheme}
          className={cn(
            "flex items-center gap-3 rounded-lg text-text-secondary hover:bg-subtle hover:text-text transition-all",
            expanded ? "w-full px-3 py-2" : "mx-auto h-10 w-10 justify-center"
          )}
          title={theme === "dark" ? "Light mode" : "Dark mode"}
        >
          {theme === "dark" ? <SunIcon size={18} /> : <MoonIcon size={18} />}
          {expanded && (
            <span className="text-sm">{theme === "dark" ? "Light" : "Dark"}</span>
          )}
        </button>

        {/* Logout */}
        <button
          onClick={onLogout}
          className={cn(
            "flex items-center gap-3 rounded-lg text-text-secondary hover:bg-danger-soft hover:text-danger transition-all",
            expanded ? "w-full px-3 py-2" : "mx-auto h-10 w-10 justify-center"
          )}
          title="Log out"
        >
          <LogOutIcon size={18} />
          {expanded && <span className="text-sm">Log out</span>}
        </button>
      </div>
    </nav>
  );
}
