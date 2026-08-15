// /api/chat/master — SMART ORCHESTRATOR + MULTI-AGENT CONSENSUS.
//
// ARCHITECTURE:
// Question → CLASSIFY → SELECT AGENTS → PARALLEL RUN → JUDGE → MASTER → STREAM
//
// ACCESS CONTROL: Enforces plan-based model access + usage limits.

import { getUser, getPlanConfig, isModelAllowed, checkUsageLimit, logUsage } from "@/lib/accessControl";

// The Orchestrator classifies the question (coding, math, research, etc.),
// selects the BEST models for that task, runs them in parallel alongside
// web research (when needed), then a Judge verifies all answers, and finally
// a Master AI synthesizes one definitive response.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

type Msg = { role: string; content: string };

// ─── Model registry ───
interface ModelConfig {
  id: string;
  name: string;
  url: string;
  model: string;
  key?: string;
  tags: string[]; // coding, reasoning, fast, creative, knowledge, math
}

const MODELS: ModelConfig[] = [
  { id: "groq-llama", name: "Llama 3.3 70B", url: "https://api.groq.com/openai/v1/chat/completions", model: "llama-3.3-70b-versatile", key: process.env.GROQ_API_KEY || "", tags: ["reasoning", "coding", "knowledge", "math", "creative", "general"] },
  { id: "groq-gptoss", name: "GPT-OSS 120B", url: "https://api.groq.com/openai/v1/chat/completions", model: "openai/gpt-oss-120b", key: process.env.GROQ_API_KEY || "", tags: ["reasoning", "knowledge", "math"] },
  { id: "bl-deepseek", name: "DeepSeek V4", url: "https://api.bazaarlink.ai/v1/chat/completions", model: "deepseek/deepseek-v4-flash:free", key: process.env.BAZAARLINK_API_KEY || "", tags: ["coding", "reasoning", "knowledge"] },
  { id: "bl-qwen", name: "Qwen 3.7", url: "https://api.bazaarlink.ai/v1/chat/completions", model: "qwen/qwen3.7-flash:free", key: process.env.BAZAARLINK_API_KEY || "", tags: ["coding", "knowledge", "creative"] },
  { id: "af-mistral", name: "Mistral Large", url: "https://api.airforce/v1/chat/completions", model: "mistral-large-latest", key: process.env.AIRFORCE_API_KEY || "", tags: ["reasoning", "creative", "knowledge", "general"] },
  { id: "or-nemotron", name: "Nemotron 120B", url: "https://openrouter.ai/api/v1/chat/completions", model: "nvidia/nemotron-3-super-120b-a12b:free", key: process.env.OPENROUTER_API_KEY || "", tags: ["reasoning", "knowledge"] },
  { id: "or-nemotron-ultra", name: "Nemotron 550B", url: "https://openrouter.ai/api/v1/chat/completions", model: "nvidia/nemotron-3-ultra-550b-a55b:free", key: process.env.OPENROUTER_API_KEY || "", tags: ["reasoning", "knowledge", "general"] },
  { id: "or-gemma", name: "Gemma 4 31B", url: "https://openrouter.ai/api/v1/chat/completions", model: "google/gemma-4-31b-it:free", key: process.env.OPENROUTER_API_KEY || "", tags: ["knowledge", "general", "fast"] },
  { id: "or-gptoss", name: "GPT-OSS 120B", url: "https://openrouter.ai/api/v1/chat/completions", model: "openai/gpt-oss-120b:free", key: process.env.OPENROUTER_API_KEY || "", tags: ["reasoning", "coding", "knowledge", "math"] },
  { id: "or-deepseek", name: "DeepSeek Chat", url: "https://openrouter.ai/api/v1/chat/completions", model: "deepseek/deepseek-chat-v3.1:free", key: process.env.OPENROUTER_API_KEY || "", tags: ["reasoning", "coding", "knowledge", "general"] },
  { id: "or-qwen-coder", name: "Qwen 3 Coder", url: "https://openrouter.ai/api/v1/chat/completions", model: "qwen/qwen3-coder:free", key: process.env.OPENROUTER_API_KEY || "", tags: ["coding", "reasoning"] },
  { id: "llm7-gemini", name: "Gemini Flash", url: "https://api.llm7.io/v1/chat/completions", model: "gemini-3.1-flash-lite", tags: ["fast", "general", "knowledge"] },
  { id: "gemini", name: "Gemini 2.5 Flash", url: "gemini", model: "gemini-2.5-flash", key: process.env.GEMINI_API_KEY || "", tags: ["reasoning", "knowledge", "general", "creative", "fast"] },
  { id: "cerebras-gptoss", name: "Cerebras GPT-OSS 120B", url: "https://api.cerebras.ai/v1/chat/completions", model: "gpt-oss-120b", key: process.env.CEREBRAS_API_KEY || "", tags: ["reasoning", "coding", "knowledge", "math", "general"] },
  { id: "cerebras-glm", name: "Cerebras GLM 4.7", url: "https://api.cerebras.ai/v1/chat/completions", model: "zai-glm-4.7", key: process.env.CEREBRAS_API_KEY || "", tags: ["reasoning", "knowledge", "general"] },
  { id: "deepseek-chat", name: "DeepSeek Chat", url: "https://api.deepseek.com/v1/chat/completions", model: "deepseek-chat", key: process.env.DEEPSEEK_API_KEY || "", tags: ["reasoning", "coding", "knowledge", "general"] },
  { id: "pollinations", name: "GPT-OSS Fast", url: "https://text.pollinations.ai/openai", model: "openai-fast", tags: ["fast", "general"] },
];

