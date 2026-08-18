"use client";

import { useState } from "react";
import { StoreProvider, useStore } from "./lib/store";
import { useAuth } from "./lib/useAuth";
import { Sidebar } from "./components/layout/Sidebar";
import { TopBar } from "./components/layout/TopBar";
import { AuthScreen } from "./components/auth/AuthScreen";
import { ChatView } from "./components/ChatView";
import { WorkspaceView } from "./components/WorkspaceView";
import { SettingsView } from "./components/SettingsView";
import { StudioView } from "./components/StudioView";
import { AdminDashboard } from "./components/admin/AdminDashboard";
import { cn } from "./utils/cn";

export type ViewType = "chat" | "workspace" | "studio" | "admin" | "settings";

function AppShell() {
  const { user, loading, logout } = useAuth();
  const { theme, toggleTheme } = useStore();
  const [view, setView] = useState<ViewType>("chat");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const openNav = () => setMobileNavOpen(true);

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
      {/* Unified Sidebar: nav + conversations */}
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
          {view === "chat" && <ChatView onOpenSidebar={openNav} />}
          {view === "admin" && user.isAdmin && <AdminDashboard email={user.email} />}
          {view === "workspace" && <WorkspaceView onOpenSidebar={openNav} />}
          {view === "studio" && <StudioView onOpenSidebar={openNav} />}
          {view === "settings" && <SettingsView onOpenSidebar={openNav} />}
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
            <Sidebar
              view={view}
              isOpen
              embedded
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

export default function App() {
  return (
    <StoreProvider>
      <AppShell />
    </StoreProvider>
  );
}
