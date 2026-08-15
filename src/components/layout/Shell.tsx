"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/useAuth";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { LoginScreen } from "../auth/LoginScreen";
import { cn } from "@/utils/cn";

export type ViewType = "chat" | "projects" | "workspace" | "admin" | "settings";

interface ShellProps {
  children?: React.ReactNode;
}

export function Shell({ children }: ShellProps) {
  const { user, loading, logout } = useAuth();
  const [view, setView] = useState<ViewType>("chat");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  // Apply theme to document
  useEffect(() => {
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(theme);
  }, [theme]);

  // Load theme from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("nexora-theme") as "dark" | "light" | null;
    if (saved) setTheme(saved);
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("nexora-theme", next);
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-void">
        <div className="flex flex-col items-center gap-4">
          <div className="relative h-12 w-12">
            <div className="absolute inset-0 rounded-full border-2 border-accent/20" />
            <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-accent" />
          </div>
          <span className="text-sm text-text-secondary">Loading Nexora...</span>
        </div>
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return <LoginScreen />;
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-void text-text">
      {/* Unified Sidebar */}
      <Sidebar
        view={view}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onViewChange={setView}
        isAdmin={user.isAdmin}
        theme={theme}
        onToggleTheme={toggleTheme}
        onLogout={logout}
      />

      {/* Main Content Area */}
      <main className="flex min-w-0 flex-1 flex-col">
        {/* Top Bar */}
        <TopBar
          user={user}
          view={view}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          onOpenMobileNav={() => setMobileNavOpen(true)}
        />

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {children}
        </div>
      </main>

      {/* Mobile Navigation Overlay */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full w-72 bg-surface border-r border-border animate-slide-up">
            <Sidebar
              view={view}
              isOpen
              onToggle={() => setMobileNavOpen(false)}
              onViewChange={(v) => {
                setView(v);
                setMobileNavOpen(false);
              }}
              isAdmin={user.isAdmin}
              theme={theme}
              onToggleTheme={toggleTheme}
              onLogout={logout}
            />
          </div>
        </div>
      )}
    </div>
  );
}