// Capability ranking — models with keys available are preferred in this order
// (best/smartest first). Used to auto-pick the strongest models for a request.
const MODEL_PRIORITY: string[] = [
  "gemini",
  "groq-llama",
  "cerebras-gptoss",
  "cerebras-glm",
  "or-nemotron-ultra",
  "or-gptoss",
  "groq-gptoss",
  "or-deepseek",
  "deepseek-chat",
  "or-nemotron",
  "or-gemma",
  "bl-deepseek",
  "bl-qwen",
  "af-mistral",
  "llm7-gemini",
  "or-qwen-coder",
  "pollinations",
];

/** Only models whose key is actually set (or keyless) are "available". */
function availableModels(all: ModelConfig[]): ModelConfig[] {
  return all.filter((m) => {
    if (m.url === "gemini") return !!m.key;
    if (m.url.includes("openrouter")) return !!m.key; // OR needs a key
    if (m.key) return !!m.key;          // provider requiring a key
    return true;                        // keyless (llm7, pollinations, etc.)
  });
}

/** Rank available models by capability, best first. */
function rankByPriority(list: ModelConfig[]): ModelConfig[] {
  const sorted = [...list].sort((a, b) => {
    const ia = MODEL_PRIORITY.indexOf(a.id);
    const ib = MODEL_PRIORITY.indexOf(b.id);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });
  return sorted;
}

// ─── ORCHESTRATOR: Classify question ───
interface Classification {
  type: "coding" | "math" | "research" | "current_events" | "creative" | "general";
  complexity: "simple" | "medium" | "complex";
  needsWebSearch: boolean;
  needsConsensus: boolean;
  selectedTags: string[];
  reasoning: string;
}

// ─── MODE: fast (1-2 models), balanced (3-4 + tools), deep (5+ + full pipeline) ───
type Mode = "fast" | "balanced" | "deep";

function selectAgentsByMode(classification: Classification, mode: Mode, available: ModelConfig[]): ModelConfig[] {
  const av = availableModels(available);
  const ranked = rankByPriority(av);

  if (mode === "fast") {
    // Fast: just the single best available model.
    return ranked.slice(0, 1);
  }

  const needs = classification.selectedTags;

  if (mode === "balanced") {
    if (!classification.needsConsensus) {
      // Simple question: best 1 model.
      return ranked.slice(0, 1);
    }
    // Consensus: take best models that match the task tags, up to 4.
    const matching = ranked.filter((m) => m.tags.some((t) => needs.includes(t)));
    const pool = matching.length ? matching : ranked;
    return pool.slice(0, 4);
  }

  // deep: best 5 that match, fall back to any available.
  const matching = ranked.filter((m) => m.tags.some((t) => needs.includes(t)));
  const pool = matching.length ? matching : ranked;
  return pool.slice(0, 5);
}

