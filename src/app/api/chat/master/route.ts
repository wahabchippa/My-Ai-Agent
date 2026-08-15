// ═══════════════════════════════════════════════════════════════════
// /api/chat/master — SMART ORCHESTRATOR (REWRITTEN 2026-08-16)
//
// Question → CLASSIFY → RESEARCH → SELECT FRESH MODELS → RUN → SYNTHESIZE
//
// ─── KYA BADLA AUR KYUN ───
//
// 1. DEAD MODEL IDs
//    Purana registry inline tha aur usme aadhe IDs retire ho chuke the
//    (deepseek-r1:free, qwen3-coder:free, llama-3.3-70b-instruct:free,
//    gpt-oss-120b:free — sab 404). Har call fail hoti thi aur chup-chaap
//    keyless fallback pe gir jati thi.
//    → Ab sab kuch @/lib/modelRegistry se aata hai, live-verified.
//
// 2. KEYLESS MODELS PRIMARY BAN JATE THE
//    "llm7-gemini" aur "pollinations" ko koi key nahi chahiye thi, is liye
//    availableModels() unhe HAMESHA available maanta tha. Jab baaki sab
//    fail hote, yehi jawab dete — aur ye asal me GPT-4o (Oct 2023) hain.
//    → Ab ye rank 90+ pe hain, sirf last-resort, aur jawab pe warning.
//
// 3. RESEARCH KAAM HI NAHI KARTA THA
//    Bing-via-jina scrape block ho chuka hai; Wikipedia title-guess kabhi
//    match nahi karta tha. To "current" sawalon pe model ke paas fresh
//    data zero hota tha → training se ghalat jawab.
//    → @/lib/research: DuckDuckGo HTML + IA + Wikipedia search API.
//
// 4. SYSTEM PROMPT SIRF DATE BATATA THA
//    Date bata dene se model apne 2023 ke facts nahi bhoolta.
//    → Ab explicit temporal-grounding rules (@/lib/aiCall buildSystem).
//
// 5. SAB ERRORS CHUP THE (`catch {}`)
//    → Ab X-Nexora-* debug headers me poori diagnostic jati hai.
// ═══════════════════════════════════════════════════════════════════

import { getUser, getPlanConfig, isModelAllowed, checkUsageLimit, logUsage } from "@/lib/accessControl";
import { REGISTRY, available, hasRealProvider, configuredProviders, isStale, type Entry } from "@/lib/modelRegistry";
import { buildSystem, callModel, raceModels, type Msg } from "@/lib/aiCall";
import { research, needsResearch } from "@/lib/research";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

type Mode = "fast" | "balanced" | "deep";

interface Classification {
  type: "coding" | "math" | "research" | "current_events" | "creative" | "general";
  complexity: "simple" | "medium" | "complex";
  needsWebSearch: boolean;
  needsConsensus: boolean;
  tags: string[];
  reasoning: string;
}

function classify(question: string): Classification {
  const q = question.toLowerCase();
  const words = question.trim().split(/\s+/).length;

  let type: Classification["type"] = "general";
  let tags: string[] = ["general", "knowledge"];

  if (/\b(code|coding|program|python|javascript|typescript|function|bug|error|react|api|html|css|sql|node|debug|compile|algorithm|class|method|refactor)\b/i.test(q)) {
    type = "coding";
    tags = ["coding", "reasoning"];
  } else if (/\b(calculate|solve|equation|math|integral|derivative|probability|compute|\d+\s*[+\-*/^%])\b/i.test(q)) {
    type = "math";
    tags = ["math", "reasoning"];
  } else if (/\b(research|study|paper|analysis|compare|versus|vs|pros and cons|evaluate|deep dive)\b/i.test(q)) {
    type = "research";
    tags = ["reasoning", "knowledge"];
  } else if (/\b(write|story|poem|essay|creative|script|song|novel|character|dialogue|imagine)\b/i.test(q)) {
    type = "creative";
    tags = ["creative", "general"];
  }

  // Freshness detection ab dynamic hai (hardcoded "2026" nahi).
  const needsWebSearch = needsResearch(question);
  if (needsWebSearch && type === "general") type = "current_events";

  let complexity: Classification["complexity"] = "medium";
  if (words <= 6 && !needsWebSearch) complexity = "simple";
  else if (words > 25 || /\b(explain in detail|comprehensive|step by step|complete guide|full analysis)\b/i.test(q)) complexity = "complex";

  const needsConsensus = complexity === "complex" || type === "research";

  return {
    type,
    complexity,
    needsWebSearch,
    needsConsensus,
    tags,
    reasoning: `type=${type} complexity=${complexity} web=${needsWebSearch} consensus=${needsConsensus}`,
  };
}

