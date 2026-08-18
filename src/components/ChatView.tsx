import { useEffect, useRef, useState } from "react";
import { useStore, newId, type TraceAgent, type TraceState } from "../lib/store";
import { generateReply, tokenize, type ChatTurn, type BrainResult } from "../lib/brain";
import { getModel } from "../lib/models";
import type { ModelId } from "../lib/models";
import { MessageItem, firstCodeBlock, LANG_FILE } from "./Message";
import { ChatInput } from "./ChatInput";
import { getPersonality, type PersonalityId } from "../lib/personalities";
import { chatReal, chatServer, chatStream, systemPrompt, resolveActive, explainError, browserOk, getProvider, hasProxy } from "../lib/realai";
import { chatOllama, chatOllamaStream, ollamaReady, ollamaReachable, ollamaModels, pickBestModel, pickFastModel, hideModelName, type OllamaConfig } from "../lib/ollama";
import { needsResearch, research } from "../lib/research";
import { ArtifactsPanel, type Artifact } from "./ArtifactsPanel";
import { SparkleIcon, BoltIcon, BookIcon, PencilIcon } from "./icons";
import { cn } from "../utils/cn";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── OLLAMA-FIRST HELPERS ─────────────────────────────────────────────
// Nexora ka MAIN engine ab local Ollama hai. Ye helpers decide karte
// hain kab local bole aur kab cloud (web search + multi-model) support
// ban jata hai.

/** URL ho to CLOUD — webFetch server-side chalti hai (client-safe
 *  nahi). Baaki fresh-data sawal Ollama + web-search se hote hain. */
function hasUrlIn(text: string): boolean {
  return /https?:\/\/|\b(?:github|gitlab|npmjs|stackoverflow)\.com\//i.test(text);
}

/** Ollama ke liye web research — agar chahiye (web toggle ya current
 *  events) to live results la kar prompt me inject. 8s cap. */
async function researchForOllama(text: string): Promise<string> {
  try {
    const ctx = await Promise.race([
      research(text),
      new Promise<string>((resolve) => setTimeout(() => resolve(""), 8000)),
    ]);
    return ctx.trim() ? `\n\n[WEB RESEARCH — abhi fetch hua, is par apni training se zyada bharosa karo]\n${ctx.trim()}` : "";
  } catch {
    return "";
  }
}

/** Ollama ke liye memory — logged-in user ke Nexora Brain se matching
 *  facts inject karo (existing /api/brain se). 4s cap. */
async function memoryForOllama(text: string): Promise<string> {
  try {
    const mem = await Promise.race([
      (async () => {
        const r = await fetch("/api/brain", { credentials: "include" });
        if (!r.ok) return "";
        const d = await r.json();
        const items: { question: string; preview: string }[] = d?.items ?? [];
        const words = new Set(text.toLowerCase().split(/\W+/).filter((w) => w.length > 3));
        const hits = items
          .filter((it) => {
            const qw = new Set((it.question || "").toLowerCase().split(/\W+/).filter((w) => w.length > 3));
            let score = 0;
            for (const w of words) if (qw.has(w)) score++;
            return score >= 2;
          })
          .slice(0, 3);
        if (!hits.length) return "";
        return (
          "\n\n[MEMORY — user ke pehle bataye hue facts]\n" +
          hits.map((h) => `• Q: ${h.question} → ${String(h.preview || "").slice(0, 150)}`).join("\n")
        );
      })(),
      new Promise<string>((resolve) => setTimeout(() => resolve(""), 4000)),
    ]);
    return mem;
  } catch {
    return "";
  }
}

/** SELF-REVIEW (Reflexion) — chhota tez model jawab ka review karta hai.
 *  Sahi ho to "OK" bolta hai (original rehta hai); warna behtar version
 *  deta hai. Code answers ke liye mat use karo (verify ho chuke hain). */
async function reflectLocal(
  cfg: OllamaConfig,
  userText: string,
  answer: string,
): Promise<string> {
  if (!answer.trim()) return answer;
  try {
    const out = await Promise.race([
      chatOllama(cfg, {
        system:
          "You are a strict quality reviewer for a chat assistant. " +
          "Improve the answer ONLY if it is wrong, incomplete, or confusing.",
        messages: [
          {
            role: "user",
            content:
              `QUESTION:\n${userText.slice(0, 500)}\n\n` +
              `DRAFT ANSWER:\n${answer.slice(0, 6000)}\n\n` +
              'TASK: If the draft fully answers the question correctly and completely, ' +
              'reply with exactly "OK". Otherwise reply ONLY with an improved, corrected, ' +
              'more complete version — no explanations, no preamble, same language.',
          },
        ],
        signal: AbortSignal.timeout(15000),
      }),
      new Promise<string>((resolve) => setTimeout(() => resolve(""), 15000)),
    ]);
    const t = out.trim();
    if (!t || /^OK$/i.test(t)) return answer;
    // Improved version tabhi accept karo jab itna content ho (behtar se
    // kamzor na ho jaye). Chhota/short reply = reject, original rakho.
    if (t.length < answer.length * 0.5) return answer;
    return t;
  } catch {
    return answer;
  }
}