function classifyQuestion(question: string): Classification {
  const q = question.toLowerCase();
  const words = question.trim().split(/\s+/).length;

  // Detect type
  let type: Classification["type"] = "general";
  let needsWebSearch = false;
  let selectedTags: string[] = ["general"];

  if (/\b(code|coding|program|python|javascript|function|bug|error|react|api|html|css|sql|node|typescript|debug|compile|algorithm|class|method|variable|array)\b/i.test(q)) {
    type = "coding";
    selectedTags = ["coding", "reasoning"];
  } else if (/\b(calculate|solve|equation|math|integral|derivative|probability|compute|what is \d|\d+\s*[+\-*/^%])\b/i.test(q)) {
    type = "math";
    selectedTags = ["math", "reasoning"];
  } else if (/\b(latest|news|today|current|happened|trending|2026|price|score|weather|who won|update|stock|bitcoin)\b/i.test(q)) {
    type = "current_events";
    needsWebSearch = true;
    selectedTags = ["knowledge", "reasoning", "general"];
  } else if (/\b(research|study|paper|analysis|compare|versus|vs|pros and cons|evaluate|investigate|deep dive)\b/i.test(q)) {
    type = "research";
    needsWebSearch = true;
    selectedTags = ["reasoning", "knowledge", "general"];
  } else if (/\b(write|story|poem|essay|creative|script|song|novel|character|dialogue|imagine)\b/i.test(q)) {
    type = "creative";
    selectedTags = ["creative", "general"];
  } else if (/\b(what is|who is|explain|how does|why|when|where|define|tell me about|history of)\b/i.test(q)) {
    type = "general";
    selectedTags = ["knowledge", "general", "reasoning"];
    if (words > 10) needsWebSearch = true;
  }

  // Detect complexity
  let complexity: Classification["complexity"] = "medium";
  if (words <= 6 && !needsWebSearch) complexity = "simple";
  else if (words > 20 || /\b(explain in detail|comprehensive|step by step|complete guide|full analysis)\b/i.test(q)) complexity = "complex";

  // Decide if consensus is needed
  const needsConsensus = complexity !== "simple" || type === "research" || type === "current_events";

  // For general knowledge questions, add web search
  if (type === "general" && complexity === "complex") needsWebSearch = true;

  const reasoning = `Type: ${type} | Complexity: ${complexity} | Web: ${needsWebSearch ? "yes" : "no"} | Consensus: ${needsConsensus ? "yes" : "no"}`;

  return { type, complexity, needsWebSearch, needsConsensus, selectedTags, reasoning };
}

// ─── ORCHESTRATOR: Select agents based on classification ───
function selectAgents(classification: Classification): ModelConfig[] {
  // For simple questions, use just 1-2 fast+smart models
  if (!classification.needsConsensus) {
    return MODELS.filter((m) => m.id === "groq-llama");
  }

  // Select models that match the required tags
  const matching = MODELS.filter((m) =>
    m.tags.some((tag: string) => classification.selectedTags.includes(tag))
  );

  // Remove duplicates and models without keys (if key is required)
  const valid = matching.filter((m) => {
    if (!m.key && m.url.includes("openrouter")) return false; // skip OR if no key
    return true;
  });

  // Cap at 5 models to control latency/cost
  const selected = valid.slice(0, 5);

  // Always ensure Llama 70B is included (best overall)
  if (!selected.find((m) => m.id === "groq-llama")) {
    selected.unshift(MODELS[0]);
  }

  return selected.slice(0, 5);
}

