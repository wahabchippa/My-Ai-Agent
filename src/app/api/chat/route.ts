// /api/chat — Nexora backend.
//
// ENSEMBLE MODE: runs several free models in PARALLEL and returns the FIRST
// (fastest) valid answer. This is both fast and reliable — if one model is
// rate-limited, another one wins. The tier (Core/Ultra/Flash) picks which set
// of models races. The OpenRouter key lives on the server only.
//
// Still supports a full provider spec (apiKey + endpoint + format) for keys a
// user adds themselves in the Models page — those run server-side too.

import { NextResponse } from "next/server";
import { recallMemories, rememberFact, clearAllMemory, extractFact } from "@/lib/memory";
import { getSessionUserId } from "@/lib/sessionUser";

type Msg = { role: "user" | "assistant" | "system"; content: string };

interface Body {
  tier?: string;
  system: string;
  messages: Msg[];
  apiKey?: string;
  format?: "openai" | "gemini" | "anthropic";
  endpoint?: string;
  model?: string;
  provider?: string;
}

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

/**
 * Each tier races a set of models in parallel; fastest valid answer wins.
 *
 * ── REBUILT 2026-08-16 — dead IDs hata diye ──
 * Purani list me ye sab 404 de rahe the (OpenRouter se retire ho chuke):
 *   deepseek/deepseek-r1:free, deepseek/deepseek-chat-v3.1:free,
 *   qwen/qwen3-coder:free, meta-llama/llama-3.3-70b-instruct:free,
 *   google/gemma-3-12b-it:free, mistralai/mistral-7b-instruct:free,
 *   openai/gpt-oss-120b:free, nvidia/nemotron-3-nano-omni-...:free
 *
 * Aur `llm7:` entries khatarnak thi — wo model naam kuch bhi accept kar
 * leta hai magar serve GPT-4o (Oct 2023 cutoff) karta hai. Live test:
 *   llm7 "gemini-3.1-flash-lite" → "I am GPT-4o, cutoff October 2023"
 *   llm7 "minimax-m2.7"          → "current president is Joe Biden"
 * Isi liye ye ab sirf AAKHIRI fallback hain, aur `keyed:` models pehle.
 *
 * `keyed:` prefix wale entries sirf tab race me aate hain jab unki key
 * set ho — warna skip. Ye ordering hi asal fix hai: fresh models pehle.
 */
const ENSEMBLES: Record<string, string[]> = {
  // ── Ultra: sabse taqatwar available models ──
  fable: [
    "gemini:gemini-3-flash",
    "cerebras:gpt-oss-120b",
    "nvidia/nemotron-3-ultra-550b-a55b:free",
    "groq:openai/gpt-oss-120b",
    "nvidia/nemotron-3-super-120b-a12b:free",
    "google/gemma-4-31b-it:free",
    "pollinations:openai",
  ],
  // ── Pro ──
  opus: [
    "gemini:gemini-3-flash",
    "cerebras:qwen-3-235b-a22b-instruct-2507",
    "nvidia/nemotron-3-super-120b-a12b:free",
    "groq:llama-3.3-70b-versatile",
    "google/gemma-4-31b-it:free",
    "poolside/laguna-s-2.1:free",
    "pollinations:openai",
  ],
  // ── Core: rozmarra ka default ──
  sonnet: [
    "gemini:gemini-2.5-flash",
    "groq:llama-3.3-70b-versatile",
    "cerebras:gpt-oss-120b",
    "google/gemma-4-31b-it:free",
    "openai/gpt-oss-20b:free",
    "cohere/north-mini-code:free",
    "pollinations:openai",
  ],
  // ── Flash: sabse tez ──
  haiku: [
    "gemini:gemini-3.1-flash-lite",
    "groq:llama-3.1-8b-instant",
    "nvidia/nemotron-3.5-lightning:free",
    "openai/gpt-oss-20b:free",
    "nvidia/nemotron-nano-9b-v2:free",
    "pollinations:openai-fast",
  ],
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

// Vercel: allow up to 60s per function.
export const maxDuration = 60;

/** Call OpenRouter (OpenAI-compatible) with a specific model. Rejects on error. */
async function callOpenRouter(
  apiKey: string,
  model: string,
  system: string,
  messages: Msg[]
): Promise<string> {
  const r = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "X-Title": "Nexora",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: system }, ...messages],
      temperature: 0.7,
    }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.error?.message || `OpenRouter error (${r.status})`);
  const text = d?.choices?.[0]?.message?.content ?? "";
  if (!text) throw new Error("Empty response.");
  return text;
}

/** Keyless — Kilo gateway free models (~200 req/hr/IP, no key needed). */
async function callKilo(
  model: string,
  system: string,
  messages: Msg[]
): Promise<string> {
  const r = await fetch("https://api.kilo.ai/api/gateway/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: system }, ...messages],
      temperature: 0.7,
    }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.message || d?.error?.message || `Kilo error (${r.status})`);
  const text = d?.choices?.[0]?.message?.content ?? "";
  if (!text) throw new Error("Empty Kilo response.");
  return text;
}

/** Keyless — OVHcloud AI Endpoints (anonymous, ~2 req/min, no key at all). */
async function callOVH(
  model: string,
  system: string,
  messages: Msg[]
): Promise<string> {
  const r = await fetch("https://oai.endpoints.kepler.ai.cloud.ovh.net/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: system }, ...messages],
      temperature: 0.7,
    }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.message || d?.error?.message || `OVH error (${r.status})`);
  const text = d?.choices?.[0]?.message?.content ?? "";
  if (!text) throw new Error("Empty OVH response.");
  return text;
}

/** AirForce — 708 models, most free. Key required. */
async function callAirForce(
  key: string,
  model: string,
  system: string,
  messages: Msg[]
): Promise<string> {
  const r = await fetch("https://api.airforce/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: system }, ...messages],
      temperature: 0.7,
    }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.error?.message || `AirForce error (${r.status})`);
  const text = d?.choices?.[0]?.message?.content ?? "";
  if (!text) throw new Error("Empty AirForce response.");
  return text;
}

