// ═══════════════════════════════════════════════════════════════════
// NEXORA — UNIFIED AI CALLER + ANTI-STALE SYSTEM PROMPT
//
// Purana code har route me apna alag fetch likhta tha, apna alag system
// prompt banata tha, aur errors chup-chaap nigal jata tha (`catch {}`).
// Nateeja: jab model fail hota, user ko pata hi nahi chalta ke jawab
// kis chuutte hue fallback se aaya — bas ghalat jawab dikh jata tha.
//
// Ab: ek caller, ek prompt builder, saaf error reporting.
// ═══════════════════════════════════════════════════════════════════

import { type Entry, keyFor, isStale } from "./modelRegistry";

export interface Msg {
  role: string;
  content: string;
}

export interface CallResult {
  ok: boolean;
  text: string;
  model: string;
  provider: string;
  /** true = jawab purane knowledge-cutoff wale model se aaya */
  stale: boolean;
  /** insani-samajh wali error */
  error?: string;
  ms: number;
}

// ─────────────────────────────────────────────────────────────────
// SYSTEM PROMPT
//
// Purana prompt sirf "CURRENT DATE: ..." likhta tha. Masla ye hai ke
// jab model ki training 2023 me khatam hui ho, wo date to maan leta hai
// magar phir bhi 2023 ke FACTS deta hai ("current president = Biden").
//
// Ab hum model ko sirf date nahi batate — usay uski AUKAAT batate hain:
// "tu purana hai, guess mat kar, keh de ke pata nahi."
// ─────────────────────────────────────────────────────────────────
export function buildSystem(opts: {
  personality?: string;
  research?: string;
  stale?: boolean;
  cutoff?: string;
}): string {
  const { personality, research, stale, cutoff } = opts;
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
  const year = now.getUTCFullYear();

  let p = `You are Nexora, a highly capable AI assistant.

════════ TEMPORAL GROUNDING (CRITICAL) ════════
TODAY'S REAL DATE: ${dateStr}
CURRENT YEAR: ${year}

Your training data ends BEFORE today. This is the single most common source
of wrong answers, so follow these rules exactly:

1. NEVER state a "current" fact from your training as if it were true today.
   Things that change: who holds an office, prices, versions, rankings,
   "the latest" anything, company leadership, sports champions, populations.

2. If asked about something time-sensitive and you have NO web research below,
   say plainly: "My training data may be out of date — as of my last update
   [X], but this may have changed since." Then give your best known answer,
   clearly labelled as possibly outdated.

3. NEVER guess a current year, current officeholder, or latest version number.
   Wrong-but-confident is much worse than "I'm not certain."

4. If WEB RESEARCH is provided below, it OVERRIDES your training data
   completely. Trust it over what you "remember."

5. Do the math on dates. If someone was born in 1990, they are ${year} - 1990
   years old — not the age you memorised during training.
`;

  if (stale) {
    p += `
⚠ SELF-AWARENESS: You are running on a model whose knowledge ends around
${cutoff || "an older date"} — that is well over a year before today.
Be EXTRA conservative. Volunteer the caveat before the user has to ask.
`;
  }

  p += `
════════ HOW TO ANSWER ════════
- Direct answer first, then supporting detail.
- Real facts, concrete examples, actual numbers — never vague filler.
- Show your reasoning step-by-step for math and logic.
- For code: complete, runnable examples with a short explanation.
- Match the user's language exactly (Roman Urdu, Urdu, Hindi, English).
- Markdown: **bold** for key points, bullets, tables, \`code\` blocks.
- Honesty over confidence. "I don't know" is a valid, respected answer.
- Never invent citations, URLs, statistics, or quotes.
`;

  if (research && research.trim()) {
    p += `
════════ WEB RESEARCH (AUTHORITATIVE — USE THIS) ════════
The following was fetched from the live web TODAY. It is more current and
more reliable than your training data. Base time-sensitive claims on it.

${research.trim()}
════════ END RESEARCH ════════
`;
  }

  if (personality && personality.trim()) {
    p += `\n════════ PERSONA ════════\n${personality.trim()}\n`;
  }

  return p;
}