// ─── Model caller (OpenAI-compatible, plus special Gemini format) ───
async function callModel(model: ModelConfig, system: string, messages: Msg[], timeoutMs: number): Promise<{ name: string; text: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    // Gemini uses its own API format (not OpenAI-compatible).
    if (model.url === "gemini") {
      if (!model.key) throw new Error(`${model.name} no key`);
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model.model}:generateContent?key=${encodeURIComponent(model.key)}`;
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
          generationConfig: { temperature: 0.7 },
        }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(`${model.name} failed: ${d?.error?.message || r.status}`);
      const text = d?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ?? "";
      if (!text || text.length < 5) throw new Error(`${model.name} empty`);
      return { name: model.name, text };
    }

    const r = await fetch(model.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(model.key ? { Authorization: `Bearer ${model.key}` } : {}) },
      body: JSON.stringify({ model: model.model, messages: [{ role: "system", content: system }, ...messages], temperature: 0.7 }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`${model.name} failed`);
    const text = d?.choices?.[0]?.message?.content ?? "";
    if (!text || text.length < 5) throw new Error(`${model.name} empty`);
    return { name: model.name, text };
  } catch {
    clearTimeout(timer);
    return { name: model.name, text: "" };
  }
}

// ─── Web research (Bing + Wikipedia) ───
async function webResearch(query: string): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  const clean = query.replace(/[?.!]/g, "").trim().slice(0, 80);
  const term = clean.replace(/\s+/g, "_").slice(0, 50);
  const [bingR, wikiR] = await Promise.allSettled([
    fetch(`https://r.jina.ai/https://www.bing.com/search?q=${encodeURIComponent(clean)}`, { headers: { Accept: "text/plain" }, signal: ctrl.signal }),
    fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(term)}`, { signal: ctrl.signal }),
  ]);
  clearTimeout(timer);
  const results: string[] = [];
  if (bingR.status === "fulfilled") {
    const text = await bingR.value.text().catch(() => "");
    const useful = text.replace(/^[\s\S]*?(?:results|Markdown Content:)/i, "")
      .replace(/\[(?:Skip|Image|Privacy|Terms|Accessibility|Close)[^\]]*\]/gi, "")
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/https?:\/\/r\.bing\.com\/[^\s)]+/g, "")
      .replace(/\n{3,}/g, "\n\n").trim().slice(200, 1500).replace(/\s+/g, " ").trim();
    if (useful.length > 30) results.push(`Web: ${useful}`);
  }
  if (wikiR.status === "fulfilled") {
    const w = await wikiR.value.json().catch(() => null);
    if (w?.extract) results.push(`Wikipedia: ${w.extract.slice(0, 200)}`);
  }
  return results.join("\n");
}

// ─── Stream helper ───
function streamResponse(res: Response): ReadableStream<Uint8Array> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  return new ReadableStream({
    async start(controller) {
      let buffer = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            if (line.startsWith("data: ") && !line.includes("[DONE]")) {
              try {
                const json = JSON.parse(line.slice(6));
                const content = json.choices?.[0]?.delta?.content;
                if (content) controller.enqueue(new TextEncoder().encode(content));
              } catch {}
            }
          }
        }
      } catch {}
      controller.close();
    },
  });
}

// ═══════════════════════════════════════════
// MAIN ORCHESTRATOR PIPELINE
// ═══════════════════════════════════════════
export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  if (!b?.messages) return new Response("Missing messages", { status: 400 });

  const now = new Date();
  const year = now.getUTCFullYear();
  const lastUser = [...b.messages].reverse().find((m: Msg) => m.role === "user")?.content || "";
  const groqKey = process.env.GROQ_API_KEY || "";

  const mode: Mode = (b.mode as Mode) || "balanced";
  // ─── ACCESS CONTROL: identify user, check plan, filter models ───
  const authUser = await getUser(req);
  const planConfig = authUser ? await getPlanConfig(authUser) : null;

  // Filter models by plan, then keep only the ones with keys actually set.
  const planFiltered = planConfig
    ? MODELS.filter((m) => isModelAllowed(m.id, planConfig))
    : MODELS;
  const accessibleModels = availableModels(planFiltered);

  // Check usage limits for non-admin
  if (authUser && authUser.plan !== "admin") {
    const usage = await checkUsageLimit(authUser, planConfig);
    if (!usage.allowed) {
      return new Response(
        JSON.stringify({ error: "Monthly limit reached. Upgrade to Pro for more messages." }),
        { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
  }

  const baseSystem = `You are Nexora, a highly capable AI assistant with broad expertise across science, technology, history, culture, geography, health, business, math, programming, and current events.

