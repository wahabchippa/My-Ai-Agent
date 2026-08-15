"use client";

import { useState } from "react";
import { StoreProvider } from "./lib/store";
import { useAuth } from "./lib/useAuth";
import { Sidebar } from "./components/Sidebar";
import { ChatView } from "./components/ChatView";
import { AdminView } from "./components/AdminView";
import { LoginModal } from "./components/LoginModal";
import { CloseIcon } from "./components/icons";

function Shell() {
  const [view, setView] = useState<"chat" | "admin" | "models">("chat");
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, loading, setUser, logout } = useAuth();

  if (!loading && !user) {
    return <LoginModal onLogin={setUser} />;
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-cream font-sans text-ink dark:bg-night dark:text-cream">
      <aside className="hidden w-72 shrink-0 border-r border-line lg:block dark:border-night-surface">
        <Sidebar
          view={view}
          onView={setView}
          userEmail={user?.email}
          isAdmin={user?.isAdmin}
          onLogout={logout}
        />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="animate-fade absolute inset-0 bg-black/30 backdrop-blur-[2px]"
            onClick={() => setMobileOpen(false)}
          />
          <div className="animate-rise absolute left-0 top-0 h-full w-72 border-r border-line shadow-2xl">
            <Sidebar
              view={view}
              onView={setView}
              userEmail={user?.email}
              isAdmin={user?.isAdmin}
              onLogout={logout}
              onClose={() => setMobileOpen(false)}
            />
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-cream-deep"
            >
              <CloseIcon size={18} />
            </button>
          </div>
        </div>
      )}

      <main className="flex min-w-0 flex-1 flex-col">
        {view === "admin" && user?.isAdmin ? (
          <AdminView email={user.email} onOpenSidebar={() => setMobileOpen(true)} />
        ) : (
          <ChatView onOpenSidebar={() => setMobileOpen(true)} />
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
