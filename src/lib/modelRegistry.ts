// ═══════════════════════════════════════════════════════════════════
// NEXORA — SINGLE SOURCE OF TRUTH FOR MODELS
//
// Ye file ISLIYE bani hai: pehle model IDs 4 alag files me bikhre hue the
// (chat/route.ts, chat/master/route.ts, realai.ts, models.tsx). Jab koi
// provider apna model retire karta, sirf EK jagah update hoti thi — baaki
// jagah dead ID reh jati thi, aur AI 404 → fallback → GHALAT/PURANA jawab.
//
// ── VERIFIED LIVE: 2026-08-16 ──
// Har ID neeche `node scripts/verify-models.mjs` se live check ki gayi hai.
//
// ⚠ RULE: Naya model add karne se PEHLE verify script chalao.
// ═══════════════════════════════════════════════════════════════════

export type Fmt = "openai" | "gemini";

export interface Entry {
  /** internal id */
  id: string;
  /** display name */
  name: string;
  /** provider label */
  provider: string;
  /** API format */
  fmt: Fmt;
  /** endpoint URL ("" for gemini — built per-model) */
  url: string;
  /** exact model id sent to the provider */
  model: string;
  /** env var holding the key; "" = keyless */
  envKey: string;
  /** capability tags */
  tags: string[];
  /**
   * Quality rank — LOWER IS BETTER. Yehi decide karta hai kaunsa model
   * pehle try hoga. Frontier models = 1-20, keyless junk = 90+.
   */
  rank: number;
  /**
   * Knowledge cutoff. Agar model ka cutoff 2024 ya usse purana hai to
   * usay kabhi PRIMARY nahi banaya jayega — sirf emergency fallback.
   */
  cutoff: string;
  /** true = model apne aap web search karta hai (grounding) */
  grounded?: boolean;
}