/**
 * Model selection.
 *
 * PURANA BUG: rankByPriority() sirf ek hardcoded list index pe sort karta
 * tha aur keyless models bhi usi list me the — to "fast" mode me top-1
 * aksar pollinations/llm7 ban jata tha. Ab fresh-first, stale-last.
 */
function scoreEntry(c: Classification, e: Entry): number {
  let s = e.rank;
  if (e.tags.some((t) => c.tags.includes(t))) s -= 100;
  if (isStale(e)) s += 1000;
  if (!e.envKey) s += 2000;
  return s;
}

/**
 * PROVIDER DIVERSITY — ye ek asli bug ka fix hai.
 *
 * Live test me "balanced" mode ne top-2 models chune, aur DONO Gemini the
 * (rank 1 aur 2). Gemini ka free tier 429 pe gaya to POORI request fail
 * ho gayi — jabke Groq aur OpenRouter keys bilkul theek thin.
 *
 * Ab pehle har provider se uska BEHTAREEN model liya jata hai, phir agar
 * jagah bache to baaki. Ek provider down ho to dusra sambhal leta hai.
 */
function diversify(ranked: Entry[], limit: number): Entry[] {
  const seen = new Set<string>();
  const out: Entry[] = [];
  for (const e of ranked) {
    if (out.length >= limit) break;
    if (seen.has(e.provider)) continue;
    seen.add(e.provider);
    out.push(e);
  }
  for (const e of ranked) {
    if (out.length >= limit) break;
    if (!out.includes(e)) out.push(e);
  }
  return out;
}

function selectAgents(c: Classification, mode: Mode, pool: Entry[]): Entry[] {
  const ranked = [...pool].sort((a, b) => scoreEntry(c, a) - scoreEntry(c, b));
  if (mode === "fast") return diversify(ranked, 2);
  if (mode === "balanced") return diversify(ranked, c.needsConsensus ? 3 : 2);
  return diversify(ranked, 5);
}