// ─────────────────────────────────────────────────────────────────
// THE CALLER
// ─────────────────────────────────────────────────────────────────
export async function callModel(
  entry: Entry,
  system: string,
  messages: Msg[],
  opts: { timeoutMs?: number; temperature?: number; useGrounding?: boolean } = {}
): Promise<CallResult> {
  const { timeoutMs = 30000, temperature = 0.7 } = opts;
  const t0 = Date.now();
  const key = keyFor(entry);
  const stale = isStale(entry);
  const base = { model: entry.name, provider: entry.provider, stale };

  if (entry.envKey && !key) {
    return { ...base, ok: false, text: "", error: `${entry.envKey} not set`, ms: 0 };
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    // ── Gemini format ──
    if (entry.fmt === "gemini") {
      const url =
        `https://generativelanguage.googleapis.com/v1beta/models/${entry.model}` +
        `:generateContent?key=${encodeURIComponent(key)}`;

      // GROUNDING — yehi "purane jawab" ka asal ilaj hai.
      // Gemini apna Google Search khud chala kar LIVE facts le aata hai,
      // to training cutoff ka masla hi khatam ho jata hai.
      const body: Record<string, unknown> = {
        systemInstruction: { parts: [{ text: system }] },
        contents: messages
          .filter((m) => m.content?.trim())
          .map((m) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }],
          })),
        generationConfig: { temperature, maxOutputTokens: 8192 },
      };
      if (entry.grounded && opts.useGrounding) {
        body.tools = [{ google_search: {} }];
      }

      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        return { ...base, ok: false, text: "", error: explain(r.status, d?.error?.message, entry), ms: Date.now() - t0 };
      }
      const text =
        d?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || "").join("") ?? "";
      if (!text.trim()) {
        const why = d?.candidates?.[0]?.finishReason || "empty response";
        return { ...base, ok: false, text: "", error: `Gemini returned nothing (${why})`, ms: Date.now() - t0 };
      }
      return { ...base, ok: true, text, ms: Date.now() - t0 };
    }

    // ── OpenAI-compatible format ──
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (key) headers.Authorization = `Bearer ${key}`;
    if (entry.provider === "OpenRouter") {
      headers["X-Title"] = "Nexora";
      headers["HTTP-Referer"] = process.env.APP_URL || "https://nexora.app";
    }

    const r = await fetch(entry.url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: entry.model,
        messages: [{ role: "system", content: system }, ...messages],
        temperature,
      }),
      signal: ctrl.signal,
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      const m = d?.error?.message || d?.error || d?.message;
      return { ...base, ok: false, text: "", error: explain(r.status, m, entry), ms: Date.now() - t0 };
    }
    const raw = d?.choices?.[0]?.message?.content ?? "";
    const text = stripThinking(raw);
    if (!text.trim()) {
      return { ...base, ok: false, text: "", error: "Empty response", ms: Date.now() - t0 };
    }
    return { ...base, ok: true, text, ms: Date.now() - t0 };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const isTimeout = /abort/i.test(msg);
    return {
      ...base,
      ok: false,
      text: "",
      error: isTimeout ? `Timed out after ${timeoutMs}ms` : msg,
      ms: Date.now() - t0,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Reasoning models (Groq qwen3.6, DeepSeek R1, Nemotron reasoning) apna
 * internal "soch" <think>...</think> me bhejte hain. Purana code use
 * seedha user ko dikha deta tha — jawab ganda aur confusing lagta tha.
 * Live proof: groq qwen/qwen3.6-27b ne "<think>Thinking Process: 1. Analyze
 * the Request..." return kiya tha.
 */
function stripThinking(t: string): string {
  let out = t
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, "")
    .replace(/^[\s\S]*?<\/think>/i, "")
    .replace(/^[\s\S]*?<\/thinking>/i, "")
    .trim();

  // Kabhi model <think> khol ke token limit hit kar deta hai aur closing
  // tag aata hi nahi — us soorat me sab kuch "soch" hai. Live probe me
  // groq qwen3.6-27b ne bilkul yehi kiya tha.
  if (/^<think(ing)?>/i.test(out)) {
    out = out.replace(/^<think(ing)?>/i, "").trim();
  }

  // ─── TAG-BAGHAIR SOCH ───
  // Upar wala sab kuch XML tags par mabni hai. Magar kuch models bina kisi
  // tag ke, SEEDHE plain text me sochna shuru kar dete hain:
  //
  //   "Here's a thinking process:
  //    1.  **Analyze User Input:** ...
  //    *Flesh out content based on Vesta's points...*"
  //
  // Live proof (production, 16 Aug 2026): /api/agents ki synthesis ne poora
  // internal monologue user ko de diya — including "Vesta (Code Reviewer)"
  // yani agent ke naam bhi leak ho gaye, jo prompt me saaf mana kiya gaya tha.
  //
  // Pehli koshish "pehli markdown heading par kaat do" thi — wo NAAKAAM rahi,
  // kyunki soch ke andar bhi headings hoti hain ("## 6. Test Suite" ek plan
  // ka item tha, jawab ka nahi). Ab do-tarfa tareeqa hai:
  const preamble =
    /^\s*(?:here(?:'s| is)\s+(?:a|my)\s+)?(?:thinking process|thought process|reasoning|my thinking|let me think|okay,? let'?s|first,? i(?:'ll| will)|i need to)\b/i;

  if (preamble.test(out)) {
    // (1) Behtareen soorat: model ne khud soch ko `---` se alag kiya hai.
    //     Aakhri rule ke baad wala hissa hi asli jawab hota hai.
    const rules = [...out.matchAll(/\n\s*(?:---+|═══+|\*\*\*+)\s*\n/g)];
    const lastRule = rules[rules.length - 1];
    if (lastRule?.index !== undefined && out.length - lastRule.index > out.length * 0.35) {
      out = out.slice(lastRule.index).replace(/^\s*(?:---+|═══+|\*\*\*+)\s*\n/, "").trim();
    } else {
      // (2) Warna: numbered/bulleted soch ke steps chhod kar aage barho.
      //     Asli deliverable pehli AISI heading se shuru hota hai jo kisi
      //     numbered step ke andar na ho.
      const lines = out.split("\n");
      let start = -1;
      for (let i = 0; i < lines.length; i++) {
        const L = lines[i];
        // Plan ke steps: "1. **Analyze**", "- **Goal:**", "*Draft...*"
        if (/^\s*(?:\d+[.)]\s|[-*]\s+\*\*|\s*\*[A-Z])/.test(L)) continue;
        if (/^#{1,4}\s+\S/.test(L)) { start = i; break; }
      }
      if (start > 0 && lines.slice(start).join("\n").length > 300) {
        out = lines.slice(start).join("\n").trim();
      }
    }
  }

  // Aakhri safai: agar phir bhi soch ka jumla bacha ho to us line ko hata do.
  out = out
    .replace(/^\s*(?:here(?:'s| is)\s+(?:a|my)\s+)?(?:thinking|thought)\s+process[:\s]*$/gim, "")
    .trim();

  return out;
}

/** HTTP status → insani samajh wali wajah. */
function explain(status: number, raw: unknown, e: Entry): string {
  const m = typeof raw === "string" ? raw : JSON.stringify(raw ?? "");
  switch (status) {
    case 401:
      return `${e.provider}: API key invalid ya revoked (401). ${e.envKey} dobara check karein.`;
    case 402:
      return `${e.provider}: credits khatam (402). Free models use karein.`;
    case 403:
      return `${e.provider}: is model ka access nahi (403). — ${m.slice(0, 90)}`;
    case 404:
      return `${e.provider}: model "${e.model}" MAUJOOD NAHI (404) — retire ho chuka hai. \`node scripts/verify-models.mjs\` chalayein.`;
    case 429:
      return `${e.provider}: rate limit (429). Thodi der baad, ya dusra provider add karein.`;
    case 500:
    case 502:
    case 503:
      return `${e.provider}: server down (${status}). Fallback try ho raha hai.`;
    default:
      return `${e.provider} error ${status}: ${m.slice(0, 120)}`;
  }
}

/**
 * Kayi models ko ek saath chalao, PEHLA acha jawab lo.
 *
 * "Acha" ka matlab: sirf non-empty nahi. Purana code `text.length > 10`
 * pe hi khush ho jata tha — is liye "I cannot help with that" jaisa
 * junk bhi jeet jata tha aur asli model ka jawab zaya ho jata tha.
 */
export async function raceModels(
  entries: Entry[],
  system: string,
  messages: Msg[],
  opts: { timeoutMs?: number; minLength?: number; useGrounding?: boolean } = {}
): Promise<{ result: CallResult; attempts: CallResult[] }> {
  const { timeoutMs = 30000, minLength = 40, useGrounding = false } = opts;
  const attempts: CallResult[] = [];

  const good = (r: CallResult) =>
    r.ok &&
    r.text.trim().length >= minLength &&
    !/^(i (cannot|can't|am unable)|sorry, i)/i.test(r.text.trim());

  // Fresh models pehle, keyless/stale baad me.
  const fresh = entries.filter((e) => !isStale(e) && e.envKey);
  const rest = entries.filter((e) => isStale(e) || !e.envKey);

  for (const group of [fresh, rest]) {
    if (!group.length) continue;
    const results = await Promise.all(
      group.map((e) => callModel(e, system, messages, { timeoutMs, useGrounding }))
    );
    attempts.push(...results);
    const winner = results.find(good) || results.find((r) => r.ok && r.text.trim());
    if (winner) return { result: winner, attempts };
  }

  const failed: CallResult = {
    ok: false,
    text: "",
    model: "none",
    provider: "none",
    stale: false,
    error: attempts.length
      ? attempts.map((a) => `• ${a.provider}: ${a.error}`).join("\n")
      : "Koi model available nahi — koi API key set nahi hai.",
    ms: 0,
  };
  return { result: failed, attempts };
}
