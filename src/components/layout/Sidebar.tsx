"use client";

import { useState, useMemo } from "react";
import { useStore, type Conversation } from "@/lib/store";
import {
  PlusIcon, SearchIcon, StarIcon, TrashIcon, MoreVerticalIcon,
  ChatIcon, FolderIcon, CodeIcon, SettingsIcon, ShieldIcon,
  SunIcon, MoonIcon, LogOutIcon, HelpCircleIcon,
} from "../ui/icons";
import { cn } from "@/utils/cn";
import type { ViewType } from "@/App";

interface SidebarProps {
  view: ViewType;
  isOpen: boolean;
  onToggle: () => void;
  onViewChange: (v: ViewType) => void;
  isAdmin?: boolean;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  onLogout: () => void;
}

interface NavItem {
  id: ViewType;
  label: string;
  icon: React.FC<{ size?: number; className?: string }>;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { id: "chat", label: "Chat", icon: ChatIcon },
  { id: "projects", label: "Projects", icon: FolderIcon },
  { id: "workspace", label: "Workspace", icon: CodeIcon },
  { id: "settings", label: "Settings", icon: SettingsIcon },
  { id: "admin", label: "Admin", icon: ShieldIcon, adminOnly: true },
];

function groupConversations(items: Conversation[]) {
  const now = Date.now();
  const DAY = 86400000;
  const groups: Record<string, Conversation[]> = {
    Today: [], Yesterday: [], "This Week": [], "This Month": [], Older: [],
  };
  const sorted = [...items].sort((a, b) => b.updatedAt - a.updatedAt);
  for (const conv of sorted) {
    const age = now - conv.updatedAt;
    if (age < DAY) groups.Today.push(conv);
    else if (age < 2 * DAY) groups.Yesterday.push(conv);
    else if (age < 7 * DAY) groups["This Week"].push(conv);
    else if (age < 30 * DAY) groups["This Month"].push(conv);
    else groups.Older.push(conv);
  }
  return groups;
}

