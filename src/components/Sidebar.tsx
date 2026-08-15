import { useMemo, useState } from "react";
import { useStore } from "../lib/store";
import type { Conversation } from "../lib/store";
import { ClaudeLogo, PlusIcon, SearchIcon, TrashIcon, MessageIcon, FolderIcon, MoreIcon, SunIcon, MoonIcon, TerminalIcon, BookIcon, BrainIcon, GlobeIcon, SparkleIcon } from "./icons";
import { getProvider } from "../lib/realai";
import { cn } from "../utils/cn";

function groupByDate(items: Conversation[]) {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const today = startOfDay(now);
  const yesterday = today - 86400000;
  const week = today - 7 * 86400000;
  const month = today - 30 * 86400000;

  const groups: Record<string, Conversation[]> = {
    Today: [],
    Yesterday: [],
    "Previous 7 days": [],
    "Previous 30 days": [],
    Older: [],
  };
  for (const c of items) {
    const t = c.updatedAt;
    if (t >= today) groups["Today"].push(c);
    else if (t >= yesterday) groups["Yesterday"].push(c);
    else if (t >= week) groups["Previous 7 days"].push(c);
    else if (t >= month) groups["Previous 30 days"].push(c);
    else groups["Older"].push(c);
  }
  return groups;
}

