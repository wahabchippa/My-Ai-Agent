"use client";

import { useState, useEffect } from "react";
import { StoreProvider } from "./lib/store";
import { useAuth } from "./lib/useAuth";
import { Navigation } from "./components/layout/Navigation";
import { Sidebar } from "./components/layout/Sidebar";
import { TopBar } from "./components/layout/TopBar";
import { AuthScreen } from "./components/auth/AuthScreen";
import { ChatInterface } from "./components/chat/ChatInterface";
import { AdminDashboard } from "./components/admin/AdminDashboard";
import { cn } from "./utils/cn";

export type ViewType = "chat" | "projects" | "workspace" | "admin" | "settings";

function AppShell() {
  const { user, loading, logout } = useAuth();
  const [view, setView] = useState<ViewType>("chat");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("light");

  // Apply theme
  useEffect(() => {
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(theme);
  }, [theme]);

  // Load saved theme
  useEffect(() => {
    const saved = localStorage.getItem("nexora-theme") as "dark" | "light" | null;
    if (saved) setTheme(saved);
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("nexora-theme", next);
  };

  // Loading
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
    return <AuthScreen />;
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-void text-text">
      {/* Navigation Rail */}
      <Navigation
        view={view}
        onViewChange={setView}
        isAdmin={user.isAdmin}
        theme={theme}
        onToggleTheme={toggleTheme}
        onLogout={logout}
      />

      {/* Sidebar */}
      <Sidebar
        view={view}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />

      {/* Main Content */}
      <main className="flex min-w-0 flex-1 flex-col">
        <TopBar
          user={user}
          view={view}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          onOpenMobileNav={() => setMobileNavOpen(true)}
        />

        <div className="flex-1 overflow-hidden">
          {view === "chat" && <ChatInterface />}
          {view === "admin" && user.isAdmin && <AdminDashboard email={user.email} />}
          {view === "projects" && <ComingSoon title="Projects" />}
          {view === "workspace" && <ComingSoon title="Coding Workspace" />}
          {view === "settings" && <ComingSoon title="Settings" />}
        </div>
      </main>

      {/* Mobile Nav Overlay */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full w-72 bg-surface border-r border-border animate-slide-up">
            <Navigation
              view={view}
              onViewChange={(v) => {
                setView(v);
                setMobileNavOpen(false);
              }}
              isAdmin={user.isAdmin}
              theme={theme}
              onToggleTheme={toggleTheme}
              onLogout={logout}
              expanded
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ComingSoon({ title }: { title: string }) {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <div className="text-5xl mb-4">🚀</div>
        <h2 className="text-xl font-semibold text-text mb-2">{title}</h2>
        <p className="text-text-secondary">Coming soon...</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <AppShell />
    </StoreProvider>
  );
}
