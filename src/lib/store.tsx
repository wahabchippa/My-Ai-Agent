import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { ModelId } from "./models";
import type { PersonalityId } from "./personalities";
import type { RealConfig, ApiKeys, Provider, KeySlot } from "./realai";
import { DEFAULT_SLOTS, DEFAULT_ACTIVE_SLOT, slotsToMap } from "./realai";

export type Role = "user" | "assistant";

export interface Message {
  id: string;
  role: Role;
  content: string;
  model?: ModelId;
  personality?: PersonalityId;
  thinking?: string[];
  ts: number;
  feedback?: "up" | "down";
  streaming?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  model: ModelId;
  createdAt: number;
  updatedAt: number;
  starred?: boolean;
}

export type Theme = "light" | "dark";

interface StoreShape {
  conversations: Conversation[];
  activeId: string | null;
  active: Conversation | null;
  model: ModelId;
  theme: Theme;
  personality: PersonalityId;
  apiKeys: ApiKeys;
  activeSlot: string | null;
  mediaKey: string;
  setMediaKey: (k: string) => void;
  setModel: (m: ModelId) => void;
  setPersonality: (p: PersonalityId) => void;
  setSlot: (slot: KeySlot) => void;
  removeSlot: (id: string) => void;
  setActiveSlot: (id: string | null) => void;
  toggleTheme: () => void;
  newChat: (model?: ModelId) => string;
  selectChat: (id: string) => void;
  deleteChat: (id: string) => void;
  renameChat: (id: string, title: string) => void;
  toggleStar: (id: string) => void;
  clearAll: () => void;
  addMessage: (convId: string, msg: Message) => void;
  patchMessage: (convId: string, msgId: string, patch: Partial<Message>) => void;
  setConversationModel: (id: string, m: ModelId) => void;
}

const StoreContext = createContext<StoreShape | null>(null);

// ⚠ Ye pehle ek hi fixed string thi: "claude-replica-v1".
// Nateeja: EK hi browser par jo bhi login karta, sab ko WAHI localStorage
// entry milti thi — is liye har email par ek jaisi chat nazar aati thi.
// Ab har user ki apni key hai, aur logged-out ke liye alag "guest" key.
const LS_PREFIX = "nexora-store-v2";
function lsKeyFor(userId: number | null): string {
  return userId == null ? `${LS_PREFIX}:guest` : `${LS_PREFIX}:u${userId}`;
}

const uid = () =>
  Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

function titleFrom(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return "New chat";
  return clean.length > 38 ? clean.slice(0, 38) + "…" : clean;
}

function seedConversations(): Conversation[] {
  // a friendly starting example so the sidebar isn't empty
  const now = Date.now();
  return [
    {
      id: uid(),
      title: "Welcome to Nexora",
      model: "sonnet",
      createdAt: now - 1000 * 60 * 60 * 26,
      updatedAt: now - 1000 * 60 * 60 * 26,
      starred: true,
      messages: [
        {
          id: uid(),
          role: "user",
          content: "What can you help me with?",
          ts: now - 1000 * 60 * 60 * 26,
        },
        {
          id: uid(),
          role: "assistant",
          model: "sonnet",
          content:
            "I'm **Nexora** — I can write and edit, reason through hard problems, write and debug code, summarize documents, brainstorm ideas, and plenty more.\n\nTry asking me to `explain` something, `write code`, or compare options. What are you working on?",
          ts: now - 1000 * 60 * 60 * 26 + 5000,
        },
      ],
    },
  ];
}

interface Persisted {
  conversations: Conversation[];
  model: ModelId;
  theme: Theme;
  personality: PersonalityId;
  apiKeys: ApiKeys;
  activeSlot: string | null;
  mediaKey?: string;
  // legacy fields, migrated on load
  realConfig?: RealConfig | null;
  activeProvider?: Provider | null;
}

function emptyState(): Persisted {
  return {
    conversations: [],
    model: "sonnet",
    theme: "light",
    personality: "claude",
    apiKeys: slotsToMap(DEFAULT_SLOTS),
    activeSlot: DEFAULT_ACTIVE_SLOT,
    mediaKey: "",
  };
}