function ChatRow({
  conv,
  active,
  onSelect,
}: {
  conv: Conversation;
  active: boolean;
  onSelect: () => void;
}) {
  const { deleteChat } = useStore();
  const [confirm, setConfirm] = useState(false);
  return (
    <div
      className={cn(
        "group/row relative flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition",
        active
          ? "bg-cream-deep text-ink dark:bg-night-surface dark:text-cream"
          : "text-ink-soft hover:bg-cream-deep/70 dark:text-cream/70 dark:hover:bg-night-surface/70"
      )}
      onClick={onSelect}
    >
      <span className="truncate">{conv.title}</span>
      {conv.starred && <span className="text-[11px] text-coral">★</span>}
      <div className="ml-auto flex items-center opacity-0 transition group-hover/row:opacity-100">
        {confirm ? (
          <span
            className="flex items-center gap-1 text-[11px]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="rounded px-1.5 py-0.5 text-red-600 hover:bg-red-50"
              onClick={() => deleteChat(conv.id)}
            >
              Delete
            </button>
            <button
              className="rounded px-1.5 py-0.5 text-muted"
              onClick={() => setConfirm(false)}
            >
              No
            </button>
          </span>
        ) : (
          <button
            className="flex h-6 w-6 items-center justify-center rounded text-muted hover:text-ink-soft dark:hover:text-cream"
            title="Delete"
            onClick={(e) => {
              e.stopPropagation();
              setConfirm(true);
            }}
          >
            <TrashIcon size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

export function Sidebar({
  view,
  onView,
  onClose,
  userEmail,
  isAdmin,
  onLogout,
}: {
  view?: "chat" | "models" | "admin";
  onView?: (v: "chat" | "models" | "admin") => void;
  onClose?: () => void;
  userEmail?: string;
  isAdmin?: boolean;
  onLogout?: () => void;
}) {
  const {
    conversations,
    activeId,
    newChat,
    selectChat,
    theme,
    toggleTheme,
    apiKeys,
    activeSlot,
  } = useStore();
  const [query, setQuery] = useState("");
  const connected = !!activeSlot && !!apiKeys[activeSlot]?.apiKey;
  // Number of AI models running together in consensus mode.
  const numModels = 10;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);
    if (!q) return sorted;
    return sorted.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.messages.some((m) => m.content.toLowerCase().includes(q))
    );
  }, [conversations, query]);

  const groups = useMemo(() => groupByDate(filtered), [filtered]);

  return (
    <div className="flex h-full w-full flex-col bg-cream-surface dark:bg-night-deep">
      {/* Brand */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-coral">
            <ClaudeLogo size={22} />
          </span>
          <span className="text-[17px] font-semibold tracking-tight text-ink dark:text-cream">
            Nexora
          </span>
        </div>
        <button
          onClick={toggleTheme}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-cream-deep hover:text-ink-soft dark:hover:bg-night-surface dark:hover:text-cream"
          title="Toggle theme"
        >
          {theme === "light" ? <MoonIcon size={17} /> : <SunIcon size={17} />}
        </button>
      </div>

      {/* New chat */}
      <div className="px-3 pb-2">
        <button
          onClick={() => {
            newChat();
            onClose?.();
          }}
          className="flex w-full items-center gap-2.5 rounded-xl bg-ink px-3.5 py-2.5 text-sm font-medium text-cream transition hover:opacity-90 dark:bg-cream dark:text-ink"
        >
          <PlusIcon size={17} />
          New chat
        </button>
      </div>

      {/* Search */}
      <div className="px-3 pb-2">
        <div className="flex items-center gap-2 rounded-lg border border-line bg-cream px-3 py-2 dark:border-night-surface dark:bg-night">
          <SearchIcon size={15} className="text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chats"
            className="w-full bg-transparent text-sm text-ink placeholder:text-muted focus:outline-none dark:text-cream"
          />
        </div>
      </div>

      {/* Quick links */}
      <div className="px-3 pb-1">
        <div className="flex items-center gap-1 rounded-lg px-1 py-1 text-[13px]">
          <button
            onClick={() => onView?.("chat")}
            className={cn(
              "flex flex-1 items-center gap-2 rounded-md px-2.5 py-1.5 font-medium transition",
              view === "chat"
                ? "bg-cream-deep text-ink dark:bg-night-surface dark:text-cream"
                : "text-muted hover:text-ink-soft dark:hover:text-cream"
            )}
          >
            <MessageIcon size={15} /> Chat
          </button>
          {isAdmin && (
            <button
              onClick={() => onView?.("admin")}
              className={cn(
                "flex flex-1 items-center gap-2 rounded-md px-2.5 py-1.5 font-medium transition",
                view === "admin"
                  ? "bg-cream-deep text-ink dark:bg-night-surface dark:text-cream"
                  : "text-muted hover:text-ink-soft dark:hover:text-cream"
              )}
            >
              <span className="text-[13px]">👑</span> Admin
            </button>
          )}
        </div>
      </div>

      {/* History */}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-1">
        {filtered.length === 0 ? (
          <p className="px-2 py-6 text-center text-[13px] text-muted">
            {query ? "No chats found." : "No conversations yet."}
          </p>
        ) : (
          Object.entries(groups).map(
            ([label, items]) =>
              items.length > 0 && (
                <div key={label} className="mb-1">
                  <div className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-2">
                    {label}
                  </div>
                  <div className="space-y-0.5">
                    {items.map((c) => (
                      <ChatRow
                        key={c.id}
                        conv={c}
                        active={c.id === activeId}
                        onSelect={() => {
                          selectChat(c.id);
                          onView?.("chat");
                          onClose?.();
                        }}
                      />
                    ))}
                  </div>
                </div>
              )
          )
        )}
      </div>

      {/* Footer — status only, no selector */}
      <div className="border-t border-line px-3 py-2.5 dark:border-night-surface">
        <div className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
          <span className="text-[12px] font-medium text-muted">
            {numModels}+ AI models · Consensus mode
          </span>
        </div>
        <div className="mt-1.5 flex items-center gap-2.5 rounded-lg px-2.5 py-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-coral to-coral-hover text-[12px] font-bold text-white">
            {(userEmail || "C")[0].toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-medium text-ink dark:text-cream">
              {userEmail || "Guest"}
            </div>
            <div className="truncate text-[11px] text-muted">Logged in</div>
          </div>
          {onLogout && (
            <button
              onClick={onLogout}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-cream-deep hover:text-red-500 dark:hover:bg-night-surface"
              title="Logout"
            >
              ⏻
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
