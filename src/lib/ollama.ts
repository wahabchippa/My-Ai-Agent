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
  for (const raw of [LOCAL, c.baseUrl, c.fallbackUrl, TUNNEL]) {
    if (!raw?.trim()) continue;
    const n = normalizeOllamaBase(raw);
    if (n && !out.includes(n)) out.push(n);
  }
  return out;
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
  if (!full.trim()) throw new Error("Qwen ne khaali jawab diya");
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
