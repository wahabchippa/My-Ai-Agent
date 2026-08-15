import { useEffect, useRef, useState } from "react";
import { useStore, newId } from "../lib/store";
import { generateReply, tokenize, type ChatTurn, type BrainResult } from "../lib/brain";
import { getModel } from "../lib/models";
import type { ModelId } from "../lib/models";
import { MessageItem, firstCodeBlock, LANG_FILE } from "./Message";
import { ChatInput } from "./ChatInput";
import { getPersonality, type PersonalityId } from "../lib/personalities";
import { chatReal, chatServer, chatStream, systemPrompt, resolveActive, explainError, browserOk, getProvider, hasProxy } from "../lib/realai";
import { ArtifactsPanel, type Artifact } from "./ArtifactsPanel";
import { MenuIcon, SparkleIcon, BoltIcon, BookIcon, PencilIcon } from "./icons";
import { cn } from "../utils/cn";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Try Puter.js first — free access to GPT-5.4, Claude, Gemini (400+ models).
 * Returns the response text, or null if Puter is unavailable/failed.
 */
async function tryPuter(system: string, messages: { role: string; content: string }[], onChunk: (t: string) => void): Promise<string | null> {
  try {
    const puter = (window as any).puter;
    if (!puter?.ai?.chat) return null;

    // Silent auth — no popup confusion
    const result = await puter.ai.chat(messages[messages.length - 1]?.content || "hello", {
      model: "openai/gpt-5.4-nano",
      stream: true,
    });

    // Handle streaming response
    let full = "";
    if (result && typeof result[Symbol.asyncIterator] === "function") {
      for await (const part of result) {
        const chunk = part?.text || part?.choices?.[0]?.delta?.content || "";
        if (chunk) { full += chunk; onChunk(full); }
      }
    } else if (typeof result === "string") {
      full = result;
      onChunk(full);
    } else if (result?.message?.content) {
      full = typeof result.message.content === "string" ? result.message.content : JSON.stringify(result.message.content);
      onChunk(full);
    } else if (result?.choices?.[0]?.message?.content) {
      full = result.choices[0].message.content;
      onChunk(full);
    }

    return full.trim() || null;
  } catch {
    return null; // Puter failed — fall back to backend
  }
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

const SUGGESTIONS = [
  {
    icon: BoltIcon,
    label: "Build an app",
    prompt: "Build a calculator app",
    color: "#D97757",
  },
  {
    icon: SparkleIcon,
    label: "Make a website",
    prompt: "Create a website for my coffee shop",
    color: "#E0A458",
  },
  {
    icon: PencilIcon,
    label: "Write",
    prompt: "Write a short story about the sea",
    color: "#8C6FD6",
  },
  {
    icon: BookIcon,
    label: "Mujhe batao",
    prompt: "Mujhe black holes ke baare mein batao",
    color: "#5BA88A",
  },
];

export function ChatView({
  onOpenSidebar,
}: {
  onOpenSidebar: () => void;
}) {
  const {
    active,
    activeId,
    model,
    setModel,
    setConversationModel,
    newChat,
    addMessage,
    patchMessage,
    personality,
    apiKeys,
    activeSlot,
  } = useStore();

  const cancelRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [localStream, setLocalStream] = useState(false);
  const [artifact, setArtifact] = useState<Artifact | null>(null);
  const [web, setWeb] = useState(false);
  const [mode, setMode] = useState<"fast" | "balanced" | "deep">("balanced");
  const [showAgents, setShowAgents] = useState(false);
  const [pipelineInfo, setPipelineInfo] = useState<{ agents: string; orchestrator: string } | null>(null);
  const [freeModel, setFreeModel] = useState<string | null>(null);

  const messages = active?.messages ?? [];
  const lastMsg = messages[messages.length - 1];
  const isStreaming = !!lastMsg?.streaming || localStream;

  // auto-scroll while streaming / new messages
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages.length, lastMsg?.content, lastMsg?.streaming]);

  // close the live preview when switching conversations
  useEffect(() => {
    setArtifact(null);
  }, [activeId]);

  const activeModel: ModelId = active?.model ?? model;
  const realConfig = resolveActive(apiKeys, activeSlot);
  const activeProviderId = activeSlot ? apiKeys[activeSlot]?.provider : null;
  const explainActiveError = (e: unknown) =>
    activeProviderId ? explainError(activeProviderId, e) : "connection failed";

  const runStream = async (
    convId: string,
    assistantId: string,
    userText: string,
    history: ChatTurn[],
    mdl: ModelId
  ) => {
    cancelRef.current = false;
    setLocalStream(true);
    const m = getModel(mdl);

    // MASTER CONSENSUS: ALL models work in parallel → master AI synthesizes → stream.
    if (!realConfig) {
      try {
        patchMessage(convId, assistantId, {
          thinking: ["Thinking"],
        });
        await delay(700);
        patchMessage(convId, assistantId, {
          thinking: ["Thinking", "Preparing your answer"],
        });

        const res = await fetch("/api/chat/master", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system: systemPrompt(personality),
            messages: [...history, { role: "user", content: userText }],
            mode,
          }),
        });

        if (!res.ok) throw new Error("master failed");

        // Capture pipeline info from headers
        setPipelineInfo({
          agents: res.headers.get("x-agents-used") || "Nexora AI",
          orchestrator: res.headers.get("x-orchestrator") || "",
        });

        // Stream the master answer
        const reader = res.body?.getReader();
        if (reader) {
          const decoder = new TextDecoder();
          let full = "";
          patchMessage(convId, assistantId, { thinking: [] });
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            full += decoder.decode(value, { stream: true });
            if (!cancelRef.current) patchMessage(convId, assistantId, { content: full });
          }
          if (!cancelRef.current) {
            patchMessage(convId, assistantId, { content: full || "No response", streaming: false });
          }
          setLocalStream(false);
          return;
        }
      } catch {
        // master failed — fall through to simple streaming
        patchMessage(convId, assistantId, { thinking: [] });
        try {
          const fullText = await chatStream(
            { system: systemPrompt(personality), messages: [...history, { role: "user", content: userText }] },
            (partial) => { if (!cancelRef.current) patchMessage(convId, assistantId, { content: partial }); }
          );
          if (!cancelRef.current) patchMessage(convId, assistantId, { content: fullText, streaming: false });
          setLocalStream(false);
          return;
        } catch {}
      }
    }

    // Decide: real AI (if a key is configured) or the offline simulation.
    let result: BrainResult;
    try {
      let text: string;
      if (realConfig) {
        // A user pasted their OWN key in the Models page → use it (server-side).
        const proxy = await hasProxy();
        if (!proxy && !browserOk(realConfig.provider)) {
          throw new Error(
            `the active model (${getProvider(realConfig.provider).name}) is blocked by the browser (CORS). Use the Nexora backend default, or switch to a browser-friendly provider in the Models tab.`
          );
        }
        text = await chatReal({
          config: realConfig,
          system: systemPrompt(personality),
          messages: [...history, { role: "user", content: userText }],
        });
      } else {
        // DEFAULT: Nexora backend — real models via OpenRouter, key on server.
        text = await chatServer({
          tier: mdl,
          system: systemPrompt(personality),
          messages: [...history, { role: "user", content: userText }],
        });
      }
      result = { thinking: [], text, lang: "en" };
    } catch (e) {
      // Fall back to offline brain with a clear, helpful note
      const offline = generateReply({ prompt: userText, model: mdl, history, web, personality });
      const why = explainActiveError(e);
      result = {
        ...offline,
        text:
          `⚠️ **Couldn't reach the real AI** — ${why}\n\n` +
          `Here's an offline answer instead:\n\n` +
          offline.text,
      };
    }

    // Phase 1 — reveal "thinking" lines (only for offline extended-thinking models)
    if (!realConfig && m.thinks) {
      const shown: string[] = [];
      for (const line of result.thinking) {
        if (cancelRef.current) break;
        shown.push(line);
        patchMessage(convId, assistantId, { thinking: [...shown] });
        await delay(260);
      }
    } else {
      patchMessage(convId, assistantId, { thinking: [] });
      await delay(220);
    }

    // Phase 2 — stream the answer. Short replies type word-by-word; long ones
    // (full app builds) use larger chunks so they finish in a few seconds.
    const tokens = tokenize(result.text);
    const chunk = Math.max(1, Math.ceil(tokens.length / 80));
    const tickMs = Math.max(10, 230 / m.speed);
    let acc = "";
    for (let i = 0; i < tokens.length; i += chunk) {
      if (cancelRef.current) break;
      acc += tokens.slice(i, i + chunk).join("");
      patchMessage(convId, assistantId, { content: acc });
      await delay(tickMs);
    }
    patchMessage(convId, assistantId, {
      content: cancelRef.current && acc ? acc : result.text,
      streaming: false,
    });
    // auto-open the live preview when an app/website was built
    if (result.autoArtifact && !cancelRef.current) {
      const cb = firstCodeBlock(result.text);
      if (cb) {
        setArtifact({
          id: newId(),
          title: LANG_FILE[cb.lang] || "snippet.txt",
          lang: cb.lang,
          code: cb.code,
        });
      }
    }
    setLocalStream(false);
  };

  const handleSend = (text: string) => {
    let convId = activeId;
    const mdl = active?.model ?? model;
    const history: ChatTurn[] = (active?.messages ?? []).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    if (!convId || !active) {
      convId = newChat(mdl);
    }

    const userMsg = {
      id: newId(),
      role: "user" as const,
      content: text,
      ts: Date.now(),
    };
    addMessage(convId, userMsg);

    const assistantId = newId();
    const assistantMsg = {
      id: assistantId,
      role: "assistant" as const,
      content: "",
      model: mdl,
      personality,
      thinking: [],
      ts: Date.now(),
      streaming: true,
    };
    addMessage(convId, assistantMsg);
    runStream(convId, assistantId, text, history, mdl);
  };

  const handleRegenerate = () => {
    if (!active || !activeId) return;
    const msgs = active.messages;
    // find last assistant + preceding user message
    let lastAssistantIdx = -1;
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === "assistant") {
        lastAssistantIdx = i;
        break;
      }
    }
    if (lastAssistantIdx < 1) return;
    const userMsg = msgs.slice(0, lastAssistantIdx).reverse().find((m) => m.role === "user");
    if (!userMsg) return;
    const history: ChatTurn[] = msgs
      .slice(0, lastAssistantIdx)
      .filter((m) => m.id !== userMsg.id)
      .map((m) => ({ role: m.role, content: m.content }));

    // replace the assistant message content with a fresh stream
    patchMessage(activeId, msgs[lastAssistantIdx].id, {
      content: "",
      thinking: [],
      streaming: true,
      feedback: undefined,
      model: active.model,
      personality,
    });
    runStream(
      activeId,
      msgs[lastAssistantIdx].id,
      userMsg.content,
      history,
      active.model
    );
  };

  const handleStop = () => {
    cancelRef.current = true;
  };

  const handleFeedback = (msgId: string, v: "up" | "down") => {
    if (!activeId) return;
    const cur = active?.messages.find((m) => m.id === msgId)?.feedback;
    patchMessage(activeId, msgId, { feedback: cur === v ? undefined : v });
  };

  const onModelChange = (m: ModelId) => {
    setModel(m);
    if (activeId) setConversationModel(activeId, m);
  };

  const showHome = !active || active.messages.length === 0;

  return (
    <div className="relative flex h-full">
    <div className="relative flex min-w-0 flex-1 flex-col bg-cream dark:bg-night">
      {/* Top bar */}
      <header className="flex items-center gap-2 px-3 py-2.5 sm:px-5">
        <button
          onClick={onOpenSidebar}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-soft transition hover:bg-cream-deep lg:hidden dark:text-cream"
        >
          <MenuIcon size={20} />
        </button>
        <div className="flex items-center gap-2">
          <span className="text-coral">
            <img src="/nexora-logo.png" alt="Nexora" className="h-5 w-5 rounded-full object-cover" />
          </span>
          <span className="hidden text-[15px] font-semibold tracking-tight text-ink dark:text-cream sm:inline">
            Nexora
          </span>
          {/* Mode selector */}
          <div className="flex items-center gap-0.5 rounded-full border border-line bg-cream-deep/50 p-0.5 dark:border-night-surface dark:bg-night-surface/50">
            {(["fast", "balanced", "deep"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-[11px] font-medium transition",
                  mode === m
                    ? "bg-coral text-white"
                    : "text-muted hover:text-ink-soft dark:hover:text-cream"
                )}
                title={m === "fast" ? "1-2 models, instant" : m === "balanced" ? "3-4 models + tools" : "5+ models + research + verify"}
              >
                {m === "fast" ? "Fast" : m === "balanced" ? "Balanced" : "Deep"}
              </button>
            ))}
          </div>
          {/* Agent status indicator */}
          {pipelineInfo && (
            <button
              onClick={() => setShowAgents((s) => !s)}
              className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400"
              title={pipelineInfo.orchestrator || "Pipeline info"}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="hidden sm:inline truncate max-w-[120px]">{pipelineInfo.agents.split(",")[0]}</span>
            </button>
          )}
        </div>
      </header>

      {/* Expandable agent pipeline panel */}
      {showAgents && pipelineInfo && (
        <div className="animate-fade border-b border-line bg-cream-surface/50 px-4 py-2.5 dark:border-night-surface dark:bg-night-deep/50">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-2 text-[11px] text-muted">
            <span className="font-semibold text-ink-soft dark:text-cream/80">Pipeline:</span>
            <span className="rounded-md bg-cream-deep px-2 py-0.5 dark:bg-night-surface">🎯 Orchestrator</span>
            <span>→</span>
            <span className="rounded-md bg-cream-deep px-2 py-0.5 dark:bg-night-surface">🤖 Agents ({pipelineInfo.agents.split(",").length})</span>
            <span>→</span>
            <span className="rounded-md bg-cream-deep px-2 py-0.5 dark:bg-night-surface">⚖️ Verify</span>
            <span>→</span>
            <span className="rounded-md bg-coral/15 px-2 py-0.5 text-coral">🧠 Master AI</span>
            <span className="ml-auto text-muted-2">{pipelineInfo.orchestrator}</span>
          </div>
          <div className="mx-auto mt-1.5 flex max-w-3xl flex-wrap gap-1 text-[10px] text-muted-2">
            {pipelineInfo.agents.split(",").map((a, i) => (
              <span key={i} className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-emerald-600 dark:text-emerald-400">
                ✓ {a.trim()}
              </span>
            ))}
          </div>
        </div>
      )}

      {showHome ? (
        <HomeView
          greetingText={greeting()}
          suggestions={SUGGESTIONS}
          model={activeModel}
          onModelChange={onModelChange}
          onSend={handleSend}
          onPick={(p) => handleSend(p)}
          web={web}
          onWebChange={setWeb}
          personality={personality}
        />
      ) : (
        <>
          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-3xl pb-6 pt-2">
              {messages.map((m, i) => (
                <MessageItem
                  key={m.id}
                  msg={m}
                  isLast={i === messages.length - 1 && m.role === "assistant"}
                  onRegenerate={handleRegenerate}
                  onFeedback={(v) => handleFeedback(m.id, v)}
                  onOpenArtifact={(a) =>
                    setArtifact({ id: newId(), ...a })
                  }
                />
              ))}
              <div className="h-2" />
            </div>
          </div>
          <div className="px-4 pb-4 pt-1">
            <div className="mx-auto w-full max-w-3xl">
              <ChatInput
                onSend={handleSend}
                onStop={handleStop}
                streaming={isStreaming}
                model={activeModel}
                onModelChange={onModelChange}
                placeholder="Reply to Nexora…"
                web={web}
                onWebChange={setWeb}
              />
              <p className="mt-2 text-center text-[11px] text-muted-2">
                Nexora can make mistakes. Responses come from real models via
                the backend.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
    {artifact && (
      <ArtifactsPanel
        key={artifact.id}
        artifact={artifact}
        onClose={() => setArtifact(null)}
        className="absolute inset-0 z-40 md:static md:inset-auto md:w-[440px] md:shrink-0 lg:w-[480px]"
      />
    )}
    </div>
  );
}

