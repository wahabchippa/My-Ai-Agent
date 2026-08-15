/**
 * realai — connection to REAL AI models from providers all over the world.
 *
 * Supports three API families:
 *   • openai-compatible  — OpenAI, Groq, OpenRouter, Mistral, DeepSeek, xAI,
 *                          Together, Perplexity, Fireworks, NVIDIA  (one format)
 *   • gemini             — Google Gemini (its own format)
 *   • anthropic          — Anthropic Claude direct (its own format)
 *
 * OpenRouter alone exposes hundreds of models (GPT, Claude, Gemini, Llama,
 * DeepSeek, Mistral, Qwen, Grok…) through a single key.
 */

export type Provider =
  | "groq"
  | "gemini"
  | "openai"
  | "openrouter"
  | "anthropic"
  | "mistral"
  | "deepseek"
  | "xai"
  | "together"
  | "perplexity"
  | "fireworks"
  | "nvidia";

export type ApiFormat = "openai" | "gemini" | "anthropic";

export interface ProviderInfo {
  id: Provider;
  name: string;
  emoji: string;
  color: string;
  blurb: string;
  keyUrl: string;
  format: ApiFormat;
  endpoint: string;
  models: string[];
  free?: boolean;
  popular?: boolean;
}

export const PROVIDERS: ProviderInfo[] = [
  {
    id: "groq",
    name: "Groq",
    emoji: "⚡",
    color: "#F55036",
    blurb: "Free, ultra-fast Llama & DeepSeek models.",
    keyUrl: "https://console.groq.com/keys",
    format: "openai",
    endpoint: "https://api.groq.com/openai/v1/chat/completions",
    models: [
      "llama-3.3-70b-versatile",
      "llama-3.1-8b-instant",
      "deepseek-r1-distill-llama-70b",
      "openai/gpt-oss-20b",
      "gemma2-9b-it",
    ],
    free: true,
    popular: true,
  },
  {
    id: "gemini",
    name: "Google Gemini",
    emoji: "✦",
    color: "#4285F4",
    blurb: "Real Gemini 3 & 2.5 models from Google. Free tier available.",
    keyUrl: "https://aistudio.google.com/apikey",
    format: "gemini",
    endpoint: "",
    models: [
      "gemini-2.5-flash",
      "gemini-2.5-pro",
      "gemini-2.5-flash-lite",
      "gemini-3.1-pro-preview",
      "gemini-3-flash-preview",
      "gemini-3.1-flash-lite",
      "gemini-pro-latest",
      "gemini-flash-latest",
      "gemma-4-31b-it",
    ],
    free: true,
    popular: true,
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    emoji: "🌐",
    color: "#8B5CF6",
    blurb: "One key → hundreds of models (GPT, Claude, Gemini, Llama, DeepSeek, Qwen…).",
    keyUrl: "https://openrouter.ai/keys",
    format: "openai",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    models: [
      // Free models (IDs end with :free) — $0/token, just rate-limited.
      "openrouter/auto",
      "meta-llama/llama-3.3-70b-instruct:free",
      "deepseek/deepseek-r1:free",
      "deepseek/deepseek-chat-v3.1:free",
      "google/gemma-3-12b-it:free",
      "qwen/qwen3-coder:free",
      "nvidia/nemotron-3-super-120b-a12b:free",
      "mistralai/mistral-7b-instruct:free",
      // Cheap paid models (use credits).
      "openai/gpt-4o-mini",
      "google/gemini-2.5-flash",
      "anthropic/claude-3.5-sonnet",
      "x-ai/grok-2",
    ],
    free: true,
    popular: true,
  },
  {
    id: "anthropic",
    name: "Anthropic",
    emoji: "✻",
    color: "#D97757",
    blurb: "Frontier models direct from Anthropic (BYO key).",
    keyUrl: "https://console.anthropic.com/settings/keys",
    format: "anthropic",
    endpoint: "https://api.anthropic.com/v1/messages",
    models: [
      "claude-3-7-sonnet-20250219",
      "claude-3-5-sonnet-20241022",
      "claude-3-5-haiku-20241022",
      "claude-3-opus-20240229",
    ],
  },
  {
    id: "openai",
    name: "OpenAI",
    emoji: "✺",
    color: "#10A37F",
    blurb: "Real GPT models. Requires a paid OpenAI key.",
    keyUrl: "https://platform.openai.com/api-keys",
    format: "openai",
    endpoint: "https://api.openai.com/v1/chat/completions",
    models: ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini", "gpt-4.1", "o4-mini"],
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    emoji: "🐋",
    color: "#6E56CF",
    blurb: "DeepSeek chat & reasoning models, low cost.",
    keyUrl: "https://platform.deepseek.com/api_keys",
    format: "openai",
    endpoint: "https://api.deepseek.com/v1/chat/completions",
    models: ["deepseek-chat", "deepseek-reasoner"],
  },
  {
    id: "mistral",
    name: "Mistral",
    emoji: "🌬️",
    color: "#FF7000",
    blurb: "Mistral Large, Codestral & open models.",
    keyUrl: "https://console.mistral.ai/api-keys",
    format: "openai",
    endpoint: "https://api.mistral.ai/v1/chat/completions",
    models: ["mistral-large-latest", "mistral-small-latest", "codestral-latest", "open-mixtral-8x7b"],
  },
  {
    id: "xai",
    name: "xAI (Grok)",
    emoji: "🛸",
    color: "#111111",
    blurb: "Real Grok models from xAI.",
    keyUrl: "https://console.x.ai",
    format: "openai",
    endpoint: "https://api.x.ai/v1/chat/completions",
    models: ["grok-2", "grok-2-latest", "grok-beta"],
  },
  {
    id: "perplexity",
    name: "Perplexity",
    emoji: "🔎",
    color: "#20B46E",
    blurb: "Sonar online models with web grounding.",
    keyUrl: "https://www.perplexity.ai/settings/api",
    format: "openai",
    endpoint: "https://api.perplexity.ai/chat/completions",
    models: ["sonar", "sonar-pro", "sonar-reasoning"],
  },
  {
    id: "together",
    name: "Together AI",
    emoji: "🤝",
    color: "#0F6FFF",
    blurb: "Hosted Llama, Qwen & open models.",
    keyUrl: "https://api.together.xyz/settings/api-keys",
    format: "openai",
    endpoint: "https://api.together.xyz/v1/chat/completions",
    models: ["meta-llama/Llama-3.3-70B-Instruct-Turbo", "Qwen/Qwen2.5-72B-Instruct-Turbo", "meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo"],
  },
  {
    id: "fireworks",
    name: "Fireworks AI",
    emoji: "🎆",
    color: "#E63946",
    blurb: "Fast open-model inference.",
    keyUrl: "https://fireworks.ai/account/api-keys",
    format: "openai",
    endpoint: "https://api.fireworks.ai/inference/v1/chat/completions",
    models: ["accounts/fireworks/models/llama-v3p3-70b-instruct", "accounts/fireworks/models/qwen2p5-72b-instruct"],
  },
  {
    id: "nvidia",
    name: "NVIDIA NIM",
    emoji: "🟩",
    color: "#76B900",
    blurb: "NVIDIA-hosted frontier open models (GLM, Llama, DeepSeek…).",
    keyUrl: "https://build.nvidia.com",
    format: "openai",
    endpoint: "https://integrate.api.nvidia.com/v1/chat/completions",
    models: [
      // Confirmed-valid current build.nvidia.com chat model IDs.
      "meta/llama-3.3-70b-instruct",
      "meta/llama-3.1-405b-instruct",
      "meta/llama-3.1-70b-instruct",
      "deepseek-ai/deepseek-r1",
      "deepseek-ai/deepseek-v3.1",
      "qwen/qwen2.5-coder-32b-instruct",
      "nvidia/llama-3.1-nemotron-70b-instruct",
      "nvidia/llama-3.3-nemotron-super-49b-v1.5",
      "nvidia/nemotron-3-super-120b-a12b",
      "nvidia/nemotron-3-ultra-550b-a55b",
      "z-ai/glm-5.2",
      "z-ai/glm-5.1",
      "google/gemma-4-31b-it",
      "google/diffusiongemma-26b-a4b-it",
      "minimaxai/minimax-m3",
      "openai/gpt-oss-120b",
      "openai/gpt-oss-20b",
    ],
  },
];