// ─────────────────────────────────────────────────────────────────
// TIER 1 — FRONTIER (free tier, key chahiye, 10 min me mil jati hai)
// ─────────────────────────────────────────────────────────────────
export const REGISTRY: Entry[] = [
  // ── Google Gemini — BEST free tier. Live-verified 2026-08-16 ──
  // Har entry asli key se test ki gayi; model ne khud apna cutoff bataya.
  // ⚠ "gemini-3-flash" 404 deta hai — wo exist nahi karta. Sahi naam
  //   "gemini-3-flash-preview" hai, magar 3.7 usse behtar hai.
  {
    id: "gemini-37-flash",
    name: "Gemini 3.7 Flash",
    provider: "Google",
    fmt: "gemini",
    url: "",
    model: "gemini-3.7-flash",
    envKey: "GEMINI_API_KEY",
    tags: ["reasoning", "knowledge", "coding", "math", "creative", "general", "fast"],
    rank: 1,
    cutoff: "2026-03", // ← model ne khud bataya: "knowledge cutoff is March 2026"
    grounded: true,
  },
  {
    id: "gemini-36-flash",
    name: "Gemini 3.6 Flash",
    provider: "Google",
    fmt: "gemini",
    url: "",
    model: "gemini-3.6-flash",
    envKey: "GEMINI_API_KEY",
    tags: ["reasoning", "knowledge", "coding", "math", "creative", "general", "fast"],
    rank: 2,
    cutoff: "2026-03",
    grounded: true,
  },
  {
    id: "gemini-35-flash",
    name: "Gemini 3.5 Flash",
    provider: "Google",
    fmt: "gemini",
    url: "",
    model: "gemini-3.5-flash",
    envKey: "GEMINI_API_KEY",
    tags: ["reasoning", "knowledge", "coding", "general", "fast"],
    rank: 3,
    cutoff: "2025-01",
    grounded: true,
  },
  {
    id: "gemini-31-flash-lite",
    name: "Gemini 3.1 Flash Lite",
    provider: "Google",
    fmt: "gemini",
    url: "",
    model: "gemini-3.1-flash-lite",
    envKey: "GEMINI_API_KEY",
    tags: ["general", "fast", "knowledge"],
    rank: 10,
    cutoff: "2025-01",
    grounded: true,
  },
  // ⚠ gemini-2.5-flash ne khud kaha "as of early 2023" — bohot purana.
  // Sirf aakhri Gemini fallback ke taur pe rakha hai.
  {
    id: "gemini-25-flash",
    name: "Gemini 2.5 Flash",
    provider: "Google",
    fmt: "gemini",
    url: "",
    model: "gemini-2.5-flash",
    envKey: "GEMINI_API_KEY",
    tags: ["general", "fast"],
    rank: 30,
    cutoff: "2024-06",
    grounded: true,
  },

  // ── Cerebras — 1M tokens/day free (key optional) ──
  {
    id: "cerebras-gptoss120",
    name: "GPT-OSS 120B (Cerebras)",
    provider: "Cerebras",
    fmt: "openai",
    url: "https://api.cerebras.ai/v1/chat/completions",
    model: "gpt-oss-120b",
    envKey: "CEREBRAS_API_KEY",
    tags: ["reasoning", "coding", "math", "knowledge", "general"],
    rank: 11,
    cutoff: "2024-06",
  },
  {
    id: "cerebras-qwen235",
    name: "Qwen3 235B (Cerebras)",
    provider: "Cerebras",
    fmt: "openai",
    url: "https://api.cerebras.ai/v1/chat/completions",
    model: "qwen-3-235b-a22b-instruct-2507",
    envKey: "CEREBRAS_API_KEY",
    tags: ["reasoning", "coding", "knowledge", "general"],
    rank: 12,
    cutoff: "2024",
  },

  // ── Groq — live-verified 2026-08-16 (15 models available on this key) ──
  {
    id: "groq-gptoss120",
    name: "GPT-OSS 120B (Groq)",
    provider: "Groq",
    fmt: "openai",
    url: "https://api.groq.com/openai/v1/chat/completions",
    model: "openai/gpt-oss-120b",
    envKey: "GROQ_API_KEY",
    tags: ["reasoning", "coding", "math", "knowledge", "general"],
    rank: 13,
    cutoff: "2024-06",
  },
  {
    id: "groq-qwen36",
    name: "Qwen 3.6 27B (Groq)",
    provider: "Groq",
    fmt: "openai",
    url: "https://api.groq.com/openai/v1/chat/completions",
    model: "qwen/qwen3.6-27b",
    envKey: "GROQ_API_KEY",
    tags: ["reasoning", "coding", "general"],
    rank: 14,
    cutoff: "2025",
  },
  {
    id: "groq-llama33",
    name: "Llama 3.3 70B (Groq)",
    provider: "Groq",
    fmt: "openai",
    url: "https://api.groq.com/openai/v1/chat/completions",
    model: "llama-3.3-70b-versatile",
    envKey: "GROQ_API_KEY",
    tags: ["reasoning", "coding", "knowledge", "creative", "general"],
    rank: 16,
    cutoff: "2023-12",
  },
  {
    id: "groq-compound",
    name: "Groq Compound (web-enabled)",
    provider: "Groq",
    fmt: "openai",
    url: "https://api.groq.com/openai/v1/chat/completions",
    model: "groq/compound",
    envKey: "GROQ_API_KEY",
    tags: ["knowledge", "general", "reasoning"],
    rank: 15,
    // Base weights Dec 2023 ke hain, MAGAR compound ke paas built-in web
    // search hai — is liye live sawalon pe ye fresh jawab deta hai.
    // grounded:true isi liye hai; cutoff sach likha hai.
    cutoff: "2023-12",
    grounded: true, // Groq compound ke paas built-in web search hai
  },
  {
    id: "groq-llama31-8b",
    name: "Llama 3.1 8B (Groq)",
    provider: "Groq",
    fmt: "openai",
    url: "https://api.groq.com/openai/v1/chat/completions",
    model: "llama-3.1-8b-instant",
    envKey: "GROQ_API_KEY",
    tags: ["fast", "general"],
    rank: 40,
    cutoff: "2023-12",
  },

  // ── OpenRouter — VERIFIED live :free IDs (2026-08-16). ──
  {
    id: "or-nemotron-ultra",
    name: "Nemotron 3 Ultra 550B",
    provider: "OpenRouter",
    fmt: "openai",
    url: "https://openrouter.ai/api/v1/chat/completions",
    model: "nvidia/nemotron-3-ultra-550b-a55b:free",
    envKey: "OPENROUTER_API_KEY",
    tags: ["reasoning", "knowledge", "general", "math"],
    rank: 20,
    // ⚠ Live probe: model ne khud "October 2024" bataya (ek aur run me
    // "October 2023"). Dono soorat me STALE — OpenRouter ki listing naya
    // lagti hai magar weights purane hain.
    cutoff: "2024-10",
  },
  {
    id: "or-nemotron-lightning",
    name: "Nemotron 3.5 Lightning",
    provider: "OpenRouter",
    fmt: "openai",
    url: "https://openrouter.ai/api/v1/chat/completions",
    model: "nvidia/nemotron-3.5-lightning:free",
    envKey: "OPENROUTER_API_KEY",
    tags: ["fast", "general", "knowledge"],
    rank: 21,
    cutoff: "2024-06", // live probe
  },
  {
    id: "or-nemotron-super",
    name: "Nemotron 3 Super 120B",
    provider: "OpenRouter",
    fmt: "openai",
    url: "https://openrouter.ai/api/v1/chat/completions",
    model: "nvidia/nemotron-3-super-120b-a12b:free",
    envKey: "OPENROUTER_API_KEY",
    tags: ["reasoning", "knowledge", "general"],
    rank: 22,
    cutoff: "2024-09", // live probe
  },
  {
    id: "or-gemma4-31b",
    name: "Gemma 4 31B",
    provider: "OpenRouter",
    fmt: "openai",
    url: "https://openrouter.ai/api/v1/chat/completions",
    model: "google/gemma-4-31b-it:free",
    envKey: "OPENROUTER_API_KEY",
    tags: ["knowledge", "general", "creative"],
    rank: 17,
    cutoff: "2025-01", // live probe — FRESH
  },
  {
    id: "or-gemma4-26b",
    name: "Gemma 4 26B",
    provider: "OpenRouter",
    fmt: "openai",
    url: "https://openrouter.ai/api/v1/chat/completions",
    model: "google/gemma-4-26b-a4b-it:free",
    envKey: "OPENROUTER_API_KEY",
    tags: ["knowledge", "general", "fast"],
    rank: 16,
    cutoff: "2024",
  },
  {
    id: "or-northcode",
    name: "North Mini Code",
    provider: "OpenRouter",
    fmt: "openai",
    url: "https://openrouter.ai/api/v1/chat/completions",
    model: "cohere/north-mini-code:free",
    envKey: "OPENROUTER_API_KEY",
    tags: ["coding"],
    rank: 24,
    cutoff: "2024-06", // live probe (aur 11s slow tha)
  },
  {
    id: "or-laguna",
    name: "Laguna S 2.1",
    provider: "OpenRouter",
    fmt: "openai",
    url: "https://openrouter.ai/api/v1/chat/completions",
    model: "poolside/laguna-s-2.1:free",
    envKey: "OPENROUTER_API_KEY",
    tags: ["coding", "reasoning"],
    rank: 18,
    cutoff: "2025-11", // live probe — OpenRouter ka sabse fresh free model
  },
  {
    id: "or-gptoss20",
    name: "GPT-OSS 20B",
    provider: "OpenRouter",
    fmt: "openai",
    url: "https://openrouter.ai/api/v1/chat/completions",
    model: "openai/gpt-oss-20b:free",
    envKey: "OPENROUTER_API_KEY",
    tags: ["reasoning", "coding", "fast"],
    // Live probe: 20s timeout pe "Empty response" — reliably slow/broken.
    rank: 45,
    cutoff: "2024-06",
  },
  {
    id: "or-dots3",
    name: "Dots 3 Note",
    provider: "OpenRouter",
    fmt: "openai",
    url: "https://openrouter.ai/api/v1/chat/completions",
    model: "dots-studio/dots-3-note-preview:free",
    envKey: "OPENROUTER_API_KEY",
    tags: ["general", "creative"],
    rank: 19,
    cutoff: "2025-12", // live probe — FRESH, 512K context
  },
  {
    id: "or-auto",
    name: "OpenRouter Auto",
    provider: "OpenRouter",
    fmt: "openai",
    url: "https://openrouter.ai/api/v1/chat/completions",
    model: "openrouter/auto",
    envKey: "OPENROUTER_API_KEY",
    tags: ["general"],
    rank: 26,
    cutoff: "2024-04", // live probe
  },

  // ── AirForce — is key par sirf Mistral free hai ──
  // Live test: gemini-3.6-flash aur grok-* "requires active subscription".
  // gemma-4-26b rate-limited (1 req). Sirf mistral-large chala.
  {
    id: "af-mistral",
    name: "Mistral Large (AirForce)",
    provider: "AirForce",
    fmt: "openai",
    url: "https://api.airforce/v1/chat/completions",
    model: "mistral-large-latest",
    envKey: "AIRFORCE_API_KEY",
    tags: ["general", "creative"],
    rank: 60,
    // ⚠ Live probe: is model ne "September 2021" bataya — bohot purana.
    cutoff: "2021-09",
  },

  // ── BazaarLink — ⚠ is key par credits KHATAM hain ──
  // Live test: har model "Insufficient credits. Please top up".
  // Entry rakhi hai taake top-up karte hi kaam kare, magar rank neeche.
  {
    id: "bl-glm52",
    name: "GLM 5.2 (BazaarLink)",
    provider: "BazaarLink",
    fmt: "openai",
    url: "https://api.bazaarlink.ai/v1/chat/completions",
    model: "glm-5.2",
    envKey: "BAZAARLINK_API_KEY",
    tags: ["reasoning", "knowledge", "coding", "general"],
    rank: 55,
    cutoff: "2025",
  },
  {
    id: "bl-gemini31pro",
    name: "Gemini 3.1 Pro (BazaarLink)",
    provider: "BazaarLink",
    fmt: "openai",
    url: "https://api.bazaarlink.ai/v1/chat/completions",
    model: "gemini-3.1-pro-preview",
    envKey: "BAZAARLINK_API_KEY",
    tags: ["reasoning", "knowledge", "coding", "math", "general"],
    rank: 56,
    cutoff: "2025",
  },

  // ═════════════════════════════════════════════════════════════
  // OPTIONAL EXTRA PROVIDERS
  //
  // Ye cheahjs/free-llm-api-resources aur public-apis lists se aaye hain.
  // Sab ke free tiers hain. Key set karo to khud-ba-khud pool me aa jate
  // hain (envKey khali ho to skip ho jate hain) — koi code badalna nahi.
  //
  // Signup links SETUP-FREE-AI.md me hain.
  // ═════════════════════════════════════════════════════════════

  // Cloudflare Workers AI — 10,000 neurons/day free.
  // ⚠ URL me account ID chahiye, is liye CF_ACCOUNT_ID bhi set karna hoga.
  {
    id: "cf-llama33",
    name: "Llama 3.3 70B (Cloudflare)",
    provider: "Cloudflare",
    fmt: "openai",
    url: `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID || ""}/ai/v1/chat/completions`,
    model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    envKey: "CLOUDFLARE_API_KEY",
    tags: ["general", "reasoning", "fast"],
    rank: 23,
    cutoff: "2023-12",
  },

  // Mistral La Plateforme — free tier (1 req/sec).
  {
    id: "mistral-large",
    name: "Mistral Large",
    provider: "Mistral",
    fmt: "openai",
    url: "https://api.mistral.ai/v1/chat/completions",
    model: "mistral-large-latest",
    envKey: "MISTRAL_API_KEY",
    tags: ["reasoning", "coding", "general", "creative"],
    rank: 25,
    cutoff: "2024",
  },

  // Cohere — free trial key, 1,000 req/month.
  {
    id: "cohere-command-a",
    name: "Command A (Cohere)",
    provider: "Cohere",
    fmt: "openai",
    url: "https://api.cohere.ai/compatibility/v1/chat/completions",
    model: "command-a-03-2025",
    envKey: "COHERE_API_KEY",
    tags: ["general", "knowledge", "reasoning"],
    rank: 27,
    cutoff: "2025-03",
  },

  // SambaNova — free tier, bohot tez.
  {
    id: "sambanova-llama",
    name: "Llama 3.3 70B (SambaNova)",
    provider: "SambaNova",
    fmt: "openai",
    url: "https://api.sambanova.ai/v1/chat/completions",
    model: "Meta-Llama-3.3-70B-Instruct",
    envKey: "SAMBANOVA_API_KEY",
    tags: ["general", "reasoning", "fast"],
    rank: 28,
    cutoff: "2023-12",
  },

  // Scaleway Generative APIs — 1,000,000 free tokens.
  {
    id: "scaleway-llama",
    name: "Llama 3.3 70B (Scaleway)",
    provider: "Scaleway",
    fmt: "openai",
    url: "https://api.scaleway.ai/v1/chat/completions",
    model: "llama-3.3-70b-instruct",
    envKey: "SCALEWAY_API_KEY",
    tags: ["general", "reasoning"],
    rank: 29,
    cutoff: "2023-12",
  },

  // ─────────────────────────────────────────────────────────────
  // TIER 3 — KEYLESS EMERGENCY FALLBACK
  //
  // ⚠⚠ YEH HI AAPKA ASAL MASLA THA ⚠⚠
  // Ye endpoints koi bhi model naam accept kar lete hain aur chupke se
  // kuch aur serve karte hain. Live test (2026-08-16):
  //   llm7 "gemini-3.1-flash-lite" → asal me GPT-4o, cutoff Oct 2023
  //   llm7 "gpt-oss:20b"           → asal me GPT-4,  cutoff Sep 2021
  //   llm7 "DeepSeek-V4-Flash"     → asal me GPT-4o, cutoff Oct 2023
  //   llm7 "minimax-m2.7"          → "current president = Joe Biden" (2024!)
  //
  // Isi liye rank 90+ hai — sirf tab chalega jab BAAKI SAB fail ho jayen,
  // aur jawab pe "outdated" warning lagegi.
  // ─────────────────────────────────────────────────────────────
  {
    id: "keyless-pollinations",
    name: "Pollinations (fallback)",
    provider: "Keyless",
    fmt: "openai",
    url: "https://text.pollinations.ai/openai",
    model: "openai",
    envKey: "",
    tags: ["general", "fast"],
    rank: 90,
    cutoff: "2024-06",
  },
  {
    id: "keyless-pollinations-fast",
    name: "Pollinations Fast (fallback)",
    provider: "Keyless",
    fmt: "openai",
    url: "https://text.pollinations.ai/openai",
    model: "openai-fast",
    envKey: "",
    tags: ["fast", "general"],
    rank: 92,
    cutoff: "2024-06",
  },
  {
    id: "keyless-llm7",
    name: "LLM7 (fallback)",
    provider: "Keyless",
    fmt: "openai",
    url: "https://api.llm7.io/v1/chat/completions",
    model: "gemini-3.1-flash-lite",
    envKey: "",
    tags: ["general"],
    rank: 95,
    cutoff: "2023-10", // ← ASAL cutoff, jo naam se nahi pata chalta
  },
];

