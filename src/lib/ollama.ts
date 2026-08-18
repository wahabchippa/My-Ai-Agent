// ═══════════════════════════════════════════════════════════════════
// OLLAMA — browser se seedha OpenAI-compatible call
//
// Jugaad: pehle localhost:11434. Ollama Windows/Mac app tray me
// service ki tarah chalti hai — terminal band ho to bhi zinda.
// Tunnel sirf backup hai (wo terminal ke sath mar jati hai).
// Koi nayi AI API nahi.
// ═══════════════════════════════════════════════════════════════════

export interface OllamaConfig {
  enabled: boolean;
  baseUrl: string;
  fallbackUrl?: string;
  apiKey: string;
  model: string;
}

const LOCAL = "http://localhost:11434/v1";
const LOCAL_IP = "http://127.0.0.1:11434/v1";
const TUNNEL = "https://curriculum-edit-involvement-adapters.trycloudflare.com/v1";

export const DEFAULT_OLLAMA: OllamaConfig = {
  enabled: true,
  baseUrl: LOCAL,
  fallbackUrl: TUNNEL,
  apiKey: "ollama",
  model: "qwen",
};

export function migrateOllama(c?: OllamaConfig | null): OllamaConfig {
  return {
    enabled: c?.enabled ?? true,
    baseUrl: LOCAL,
    fallbackUrl:
      c?.fallbackUrl && !/williams-employee/i.test(c.fallbackUrl) ? c.fallbackUrl : TUNNEL,
    apiKey: c?.apiKey || "ollama",
    model: c?.model || "qwen",
  };
}

export function ollamaReady(c?: OllamaConfig | null): boolean {
  return !!(c?.enabled && (c.baseUrl.trim() || c.fallbackUrl?.trim()) && c.model.trim());
}

/** UI me local / Qwen ka asal naam mat dikhao — sirf backend jaanta hai. */
export function hideModelName(s?: string | null): string {
  if (!s?.trim()) return "";
  if (/qwen/i.test(s)) return "";
  return s;
}

/** List se pehla local model chuno — Qwen ho to wo, warna pehla. Naam UI pe nahi. */
export function pickLocalModel(models: string[], current?: string): string {
  if (current && models.includes(current)) return current;
  return models.find((m) => /qwen/i.test(m)) || models[0] || current || "qwen";
}

export function normalizeOllamaBase(url: string): string {
  let u = url.trim().replace(/\/+$/, "");
  if (!u) return u;
  try {
    const parsed = new URL(u);
    const path = parsed.pathname.replace(/\/+$/, "") || "";
    if (!path || path === "/") u = `${parsed.origin}/v1`;
  } catch {
    /* jaise diya */
  }
  return u.replace(/\/+$/, "");
}

export function ollamaEndpoints(c: OllamaConfig): string[] {
  const out: string[] = [];
  for (const raw of [LOCAL, LOCAL_IP, c.baseUrl, c.fallbackUrl, TUNNEL]) {
    if (!raw?.trim()) continue;
    const n = normalizeOllamaBase(raw);
    if (n && !out.includes(n)) out.push(n);
  }
  return out;
}

/**
 * Ollama asal me chal raha hai? SIRF local endpoints ping karta hai
 * (1.5s timeout) — taake bina Ollama wale users ko koi der na lage
 * aur remote/tunnel endpoint ke intezar me na phansein.
 */
export async function ollamaReachable(cfg: OllamaConfig): Promise<boolean> {
  const candidates = new Set<string>([
    LOCAL,
    LOCAL_IP,
    normalizeOllamaBase(cfg.baseUrl),
  ]);
  for (const base of candidates) {
    if (!base) continue;
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 1500);
      const r = await fetch(`${base.replace(/\/+$/, "")}/models`, {
        headers: authHeaders(cfg),
        signal: ctrl.signal,
      });
      clearTimeout(t);
      if (r.ok) return true;
    } catch {
      /* agla endpoint */
    }
  }
  return false;
}