Date: ${now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}. Year: ${year}.

Answer the user's question with detail, accuracy, and genuine usefulness. Give real facts, concrete examples, and clear reasoning. For code, write complete working examples. Answer in the user's language (Roman Urdu, Urdu, Hindi, English). Use Markdown (bold, bullets, code). Be honest when unsure. If web research is provided, use it for accuracy.`;

  // ─── STEP 1: ORCHESTRATOR — Classify the question ───
  const classification = classifyQuestion(lastUser);

  // In deep mode, always enable web search
  if (mode === "deep") classification.needsWebSearch = true;

  // ─── STEP 2: SELECT AGENTS based on classification + mode ───
  const selectedAgents = selectAgentsByMode(classification, mode, accessibleModels);

  // ─── STEP 3a: SIMPLE question → single model, no consensus ───
  if (!classification.needsConsensus) {
    const best = selectedAgents[0];
    // Prefer Gemini (smartest free model) when a key is set; fall back to others.
    const gemKey = process.env.GEMINI_API_KEY || "";
    if (gemKey && (!best || best.id !== "gemini")) {
      try {
        const gres = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(gemKey)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: baseSystem }] },
              contents: b.messages.map((m: Msg) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
              generationConfig: { temperature: 0.7 },
            }),
          }
        );
        const gd = await gres.json().catch(() => ({}));
        const gtext = gd?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ?? "";
        if (gres.ok && gtext) {
          if (authUser) logUsage({ userId: authUser.id, type: classification.type, mode, success: true }).catch(() => {});
          return new Response(gtext, {
            headers: { "Content-Type": "text/plain; charset=utf-8", "X-Orchestrator": classification.reasoning, "X-Model": "gemini-2.5-flash", ...corsHeaders },
          });
        }
      } catch {}
    }
    // Fall back to the next best available model if Gemini failed.
    if (best) {
      const r2 = await callModel(best, baseSystem, b.messages, 15000);
      if (r2.text) {
        if (authUser) logUsage({ userId: authUser.id, type: classification.type, mode, success: true }).catch(() => {});
        return new Response(r2.text, {
          headers: { "Content-Type": "text/plain; charset=utf-8", "X-Orchestrator": classification.reasoning, "X-Model": best.name, ...corsHeaders },
        });
      }
    }
  }

  // ─── STEP 3b: COMPLEX question → multi-agent consensus pipeline ───

  // Always run web research in the consensus path so the AI has current,
  // accurate facts (free models have limited knowledge cutoffs).
  const researchPromise = webResearch(lastUser);

  const agentPromises = selectedAgents.map((m) => callModel(m, baseSystem, b.messages, 10000));

  // Wait for everything
  const [research, ...agentResults] = await Promise.all([researchPromise, ...agentPromises]);

  // Collect successful answers (don't let failed agents break the pipeline)
  const answers = agentResults.filter((a) => a.text.length > 10);
  const agentNames = answers.map((a) => a.name);

  if (answers.length === 0) {
    return new Response("__STREAM_FAILED__", { status: 502, headers: corsHeaders });
  }

  // If only 1 agent succeeded, stream its answer directly (no synthesis needed)
  if (answers.length === 1) {
    return new Response(answers[0].text, {
      headers: { "Content-Type": "text/plain; charset=utf-8", "X-Orchestrator": classification.reasoning, "X-Agents": agentNames.join(", "), ...corsHeaders },
    });
  }

  // ─── STEP 4: JUDGE / VERIFIER + MASTER SYNTHESIS (combined for efficiency) ───
  const allAnswers = answers.map((a, i) => `### Agent ${i + 1} (${a.name}):\n${a.text}`).join("\n\n---\n\n");

  const masterSystem = `You are the MASTER AI of Nexora — a consensus orchestrator and verifier.

Multiple AI agents answered the user's question. Your job:

1. VERIFY: Compare all agent answers. Detect contradictions, factual errors, or unsupported claims.
2. EVALUATE: Which agent provided the most accurate, complete, and well-reasoned answer?
3. SYNTHESIZE: Combine the BEST information from all agents into ONE definitive answer.

${research ? `4. CROSS-CHECK: Verify claims against the web research data provided below. Prioritize information that is supported by both agent consensus AND web research.` : ""}

RULES:
- Write naturally as the final answer — do NOT mention "agents", "models", or "verification".
- If agents contradict each other, present the most accurate/verified information.
- Be thorough, accurate, engaging, and genuinely helpful.
- Use the user's language (Roman Urdu, Urdu, Hindi, English).
- Use Markdown: **bold**, bullets, tables, \`code\` blocks.`;

  const masterInput = `${research ? `WEB RESEARCH:\n${research}\n\n` : ""}AGENT ANSWERS:\n${allAnswers}\n\nUSER'S QUESTION: ${lastUser}\n\nWrite the definitive final answer:`;

  // ─── STEP 5: STREAM the Master AI's answer ───
  // Primary: Groq Llama 70B (fast + smart); OpenRouter Nemotron 550B & GPT-OSS
  // as strong alternatives via the user's OpenRouter key.
  const masterProviders = [
    { url: "https://api.groq.com/openai/v1/chat/completions", model: "llama-3.3-70b-versatile", key: groqKey },
    { url: "https://openrouter.ai/api/v1/chat/completions", model: "nvidia/nemotron-3-ultra-550b-a55b:free", key: process.env.OPENROUTER_API_KEY || "" },
    { url: "https://openrouter.ai/api/v1/chat/completions", model: "openai/gpt-oss-120b:free", key: process.env.OPENROUTER_API_KEY || "" },
    { url: "https://api.bazaarlink.ai/v1/chat/completions", model: "deepseek/deepseek-v4-flash:free", key: process.env.BAZAARLINK_API_KEY || "" },
    { url: "https://api.airforce/v1/chat/completions", model: "mistral-large-latest", key: process.env.AIRFORCE_API_KEY || "" },
  ];

  // Gemini is the smartest available model — try it first for the master answer.
  const gemKey = process.env.GEMINI_API_KEY || "";
  if (gemKey) {
    try {
      const gres = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(gemKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: masterSystem }] },
            contents: [{ role: "user", parts: [{ text: masterInput }] }],
            generationConfig: { temperature: 0.4 },
          }),
        }
      );
      const gd = await gres.json().catch(() => ({}));
      const gtext = gd?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ?? "";
      if (gres.ok && gtext) {
        if (authUser) logUsage({ userId: authUser.id, type: classification.type, mode, agentsUsed: agentNames.join(", "), estimatedCost: "0", success: true }).catch(() => {});
        return new Response(gtext, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "X-Orchestrator": classification.reasoning,
            "X-Agents-Used": agentNames.join(", "),
            "X-Master": "gemini-2.5-flash",
            ...corsHeaders,
          },
        });
      }
    } catch {}
  }

  for (const provider of masterProviders) {
    try {
      const res = await fetch(provider.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${provider.key}` },
        body: JSON.stringify({
          model: provider.model,
          stream: true,
          messages: [{ role: "system", content: masterSystem }, { role: "user", content: masterInput }],
          temperature: 0.4,
        }),
      });
      if (res.ok && res.body) {
        if (authUser) logUsage({ userId: authUser.id, type: classification.type, mode, agentsUsed: agentNames.join(", "), estimatedCost: "0.002", success: true }).catch(() => {});
        return new Response(streamResponse(res), {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "X-Orchestrator": classification.reasoning,
            "X-Agents-Used": agentNames.join(", "),
            "X-Pipeline": "orchestrator→select→parallel→judge→master→stream",
            ...corsHeaders,
          },
        });
      }
    } catch {}
  }

  // All master providers failed → return longest agent answer
  const bestFallback = answers.reduce((best, a) => a.text.length > best.text.length ? a : best);
  return new Response(bestFallback.text, {
    headers: { "Content-Type": "text/plain; charset=utf-8", ...corsHeaders },
  });
}