/** Cutoff se pehle ka koi bhi model "stale" hai — sirf fallback. */
const STALE_BEFORE = 2025;

export function isStale(e: Entry): boolean {
  const y = parseInt(e.cutoff.slice(0, 4), 10);
  return Number.isFinite(y) && y < STALE_BEFORE;
}

/** Sirf wo models jinki key ACTUALLY set hai (ya keyless hain). */
export function available(): Entry[] {
  return REGISTRY.filter((e) => (e.envKey ? !!process.env[e.envKey] : true));
}

/** Kya user ke paas koi asli (non-keyless) provider hai? */
export function hasRealProvider(): boolean {
  return REGISTRY.some((e) => e.envKey && !!process.env[e.envKey]);
}

/** Kaunse providers configured hain — UI/diagnostics ke liye. */
export function configuredProviders(): string[] {
  const s = new Set<string>();
  for (const e of REGISTRY) if (e.envKey && process.env[e.envKey]) s.add(e.provider);
  return [...s];
}

/** Get the key for an entry. */
export function keyFor(e: Entry): string {
  return e.envKey ? process.env[e.envKey] || "" : "";
}

/**
 * Best models for a task, best-first.
 *
 * KEY FIX: keyless/stale models hamesha AAKHIR me — chahe wo tags match
 * karte hon. Pehle ye rank-sort me ghul-mil jate the aur "fast mode" me
 * top-1 ban jate the → user ko 2023 ka jawab milta tha.
 */
export function pick(opts: { tags?: string[]; limit?: number } = {}): Entry[] {
  const { tags = [], limit = 3 } = opts;
  const av = available();

  const score = (e: Entry) => {
    let s = e.rank;
    if (tags.length && e.tags.some((t) => tags.includes(t))) s -= 100; // tag match = big boost
    if (isStale(e)) s += 1000;        // purana model = neeche
    if (!e.envKey) s += 2000;         // keyless = sabse neeche
    return s;
  };

  return [...av].sort((a, b) => score(a) - score(b)).slice(0, limit);
}

/** Sirf fresh (2025+) models — quality-critical kaam ke liye. */
export function pickFresh(opts: { tags?: string[]; limit?: number } = {}): Entry[] {
  const fresh = pick({ ...opts, limit: 99 }).filter((e) => !isStale(e) && e.envKey);
  return fresh.slice(0, opts.limit ?? 3);
}

export function byId(id: string): Entry | undefined {
  return REGISTRY.find((e) => e.id === id);
}
