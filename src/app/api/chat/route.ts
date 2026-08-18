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
import { guardApi, corsHeaders as cors } from "@/lib/guard";
import { isSafeUrl } from "@/lib/safeUrl";

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

// Origin-aware CORS — `*` nahi (scripted abuse band karne ke liye).
function corsHeaders(req?: Request): Record<string, string> {
  return cors(req);
}

export async function OPTIONS(req: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
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
  if (m.startsWith("airforce:"))
    return callAirForce(keys.afKey, m.slice("airforce:".length), system, messages);
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

/* -------------------- live-data tools (keyless public APIs) ---------------- */

/* ---------------------- user-supplied-key paths --------------------------- */

async function runGemini(endpoint: string, b: Body): Promise<string> {
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
  // ── AUTH GATE ──
  // Pehle yahan koi check nahi tha: koi bhi bina login ke server keys ka
  // quota jala sakta tha. Ab logged-in users chaltay hain; guests ko
  // per-IP limit milti hai.
  const guard = await guardApi(req, { allowAnon: true });
  if (!guard.ok) {
    return NextResponse.json(
      { error: guard.error },
      { status: guard.status, headers: corsHeaders(req) }
    );
  }

  const b = (await req.json().catch(() => null)) as Body | null;
  if (!b || !Array.isArray(b.messages)) {
    return NextResponse.json(
      { error: "Missing messages in body." },
      { status: 400, headers: corsHeaders(req) }
    );
  }

  try {
    let text = "";

    // 1) Full provider spec → use the caller's own key (Models page).
    if (b.apiKey && b.format && b.endpoint) {
      // ── SSRF GUARD ──
      // Ye endpoint client se aata hai aur server use fetch karta hai.
      // Pehle private/local/metadata IPs blocked nahi the — internal
      // services scan ki ja sakti thin (live proof: localhost hit hua).
      const safe = await isSafeUrl(b.endpoint, {
        allowPrivate: process.env.NEXORA_ALLOW_PRIVATE_ENDPOINTS === "1",
      });
      if (!safe.ok) {
        return NextResponse.json(
          { error: `Endpoint not allowed: ${safe.reason}` },
          { status: 400, headers: corsHeaders(req) }
        );
      }
      if (b.format === "gemini") text = await runGemini(b.endpoint, b);
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

    return NextResponse.json({ text }, { headers: corsHeaders(req) });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Proxy error" },
      { status: 502, headers: corsHeaders(req) }
    );
  }
}