export function getProvider(id: Provider): ProviderInfo {
  return PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0];
}

/**
 * Keyless free models — all run via the backend's server-side OpenRouter key,
 * so the user needs NO key of their own. These are current OpenRouter free
 * models (`:free`). Each `id` is sent straight to the backend as the model.
 */
export interface FreeModel {
  id: string;
  name: string;
  vendor: string;
  tag: string;
  accent: string;
  source?: "openrouter" | "pollinations";
}

export const FREE_MODELS: FreeModel[] = [
  { id: "pollinations:openai", name: "GPT-OSS · No-Key", vendor: "Pollinations", tag: "100% free — no key, no signup", accent: "#7BC74D", source: "pollinations" },
  { id: "pollinations:openai-fast", name: "GPT-OSS Fast · No-Key", vendor: "Pollinations", tag: "Instant — no key needed", accent: "#7BC74D", source: "pollinations" },
  { id: "openrouter/free", name: "Auto (Best Free)", vendor: "OpenRouter", tag: "Picks the best available free model", accent: "#d97757", source: "openrouter" },
  { id: "nvidia/nemotron-3-ultra-550b-a55b:free", name: "Nemotron 3 Ultra", vendor: "NVIDIA", tag: "Most capable · 1M context", accent: "#76B900" },
  { id: "nvidia/nemotron-3-super-120b-a12b:free", name: "Nemotron 3 Super", vendor: "NVIDIA", tag: "Strong reasoning · 120B", accent: "#76B900" },
  { id: "google/gemma-4-31b-it:free", name: "Gemma 4 31B", vendor: "Google", tag: "Balanced all-rounder", accent: "#4285F4" },
  { id: "google/gemma-4-26b-a4b-it:free", name: "Gemma 4 26B", vendor: "Google", tag: "Efficient MoE", accent: "#4285F4" },
  { id: "openai/gpt-oss-20b:free", name: "GPT-OSS 20B", vendor: "OpenAI", tag: "Fast open reasoning", accent: "#10A37F" },
  { id: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free", name: "Nemotron Nano Omni 30B", vendor: "NVIDIA", tag: "Reasoning · multimodal", accent: "#76B900" },
  { id: "nvidia/nemotron-3-nano-30b-a3b:free", name: "Nemotron Nano 30B", vendor: "NVIDIA", tag: "Compact & quick", accent: "#76B900" },
  { id: "nvidia/nemotron-nano-9b-v2:free", name: "Nemotron Nano 9B", vendor: "NVIDIA", tag: "Very fast", accent: "#76B900" },
  { id: "nvidia/nemotron-nano-12b-v2-vl:free", name: "Nemotron Nano 12B VL", vendor: "NVIDIA", tag: "Vision-capable", accent: "#76B900" },
  { id: "nvidia/nemotron-3.5-lightning:free", name: "Nemotron 3.5 Lightning", vendor: "NVIDIA", tag: "Ultra-fast · 1M context", accent: "#76B900" },
  { id: "cohere/north-mini-code:free", name: "North Mini Code", vendor: "Cohere", tag: "Coding-focused", accent: "#39594D" },
  { id: "poolside/laguna-xs-2.1:free", name: "Laguna XS 2.1", vendor: "Poolside", tag: "Agentic coding", accent: "#6366f1" },
  { id: "liquid/lfm-2.5-2.6b:free", name: "LFM 2.6B", vendor: "Liquid", tag: "Tiny & instant", accent: "#0891b2" },
];

export function getFreeModel(id: string | null): FreeModel | null {
  if (!id) return null;
  return FREE_MODELS.find((m) => m.id === id) ?? null;
}

/* --------------------------- stored key slots ----------------------------- */
// A "slot" is one (provider, key, model) entry. A provider can have multiple
// slots — handy when you have several keys (e.g. several NVIDIA accounts).

export interface KeySlot {
  id: string;
  provider: Provider;
  apiKey: string;
  model: string;
  ok?: boolean | null; // last test result
  error?: string | null; // last test error message
  testedAt?: number;
}
export type ApiKeys = Record<string, KeySlot>;

export interface RealConfig {
  provider: Provider;
  apiKey: string;
  model: string;
}

/** Resolve the currently active slot into a live config for chatReal. */
export function resolveActive(
  apiKeys: ApiKeys,
  activeSlot: string | null
): RealConfig | null {
  if (!activeSlot) return null;
  const slot = apiKeys[activeSlot];
  if (!slot || !slot.apiKey) return null;
  return { provider: slot.provider, apiKey: slot.apiKey, model: slot.model };
}

/**
 * No keys are embedded in the client anymore. Nexora runs ALL models through
 * the backend (/api/chat), which holds the OpenRouter key server-side. Users can
 * still paste their OWN keys in the Models page if they want extra providers.
 */
export const DEFAULT_SLOTS: KeySlot[] = [];
export const DEFAULT_ACTIVE_SLOT = "";

/**
 * Backend-first call: the server maps `tier` (the sidebar model) to a real
 * OpenRouter model and uses the server-side key. No key ever touches the browser.
 */
/** Stream chat from the backend — text appears word-by-word in real time. */
export async function chatStream(
  opts: { system: string; messages: ApiMessage[] },
  onChunk: (partial: string) => void
): Promise<string> {
  const res = await fetch("/api/chat/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ system: opts.system, messages: opts.messages }),
  });
  if (!res.ok || !res.body) throw new Error("stream failed");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    full += decoder.decode(value, { stream: true });
    onChunk(full);
  }
  if (!full.trim() || full.includes("__STREAM_FAILED__")) throw new Error("empty stream");
  return full;
}

