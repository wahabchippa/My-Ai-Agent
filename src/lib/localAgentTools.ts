// ═══════════════════════════════════════════════════════════════════
// NEXORA — CLIENT-SAFE LOCAL AGENT TOOLS
//
// Deep mode ka LOCAL ReAct agent (browser me chalta hai) ke liye.
// Server wale tools.ts ko import NAHI kar sakte — wo webFetch →
// safeUrl → node:dns khinchta hai (client build toot jata).
// Ye file sirf client-safe cheezein use karti hai: research (DuckDuckGo
// API), knowledge (built-in), /api/execute (auth-gated sandbox).
// ═══════════════════════════════════════════════════════════════════

import { research } from "./research";
import { lookup } from "./knowledge";

export interface LocalToolCall {
  tool: string;
  input: string;
}

export interface LocalToolResult {
  tool: string;
  input: string;
  output: string;
  ok: boolean;
  ms?: number;
}

const KNOWN = new Set(["web_search", "read_url", "run_code", "recall"]);

/** Model ke jawab me se ACTION JSON nikalo. */
export function parseActionLocal(text: string): LocalToolCall | null {
  const t = text.trim();
  if (/^\s*FINAL\s*:/i.test(t)) return null;

  const tryParse = (raw: string): LocalToolCall | null => {
    try {
      const o = JSON.parse(raw) as { tool?: unknown; input?: unknown };
      if (typeof o?.tool !== "string" || !KNOWN.has(o.tool)) return null;
      return { tool: o.tool, input: String(o.input ?? "") };
    } catch {
      return null;
    }
  };

  const m = t.match(/ACTION\s*:\s*(\{[\s\S]*?\})\s*(?:\n|$)/i);
  if (m) {
    const c = tryParse(m[1]);
    if (c) return c;
  }
  const f = t.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (f) {
    const c = tryParse(f[1]);
    if (c) return c;
  }
  if (t.startsWith("{")) {
    const end = t.lastIndexOf("}");
    if (end > 0) {
      const c = tryParse(t.slice(0, end + 1));
      if (c) return c;
    }
  }
  return null;
}

/** FINAL: ke baad wala hissa (ya poora text). */
export function stripFinalLocal(text: string): string {
  const m = text.match(/^[\s\S]*?FINAL\s*:\s*([\s\S]*)$/i);
  return (m ? m[1] : text).trim();
}

/** Model ko dikhane wala chhota tool manual. */
export function toolManualLocal(): string {
  return [
    '• web_search — "input": search query. Live web results. Use for current events, prices, facts you are unsure about.',
    '• read_url — "input": full http(s) URL. Reads a page (may fail due to browser CORS; if so say so and rely on web_search).',
    '• run_code — "input": JavaScript function body (no imports/fs/network). Runs in a sandbox and returns real output.',
    '• recall — "input": topic. Nexora built-in knowledge base. Cheap — try before web_search.',
  ].join("\n");
}

const cap = (s: string, n = 4000) => (s.length > n ? s.slice(0, n) + `\n…[${s.length - n} chars aur]` : s);

/** Tool chalao — client-safe versions. */
export async function runToolLocal(call: LocalToolCall): Promise<LocalToolResult> {
  const t0 = Date.now();
  let output = "";
  try {
    switch (call.tool) {
      case "web_search": {
        const q = call.input.trim().slice(0, 200);
        if (!q) output = "ERROR: search query khali hai.";
        else output = (await research(q)) || "Web search: koi natija nahi mila.";
        break;
      }
      case "read_url": {
        const u = call.input.trim();
        if (!/^https?:\/\//i.test(u)) {
          output = "ERROR: input ek poora http(s) URL hona chahiye.";
          break;
        }
        try {
          const ctrl = new AbortController();
          const t = setTimeout(() => ctrl.abort(), 8000);
          const r = await fetch(u, { signal: ctrl.signal, headers: { Accept: "text/html,*/*" } });
          clearTimeout(t);
          const text = r.ok ? await r.text() : "";
          const clean = text
            .replace(/<script[\s\S]*?<\/script>/gi, " ")
            .replace(/<style[\s\S]*?<\/style>/gi, " ")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 4000);
          output = clean.length > 100 ? clean : "ERROR: page ka content browser se nahi parha ja saka (CORS). web_search use karo.";
        } catch {
          output = "ERROR: page fetch nahi hua (CORS/network). web_search use karo.";
        }
        break;
      }
      case "run_code": {
        const code = call.input.trim();
        if (!code || code.length > 6000) {
          output = "ERROR: code khali ya bohot bara.";
          break;
        }
        try {
          const r = await fetch("/api/execute", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code }),
          });
          const d = await r.json().catch(() => null);
          if (!d) output = "ERROR: sandbox ne jawab nahi diya.";
          else if (d.error) output = `ERROR: ${d.error}`;
          else output = `result: ${JSON.stringify(d.result)}${d.logs?.length ? `\nconsole:\n${d.logs.join("\n")}` : ""}`;
        } catch {
          output = "ERROR: sandbox tak nahi pohancha.";
        }
        break;
      }
      case "recall": {
        const hit = lookup(call.input.trim());
        output = hit ? `[${hit.entry.keys[0]}]\n${hit.entry.answer}` : "Knowledge base me is par kuch nahi mila. web_search try karo.";
        break;
      }
      default:
        output = `ERROR: '${call.tool}' naam ka koi tool nahi.`;
    }
  } catch (e) {
    output = `ERROR: ${e instanceof Error ? e.message : "tool fail"}`;
  }
  return { ...call, output: cap(output), ok: !output.startsWith("ERROR:") && output.length > 0, ms: Date.now() - t0 };
}
