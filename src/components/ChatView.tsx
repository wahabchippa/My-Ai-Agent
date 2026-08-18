import { useEffect, useRef, useState } from "react";
import { useStore, newId, type TraceAgent, type TraceState } from "../lib/store";
import { generateReply, tokenize, type ChatTurn, type BrainResult } from "../lib/brain";
import { getModel } from "../lib/models";
import type { ModelId } from "../lib/models";
import { MessageItem, firstCodeBlock, LANG_FILE } from "./Message";
import { ChatInput } from "./ChatInput";
import { getPersonality, type PersonalityId } from "../lib/personalities";
import { chatReal, chatServer, chatStream, systemPrompt, resolveActive, explainError, browserOk, getProvider, hasProxy } from "../lib/realai";
import { chatOllamaStream, ollamaReady, hideModelName } from "../lib/ollama";
import { ArtifactsPanel, type Artifact } from "./ArtifactsPanel";
import { MenuIcon, SparkleIcon, BoltIcon, BookIcon, PencilIcon } from "./icons";
import { cn } from "../utils/cn";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
    mode: defaultMode,
    setMode: setDefaultMode,
    setConversationMode,
    newChat,
    addMessage,
    patchMessage,
    personality,
    apiKeys,
    activeSlot,
    ollama,
  } = useStore();

  const cancelRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [localStream, setLocalStream] = useState(false);
  const [artifact, setArtifact] = useState<Artifact | null>(null);
  const [web, setWeb] = useState(false);
  // Mode ab component ke andar useState NAHI hai.
  //
  // Pehle wo tha, aur bug yehi tha: tab badlo ya refresh karo to
  // component remount hota aur mode chup chaap "balanced" par wapas
  // chala jata. User ne bilkul theek kaha — "1 command ke baad woh apni
  // marzi se change karleta hey".
  //
  // Ab do jagah: har chat ka apna mode (conversation.mode), aur naye
  // chats ke liye default (store.mode). Dono localStorage + Neon me
  // mehfooz hain, is liye kabhi khud nahi badalta.
  const mode = active?.mode ?? defaultMode;
  const setMode = (m: "fast" | "balanced" | "deep" | "agents") => {
    setDefaultMode(m);                                   // agla naya chat
    if (activeId) setConversationMode(activeId, m);      // ye wala chat
  };
  const [showAgents, setShowAgents] = useState(false);
  const [pipelineInfo, setPipelineInfo] = useState<{ agents: string; orchestrator: string } | null>(null);

  const messages = active?.messages ?? [];
  const lastMsg = messages[messages.length - 1];
  const isStreaming = !!lastMsg?.streaming || localStream;

  // auto-scroll while streaming / new messages
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages.length, lastMsg?.content, lastMsg?.streaming, lastMsg?.thinking, lastMsg?.trace]);

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
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLocalStream(true);
    const m = getModel(mdl);

    // Local model sirf MASTER — pehle chhote/cloud, aakhir me yahan polish.
    // UI me naam nahi. Fail ho to draft hi de do.
    const polishLocal = async (draft: string): Promise<string> => {
      if (!ollamaReady(ollama) || !draft.trim() || cancelRef.current) return draft;
      patchMessage(convId, assistantId, { thinking: ["Writing final answer"] });
      try {
        const out = await chatOllamaStream(
          ollama,
          {
            system:
              "You are Nexora. Turn the DRAFT into ONE final answer. " +
              "Keep every fact, number and code block. Never mention drafts, teams, or models. " +
              "Start directly with the answer. Match the user's language.",
            messages: [
              {
                role: "user",
                content:
                  `USER ASKED:\n${userText}\n\n──── DRAFT ────\n${draft.slice(0, 12000)}\n\nFinal answer:`,
              },
            ],
            signal: ac.signal,
          },
          (partial) => {
            if (!cancelRef.current) patchMessage(convId, assistantId, { content: partial, thinking: [] });
          },
        );
        return out.trim() || draft;
      } catch {
        return draft;
      }
    };

    // ─── DEEP THINK / AGENTS ───
    // Pehle ye alag tabs me the aur user ko poochna parta tha "kaunsa
    // tab?". Ab wohi taqat isi chat me hai — sirf mode badlo.
    //   deep   -> /api/think  (khud tools chalata hai: search, page, code)
    //   agents -> /api/agents (poori team: engineer/reviewer/tester/docs)
    // BYO key ho to bhi Deep/Agents chalein — warna tools skip ho jate the.
    if (mode === "deep" || mode === "agents") {
      try {
        const isDeep = mode === "deep";
        const url = isDeep ? "/api/think?stream=1" : "/api/agents?stream=1";
        const body = isDeep
          ? { task: userText, maxSteps: 5, messages: [...history, { role: "user", content: userText }] }
          : { task: userText, messages: [...history, { role: "user", content: userText }] };

        // Structured trace — retry par naya line nahi, sirf status badalta hai.
        const trace: TraceState = {
          kind: isDeep ? "deep" : "agents",
          agents: [],
          steps: [],
          phase: "start",
        };

        const headlineOf = (t: TraceState) => {
          const run = t.agents.filter((a) => a.status === "running");
          if (run.length) return run.map((a) => a.name).join(" · ");
          if (t.phase === "research") return "Gathering sources";
          if (t.phase === "synthesis") return "Synthesizing";
          if (t.phase === "verify") return "Verifying code";
          const live = t.steps.find((s) => s.status === "running");
          if (live) return live.label;
          return isDeep ? "Deep Think" : "Assembling team";
        };

        const publish = () => {
          const snap: TraceState = {
            ...trace,
            agents: trace.agents.map((a) => ({ ...a })),
            steps: trace.steps.map((s) => ({ ...s })),
          };
          const head = headlineOf(snap);
          patchMessage(convId, assistantId, { thinking: [head], trace: snap });
        };

        const addStep = (id: string, label: string) => {
          const ex = trace.steps.find((s) => s.id === id);
          if (ex) {
            ex.status = "running";
            return;
          }
          for (const s of trace.steps) if (s.status === "running") s.status = "done";
          trace.steps.push({ id, label, status: "running" });
        };

        const upsertAgent = (partial: Partial<TraceAgent> & { id: string; name: string }) => {
          const i = trace.agents.findIndex((a) => a.id === partial.id || a.name === partial.name);
          if (i >= 0) {
            trace.agents[i] = { ...trace.agents[i], ...partial };
          } else {
            trace.agents.push({
              id: partial.id,
              name: partial.name,
              emoji: partial.emoji ?? "⚙️",
              color: partial.color ?? "#D97757",
              status: partial.status ?? "running",
              role: partial.role,
              model: partial.model,
            });
          }
        };

        publish(); // pehli frame — spinner turant dikhe, event ka intezaar nahi

        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok || !res.body) throw new Error("stream failed");

        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        let finalText = "";
        let who = "";

        for (;;) {
          const { done, value } = await reader.read();
          if (done || cancelRef.current) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            let ev: Record<string, unknown>;
            try { ev = JSON.parse(line); } catch { continue; }

            if (ev.type === "start") who = hideModelName(String(ev.model ?? ""));
            else if (ev.type === "step") {
              const st = ev.step as { tool?: string; thought?: string; n?: number };
              const label =
                st.tool === "web_search" ? "Searched the web"
                : st.tool === "read_url" ? "Read a page"
                : st.tool === "run_code" ? "Ran the code"
                : st.tool === "recall" ? "Checked knowledge"
                : (st.tool ?? "step");
              addStep(`step-${st.n ?? trace.steps.length}-${st.tool ?? "x"}`, label);
              trace.phase = "agents";
              publish();
            } else if (ev.type === "plan") {
              const team = (ev.team as { id: string; name: string; role?: string; emoji: string; color: string }[]) ?? [];
              // poori team ek dafa — pending chips, dobara push nahi
              trace.agents = team.map((t) => ({
                id: t.id,
                name: t.name,
                role: t.role,
                emoji: t.emoji,
                color: t.color,
                status: "pending" as const,
              }));
              trace.phase = "agents";
              publish();
            } else if (ev.type === "research") {
              addStep("research", "Gathering sources");
              trace.phase = "research";
              publish();
            } else if (ev.type === "agent:start") {
              // same id dobara aaye (model retry) to sirf running — naya chip nahi
              upsertAgent({
                id: String(ev.id ?? ev.name),
                name: String(ev.name ?? "Agent"),
                status: "running",
                model: hideModelName(ev.model ? String(ev.model) : "") || undefined,
              });
              trace.phase = "agents";
              publish();
            } else if (ev.type === "agent:done") {
              const st = ev.stage as {
                id?: string; name: string; ok: boolean;
                emoji?: string; color?: string; role?: string; model?: string;
              };
              upsertAgent({
                id: String(st.id ?? st.name),
                name: st.name,
                status: st.ok ? "done" : "skipped",
                emoji: st.emoji,
                color: st.color,
                role: st.role,
                model: hideModelName(st.model) || undefined,
              });
              publish();
            } else if (ev.type === "synthesis:start") {
              for (const a of trace.agents) if (a.status === "running") a.status = "done";
              addStep("synthesis", "Synthesizing answer");
              trace.phase = "synthesis";
              publish();
            } else if (ev.type === "verify") {
              const status = ev.status as "passed" | "failed" | "fixed";
              trace.verify = status;
              trace.phase = "verify";
              addStep(
                "verify",
                status === "passed" ? "Code verified" : status === "fixed" ? "Code auto-fixed" : "Code failed the check",
              );
              const vs = trace.steps.find((s) => s.id === "verify");
              if (vs) vs.status = "done";
              publish();
            } else if (ev.type === "retry") {
              addStep("retry", "Trying another model");
              publish();
            } else if (ev.type === "done") {
              finalText = String(ev.final ?? "");
              who = hideModelName(String(ev.model ?? ev.synthesizedBy ?? who));
            } else if (ev.type === "error") {
              throw new Error(String(ev.message ?? ev.error ?? "pipeline error"));
            }
          }
        }

        if (finalText) {
          for (const a of trace.agents) if (a.status === "running") a.status = "done";
          for (const s of trace.steps) s.status = "done";
          // aakhri qadam: local master — naam UI pe nahi
          if (ollamaReady(ollama)) {
            addStep("master", "Writing final answer");
            publish();
          }
          const polished = await polishLocal(finalText);
          for (const s of trace.steps) s.status = "done";
          const snap: TraceState = {
            ...trace,
            agents: trace.agents.map((a) => ({ ...a })),
            steps: trace.steps.map((s) => ({ ...s })),
          };
          patchMessage(convId, assistantId, {
            content: polished,
            thinking: [isDeep ? "Deep Think" : "Agent team"],
            trace: snap,
            streaming: false,
          });
          setPipelineInfo({
            agents: who || (isDeep ? "Deep Think" : snap.agents.map((a) => a.name).join(", ") || "Agent team"),
            orchestrator: snap.agents.map((a) => a.name).join(" · "),
          });
          setLocalStream(false);
          return;
        }
        // Kuch na mila to neeche wala aam raasta chal jayega.
        patchMessage(convId, assistantId, { trace: undefined });
      } catch {
        // Deep/Agents nakaam — chup chaap aam chat par gir jao. User ko
        // khali screen dena sab se bura natija hai.
        patchMessage(convId, assistantId, { trace: undefined });
      }
    }

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

        // Capture pipeline info from headers — model naam UI pe nahi
        setPipelineInfo({
          agents: hideModelName(res.headers.get("x-nexora-agents") || res.headers.get("x-agents-used")) || "Nexora AI",
          orchestrator: hideModelName(res.headers.get("x-nexora-master") || res.headers.get("x-orchestrator")) || "",
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
            const polished = await polishLocal(full || "No response");
            patchMessage(convId, assistantId, { content: polished, streaming: false });
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
          if (!cancelRef.current) {
            const polished = await polishLocal(fullText);
            patchMessage(convId, assistantId, { content: polished, streaming: false });
          }
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

    result = { ...result, text: await polishLocal(result.text) };

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
      trace: undefined,
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
    abortRef.current?.abort();
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
            {(["fast", "balanced", "deep", "agents"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-[11px] font-medium transition",
                  mode === m
                    ? "bg-coral text-white"
                    : "text-muted hover:text-ink-soft dark:hover:text-cream"
                )}
                title={
                  m === "fast"
                    ? "1-2 models, foran jawab"
                    : m === "balanced"
                      ? "3-4 models — rozmarra ke liye"
                      : m === "deep"
                        ? "Deep Think: khud web search karta hai, page parhta hai, code CHALA kar check karta hai"
                        : "Agent team: engineer + reviewer + tester + docs, sab mil kar"
                }
              >
                {m === "fast" ? "Fast" : m === "balanced" ? "Balanced" : m === "deep" ? "🧠 Deep" : "🤖 Agents"}
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