export async function chatServer(opts: {
  tier: string;
  system: string;
  messages: ApiMessage[];
}): Promise<string> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tier: opts.tier,
      system: opts.system,
      messages: opts.messages,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Nexora error (${res.status})`);
  if (!data?.text) throw new Error("Empty response from Nexora.");
  return data.text as string;
}

export function slotsToMap(slots: KeySlot[]): ApiKeys {
  const map: ApiKeys = {};
  for (const s of slots) map[s.id] = s;
  return map;
}

/* ------------------------------ call helpers ------------------------------ */

export interface ApiMessage {
  role: "user" | "assistant";
  content: string;
}

export function systemPrompt(personality: string): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
  return `You are Nexora — an advanced AI assistant.

CURRENT DATE: ${dateStr}. Current year: ${year}. You are aware of events through ${year}.

You have expertise across ALL subjects. Answer in the user's language (Roman Urdu, Urdu, Hindi, English). Think step-by-step. Use Markdown. Be accurate and honest — don't invent facts. For code, write complete working examples.`;
}

export interface Spec {
  format: "openai" | "gemini" | "anthropic";
  endpoint: string;
  apiKey: string;
  model: string;
  system: string;
  messages: ApiMessage[];
  provider: string;
}

/** Build a provider-agnostic request spec from a live config. */
export function buildSpec(opts: {
  config: RealConfig;
  system: string;
  messages: ApiMessage[];
}): Spec {
  const { config, system, messages } = opts;
  const p = getProvider(config.provider);
  const endpoint =
    p.format === "gemini"
      ? `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${encodeURIComponent(
          config.apiKey
        )}`
      : p.endpoint;
  return {
    format: p.format,
    endpoint,
    apiKey: config.apiKey,
    model: config.model,
    system,
    messages,
    provider: config.provider,
  };
}

/** Call via the Vercel serverless proxy — works for ALL providers (no CORS). */
async function callProxy(spec: Spec): Promise<string> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(spec),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 404) throw new Error("__NO_PROXY__");
  if (!res.ok) throw new Error(data?.error || `Proxy error (${res.status})`);
  if (!data?.text) throw new Error("Empty response from proxy.");
  return data.text as string;
}

/** Direct browser call — only works for CORS-friendly providers. */
async function callDirect(spec: Spec): Promise<string> {
  const p = getProvider(spec.provider as Provider);

  if (spec.format === "gemini") {
    const res = await fetch(spec.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: spec.system }] },
        contents: spec.messages.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        })),
        generationConfig: { temperature: 0.7 },
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error?.message || `Gemini error (${res.status})`);
    const text = data?.candidates?.[0]?.content?.parts?.map((x: { text?: string }) => x.text).join("") ?? "";
    if (!text) throw new Error("Empty response from Gemini.");
    return text;
  }

  if (spec.format === "anthropic") {
    const res = await fetch(spec.endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": spec.apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: spec.model,
        max_tokens: 2048,
        system: spec.system,
        messages: spec.messages.map((m) => ({ role: m.role, content: m.content })),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error?.message || `Anthropic error (${res.status})`);
    const text = data?.content?.map((x: { text?: string }) => x.text).join("") ?? "";
    if (!text) throw new Error("Empty response from Claude.");
    return text;
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${spec.apiKey}`,
  };
  if (spec.provider === "openrouter") headers["X-Title"] = "Nexora";
  const res = await fetch(spec.endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: spec.model,
      messages: [{ role: "system", content: spec.system }, ...spec.messages],
      temperature: 0.7,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `${p.name} error (${res.status})`);
  const text = data?.choices?.[0]?.message?.content ?? "";
  if (!text) throw new Error("Empty response.");
  return text;
}