/** OpenAPIs — FREE Claude + GPT proxy (open beta, key: "admin"). */
async function callOpenAPIs(
  model: string,
  system: string,
  messages: Msg[]
): Promise<string> {
  const r = await fetch("https://api.openapis.online/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer admin" },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: system }, ...messages],
      temperature: 0.7,
    }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.error?.message || `OpenAPIs error (${r.status})`);
  const text = d?.choices?.[0]?.message?.content ?? "";
  if (!text) throw new Error("Empty OpenAPIs response.");
  return text;
}

/** BazaarLink — free LLM gateway (DeepSeek V4, Qwen 3.7, Auto). */
async function callBazaarLink(
  key: string,
  model: string,
  system: string,
  messages: Msg[]
): Promise<string> {
  const r = await fetch("https://api.bazaarlink.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: system }, ...messages],
      temperature: 0.7,
    }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.error?.message || `BazaarLink error (${r.status})`);
  const text = d?.choices?.[0]?.message?.content ?? "";
  if (!text) throw new Error("Empty BazaarLink response.");
  return text;
}

/** Cerebras — extremely fast (~2600 tok/s). Needs CEREBRAS_API_KEY + billing. */
// Verified live 2026-08-16 — "gemma-4-31b" Cerebras pe maujood NAHI tha (404).
const CEREBRAS_MODELS = ["gpt-oss-120b", "qwen-3-235b-a22b-instruct-2507", "zai-glm-4.7"];
async function callCerebras(
  key: string,
  model: string,
  system: string,
  messages: Msg[]
): Promise<string> {
  const r = await fetch("https://api.cerebras.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: system }, ...messages],
      temperature: 0.7,
    }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok)
    throw new Error(d?.error?.message || d?.message || `Cerebras error (${r.status})`);
  const text = d?.choices?.[0]?.message?.content ?? "";
  if (!text) throw new Error("Empty Cerebras response.");
  return text;
}

/** Keyless call — LLM7.io (no registration, OpenAI-compatible, ~150/min). */
async function callLLM7(
  model: string,
  system: string,
  messages: Msg[]
): Promise<string> {
  const r = await fetch("https://api.llm7.io/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: system }, ...messages],
    }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.error?.message || `LLM7 error (${r.status})`);
  const text = d?.choices?.[0]?.message?.content ?? "";
  if (!text) throw new Error("Empty LLM7 response.");
  return text;
}

/** Truly keyless call — Pollinations text API (no API key at all).
 * Retries a few times because it can intermittently 402 from server IPs. */
async function callPollinations(
  model: string,
  system: string,
  messages: Msg[]
): Promise<string> {
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const r = await fetch("https://text.pollinations.ai/openai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [{ role: "system", content: system }, ...messages],
        }),
      });
      if (r.status === 402 || r.status === 429) {
        lastErr = new Error(`Pollinations busy (${r.status})`);
        await new Promise((x) => setTimeout(x, 400 * (attempt + 1)));
        continue;
      }
      const d = await r.json().catch(() => ({}));
      if (!r.ok)
        throw new Error(d?.error?.message || `Pollinations error (${r.status})`);
      const text = d?.choices?.[0]?.message?.content ?? "";
      if (!text) throw new Error("Empty response from Pollinations.");
      return text;
    } catch (e) {
      lastErr = e;
      await new Promise((x) => setTimeout(x, 400 * (attempt + 1)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Pollinations failed.");
}

/** Groq (very fast, generous free tier) — only added if GROQ_API_KEY is set. */
/** Groq free-tier models — verified live 2026-08-16. */
const GROQ_MODELS = [
  "llama-3.3-70b-versatile",
  "openai/gpt-oss-120b",
  "llama-3.1-8b-instant",
];
/**
 * Google Gemini — sabse acha free tier (1,500 req/day).
 * gemini-3-flash pehle: naya cutoff + built-in search grounding.
 */
const GEMINI_MODELS = ["gemini-3-flash", "gemini-2.5-flash", "gemini-3.1-flash-lite"];

async function callGroq(
  key: string,
  model: string,
  system: string,
  messages: Msg[]
): Promise<string> {
  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: system }, ...messages],
      temperature: 0.7,
    }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.error?.message || `Groq error (${r.status})`);
  const text = d?.choices?.[0]?.message?.content ?? "";
  if (!text) throw new Error("Empty Groq response.");
  return text;
}

async function callGemini(
  key: string,
  model: string,
  system: string,
  messages: Msg[]
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
    key
  )}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
      generationConfig: { temperature: 0.7 },
    }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.error?.message || `Gemini error (${r.status})`);
  const text =
    d?.candidates?.[0]?.content?.parts
      ?.map((p: { text?: string }) => p.text)
      .join("") ?? "";
  if (!text) throw new Error("Empty Gemini response.");
  return text;
}

/**
 * Run the ensemble in QUALITY TIERS, not one blind race.
 *
 * ── PURANA BUG (aapke ghalat jawabon ki asal wajah) ──
 * Purana code SAB models ek saath `Promise.any` me daal deta tha aur jo
 * PEHLE jawab de wo jeet jata tha. Masla: keyless endpoints (pollinations,
 * llm7) sabse TEZ hain — kyunki wo chhote purane models chalate hain.
 * To har request me practically WAHI jeetta tha, chahe aapne Gemini aur
 * Groq keys laga rakhi hon. Aapko frontier model kabhi milta hi nahi tha.
 *
 * Live proof (2026-08-16):
 *   llm7 "gemini-3.1-flash-lite" → "I am GPT-4o, knowledge cutoff Oct 2023"
 *   llm7 "minimax-m2.7"          → "current president is Joe Biden"
 *
 * ── AB ──
 * Tier 1 = aapke asli keyed providers (Gemini/Groq/Cerebras/OpenRouter).
 * Tier 2 = keyless fallback — sirf tab jab Tier 1 poora fail ho jaye.
 * Tier 1 ke andar race hoti hai (tez), magar keyless usay hara nahi sakta.
 */
