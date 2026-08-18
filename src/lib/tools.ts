// ═══════════════════════════════════════════════════════════════════════
// NEXORA — AGENT TOOLS
//
// Ye wo cheez hai jo Claude/GPT ko "agent" banati hai aur jiski Nexora me
// kami thi. Tools pehle se mojood the (research, readUrl, execute code),
// magar unhe chalane ka faisla HARDCODED tha:
//     needsResearch(task) regex chala -> web search
//     hasUrl(task)        regex chala -> URL parho
// Yani model ke paas ikhtiyar nahi tha. Agar regex chook gaya, tool kabhi
// na chalta — chahe model ko us ki sakht zaroorat ho.
//
// Ab model KHUD likhta hai ke usay kya chahiye, aur natija dekh kar agla
// faisla karta hai. Yehi asal farq hai fixed pipeline aur agent me.
//
// NOTE: native "tool calling" (OpenAI function-calling) istemal NAHI ki
// gayi — 37 me se sirf kuch models us ko theek support karte hain, aur
// free tier par wo aksar khaali jawab deta hai. Iski jagah saada text
// protocol hai: model JSON likhta hai, hum parse karte hain. Ye har model
// ke sath chalta hai, chahe wo kitna hi chhota ho.
// ═══════════════════════════════════════════════════════════════════════

import { research } from "./research";
import { readUrl, readGitHubRepo } from "./webFetch";
import { lookup } from "./knowledge";
import { internalSecret } from "./internalSecret";

export interface ToolCall {
  tool: string;
  input: string;
}

export interface ToolResult {
  tool: string;
  input: string;
  output: string;
  ok: boolean;
  ms: number;
}

export interface ToolSpec {
  name: string;
  desc: string;
  /** model ko dikhane wali misaal */
  example: string;
  run: (input: string, ctx: ToolCtx) => Promise<string>;
}

export interface ToolCtx {
  /** code chalane ke liye — /api/execute ka absolute URL banane ko */
  origin: string;
}

const CAP = 6000;
const cap = (s: string, n = CAP) => (s.length > n ? s.slice(0, n) + `\n…[${s.length - n} chars aur]` : s);