/**
 * Try the serverless proxy first (works for every provider on Vercel).
 * If there's no proxy (local dev, or not deployed), fall back to a direct
 * browser call (CORS-friendly providers only).
 */
export async function chatReal(opts: {
  config: RealConfig;
  system: string;
  messages: ApiMessage[];
}): Promise<string> {
  const spec = buildSpec(opts);
  try {
    return await callProxy(spec);
  } catch (e) {
    if (e instanceof Error && e.message === "__NO_PROXY__") {
      return callDirect(spec);
    }
    throw e;
  }
}

/** Is a serverless proxy available (i.e. running on Vercel)? */
export async function hasProxy(): Promise<boolean> {
  try {
    const res = await fetch("/api/chat", { method: "OPTIONS" });
    return res.ok || res.status === 204;
  } catch {
    return false;
  }
}

/** Live connectivity test — returns the model's reply or throws with a clear error. */
export async function testReal(config: RealConfig): Promise<string> {
  return chatReal({
    config,
    system: "You are a connectivity test. Reply with exactly: OK",
    messages: [{ role: "user", content: "ping" }],
  });
}

// Providers that allow direct browser calls (CORS-friendly). Others are blocked
// by the browser for security and require a backend proxy.
export const BROWSER_OK: Provider[] = ["groq", "gemini", "openrouter", "anthropic", "mistral"];