async function callEnsemble(opts: {
  orKey: string;
  groqKey: string;
  gemKey: string;
  cerKey?: string;
  models: string[];
  system: string;
  messages: Msg[];
}): Promise<string> {
  const { orKey, groqKey, gemKey, cerKey = "", models, system, messages } = opts;

  const primary: Promise<string>[] = [];
  const fallback: Promise<string>[] = [];

  for (const m of models) {
    // Keyless — hamesha fallback tier me.
    if (m.startsWith("pollinations:")) {
      fallback.push(callPollinations(m.slice("pollinations:".length) || "openai", system, messages));
      continue;
    }
    if (m.startsWith("llm7:")) {
      fallback.push(callLLM7(m.slice("llm7:".length), system, messages));
      continue;
    }
    // Explicit keyed prefixes — sirf tab jab key maujood ho.
    if (m.startsWith("gemini:")) {
      if (gemKey) primary.push(callGemini(gemKey, m.slice("gemini:".length), system, messages));
      continue;
    }
    if (m.startsWith("groq:")) {
      if (groqKey) primary.push(callGroq(groqKey, m.slice("groq:".length), system, messages));
      continue;
    }
    if (m.startsWith("cerebras:")) {
      if (cerKey) primary.push(callCerebras(cerKey, m.slice("cerebras:".length), system, messages));
      continue;
    }
    // Baaki sab OpenRouter IDs — key chahiye.
    if (orKey) primary.push(callOpenRouter(orKey, m, system, messages));
  }

  // Tier 1: asli providers.
  if (primary.length) {
    try {
      return await Promise.any(primary);
    } catch {
      // sab fail — Tier 2 pe jao
    }
  }

  // Tier 2: keyless emergency.
  if (fallback.length) {
    try {
      const text = await Promise.any(fallback);
      const warn =
        "\n\n---\n*⚠️ Ye jawab ek purane fallback model se aaya hai (knowledge cutoff ~2023-2024), " +
        "kyunki koi configured provider jawab nahi de saka. Behtar jawab ke liye " +
        "`GEMINI_API_KEY` / `GROQ_API_KEY` set karein — SETUP-FREE-AI.md dekhein.*";
      return text + warn;
    } catch {
      // dono tier fail
    }
  }

  throw new Error(
    primary.length
      ? "Sabhi models busy/rate-limited hain. Thodi der baad koshish karein."
      : "Koi AI provider configured nahi hai. `.env` me GEMINI_API_KEY ya GROQ_API_KEY daalein — SETUP-FREE-AI.md dekhein."
  );
}

/** Reject a promise after `ms` so slow/dead models don't hold up consensus. */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms)),
  ]);
}

/** Run ONE model (handles all source prefixes). */
function runOne(
  m: string,
  keys: { orKey: string; cerKey: string; groqKey: string; gemKey: string; blKey: string; afKey: string },
  system: string,
  messages: Msg[]
): Promise<string> {
  const { orKey, cerKey, groqKey, gemKey } = keys;
  if (m.startsWith("pollinations:"))
    return callPollinations(m.slice("pollinations:".length) || "openai", system, messages);
  if (m.startsWith("llm7:"))
    return callLLM7(m.slice("llm7:".length), system, messages);
  if (m.startsWith("ovh:"))
    return callOVH(m.slice("ovh:".length), system, messages);
  if (m.startsWith("kilo:"))
    return callKilo(m.slice("kilo:".length), system, messages);
  if (m.startsWith("airforce:"))
    return callAirForce(keys.afKey, m.slice("airforce:".length), system, messages);
  if (m.startsWith("openapis:"))
    return callOpenAPIs(m.slice("openapis:".length), system, messages);
  if (m.startsWith("bazaarlink:"))
    return callBazaarLink(keys.blKey, m.slice("bazaarlink:".length), system, messages);
  if (m.startsWith("cerebras:"))
    return callCerebras(cerKey, m.slice("cerebras:".length), system, messages);
  if (m.startsWith("groq:"))
    return callGroq(groqKey, m.slice("groq:".length), system, messages);
  if (m.startsWith("gemini:"))
    return callGemini(gemKey, m.slice("gemini:".length), system, messages);
  return callOpenRouter(orKey, m, system, messages);
}

/**
 * CONSENSUS MODE — every model answers at the same time, then their answers are
 * combined into ONE best answer. This gives higher-quality results than racing:
 * multiple models contribute their best points, and a final synthesis step
 * merges them. Falls back to the most complete answer if synthesis fails.
 */