function load(userId: number | null): Persisted {
  try {
    const raw = localStorage.getItem(lsKeyFor(userId));
    if (raw) {
      const parsed = JSON.parse(raw) as Persisted & Record<string, unknown>;
      if (parsed && Array.isArray(parsed.conversations)) {
        const stored = (parsed.apiKeys ?? {}) as Record<string, Partial<KeySlot>>;
        const apiKeys: ApiKeys = {};
        // migrate any stored entries into proper slots
        for (const [k, v] of Object.entries(stored)) {
          if (v && v.apiKey) {
            apiKeys[k] = {
              id: k,
              provider: (v.provider as Provider) ?? (k as Provider),
              apiKey: v.apiKey,
              model: v.model ?? "",
              ok: v.ok ?? null,
              error: v.error ?? null,
            };
          }
        }
        // merge in any default slots that are missing (so new seed keys appear)
        for (const slot of DEFAULT_SLOTS) {
          if (!apiKeys[slot.id]) apiKeys[slot.id] = slot;
        }
        // fix deprecated Gemini model names
        if (apiKeys.gemini && /gemini-(1\.5|2\.0)-/.test(apiKeys.gemini.model)) {
          apiKeys.gemini = { ...apiKeys.gemini, model: "gemini-2.5-flash", ok: null, error: null };
        }
        // resolve the active slot (support legacy activeProvider field too)
        let activeSlot: string | null =
          (parsed.activeSlot as string | null) ??
          (parsed.activeProvider as Provider | null) ??
          null;
        if (!activeSlot || !apiKeys[activeSlot] || !apiKeys[activeSlot].apiKey) {
          activeSlot =
            Object.values(apiKeys).find((s) => s.apiKey)?.id ?? DEFAULT_ACTIVE_SLOT;
        }
        return {
          conversations: parsed.conversations,
          model: parsed.model ?? "sonnet",
          // Force the clean light theme; ignore any stale saved "dark".
          theme: "light",
          personality: parsed.personality ?? "claude",
          apiKeys,
          activeSlot,
          mediaKey: parsed.mediaKey || "",
        };
      }
    }
  } catch {
    /* ignore */
  }
  return {
    // ⚠ pehle yahan seedConversations() tha — har naye user ko wohi
    // "Welcome to Nexora" wali banawati chat milti thi, jis se lagta tha
    // ke sab ki chat ek jaisi hai. Ab naya user khali sidebar se shuru
    // karta hai (asli chat pehle message par banti hai).
    conversations: [],
    model: "sonnet",
    theme: "light",
    personality: "claude",
    apiKeys: slotsToMap(DEFAULT_SLOTS),
    activeSlot: DEFAULT_ACTIVE_SLOT,
    mediaKey: "",
  };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  // Server render par localStorage mojood nahi — is liye khali se shuru
  // karte hain aur asli data neeche wale effect me aata hai.
  const initial = useRef<Persisted | null>(null);
  if (initial.current === null) {
    initial.current =
      typeof window === "undefined" ? emptyState() : load(null);
  }
  const data = initial.current;

  // Kaun logged in hai. null = abhi maloom nahi / guest.
  const [userId, setUserId] = useState<number | null>(null);
  // Jab tak ye true na ho, hum kuch save NAHI karte — warna guest ka khali
  // state login wale user ke saved data ke upar chal jata.
  const [hydrated, setHydrated] = useState(false);

  const [conversations, setConversations] = useState<Conversation[]>(
    data.conversations
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [model, setModelState] = useState<ModelId>(data.model);
  const [theme, setTheme] = useState<Theme>(data.theme);
  const [personality, setPersonality] = useState<PersonalityId>(data.personality);
  const [apiKeys, setApiKeys] = useState<ApiKeys>(data.apiKeys);
  const [activeSlot, setActiveSlotState] = useState<string | null>(data.activeSlot);
  const [mediaKey, setMediaKeyState] = useState<string>(data.mediaKey ?? "");

  // ── Kaun login hai? ──────────────────────────────────────────────────
  // Mount par ek dafa. Jawab aane par us user ka apna data load hota hai.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      let uid: number | null = null;
      try {
        const r = await fetch("/api/auth/me", { credentials: "include" });
        if (r.ok) {
          const j = await r.json();
          uid = typeof j?.user?.id === "number" ? j.user.id : null;
        }
      } catch {
        /* offline / network — guest samjho */
      }
      if (cancelled) return;

      // 1) Pehle is user ka localStorage (fauri, taake screen khali na rahe)
      const localData = load(uid);
      setUserId(uid);
      applyState(localData);

      // 2) Phir Neon se — logged-in ho to server hi asli sach hai
      if (uid != null) {
        try {
          const r = await fetch("/api/state", { credentials: "include" });
          if (r.ok) {
            const j = await r.json();
            const remote = j?.state as Partial<Persisted> | undefined;
            // Server par kuch ho tab hi lo. Khali server se maqami chat
            // mitana theek nahi (pehli dafa sync ho rahi hogi).
            if (remote && Array.isArray(remote.conversations) && remote.conversations.length > 0) {
              if (!cancelled) applyState({ ...localData, ...remote } as Persisted);
            }
          }
        } catch {
          /* server na mile to localStorage hi kaafi hai */
        }
      }

      if (!cancelled) setHydrated(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Ek hi jagah se poora state set karne ka helper.
  function applyState(st: Persisted) {
    setConversations(st.conversations);
    setModelState(st.model);
    setTheme(st.theme);
    setPersonalityState(st.personality);
    setApiKeys(st.apiKeys);
    setActiveSlotState(st.activeSlot);
    setMediaKeyState(st.mediaKey ?? "");
  }

  // ── Save: localStorage foran + Neon 2s debounce ──────────────────────
  useEffect(() => {
    // hydrate hone se pehle save mat karo — warna khali state asli data
    // par chal jayegi.
    if (!hydrated) return;

    const payload: Persisted = { conversations, model, theme, personality, apiKeys, activeSlot, mediaKey };

    // localStorage — is user ki apni key par
    try {
      localStorage.setItem(lsKeyFor(userId), JSON.stringify(payload));
    } catch {
      /* quota bhar gaya ya private mode */
    }

    // Neon — sirf logged-in, aur debounce ta ke har keystroke par PUT na ho
    if (userId == null) return;
    const t = setTimeout(() => {
      fetch("/api/state", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: payload }),
      }).catch(() => {
        /* network gaya to localStorage me mehfooz hai */
      });
    }, 2000);
    return () => clearTimeout(t);
  }, [hydrated, userId, conversations, model, theme, personality, apiKeys, activeSlot, mediaKey]);

  // apply theme class to <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    root.style.colorScheme = theme;
  }, [theme]);

  const active = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId]
  );

  const setModel = useCallback((m: ModelId) => setModelState(m), []);
  const setPersonalityState = useCallback(
    (p: PersonalityId) => setPersonality(p),
    []
  );
  const setSlot = useCallback((slot: KeySlot) => {
    setApiKeys((prev) => ({ ...prev, [slot.id]: { ...slot, testedAt: Date.now() } }));
    // first successful connection becomes the active model automatically
    if (slot.ok === true) {
      setActiveSlotState((cur) => cur ?? slot.id);
    }
  }, []);
  const removeSlot = useCallback((id: string) => {
    setApiKeys((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setActiveSlotState((cur) => (cur === id ? null : cur));
  }, []);
  const setActiveSlot = useCallback((id: string | null) => setActiveSlotState(id), []);
  const setMediaKey = useCallback((k: string) => setMediaKeyState(k), []);
  const toggleTheme = useCallback(
    () => setTheme((t) => (t === "light" ? "dark" : "light")),
    []
  );

  const newChat = useCallback((m?: ModelId) => {
    const id = uid();
    const conv: Conversation = {
      id,
      title: "New chat",
      messages: [],
      model: m ?? model,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setConversations((prev) => [conv, ...prev]);
    setActiveId(id);
    return id;
  }, [model]);

  const selectChat = useCallback((id: string) => setActiveId(id), []);

  const deleteChat = useCallback(
    (id: string) => {
      setConversations((prev) => {
        const next = prev.filter((c) => c.id !== id);
        setActiveId((cur) =>
          cur === id ? (next[0]?.id ?? null) : cur
        );
        return next;
      });
    },
    []
  );

  const renameChat = useCallback((id: string, title: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title: title || "Untitled" } : c))
    );
  }, []);

  const toggleStar = useCallback((id: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, starred: !c.starred } : c))
    );
  }, []);

  const clearAll = useCallback(() => {
    setConversations([]);
    setActiveId(null);
  }, []);

  const addMessage = useCallback((convId: string, msg: Message) => {
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== convId) return c;
        const isFirstUser =
          msg.role === "user" &&
          !c.messages.some((m) => m.role === "user");
        return {
          ...c,
          title: isFirstUser ? titleFrom(msg.content) : c.title,
          messages: [...c.messages, msg],
          updatedAt: Date.now(),
        };
      })
    );
  }, []);

  const patchMessage = useCallback(
    (convId: string, msgId: string, patch: Partial<Message>) => {
      setConversations((prev) =>
        prev.map((c) =>
          c.id !== convId
            ? c
            : {
                ...c,
                updatedAt: Date.now(),
                messages: c.messages.map((m) =>
                  m.id === msgId ? { ...m, ...patch } : m
                ),
              }
        )
      );
    },
    []
  );

  const setConversationModel = useCallback((id: string, m: ModelId) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, model: m } : c))
    );
  }, []);

  const value: StoreShape = {
    conversations,
    activeId,
    active,
    model,
    theme,
    personality,
    apiKeys,
    activeSlot,
    mediaKey,
    setMediaKey,
    setModel,
    setPersonality: setPersonalityState,
    setSlot,
    removeSlot,
    setActiveSlot,
    toggleTheme,
    newChat,
    selectChat,
    deleteChat,
    renameChat,
    toggleStar,
    clearAll,
    addMessage,
    patchMessage,
    setConversationModel,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreShape {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}

export function newId() {
  return uid();
}