export function browserOk(provider: Provider): boolean {
  return BROWSER_OK.includes(provider);
}

/** Turn a raw fetch failure into a clear, human-readable reason. */
export function explainError(provider: Provider, err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const name = getProvider(provider).name;

  // Network / CORS
  if (/failed to fetch|networkerror|load failed/i.test(msg)) {
    if (!browserOk(provider)) {
      return (
        `Browser blocks ${name} (CORS). Deploy on Vercel so the /api/chat proxy can call it ` +
        "server-side, or use a browser-friendly provider: Groq, Gemini, or OpenRouter."
      );
    }
    return "Network/CORS error — the request was blocked or there's no internet. Check the key and your connection.";
  }

  // Rate limit / quota exhausted (the #1 reason shared/seeded keys "stop working")
  if (/429|rate.?limit|too many requests|throttl|quota|exceed/i.test(msg)) {
    if (provider === "nvidia") {
      return (
        "Rate limit / quota exhausted (429). NVIDIA gives each free key only ~1000 calls/month, " +
        "and these built-in keys are SHARED by everyone who opens this app — so they run out fast. " +
        "Fix: get your OWN free key from build.nvidia.com and add it here, OR switch to OpenRouter " +
        "(1 key → hundreds of models, higher free limits) or Groq (free + very fast)."
      );
    }
    return (
      "Rate limit / quota exhausted (429) on this key. Add another key, or switch to OpenRouter " +
      "(1 key → hundreds of models with a free tier)."
    );
  }

  // Invalid / revoked key
  if (/401|unauthor|invalid.?api.?key|invalid_api_key|no api key/i.test(msg)) {
    return (
      "Invalid or revoked API key (401). Built-in shared keys get disabled often — paste your OWN " +
      `key (tap "Get a key ↗") to keep working reliably.`
    );
  }

  // Forbidden / no access
  if (/403|forbidden|permission|access/i.test(msg)) {
    return "This key isn't authorized for that model (403). Try a different model, or a key that has access.";
  }

  // Out of credits / billing
  if (/402|payment|credit|billing|insufficient|balance/i.test(msg)) {
    return (
      "Out of credits / billing issue (402). Add credits, or use a free provider — Groq, Gemini, " +
      "or OpenRouter's free (:free) models."
    );
  }

  // Model not found / retired
  if (/404|not found|does not exist|model .* not|no such model/i.test(msg)) {
    return (
      "Model not found (404) — this model ID is invalid or retired. Pick a current model from the " +
      "provider's list (Edit → Model)."
    );
  }

  return msg;
}