async function callConsensus(opts: {
  orKey: string;
  cerKey: string;
  groqKey: string;
  gemKey: string;
  blKey: string;
  afKey: string;
  system: string;
  messages: Msg[];
}): Promise<string> {
  const { orKey, cerKey, groqKey, gemKey, blKey, afKey, system, messages } = opts;
  const keys = { orKey, cerKey, groqKey, gemKey, blKey, afKey };

  // ── PURANA BUG ──
  // Ye ek "PURE RACE" thi: sab models 5s timeout ke saath ek saath, aur jo
  // pehle bole wo jeet gaya. Keyless endpoints (llm7, pollinations, openapis)
  // list me SABSE UPAR the aur sabse tez hain — kyunki wo chhote purane
  // models chalate hain. Nateeja: chahe aapki Gemini/Groq keys set hon,
  // jawab practically HAMESHA 2023-cutoff wale model se aata tha.
  //
  // Plus 5s timeout bara zalim tha — Gemini/Groq ko sochne ka waqt hi nahi
  // milta tha, wo har baar timeout ho jate the.
  //
  // ── AB: 2 TIERS ──
  const primary: string[] = [];
  const fallback: string[] = [];

  // Tier 1 — asli providers, sirf jab key set ho.
  if (gemKey) for (const g of GEMINI_MODELS) primary.push(`gemini:${g}`);
  if (cerKey) for (const c of CEREBRAS_MODELS) primary.push(`cerebras:${c}`);
  if (groqKey) for (const g of ["llama-3.3-70b-versatile", "openai/gpt-oss-120b"]) primary.push(`groq:${g}`);
  if (orKey) for (const o of ["google/gemma-4-31b-it:free", "openai/gpt-oss-20b:free"]) primary.push(o);
  if (afKey) for (const am of ["mistral-large-latest"]) primary.push(`airforce:${am}`);
  if (blKey) for (const bm of ["deepseek-v4-flash", "glm-5.2"]) primary.push(`bazaarlink:${bm}`);

  // Tier 2 — keyless emergency fallback (purane models, warning ke saath).
  fallback.push("pollinations:openai", "pollinations:openai-fast", "llm7:gemini-3.1-flash-lite");

  // Tier 1: 20s timeout (5s nahi) — acha model ko sochne do.
  if (primary.length) {
    try {
      return (await Promise.any(primary.map((m) => withTimeout(runOne(m, keys, system, messages), 20000)))).trim();
    } catch {
      // sab fail → Tier 2
    }
  }

  // Tier 2: keyless.
  try {
    const text = await Promise.any(fallback.map((m) => withTimeout(runOne(m, keys, system, messages), 15000)));
    return (
      text.trim() +
      "\n\n---\n*⚠️ Purane fallback model ka jawab (cutoff ~2023-2024). " +
      "`GEMINI_API_KEY` ya `GROQ_API_KEY` set karein — dono free hain. SETUP-FREE-AI.md dekhein.*"
    );
  } catch {
    throw new Error(
      primary.length
        ? "Sabhi models busy hain. Thodi der baad koshish karein."
        : "Koi AI provider configured nahi. `.env` me GEMINI_API_KEY daalein — SETUP-FREE-AI.md dekhein."
    );
  }
}

/**
 * Image generation (Pollinations — keyless). When the user asks to draw/generate
 * a picture, build a markdown image that renders in chat. Returns the markdown
 * string, or null if this isn't an image request.
 */
function generateImage(message: string): string | null {
  const q = message.toLowerCase();
  const wants =
    /\b(draw|generate|paint|sketch|create|make|banao|bana|bnana|design|tasveer|wallpaper|logo)\b/i.test(q) &&
    /\b(image|picture|photo|painting|drawing|art|logo|wallpaper|tasveer|sketch|illustration|banao|bana|bnana)\b/i.test(q);
  if (!wants) return null;
  const prompt = message
    .replace(/.*\b(draw|generate|paint|sketch|create|make|banao|bana|bnana|design)\b/i, " ")
    .replace(/\b(of|a|an|the|meri|ek|for me|please|mujhe|mere liye|picture|image|photo|painting|drawing|art|tasveer|wallpaper|logo)\b/gi, " ")
    .replace(/[?.!]/g, "")
    .trim();
  if (!prompt || prompt.length < 2) return null;
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}`;
  return `Here is your image of **${prompt}**:\n\n![${prompt}](${url})\n\n*(Generated live — the image may take a few seconds to load.)*`;
}

/**
 * AGENT RESEARCH — for general questions, queries MULTIPLE knowledge sources
 * in PARALLEL (DuckDuckGo + Wikipedia + Stack Overflow) and combines results.
 * This is what makes Nexora a "research agent" rather than a simple chatbot.
 */
async function agentResearch(query: string): Promise<string> {
  const get = async (u: string) =>
    (await fetch(u).then((r) => r.json().catch(() => null))) as any;

  const [ddg, wiki, so] = await Promise.allSettled([
    // DuckDuckGo Instant Answer
    get(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`),
    // Wikipedia summary
    get(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query.replace(/[?.!]/g, "").trim().replace(/\s+/g, "_").slice(0, 60))}`),
    // Stack Overflow (for coding/technical questions)
    query.match(/code|python|javascript|error|function|bug|how|fix/i)
      ? get(`https://api.stackexchange.com/2.3/similar?order=desc&sort=relevance&title=${encodeURIComponent(query.slice(0, 100))}&site=stackoverflow&pagesize=1&filter=withbody`)
      : Promise.resolve(null),
  ]);

  const results: string[] = [];

  // DuckDuckGo
  const ddgVal = ddg.status === "fulfilled" ? ddg.value : null;
  if (ddgVal) {
    if (ddgVal.AbstractText) results.push(ddgVal.AbstractText);
    if (ddgVal.Answer) results.push(String(ddgVal.Answer));
    for (const t of (ddgVal.RelatedTopics || []).slice(0, 3)) {
      if (t?.Text) results.push(t.Text);
      if (results.length > 4) break;
    }
  }

  // Wikipedia
  const wikiVal = wiki.status === "fulfilled" ? wiki.value : null;
  if (wikiVal?.extract) results.push(`Wikipedia: ${wikiVal.extract.slice(0, 300)}`);

  // Stack Overflow
  const soVal = so.status === "fulfilled" ? so.value : null;
  const soItem = soVal?.items?.[0];
  if (soItem) results.push(`StackOverflow (${soItem.score}↑): ${(soItem.body || "").replace(/<[^>]+>/g, "").slice(0, 200)}`);

  return results.slice(0, 5).join(" | ");
}

/* -------------------- live-data tools (keyless public APIs) ---------------- */

/** Fetch real, current data based on the user's question and return it as a
 * short context string the models can answer with. All sources are keyless. */