function authHeaders(cfg: OllamaConfig): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${cfg.apiKey.trim() || "ollama"}`,
  };
}

function explainOllamaError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/failed to fetch|networkerror|load failed|cors/i.test(msg)) {
    return (
      "Ollama nahi mila. App (llama icon) tray me chalu rakho — terminal ki zaroorat nahi. " +
      "Pehli dafa: OLLAMA_ORIGINS=* set karo, phir Ollama restart."
    );
  }
  return msg;
}

function pullDelta(obj: Record<string, unknown>): string {
  const choices = obj.choices as { delta?: { content?: string }; message?: { content?: string } }[] | undefined;
  if (choices?.[0]?.delta?.content) return String(choices[0].delta.content);
  if (choices?.[0]?.message?.content) return String(choices[0].message.content);
  const message = obj.message as { content?: string } | undefined;
  if (typeof message?.content === "string" && obj.done !== true) return message.content;
  if (typeof obj.response === "string") return obj.response;
  return "";
}

async function readStream(res: Response, onChunk: (partial: string) => void): Promise<string> {
  if (!res.body) throw new Error("Ollama ne khaali stream bheji");
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let full = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const parts = buf.split("\n");
    buf = parts.pop() ?? "";
    for (const raw of parts) {
      const line = raw.trim();
      if (!line || line === "data: [DONE]") continue;
      const json = line.startsWith("data:") ? line.slice(5).trim() : line;
      if (!json || json === "[DONE]") continue;
      try {
        const piece = pullDelta(JSON.parse(json) as Record<string, unknown>);
        if (piece) {
          full += piece;
          onChunk(full);
        }
      } catch {
        /* adhoori line */
      }
    }
  }
  if (!full.trim()) throw new Error("Local AI ne khaali jawab diya");
  return full;
}

export async function chatOllamaStream(
  cfg: OllamaConfig,
  opts: {
    system: string;
    messages: { role: string; content: string }[];
    signal?: AbortSignal;
  },
  onChunk: (partial: string) => void,
): Promise<string> {
  const body = JSON.stringify({
    model: cfg.model.trim(),
    stream: true,
    messages: [
      { role: "system", content: opts.system },
      ...opts.messages.map((m) => ({ role: m.role, content: m.content })),
    ],
  });

  let lastErr: unknown = null;
  for (const base of ollamaEndpoints(cfg)) {
    try {
      const res = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: authHeaders(cfg),
        body,
        signal: opts.signal,
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        lastErr = new Error(t.slice(0, 200) || `HTTP ${res.status}`);
        continue;
      }
      return await readStream(res, onChunk);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") throw e;
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(explainOllamaError(lastErr));
}

export async function testOllama(
  cfg: OllamaConfig,
): Promise<{ ok: true; models: string[]; via: string } | { ok: false; error: string }> {
  let last = "";
  for (const base of ollamaEndpoints(cfg)) {
    try {
      const res = await fetch(`${base}/models`, { headers: authHeaders(cfg) });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const models: string[] = (data?.data ?? data?.models ?? [])
          .map((m: { id?: string; name?: string }) => m.id || m.name)
          .filter(Boolean);
        return { ok: true, models, via: base };
      }
      last = `${base} → HTTP ${res.status}`;
    } catch (e) {
      last = explainOllamaError(e);
    }
  }
  return { ok: false, error: last || "Ollama nahi mila" };
}

export function explainOllama(err: unknown): string {
  return explainOllamaError(err);
}

/** Streaming ke baghair poora jawab — builder JSON ke liye. */
export async function chatOllama(
  cfg: OllamaConfig,
  opts: {
    system: string;
    messages: { role: string; content: string }[];
    signal?: AbortSignal;
  },
): Promise<string> {
  let full = "";
  await chatOllamaStream(cfg, opts, (p) => {
    full = p;
  });
  return full;
}

// ── LOCAL MODEL ENSEMBLE ────────────────────────────────────────────
// Agar user ke paas MULTIPLE Ollama models hain, to:
//   • pickBestModel  — answer ke liye sabse taqatwar model (70b > 34b >
//                      27b > 14b > 13b > 8b > 7b > 3b > 1.5b)
//   • pickFastModel  — triage/review ke liye sabse chhota tez model
// User ki khud ki setting (Settings → Local AI) hamesha respect hoti hai.

const SIZE_ORDER = [
  "70b", "34b", "27b", "32b", "22b", "14b", "13b", "12b", "9b", "8b",
  "7b", "6b", "3.1", "3b", "2b", "1.5b", "1b", "0.5b", "0.6b",
];

function sizeScore(m: string): number {
  const low = m.toLowerCase();
  for (let i = 0; i < SIZE_ORDER.length; i++) {
    if (low.includes(SIZE_ORDER[i])) return (SIZE_ORDER.length - i) * 10;
  }
  return 0;
}

/** Installed models ki list (sirf local endpoints, 2s timeout). */
export async function ollamaModels(cfg: OllamaConfig): Promise<string[] | null> {
  for (const base of [LOCAL, LOCAL_IP, normalizeOllamaBase(cfg.baseUrl)]) {
    if (!base) continue;
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 2000);
      const res = await fetch(`${base.replace(/\/+$/, "")}/models`, {
        headers: authHeaders(cfg),
        signal: ctrl.signal,
      });
      clearTimeout(t);
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const models: string[] = (data?.data ?? data?.models ?? [])
          .map((m: { id?: string; name?: string }) => m.id || m.name)
          .filter(Boolean);
        if (models.length) return models;
      }
    } catch {
      /* agla endpoint */
    }
  }
  return null;
}

/** Answer ke liye behtareen model — user ki setting pehle. */
export function pickBestModel(models: string[], current?: string): string {
  if (current && models.includes(current)) return current;
  return [...models].sort((a, b) => sizeScore(b) - sizeScore(a))[0] || current || "";
}

/** Triage/review ke liye sabse halka model — user ki setting pehle. */
export function pickFastModel(models: string[], current?: string): string {
  if (current && models.includes(current)) return current;
  return [...models].sort((a, b) => sizeScore(a) - sizeScore(b))[0] || current || "";
}