export async function POST(req: Request) {
  const t0 = Date.now();
  const b = await req.json().catch(() => null);
  if (!b?.messages?.length) {
    return new Response(JSON.stringify({ error: "Missing messages" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const messages: Msg[] = b.messages;
  const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content || "";
  const mode: Mode = (b.mode as Mode) || "balanced";

  // ─── NO-KEY GUARD ───
  // Pehle app bina kisi key ke bhi "chalti" thi — keyless junk models se.
  // User ko lagta tha AI kharab hai; asal me koi provider hi configured
  // nahi tha. Ab saaf batate hain.
  if (!hasRealProvider()) {
    const msg =
      `⚠️ **Koi AI provider configured nahi hai.**\n\n` +
      `Isi wajah se jawab purane aur ghalat aa rahe hain — app bina key ke ` +
      `keyless public endpoints use karti hai, jo asal me **2023-2024 ke purane models** hain.\n\n` +
      `**Fix (10 minute, bilkul free, credit card nahi):**\n\n` +
      `1. **Gemini** → https://aistudio.google.com/apikey — 1,500 requests/day free\n` +
      `2. **Groq** → https://console.groq.com/keys — 14,400 requests/day free\n` +
      `3. **Cerebras** → https://cloud.cerebras.ai — 1M tokens/day free\n\n` +
      `Phir \`.env\` file me daalein:\n\n` +
      `\`\`\`bash\nGEMINI_API_KEY=your_key_here\nGROQ_API_KEY=your_key_here\nCEREBRAS_API_KEY=your_key_here\n\`\`\`\n\n` +
      `Poori guide: **SETUP-FREE-AI.md**`;
    return new Response(msg, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Nexora-Error": "no-provider-configured",
        ...corsHeaders,
      },
    });
  }

  // ─── ACCESS CONTROL ───
  const authUser = await getUser(req);
  const planConfig = authUser ? await getPlanConfig(authUser) : null;

  if (authUser && authUser.plan !== "admin") {
    const usage = await checkUsageLimit(authUser, planConfig);
    if (!usage.allowed) {
      return new Response(JSON.stringify({ error: "Monthly limit reached. Upgrade to Pro for more messages." }), {
        status: 429,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
  }

  let pool = available();
  if (planConfig) pool = pool.filter((e) => isModelAllowed(e.id, planConfig));
  if (!pool.length) pool = available();

  // ─── STEP 1: CLASSIFY ───
  const c = classify(lastUser);
  if (mode === "deep") c.needsWebSearch = true;

  // ─── STEP 2: RESEARCH (parallel with nothing — ye pehle hona chahiye
  //     taake system prompt me chala jaye) ───
  let researchData = "";
  if (c.needsWebSearch) {
    researchData = await research(lastUser).catch(() => "");
  }

  // ─── STEP 3: SELECT ───
  const agents = selectAgents(c, mode, pool);
  if (!agents.length) {
    return new Response("Koi model available nahi hai. `node scripts/verify-models.mjs` chalayein.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8", ...corsHeaders },
    });
  }

  const anyStale = agents.every((a) => isStale(a));
  const system = buildSystem({
    personality: b.personality,
    research: researchData,
    stale: anyStale,
    cutoff: agents[0]?.cutoff,
  });

  const dbg = (extra: Record<string, string> = {}) => ({
    "Content-Type": "text/plain; charset=utf-8",
    "X-Nexora-Classification": c.reasoning,
    "X-Nexora-Research": researchData ? `${researchData.length} chars` : "none",
    "X-Nexora-Providers": configuredProviders().join(",") || "none",
    "X-Nexora-Ms": String(Date.now() - t0),
    ...extra,
    ...corsHeaders,
  });

  // ─── STEP 4a: SINGLE-MODEL PATH ───
  if (!c.needsConsensus) {
    let { result, attempts } = await raceModels(agents, system, messages, {
      timeoutMs: 25000,
      useGrounding: c.needsWebSearch, // Gemini apna Google Search chalayega
    });

    // CASCADE — agar chune hue agents fail ho gaye (429/500/timeout), to
    // baaki POOL bhi try karo. Pehle app yahin haar maan leti thi, chahe
    // Groq/OpenRouter bilkul theek hon.
    if (!result.ok) {
      const rest = pool
        .filter((e) => !agents.includes(e))
        .sort((a, b) => scoreEntry(c, a) - scoreEntry(c, b))
        .slice(0, 6);
      if (rest.length) {
        const retry = await raceModels(rest, system, messages, {
          timeoutMs: 25000,
          useGrounding: c.needsWebSearch,
        });
        attempts = [...attempts, ...retry.attempts];
        result = retry.result;
      }
    }

    if (result.ok) {
      if (authUser) logUsage({ userId: authUser.id, type: c.type, mode, success: true }).catch(() => {});
      const text = result.stale
        ? `${result.text}\n\n---\n*⚠️ Ye jawab ek purane model (${result.model}, cutoff ${
            REGISTRY.find((e) => e.name === result.model)?.cutoff || "?"
          }) se aaya hai. Behtar jawab ke liye Gemini/Groq key add karein — SETUP-FREE-AI.md dekhein.*`
        : result.text;
      return new Response(text, {
        headers: dbg({
          "X-Nexora-Model": result.model,
          "X-Nexora-Provider": result.provider,
          "X-Nexora-Stale": String(result.stale),
        }),
      });
    }

    return new Response(
      `Sabhi models fail ho gaye:\n\n${result.error}\n\nDiagnostic: \`node scripts/verify-models.mjs\``,
      { status: 502, headers: dbg({ "X-Nexora-Attempts": String(attempts.length) }) }
    );
  }

  // ─── STEP 4b: CONSENSUS PATH ───
  const results = await Promise.all(
    agents.map((a) => callModel(a, system, messages, { timeoutMs: 25000, useGrounding: c.needsWebSearch }))
  );
  const good = results.filter((r) => r.ok && r.text.trim().length > 40);

  if (!good.length) {
    // CASCADE — consensus agents fail hue to baaki pool try karo.
    const rest = pool
      .filter((e) => !agents.includes(e))
      .sort((a, b) => scoreEntry(c, a) - scoreEntry(c, b))
      .slice(0, 6);
    if (rest.length) {
      const retry = await raceModels(rest, system, messages, {
        timeoutMs: 25000,
        useGrounding: c.needsWebSearch,
      });
      if (retry.result.ok) {
        return new Response(retry.result.text, {
          headers: dbg({ "X-Nexora-Model": retry.result.model, "X-Nexora-Note": "cascade-recovery" }),
        });
      }
    }
    const errs = results.map((r) => `• ${r.provider}: ${r.error}`).join("\n");
    return new Response(`Sabhi agents fail:\n\n${errs}`, { status: 502, headers: dbg() });
  }

  if (good.length === 1) {
    if (authUser) logUsage({ userId: authUser.id, type: c.type, mode, success: true }).catch(() => {});
    return new Response(good[0].text, {
      headers: dbg({ "X-Nexora-Model": good[0].model, "X-Nexora-Agents": "1" }),
    });
  }

  // ─── STEP 5: SYNTHESIS ───
  const combined = good.map((r, i) => `### Answer ${i + 1} (${r.model}):\n${r.text}`).join("\n\n---\n\n");

  const masterSystem =
    buildSystem({ research: researchData }) +
    `

════════ SYNTHESIS TASK ════════
Multiple AI models answered the same question. Your job:

1. VERIFY — compare them; find contradictions and factual errors.
2. CROSS-CHECK — where web research is provided above, it WINS over any
   model's claim. Models may be working from outdated training data.
3. SYNTHESIZE — merge the best, most accurate parts into ONE answer.

RULES:
- Write as the final answer. Never mention "models", "agents", or "answers".
- If they disagree on a time-sensitive fact, trust web research; if there is
  none, state the uncertainty rather than picking one confidently.
- Keep every genuinely useful specific (numbers, code, examples).`;

  const masterInput = `USER'S QUESTION: ${lastUser}\n\nCANDIDATE ANSWERS:\n${combined}\n\nWrite the definitive final answer:`;

  // Synthesis ke liye hamesha SABSE FRESH model — stale/keyless kabhi nahi.
  const synth = pool
    .filter((e) => !isStale(e) && e.envKey)
    .sort((a, b) => a.rank - b.rank)[0];

  if (synth) {
    const sr = await callModel(synth, masterSystem, [{ role: "user", content: masterInput }], {
      timeoutMs: 30000,
      temperature: 0.4,
    });
    if (sr.ok) {
      if (authUser) {
        logUsage({
          userId: authUser.id,
          type: c.type,
          mode,
          agentsUsed: good.map((g) => g.model).join(", "),
          estimatedCost: "0",
          success: true,
        }).catch(() => {});
      }
      return new Response(sr.text, {
        headers: dbg({
          "X-Nexora-Master": sr.model,
          "X-Nexora-Agents": good.map((g) => g.model).join(", "),
          "X-Nexora-Pipeline": "classify→research→parallel→synthesize",
        }),
      });
    }
  }

  // Synthesis fail → sabse lamba acha jawab.
  const best = good.reduce((x, y) => (y.text.length > x.text.length ? y : x));
  return new Response(best.text, {
    headers: dbg({ "X-Nexora-Model": best.model, "X-Nexora-Note": "synthesis-failed-fallback" }),
  });
}