async function gatherContext(message: string): Promise<string> {
  const q = message.toLowerCase();
  const facts: string[] = [];
  const get = async (u: string) =>
    (await fetch(u).then((r) => r.json().catch(() => null))) as any;
  const has = (...w: string[]) => w.some((x) => q.includes(x));

  // 0a) CURRENT DATE/TIME — so the AI knows "today".
  facts.push(
    `Current date/time (server): ${new Date().toLocaleString("en-US", { timeZone: "UTC" })} UTC.`
  );

  // 0c) REAL CALCULATOR — exact math for "calculate X" / "what is 3*(4+5)".
  const cm = message.match(/(?:calculate|what is|compute|solve|=)\s*([\d\s+\-*/().^%]+)\??/i);
  if (cm && /[\d]/.test(cm[1]) && /[+\-*/^%]/.test(cm[1])) {
    try {
      const expr = cm[1].trim().replace(/\^/g, "**");
      if (/^[\d\s+\-*/().%]+$/.test(expr)) {
        // eslint-disable-next-line no-new-func
        const result = Function(`"use strict";return (${expr})`)();
        if (typeof result === "number" && isFinite(result))
          facts.push(`Calculator: ${cm[1].trim()} = ${result}.`);
      }
    } catch {
      /* ignore */
    }
  }

  try {
    // weather: "weather in Karachi"
    const wm = q.match(/weather(?:\s+in|\s+for|\s+at)?\s+([a-z][a-z\s,]{1,40})/);
    if (wm) {
      const g = await get(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
          wm[1].trim()
        )}&count=1`
      );
      const loc = g?.results?.[0];
      if (loc) {
        const w = await get(
          `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&current_weather=true`
        );
        const cw = w?.current_weather;
        if (cw)
          facts.push(
            `Live weather (${loc.name}, ${loc.country}): ${cw.temperature}°C, wind ${cw.windspeed} km/h, code ${cw.weathercode}.`
          );
      }
    }
    // crypto: "bitcoin price" / "price of ethereum"
    const cm =
      q.match(/\b(bitcoin|btc|ethereum|eth|solana|sol|dogecoin|doge)\b/) ||
      q.match(/price of\s+([a-z]+)/);
    if (cm) {
      const map: Record<string, string> = {
        bitcoin: "bitcoin",
        btc: "bitcoin",
        ethereum: "ethereum",
        eth: "ethereum",
        solana: "solana",
        sol: "solana",
        dogecoin: "dogecoin",
        doge: "dogecoin",
      };
      const id = map[cm[1]?.toLowerCase()] || cm[1]?.toLowerCase();
      if (id) {
        const p = await get(
          `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`
        );
        if (p?.[id]?.usd) facts.push(`Live crypto: ${id} = $${p[id].usd} USD.`);
      }
    }
    // currency: "100 usd to pkr"
    const curm = q.match(/([\d.]+)\s*([a-z]{3})\s*(?:to|in)\s*([a-z]{3})/);
    if (curm) {
      const amt = parseFloat(curm[1]);
      const from = curm[2].toUpperCase();
      const to = curm[3].toUpperCase();
      const c = await get(
        `https://api.frankfurter.app/latest?from=${from}&to=${to}`
      );
      const rate = c?.rates?.[to];
      if (rate)
        facts.push(`Live currency: ${amt} ${from} = ${(amt * rate).toFixed(2)} ${to}.`);
    }
    // dictionary: "define serendipity"
    const dm = q.match(/\b(?:define|meaning of|definition of)\s+([a-z]+)/);
    if (dm) {
      const d = await get(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${dm[1]}`
      );
      const def = d?.[0]?.meanings?.[0]?.definitions?.[0]?.definition;
      if (def) facts.push(`Dictionary (${dm[1]}): ${def}.`);
    }
    // country: "capital of Japan" / "population of Brazil"
    const ctm = q.match(/(?:capital of|population of|about country)\s+([a-z][a-z\s]{1,30})/);
    if (ctm) {
      const c = await get(
        `https://restcountries.com/v3.1/name/${ctm[1].trim()}?fields=name,capital,population`
      );
      const co = Array.isArray(c) ? c[0] : null;
      if (co)
        facts.push(
          `Country (${co.name?.common}): capital ${co.capital?.[0] || "?"}, population ${co.population?.toLocaleString()}.`
        );
    }
    // 6) GITHUB USER: "github user torvalds"
    const ghm = q.match(/github (?:user|profile|account)\s+([a-z0-9_-]+)/);
    if (ghm) {
      const u = await get(`https://api.github.com/users/${ghm[1]}`);
      if (u?.name)
        facts.push(
          `GitHub @${u.login}: ${u.name}, ${u.public_repos} repos, ${u.followers} followers. Bio: ${(u.bio || "").slice(0, 80)}.`
        );
    }
    // 7) TV / MOVIE: "tv show breaking bad"
    const tvm = q.match(/(?:tv show|tv series|series|show|movie|film)\s+(.{2,40})/);
    if (tvm) {
      const s = await get(
        `https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(tvm[1].trim())}`
      );
      if (s?.name)
        facts.push(
          `TV: "${s.name}" — ${s.genres?.join(", ") || "?"}. ${(s.summary || "").replace(/<[^>]+>/g, "").slice(0, 140)}.`
        );
    }
    // 8) MUSIC: "song adele" / "music by coldplay"
    const mum = q.match(/(?:song|track|music by|artist)\s+(.{2,40})/);
    if (mum) {
      const s = await get(
        `https://itunes.apple.com/search?term=${encodeURIComponent(mum[1].trim())}&limit=1&entity=song`
      );
      const tr = s?.results?.[0];
      if (tr) facts.push(`Music: "${tr.trackName}" by ${tr.artistName} (album: ${tr.collectionName}).`);
    }
    // 9) BOOKS: "book atomic habits"
    const bm = q.match(/(?:book|novel)\s+(.{2,40})/);
    if (bm) {
      const s = await get(
        `https://openlibrary.org/search.json?q=${encodeURIComponent(bm[1].trim())}&limit=1&fields=title,author_name,first_publish_year`
      );
      const b = s?.docs?.[0];
      if (b) facts.push(`Book: "${b.title}" by ${b.author_name?.[0] || "?"} (${b.first_publish_year || "?"}).`);
    }
    // 10) RECIPE: "what should i cook" / "recipe"
    if (has("recipe", "what should i cook", "what to cook", "kya banau", "khana")) {
      const r = await get(`https://www.themealdb.com/api/json/v1/1/random.php`);
      const m = r?.meals?.[0];
      if (m) facts.push(`Recipe idea: ${m.strMeal} (${m.strCategory}, ${m.strArea} cuisine).`);
    }
    // 11) TRIVIA: "ask me a trivia question"
    if (has("trivia", "quiz question", "ask me a question")) {
      const r = await get(`https://opentdb.com/api.php?amount=1`);
      const tq = r?.results?.[0];
      if (tq)
        facts.push(
          `Trivia (${tq.category}, ${tq.difficulty}): ${tq.question.replace(/&[^;]+;/g, "")}`
        );
    }
    // 12) JOKE: "tell me a joke"
    if (has("joke", "make me laugh", "something funny", "chutkula")) {
      const j = await get(`https://official-joke-api.appspot.com/random_joke`);
      if (j?.setup) facts.push(`Joke: ${j.setup} — ${j.punchline}.`);
    }
    // 13) QUOTE: "inspire me" / "a quote"
    if (has("quote", "inspire", "motivat", "saying")) {
      const r = await get(`https://zenquotes.io/api/random`);
      const qt = Array.isArray(r) ? r[0] : null;
      if (qt?.q) facts.push(`Quote: "${qt.q}" — ${qt.a}.`);
    }
    // 14) NEWS: top Hacker News headlines
    if (has("news", "headline", "tech news", "khabrein", "khabar")) {
      const ids = await get(`https://hacker-news.firebaseio.com/v0/topstories.json`);
      if (Array.isArray(ids)) {
        const top = await Promise.all(
          ids.slice(0, 5).map((id: number) =>
            get(`https://hacker-news.firebaseio.com/v0/item/${id}.json`)
          )
        );
        const titles = top.filter(Boolean).map((x: any) => x.title).filter(Boolean);
        if (titles.length) facts.push(`Top tech news right now: ${titles.join(" | ")}.`);
      }
    }
    // 16) NASA ASTRONOMY PICTURE: "astronomy picture" / "space photo of the day"
    if (has("astronomy", "space photo", "picture of the day", "nasa", "apod")) {
      const a = await get(`https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY`);
      if (a?.title)
        facts.push(
          `NASA Astronomy Picture of the Day (${a.date}): "${a.title}". ${(a.explanation || "").slice(0, 150)}.`
        );
    }
    // 17) ADVICE: "give me some advice"
    if (has("advice", "advise me", "life tip")) {
      const a = await get(`https://api.adviceslip.com/advice`);
      if (a?.slip?.advice) facts.push(`Advice: ${a.slip.advice}.`);
    }
    // 18) DAD JOKE: "tell me a dad joke"
    if (has("dad joke")) {
      const r = (await fetch(`https://icanhazdadjoke.com/`, {
        headers: { Accept: "application/json" },
      })
        .then((x) => x.json().catch(() => null))
        .catch(() => null)) as any;
      if (r?.joke) facts.push(`Dad joke: ${r.joke}.`);
    }
    // 19) CAT FACT: "tell me a cat fact"
    if (has("cat fact", "cat facts", "fact about cats")) {
      const c = await get(`https://catfact.ninja/fact`);
      if (c?.fact) facts.push(`Cat fact: ${c.fact}.`);
    }
    // 20) DOG PHOTO: "show me a dog" / "cute dog picture"
    if (has("dog picture", "dog photo", "dog image", "show me a dog", "cute dog")) {
      const d = await get(`https://dog.ceo/api/breeds/image/random`);
      if (d?.message) facts.push(`Random dog photo (image link): ${d.message}.`);
    }
    // 21) POKÉMON: "pokemon pikachu" / "stats of charizard"
    const pm = q.match(/pokemon\s+([a-z-]+)/);
    if (pm) {
      const p = await get(`https://pokeapi.co/api/v2/pokemon/${pm[1]}`);
      if (p?.name)
        facts.push(
          `Pokémon ${p.name}: #${p.id}, types ${p.types?.map((t: any) => t.type.name).join("/")}, height ${p.height}, weight ${p.weight}.`
        );
    }
    // 22) SUNRISE/SUNSET: "sunrise in Karachi"
    const sunm = q.match(/(?:sunrise|sunset)(?:\s+in|\s+at|\s+for)?\s+([a-z][a-z\s]{1,30})/);
    if (sunm) {
      const g = await get(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(sunm[1].trim())}&count=1`
      );
      const loc = g?.results?.[0];
      if (loc) {
        const s = await get(
          `https://api.sunrise-sunset.org/json?lat=${loc.latitude}&lng=${loc.longitude}`
        );
        if (s?.results?.sunrise)
          facts.push(
            `Sun times (${loc.name}): sunrise ${s.results.sunrise}, sunset ${s.results.sunset} (UTC).`
          );
      }
    }
    // 23) NAME AGE GUESS: "how old is someone named Ahmed"
    const agm = q.match(/(?:age of name|how old.*named|guess age of)\s+([a-z]+)/);
    if (agm) {
      const a = await get(`https://api.agify.io?name=${agm[1]}`);
      if (a?.age)
        facts.push(`Estimated age for "${a.name}": ${a.age} years (from ${a.count} samples).`);
    }
    // 24) RANDOM IDENTITY: "generate a random user" / "fake identity"
    if (has("random user", "random person", "fake identity", "random name")) {
      const u = await get(`https://randomuser.me/api/?results=1`);
      const p = u?.results?.[0];
      if (p)
        facts.push(
          `Random identity: ${p.name?.first} ${p.name?.last}, ${p.gender}, email ${p.email}, from ${p.location?.country}.`
        );
    }

    // 24a) WEBSITE READER (Jina Reader — keyless, reads any URL's content)
    const urlm = q.match(/https?:\/\/[^\s<>"']+/i);
    if (urlm) {
      const page = await fetch(
        `https://r.jina.ai/${urlm[0]}`,
        { headers: { Accept: "text/plain" } }
      )
        .then((r) => (r.ok ? r.text() : ""))
        .catch(() => "");
      if (page) {
        const clean = page.replace(/\s+/g, " ").trim().slice(0, 1500);
        if (clean) facts.push(`Content from ${urlm[0]}: ${clean}`);
      }
    }

    // AGENT RESEARCH: for complex questions only (> 4 words), run multiple
    // knowledge sources in parallel. Skip for simple/short queries (faster).
    if (facts.length <= 1 && message.split(/\s+/).length > 4) {
      const research = await agentResearch(message);
      if (research) facts.push(`[RESEARCH] ${research}`);
    }

    // 24b) WEB SEARCH (DuckDuckGo Instant Answer — keyless, real-time knowledge)
    if (facts.length === 0) {
      const ddg = await get(
        `https://api.duckduckgo.com/?q=${encodeURIComponent(message)}&format=json&no_html=1&skip_disambig=1`
      );
      const hits: string[] = [];
      if (ddg?.AbstractText) hits.push(ddg.AbstractText);
      if (ddg?.Answer) hits.push(String(ddg.Answer));
      if (ddg?.Definition) hits.push(ddg.Definition);
      for (const t of ddg?.RelatedTopics || []) {
        if (typeof t === "object" && t.Topics) {
          for (const sub of t.Topics.slice(0, 2))
            if (sub.Text) hits.push(sub.Text);
        } else if (t?.Text) hits.push(t.Text);
        if (hits.length >= 4) break;
      }
      if (hits.length) facts.push(`Web search results: ${hits.slice(0, 4).join(" | ")}`);
    }

    // 24d) STACK EXCHANGE (coding + general Q&A knowledge — keyless)
    if (facts.length === 0 && has("how", "what", "why", "error", "fix", "best", "code", "python", "javascript", "explain", "difference")) {
      const se = await get(
        `https://api.stackexchange.com/2.3/similar?order=desc&sort=relevance&title=${encodeURIComponent(message.slice(0, 100))}&site=stackoverflow&pagesize=2&filter=withbody`
      );
      const items = se?.items || [];
      if (items.length) {
        const top = items.slice(0, 2)
          .map((it: any) => `${it.title} (${it.score} votes): ${(it.body || "").replace(/<[^>]+>/g, "").slice(0, 150)}`)
          .join(" | ");
        facts.push(`Stack Overflow knowledge: ${top}`);
      }
    }

    // 24e) ARXIV (academic / research papers — keyless)
    if (facts.length === 0 && has("research", "paper", "study", "theory", "algorithm", "paper", "science", "model architecture", "neural")) {
      const xml = await fetch(
        `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(message.slice(0, 60))}&max_results=2`
      ).then((r) => (r.ok ? r.text() : "")).catch(() => "");
      const papers = [...xml.matchAll(/<title>([\s\S]*?)<\/title>/g)].slice(1, 3).map((m) => m[1].trim());
      const summary = [...xml.matchAll(/<summary>([\s\S]*?)<\/summary>/g)].slice(0, 1).map((m) => m[1].trim().slice(0, 200));
      if (papers.length) facts.push(`Research papers (ArXiv): ${papers.join(" | ")}. ${summary.join("")}`);
    }

    // 24f) GITHUB REPOS (best library/framework questions)
    const gm = q.match(/(?:best|top|recommend)\s+(.{2,50})(?:library|framework|package|tool|repo)/);
    if (gm) {
      const g = await get(
        `https://api.github.com/search/repositories?q=${encodeURIComponent(gm[1])}&sort=stars&per_page=3`
      );
      const repos = (g?.items || []).slice(0, 3)
        .map((r: any) => `${r.full_name} (${r.stargazers_count}★): ${(r.description || "").slice(0, 80)}`);
      if (repos.length) facts.push(`Popular GitHub repos: ${repos.join(" | ")}`);
    }

    // 24g) AIR QUALITY
    const aqm = q.match(/air quality(?:\s+in|\s+at)?\s+([a-z][a-z\s]{1,30})/);
    if (aqm) {
      const g = await get(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(aqm[1].trim())}&count=1`);
      const loc = g?.results?.[0];
      if (loc) {
        const a = await get(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${loc.latitude}&longitude=${loc.longitude}&current=pm10,pm2_5`);
        const c = a?.current;
        if (c) facts.push(`Air quality (${loc.name}): PM2.5 ${c.pm2_5} µg/m³, PM10 ${c.pm10} µg/m³.`);
      }
    }

    // 24h) SYNONYMS / WORD RELATIONSHIPS (Datamuse)
    const synm = q.match(/(?:synonym|rhyme|words? (?:like|similar to)|meaning)\s+(?:of|for)?\s*([a-z]+)/);
    if (synm) {
      const w = await get(`https://api.datamuse.com/words?ml=${synm[1]}&max=5`);
      const words = (w || []).map((x: any) => x.word);
      if (words.length) facts.push(`Related words for "${synm[1]}": ${words.join(", ")}.`);
    }

    // 24i) RECENT EARTHQUAKES (USGS)
    if (has("earthquake", "seismic")) {
      const eq = await get("https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_week.geojson");
      const feats = (eq?.features || []).slice(0, 3)
        .map((f: any) => `Mag ${f.properties.mag} near ${f.properties.place}`);
      if (feats.length) facts.push(`Recent significant earthquakes: ${feats.join(" | ")}`);
    }

    // 24j) PHONE VALIDATION (numverify) — "validate this number 923001234567"
    const phonem = q.match(/(?:validate|check|lookup|whose|carrier|verify).*(?:number|phone|mobile)[:\s]*([+]?[\d\s-]{7,15})/i);
    if (phonem) {
      const num = phonem[1].replace(/[\s+-]/g, "");
      const nv = await get(`https://apilayer.net/api/validate?access_key=0f78a1bb2ff03d7fe938dfcee5224214&number=${num}`);
      if (nv?.valid) {
        facts.push(`Phone lookup: ${nv.international_format} is VALID. Country: ${nv.country_name}. Line type: ${nv.line_type}. Carrier: ${nv.carrier || "unknown"}.`);
      } else if (nv) {
        facts.push(`Phone lookup: ${num} is INVALID or could not be verified.`);
      }
    }

    // 25) WIKIPEDIA (general-knowledge fallback when nothing else matched)
    if (facts.length === 0) {
      const wm = q.match(/(?:who is|who was|what is|what are|tell me about|about|explain|history of|define)\s+(.{2,60})/);
      if (wm) {
        const term = wm[1]
          .trim()
          .replace(/[?.!]$/g, "")
          .replace(/\s+/g, "_");
        const s = await get(
          `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(term)}`
        );
        if (s?.extract) facts.push(`Wikipedia (${s.title}): ${s.extract.slice(0, 320)}.`);
      }
    }
  } catch {
    /* ignore — just answer without live data */
  }
  return facts.join(" ");
}