/** Nexora Brain me achha jawab save karo — agli baar 0ms. Guest = skip. */
async function saveBrain(question: string, answer: string): Promise<boolean> {
  try {
    const r = await fetch("/api/brain", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: question.slice(0, 300),
        answer: answer.slice(0, 4000),
        source: "local",
      }),
    });
    if (!r.ok) return false;
    const d = await r.json().catch(() => ({}));
    return d?.ok === true;
  } catch {
    return false;
  }
}

/** LOCAL TRIAGE — Ollama khud batata hai ke sawal ko kya chahiye:
 *  web? code? complex? (chhota, tez call — regex ka smart replacement).
 *  Fail ho to null → caller regex fallback use karta hai. */
async function localTriage(
  ollama: OllamaConfig,
  text: string,
): Promise<{ web: boolean; mode: "direct" | "research" | "code" | "complex" } | null> {
  try {
    const raw = await Promise.race([
      chatOllama(ollama, {
        system:
          "Classify the user's question. Reply with ONLY JSON, no fence, no explanation: " +
          '{"web":true/false,"mode":"direct"|"research"|"code"|"complex"}. ' +
          "web=true jab jawab ko FRESH/current info chahiye (news, price, latest, weather, sports, 'abhi', 'aaj', 'current', version). " +
          "mode: code = programming help; complex = multi-step/deep analysis; research = web chahiye; direct = baqi sab.",
        messages: [{ role: "user", content: text.slice(0, 400) }],
        signal: AbortSignal.timeout(6000),
      }),
      new Promise<string>((resolve) => setTimeout(() => resolve(""), 6000)),
    ]);
    const m = raw.trim().match(/\{[\s\S]*\}/);
    if (!m) return null;
    const j = JSON.parse(m[0]) as { web?: unknown; mode?: unknown };
    if (typeof j?.web !== "boolean") return null;
    const mode = ["direct", "research", "code", "complex"].includes(String(j.mode))
      ? (j.mode as "direct" | "research" | "code" | "complex")
      : "direct";
    return { web: j.web, mode };
  } catch {
    return null;
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
  onOpenSidebar: _onOpenSidebar,
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
    trimFrom,
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
  const [prefill, setPrefill] = useState<string | null>(null);

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

    // ── OLLAMA-FIRST — SMART LADDER (LOCAL AI MAIN ENGINE) ─────────────
    // Behtar workflow: LOCAL TRIAGE → L1 direct → L2 +web → L2b code
    // verify/fix → L3 cloud. Ollama khud faisla karta hai (regex sirf
    // fallback), code answers sandbox me VERIFY hote hain aur error par
    // EK dafa auto-fix hota hai. Cloud sirf jab: URL, complex sawal,
    // ya local na de saka. Ollama aakhir me cloud answer polish bhi
    // karta hai (polishLocal).
    if (!realConfig && !hasUrlIn(userText) && (await ollamaReachable(ollama))) {
      patchMessage(convId, assistantId, { thinking: ["Local AI soch raha hai…"] });

      // ── LOCAL MODEL ENSEMBLE (naya) ──
      // Multiple models installed hon to: answer ke liye SABSE TAQATWAR,
      // triage/review ke liye sabse CHHOTA tez model. User ki setting
      // respect hoti hai (pickBest/Fast current ko pehle rakhta hai).
      const localModels = await ollamaModels(ollama).catch(() => null) ?? null;
      const bestCfg: OllamaConfig = localModels?.length
        ? { ...ollama, model: pickBestModel(localModels, ollama.model) }
        : ollama;
      const fastCfg: OllamaConfig = localModels?.length
        ? { ...ollama, model: pickFastModel(localModels, ollama.model) }
        : ollama;

      const triage = await localTriage(fastCfg, userText);
      const needWeb = web || (triage?.web ?? needsResearch(userText));
      const isCode =
        triage?.mode === "code" ||
        /\b(code|function|bug|error|javascript|python|react|api|html|css|sql|typescript)\b/i.test(userText);
      const complex = triage?.mode === "complex";

      let localAnswer = "";
      let good = false;
      const runLocal = async (sys: string): Promise<boolean> => {
        try {
          let ok = false;
          await chatOllamaStream(
            bestCfg,
            {
              system: sys,
              messages: [...history, { role: "user", content: userText }],
              signal: AbortSignal.timeout(30_000),
            },
            (partial) => {
              if (!cancelRef.current) patchMessage(convId, assistantId, { content: partial });
            },
          )
            .then((t) => {
              const junk =
                !t.trim() ||
                t.trim().length < 15 ||
                /^(i (don't|do not|cannot|can't|am unable)|sorry|mujhe nahi pata|main nahi jaanta)/i.test(
                  t.trim(),
                );
              ok = !junk;
              if (ok) localAnswer = t.trim();
            })
            .catch(() => {
              ok = false;
            });
          return ok;
        } catch {
          return false;
        }
      };

      if (!complex) {
        // L1 — direct local (memory ke saath)
        let sys = systemPrompt(personality) + (await memoryForOllama(userText));
        if (!needWeb) good = await runLocal(sys);

        // L2 — local + LIVE WEB (jab web chahiye ya L1 na chal saka)
        if ((needWeb || !good) && !cancelRef.current) {
          patchMessage(convId, assistantId, { thinking: ["Searching the web…"] });
          sys =
            systemPrompt(personality) +
            (await researchForOllama(userText)) +
            (await memoryForOllama(userText));
          good = await runLocal(sys);
        }

        // L2b — CODE VERIFY + 1 AUTO-FIX (code answers ka quality gate)
        if (good && isCode && !cancelRef.current) {
          const block = localAnswer.match(/```(?:js|javascript|ts|typescript)\s*\n([\s\S]*?)```/i);
          if (block && block[1].trim().length > 0 && block[1].trim().length <= 6000) {
            patchMessage(convId, assistantId, { thinking: ["Verifying code…"] });
            const vr = await fetch("/api/execute", {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ code: block[1].trim() }),
            }).catch(() => null);
            const vd = vr ? await vr.json().catch(() => null) : null;
            if (vr?.ok && vd && !vd.error) {
              patchMessage(convId, assistantId, {
                thinking: ["✅ Code verified"],
                content: localAnswer + "\n\n---\n*✅ Code sandbox me chala kar verify kiya gaya — theek chalta hai.*",
              });
            } else if (vd?.error && !cancelRef.current) {
              // EK dafa auto-fix — error wapas local AI ko
              patchMessage(convId, assistantId, { thinking: ["Code me error — local fix kar raha hai…"] });
              const fixed = await runLocal(
                systemPrompt(personality) +
                  `\n\nTumhara likha hua code ye error de raha hai:\n${String(vd.error).slice(0, 400)}\n\nSIRF code block dobara likho (fix ke saath).` +
                  (await memoryForOllama(userText)),
              );
              if (fixed && !cancelRef.current) {
                patchMessage(convId, assistantId, {
                  content: localAnswer,
                  streaming: false,
                  thinking: ["✅ Code fixed"],
                });
              } else {
                patchMessage(convId, assistantId, { thinking: [] });
              }
            } else {
              patchMessage(convId, assistantId, { thinking: [] });
            }
          }
        }

        // L2c — SELF-REVIEW (Reflexion, naya): chhota tez model final
        // jawab ka EK dafa review karta hai. Code answers skip (verify
        // ho chuke — review unhe bigad sakta hai).
        let finalText = localAnswer;
        let memoryNote = "";
        if (good && !cancelRef.current && !isCode) {
          patchMessage(convId, assistantId, { thinking: ["Reviewing answer…"] });
          const reviewed = await reflectLocal(fastCfg, userText, localAnswer);
          if (reviewed && reviewed !== localAnswer) {
            finalText = reviewed;
            patchMessage(convId, assistantId, { content: finalText });
          }
          patchMessage(convId, assistantId, { thinking: [] });
        }

        // 🧠 YAAD — achha local jawab Nexora Brain me save (agli baar 0ms)
        if (good && !cancelRef.current) {
          const saved = await saveBrain(userText, finalText);
          if (saved) {
            memoryNote =
              "\n\n---\n*🧠 Ye jawab Nexora Brain me yaad ho gaya — agli baar foran milega.*";
          }
        }

        if (good && !cancelRef.current) {
          setPipelineInfo({
            agents: needWeb ? "Local AI + Web" : isCode ? "Local AI + Verify" : "Local AI + Review",
            orchestrator: hideModelName(ollama.model) || "Ollama",
          });
          patchMessage(convId, assistantId, { content: finalText + memoryNote, streaming: false });
          setLocalStream(false);
          return;
        }
        if (cancelRef.current) {
          setLocalStream(false);
          return;
        }
        // Local na de saka — cloud (L3) sambhalta hai.
        patchMessage(convId, assistantId, { thinking: ["Local AI ne theek jawab na diya — cloud le raha hai"] });
      } else {
        // complex → seedha cloud (L3) — local sirf final polish karega
        patchMessage(convId, assistantId, { thinking: [] });
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

    // 🔒 FIX: edit ke baad prefill khali karo — warna wohi text agle
    // send par dobara input me aa sakta tha.
    setPrefill(null);

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

  const handleEdit = (msgId: string, text: string) => {
    if (!activeId || isStreaming) return;
    trimFrom(activeId, msgId);
    setPrefill(text);
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
                  // 🔒 FIX: pehle handleEdit yahan pass hi nahi hota tha —
                  // edit button kabhi dikhta hi nahi tha (dead feature).
                  onEdit={handleEdit}
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
                prefill={prefill}
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