function HomeView({
  greetingText,
  suggestions,
  model,
  onModelChange,
  onSend,
  onPick,
  web,
  onWebChange,
  personality,
}: {
  greetingText: string;
  suggestions: typeof SUGGESTIONS;
  model: ModelId;
  onModelChange: (m: ModelId) => void;
  onSend: (t: string) => void;
  onPick: (p: string) => void;
  web?: boolean;
  onWebChange?: (b: boolean) => void;
  personality: PersonalityId;
}) {
  const p = getPersonality(personality);
  const isClaude = personality === "claude";
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 pb-8">
      <div className="w-full max-w-2xl">
        <div className="relative mb-7 flex flex-col items-center text-center">
          <div className="claude-glow pointer-events-none absolute inset-0 -z-10 scale-[2.4]" />
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-[0_8px_24px_rgba(0,0,0,0.22)]"
            style={{ backgroundColor: p.color }}
          >
            {isClaude ? <img src="/nexora-logo.png" alt="Nexora" className="h-8 w-8 rounded-full object-cover" /> : <span className="text-[30px]">{p.emoji}</span>}
          </div>
          <h1 className="mt-5 font-serif text-[28px] font-normal text-ink dark:text-cream">
            <span style={{ color: p.color }}>{isClaude ? "" : `${p.emoji} `}</span>
            {isClaude ? greetingText : `Meet ${p.name}`}
          </h1>
          <p className="mt-1.5 text-[15px] text-muted">
            {p.name} · {p.tagline}. What can I do for you?
          </p>
        </div>

        <div className="mx-auto">
          <ChatInput
            onSend={onSend}
            streaming={false}
            model={model}
            onModelChange={onModelChange}
            placeholder="How can I help you today?"
            web={web}
            onWebChange={onWebChange}
          />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {suggestions.map((s) => (
            <button
              key={s.label}
              onClick={() => onPick(s.prompt)}
              className="group flex flex-col items-start gap-2 rounded-2xl border border-line bg-cream p-3.5 text-left transition hover:-translate-y-0.5 hover:border-coral/40 hover:shadow-md dark:border-night-surface dark:bg-night-surface/50"
            >
              <span
                className="flex h-8 w-8 items-center justify-center rounded-lg"
                style={{ backgroundColor: s.color + "22", color: s.color }}
              >
                <s.icon size={17} />
              </span>
              <span className="mt-0.5 text-[13px] font-semibold leading-tight text-ink-soft dark:text-cream/80">
                {s.label}
              </span>
              <span className="line-clamp-2 text-[12px] leading-snug text-muted">
                {s.prompt}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