/* ---------------------- user-supplied-key paths --------------------------- */

async function runGemini(endpoint: string, apiKey: string, b: Body): Promise<string> {
  const r = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: b.system }] },
      contents: b.messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
      generationConfig: { temperature: 0.7 },
    }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.error?.message || `Gemini error (${r.status})`);
  const text =
    d?.candidates?.[0]?.content?.parts
      ?.map((p: { text?: string }) => p.text)
      .join("") ?? "";
  if (!text) throw new Error("Empty response from Gemini.");
  return text;
}

async function runAnthropic(endpoint: string, apiKey: string, b: Body): Promise<string> {
  const r = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: b.model,
      max_tokens: 2048,
      system: b.system,
      messages: b.messages.map((m) => ({ role: m.role, content: m.content })),
    }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.error?.message || `Anthropic error (${r.status})`);
  const text = d?.content?.map((c: { text?: string }) => c.text).join("") ?? "";
  if (!text) throw new Error("Empty response.");
  return text;
}

export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as Body | null;
  if (!b || !Array.isArray(b.messages)) {
    return NextResponse.json(
      { error: "Missing messages in body." },
      { status: 400, headers: corsHeaders }
    );
  }

  try {
    let text = "";

    // 1) Full provider spec → use the caller's own key (Models page).
    if (b.apiKey && b.format && b.endpoint) {
      if (b.format === "gemini") text = await runGemini(b.endpoint, b.apiKey, b);
      else if (b.format === "anthropic")
        text = await runAnthropic(b.endpoint, b.apiKey, b);
      else {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${b.apiKey}`,
        };
        if (b.provider === "openrouter") headers["X-Title"] = "Nexora";
        const r = await fetch(b.endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify({
            model: b.model,
            messages: [{ role: "system", content: b.system }, ...b.messages],
            temperature: 0.7,
          }),
        });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d?.error?.message || `API error (${r.status})`);
        text = d?.choices?.[0]?.message?.content ?? "";
        if (!text) throw new Error("Empty response.");
      }
    } else {
      // 2) CONSENSUS: every model answers in parallel, answers are merged into one.
      const lastUser =
        [...b.messages].reverse().find((m) => m.role === "user")?.content || "";

      // IMAGE GENERATION — short-circuit (Pollinations keyless).
      const imageOut = generateImage(lastUser);
      if (imageOut) {
        text = imageOut;
      } else {
      // MEMORY: recall what the user has told us before.
      //
      // ⚠ memory ab per-user hai. Logged-out user ki koi memory nahi hoti —
      // pehle sab ki memory ek hi dher me thi, to anonymous request ko bhi
      // doosron ki batein mil jati thin.
      const memUserId = await getSessionUserId(req);
      const recalled = memUserId ? await recallMemories(memUserId, lastUser) : [];
      const memBlock =
        recalled.length > 0
          ? `\n\n[MEMORY — things you know about the user] ${recalled.join(" | ")}`
          : "";
      // Handle explicit memory commands (remember/clear).
      const fact = memUserId ? extractFact(lastUser) : null;
      if (fact === "__CLEAR__") await clearAllMemory(memUserId!);
      else if (fact) await rememberFact(memUserId!, fact);
      // SKIP gatherContext in fallback — go straight to models for speed.
      const systemParts = [b.system];
      if (memBlock) systemParts.push(memBlock);
      text = await callConsensus({
        orKey:
          process.env.OPENROUTER_API_KEY ||
          "",
        cerKey:
          process.env.CEREBRAS_API_KEY ||
          "",
        groqKey: process.env.GROQ_API_KEY || "",
        gemKey: process.env.GEMINI_API_KEY || "",
        blKey: process.env.BAZAARLINK_API_KEY || "",
        afKey: process.env.AIRFORCE_API_KEY || "",
        system: systemParts.join("\n\n"),
        messages: b.messages,
      });
        // Auto-remember: if no explicit command but the user shared a name/preference.
        if (memUserId && !fact && recalled.length === 0) {
          const autoFact = extractFact(lastUser);
          if (autoFact && autoFact !== "__CLEAR__") await rememberFact(memUserId, autoFact);
        }
      } // end image else
    }

    return NextResponse.json({ text }, { headers: corsHeaders });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Proxy error" },
      { status: 502, headers: corsHeaders }
    );
  }
}