export const TOOLS: ToolSpec[] = [
  {
    name: "web_search",
    desc: "Search the live web. Use for current events, recent versions, prices, anything after your training cutoff, or facts you are not certain about.",
    example: `{"tool":"web_search","input":"Next.js 16 release date"}`,
    run: async (q) => cap(await research(q)),
  },
  {
    name: "read_url",
    desc: "Fetch and read a web page as text. Use when you have a specific URL, or after web_search gives you one worth reading in full.",
    example: `{"tool":"read_url","input":"https://nextjs.org/blog"}`,
    run: async (u) => {
      const url = u.trim();
      if (!/^https?:\/\//i.test(url)) return "ERROR: input ek poora http(s) URL hona chahiye.";
      const isGh = /^https?:\/\/(www\.)?github\.com\/[^/]+\/[^/]+\/?$/i.test(url);
      return cap(isGh ? await readGitHubRepo(url) : await readUrl(url));
    },
  },
  {
    name: "run_code",
    desc: "Execute JavaScript (NOT Python) in a sandbox and see the real output. Use to CHECK your own code before giving it to the user, or to compute an exact answer. Write a plain function body: no imports, no require, no fs, no network, no print() — use console.log() and end with a `return` statement.",
    example: `{"tool":"run_code","input":"const f=n=>n<2?n:f(n-1)+f(n-2); return f(10);"}`,
    run: async (code, ctx) => {
      const r = await fetch(`${ctx.origin}/api/execute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // /api/execute ab auth-gated hai — server-to-server call
          // internal secret ke sath hoti hai (browser cookie nahi).
          "x-internal-secret": internalSecret(),
        },
        body: JSON.stringify({ code, language: "javascript" }),
        signal: AbortSignal.timeout(10_000),
      }).catch(() => null);

      if (!r) return "ERROR: sandbox tak nahi pohancha.";
      if (r.status === 403) return "ERROR: ye code sandbox me mana hai (imports/fs/network). Bina un ke likho.";
      const d = (await r.json().catch(() => null)) as { result?: unknown; error?: string; logs?: string[] } | null;
      if (!d) return "ERROR: sandbox ka jawab parha nahi gaya.";
      // Live par model ne do baar Python likh diya (print(), f-string).
      // Khali "ERROR: ... is not defined" se usay wajah samajh nahi aayi
      // aur usne wohi ghalti dohrayi. Ab error ke sath yaad-dehani jati hai.
      if (d.error) {
        const pyish = /\bprint\s*\(|\bf["']|\bdef\s+\w+\s*\(|:\s*$/m.test(code);
        return `ERROR: ${d.error}${pyish ? "\nYAAD RAKHO: ye JavaScript sandbox hai, Python nahi. console.log() istemal karo aur `return` se natija wapas karo." : ""}`;
      }
      const logs = d.logs?.length ? `console:\n${d.logs.join("\n")}\n` : "";
      // `return` na ho to result null aata hai aur koi error bhi nahi —
      // model ko lagta hai code chal gaya. Isay saaf batana zaroori hai.
      const res =
        d.result === null || d.result === undefined
          ? "result: null — kya tumne `return` likha tha?"
          : `result: ${JSON.stringify(d.result)}`;
      return cap(logs + res, 3000);
    },
  },
  {
    name: "recall",
    desc: "Look up Nexora's built-in knowledge base for a topic. Cheap and instant — try this before web_search for general/technical concepts.",
    example: `{"tool":"recall","input":"react hooks"}`,
    run: async (q) => {
      const hit = lookup(q);
      if (!hit) return "Knowledge base me is par kuch nahi mila. web_search try karo.";
      return cap(`[${hit.entry.keys[0]}]\n${hit.entry.answer}`, 3000);
    },
  },
];

export const TOOL_MAP = new Map(TOOLS.map((t) => [t.name, t]));

/** Model ko diya jane wala tool manual. */
export function toolManual(): string {
  return TOOLS.map((t) => `• ${t.name} — ${t.desc}\n  ${t.example}`).join("\n");
}

/**
 * Model ke jawab me se tool call nikalo.
 *
 * Model se saada protocol maanga jata hai: ya to
 *     ACTION: {"tool":"…","input":"…"}
 * ya
 *     FINAL: <jawab>
 *
 * Chhote models aksar ACTION likhna bhool jate hain aur seedha JSON de
 * dete hain, ya usay ```json me lapet dete hain. Teenon soorton ko
 * qubool karte hain — protocol par sakhti se zid karna sirf nakami
 * paida karti hai.
 */
export function parseAction(text: string): ToolCall | null {
  const t = text.trim();

  // FINAL saaf hai to koi action nahi.
  if (/^\s*FINAL\s*:/i.test(t)) return null;

  const tryParse = (raw: string): ToolCall | null => {
    try {
      const o = JSON.parse(raw) as { tool?: unknown; input?: unknown };
      if (typeof o?.tool !== "string" || !TOOL_MAP.has(o.tool)) return null;
      return { tool: o.tool, input: String(o.input ?? "") };
    } catch {
      return null;
    }
  };

  // 1. ACTION: {...}
  const m = t.match(/ACTION\s*:\s*(\{[\s\S]*?\})\s*(?:\n|$)/i);
  if (m) {
    const c = tryParse(m[1]);
    if (c) return c;
  }

  // 2. ```json { ... } ```
  const f = t.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (f) {
    const c = tryParse(f[1]);
    if (c) return c;
  }

  // 3. Poora jawab hi JSON hai (chhote models ki aam aadat).
  if (t.startsWith("{")) {
    const end = t.lastIndexOf("}");
    if (end > 0) {
      const c = tryParse(t.slice(0, end + 1));
      if (c) return c;
    }
  }

  return null;
}

/** FINAL: ke baad wala hissa nikalo (ya poora text agar marker na ho). */
export function stripFinal(text: string): string {
  const m = text.match(/^[\s\S]*?FINAL\s*:\s*([\s\S]*)$/i);
  return (m ? m[1] : text).trim();
}

export async function runTool(call: ToolCall, ctx: ToolCtx): Promise<ToolResult> {
  const t0 = Date.now();
  const spec = TOOL_MAP.get(call.tool);
  if (!spec) {
    return { ...call, output: `ERROR: '${call.tool}' naam ka koi tool nahi.`, ok: false, ms: 0 };
  }
  try {
    const output = await spec.run(call.input, ctx);
    return { ...call, output, ok: !output.startsWith("ERROR:"), ms: Date.now() - t0 };
  } catch (e) {
    return { ...call, output: `ERROR: ${(e as Error).message}`, ok: false, ms: Date.now() - t0 };
  }
}