export function Sidebar({ view, isOpen, onToggle, onViewChange, isAdmin, theme, onToggleTheme, onLogout }: SidebarProps) {
  const { conversations, activeId, newChat, selectChat, deleteChat, toggleStar } = useStore();
  const [search, setSearch] = useState("");
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const filteredItems = navItems.filter((item) => !item.adminOnly || isAdmin);

  const filtered = useMemo(() => {
    if (!search.trim()) return conversations;
    const q = search.toLowerCase();
    return conversations.filter(
      (c) => c.title.toLowerCase().includes(q) || c.messages.some((m) => m.content.toLowerCase().includes(q))
    );
  }, [conversations, search]);

  const groups = useMemo(() => groupConversations(filtered), [filtered]);

  if (!isOpen) {
    return (
      <div className="hidden lg:flex w-10 flex-col items-center border-r border-border bg-surface py-3">
        <button onClick={onToggle} className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted hover:bg-subtle hover:text-text transition" title="Expand">
          →
        </button>
      </div>
    );
  }

  const isChat = view === "chat";

  return (
    <aside className="hidden lg:flex w-64 flex-col border-r border-border bg-surface">
      {/* Logo + nav items header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-3">
        <div className="flex items-center gap-2">
          <img src="/nexora-logo.png" alt="Nexora" className="h-8 w-8 rounded-full object-cover" />
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold text-text">Nexora</span>
            <span className="text-[10px] text-text-muted">AI Workspace</span>
          </div>
        </div>
        <button onClick={onToggle} className="flex h-7 w-7 items-center justify-center rounded-lg text-text-muted hover:bg-subtle hover:text-text transition" title="Collapse">
          ←
        </button>
      </div>

      {/* Nav items */}
      <div className="border-b border-border px-2 py-2">
        <div className="space-y-0.5">
          {filteredItems.map((item) => {
            const Icon = item.icon;
            const active = view === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition",
                  active ? "bg-accent-soft text-accent" : "text-text-secondary hover:bg-subtle hover:text-text"
                )}
              >
                <Icon size={18} />
                <span className="text-sm font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Chat conversations (only for chat view) */}
      {isChat ? (
        <>
          <div className="px-3 py-2">
            <button
              onClick={() => newChat()}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-accent to-nebula px-3 py-2 text-sm font-medium text-white hover:opacity-90 transition shadow-glow-sm"
            >
              <PlusIcon size={18} />
              New Chat
            </button>
          </div>
          <div className="px-3 py-1">
            <div className="relative">
              <SearchIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search conversations..."
                className="w-full rounded-lg bg-subtle border border-border py-2 pl-9 pr-3 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none transition"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-2 py-2">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="text-3xl mb-2">💬</div>
                <p className="text-sm text-text-muted">{search ? "No conversations found" : "No conversations yet"}</p>
                {!search && <p className="text-xs text-text-dim mt-1">Start a new chat to begin</p>}
              </div>
            ) : (
              Object.entries(groups).map(([label, items]) =>
                items.length > 0 ? (
                  <div key={label} className="mb-3">
                    <div className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted">{label}</div>
                    <div className="space-y-0.5">
                      {items.map((conv) => (
                        <ConversationItem
                          key={conv.id}
                          conversation={conv}
                          isActive={conv.id === activeId}
                          isHovered={hoveredId === conv.id}
                          onSelect={() => selectChat(conv.id)}
                          onDelete={() => deleteChat(conv.id)}
                          onToggleStar={() => toggleStar(conv.id)}
                          onHover={(h) => setHoveredId(h ? conv.id : null)}
                        />
                      ))}
                    </div>
                  </div>
                ) : null
              )
            )}
          </div>
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center text-sm text-text-muted">
          {view === "projects" ? "Projects" : view === "workspace" ? "Coding Workspace" : view === "settings" ? "Settings" : view === "admin" ? "Admin" : ""}
        </div>
      )}

      {/* Bottom: theme + logout */}
      <div className="border-t border-border px-2 py-2 space-y-0.5">
        <button onClick={onToggleTheme} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-text-secondary hover:bg-subtle hover:text-text transition">
          {theme === "dark" ? <SunIcon size={18} /> : <MoonIcon size={18} />}
          <span className="text-sm">{theme === "dark" ? "Light mode" : "Dark mode"}</span>
        </button>
        <button onClick={onLogout} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-text-secondary hover:bg-danger-soft hover:text-danger transition">
          <LogOutIcon size={18} />
          <span className="text-sm">Log out</span>
        </button>
      </div>
    </aside>
  );
}

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  isHovered: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onToggleStar: () => void;
  onHover: (hovered: boolean) => void;
}

function ConversationItem({ conversation, isActive, isHovered, onSelect, onDelete, onToggleStar, onHover }: ConversationItemProps) {
  return (
    <div
      className={cn(
        "group relative flex items-center gap-2 rounded-lg px-2 py-2 cursor-pointer transition",
        isActive ? "bg-accent-soft text-accent" : "text-text-secondary hover:bg-subtle hover:text-text"
      )}
      onClick={onSelect}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
    >
      {conversation.starred && <StarIcon size={12} className={cn("shrink-0", isActive ? "text-accent" : "text-warning")} />}
      <span className="flex-1 truncate text-sm">{conversation.title}</span>
      {isHovered && (
        <div className="flex items-center gap-0.5">
          <button
            onClick={(e) => { e.stopPropagation(); onToggleStar(); }}
            className={cn("flex h-6 w-6 items-center justify-center rounded text-text-muted hover:text-warning transition", conversation.starred && "text-warning")}
          >
            <StarIcon size={14} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); if (confirm("Delete this conversation?")) onDelete(); }}
            className="flex h-6 w-6 items-center justify-center rounded text-text-muted hover:text-danger transition"
          >
            <TrashIcon size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
