// ═══════════════════════════════════════════════════════════════════
// /api/agents — ASLI MULTI-AGENT ORCHESTRATOR
//
// KYUN BANAYA:
// Purana "Agents" feature (src/lib/agents.ts) me EK BHI AI call nahi thi.
// orchestrate() sirf hardcoded template strings jorta tha — "Vesta ne
// review kiya ✅" likh deta tha bina aapka code dekhe. Poora feature
// dikhawa tha.
//
// Ab: har specialist asli model call karta hai, apne apne prompt ke saath
// (@/lib/agentPrompts — 500-AI-Agents-Projects ke prompts se), pichhle
// agent ka output agle ko milta hai, aur aakhir me sab synthesize hota hai.
//
// Pipeline: classify → team → research (agar chahiye) → agents (sequential)
//           → synthesize
// ═══════════════════════════════════════════════════════════════════

import { available, isStale, type Entry } from "@/lib/modelRegistry";
import { buildSystem, callModel, type Msg } from "@/lib/aiCall";
import { research, needsResearch } from "@/lib/research";
import { readUrlsIn, hasUrl } from "@/lib/webFetch";
import { sanitizeMessages } from "@/lib/sanitize";
import {
  SPECIALISTS,
  classifyTask,
  selectWaves,
  getSpecialist,
  type SpecialistId,
} from "@/lib/agentPrompts";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ─── WAALL-CLOCK BUDGET ───
// Vercel function 60s par mar jata hai. Local test me 3-agent pipeline 82s
// le gaya (ek agent 25s timeout kha gaya) — yani production me user ko
// adhoora response bhi na milta, sirf 504. Ab har agent ke pehle dekha jata
// hai kitna waqt bacha hai; na bache to us agent ko skip kar ke jo kaam ho
// chuka hai wo synthesize kar diya jata hai. Adhoora jawab > koi jawab nahi.
const BUDGET_MS = 52_000;      // 60 me se 8s safety margin
const SYNTH_RESERVE_MS = 16_000; // synthesis ke liye hamesha itna bacha rakho
const AGENT_MAX_MS = 20_000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

/** GET — UI ke liye specialists ki list. */
export async function GET() {
  return Response.json(
    {
      specialists: SPECIALISTS.map((s) => ({
        id: s.id,
        name: s.name,
        role: s.role,
        emoji: s.emoji,
        color: s.color,
        blurb: s.blurb,
        source: s.source,
      })),
    },
    { headers: corsHeaders }
  );
}

/**
 * Ek specialist ke liye behtareen available models chuno.
 *
 * TEEN SABAK live testing se (har ek ne pichhla version toda):
 *
 * 1) Sirf rank dekhne se teenon agents Gemini 3.7/3.6/3.5 pick karte the —
 *    aik hi provider. Google ka aik 429 poori pipeline le dooba, aur Groq
 *    (99-400ms!) kabhi chala hi nahi.
 *
 * 2) Phir "dusra provider = -60" flat bonus lagaya — Gemini (rank 1+60=61)
 *    BazaarLink (rank 55, credits khatam) se peeche chala gaya.
 *
 * 3) Phir provider ko HARD-dedup kiya (aik wave me aik provider aik baar) —
 *    is ne Groq ke 5 tandurust models chhod kar agents ko AirForce aur
 *    BazaarLink par dhakel diya, jo dono 20s zaya kar ke khaali laute.
 *
 * Aakhri natija: provider variety achhi cheez hai, magar SEHAT se pehle
 * nahi. Ab sab kuch aik score me hai — dobara-wohi-model ki saza bhari,
 * dobara-wohi-provider ki halki, aur kharab model ki sab se bhari. Groq ka
 * doosra model (rank 14 + 40) BazaarLink (rank 55 + 800) se aage rehta hai,
 * magar barabar sehat wale do providers me se doosra jeet jata hai.
 */
function pickModels(tags: string[], pool: Entry[], exclude: Entry[] = [], n = 1): Entry[] {
  const usedIds = new Set(exclude.map((e) => e.id));
  // Mutable: har pick ke baad us provider ko "istemal shuda" mark karte hain,
  // warna aik hi call [Gemini 3.7, Gemini 3.6] wapas kar deti thi — dono
  // Google, to Google ka 429 primary aur fallback dono ko aik saath maar deta.
  const usedProviders = new Map<string, number>();
  for (const e of exclude) usedProviders.set(e.provider, (usedProviders.get(e.provider) ?? 0) + 1);

  const score = (e: Entry) => {
    let s = e.rank;
    if (e.tags.some((t) => tags.includes(t))) s -= 100;
    if (isStale(e)) s += 1000;
    if (e.degraded) s += 800; // live par toota hua (402 / khaali jawab)
    // Keyless models shared/IP-based quota par chalte hain — kaam ke hain
    // (Zen ka cutoff 2025 hai) magar apni key wale se kam bharosemand.
    if (!e.envKey) s += 15;
    s += 40 * (usedProviders.get(e.provider) ?? 0); // har dohraav par thori aur saza
    return s;
  };

  // ⚠ `e.envKey` par filter mat karna! Keyless models ka envKey "" hai, to
  // wo filter unhe poori tarah bahar kar deta tha — OpenCode Zen add karne
  // ke baad bhi wo kisi test me chala hi nahi. `available()` pehle hi ye
  // guarantee deta hai ke jo entries aayi hain un ki key set hai YA wo
  // keyless hain.
  const candidates = pool.filter((e) => !usedIds.has(e.id));
  const out: Entry[] = [];
  for (let i = 0; i < n && candidates.length; i++) {
    const best = candidates.reduce((a, b) => (score(b) < score(a) ? b : a));
    out.push(best);
    candidates.splice(candidates.indexOf(best), 1);
    usedProviders.set(best.provider, (usedProviders.get(best.provider) ?? 0) + 1);
  }
  return out;
}

interface StageResult {
  id: SpecialistId;
  name: string;
  role: string;
  emoji: string;
  color: string;
  model: string;
  provider: string;
  output: string;
  ok: boolean;
  error?: string;
  ms: number;
}

/** Stream par bheja jane wala har event. */
type Ev =
  | { type: "plan"; kind: string; team: { id: string; name: string; role: string; emoji: string; color: string }[]; redacted: string[] | null }
  | { type: "research"; chars: number }
  | { type: "agent:start"; id: string; name: string; model: string }
  | { type: "agent:done"; stage: StageResult }
  | { type: "synthesis:start" }
  | { type: "done"; final: string; synthesizedBy: string; ms: number }
  | { type: "error"; error: string; message: string; status: number };

/**
 * Poori pipeline. `emit` har milestone par call hoti hai — streaming mode me
 * ye client ko turant NDJSON line bhejti hai, warna no-op hoti hai.
 * Isi liye dono modes bilkul aik hi code chalate hain (koi drift nahi).
 */
async function runPipeline(
  b: { task?: string; message?: string; team?: SpecialistId[] } | null,
  emit: (e: Ev) => void,
  /** non-streaming mode ka poora JSON yahan rakha jata hai (per-call, taake
   *  do requests aik doosre ka data na churayein). */
  full?: { value: Record<string, unknown> | null }
): Promise<Ev> {
  const t0 = Date.now();

  const rawTask: string = b?.task || b?.message || "";
  if (!rawTask.trim()) {
    return { type: "error", error: "missing-task", message: "Missing 'task'", status: 400 };
  }

  // Secrets/PII hatao — ye text kai providers ko jayega.
  const cleaned = sanitizeMessages([{ role: "user", content: rawTask }], { aggressive: false });
  const task = cleaned.messages[0].content;

  const pool = available();
  // Keyless models (OpenCode Zen) bhi ginti me hain — bina kisi key ke bhi
  // app kaam kar sakti hai, bas thori dheemi.
  if (!pool.length) {
    return {
      type: "error",
      error: "no-provider-configured",
      message:
        "Koi AI provider configured nahi. .env me GEMINI_API_KEY ya GROQ_API_KEY daalein — SETUP-FREE-AI.md dekhein.",
      status: 503,
    };
  }

  // ─── 1. CLASSIFY + TEAM ───
  const kind = classifyTask(task);
  // Caller apni team de sakta hai — us soorat me sab ek hi wave (parallel).
  const waveIds: SpecialistId[][] =
    Array.isArray(b?.team) && b.team.length
      ? [(b.team as SpecialistId[]).filter((id) => getSpecialist(id))]
      : selectWaves(kind);

  const waves = waveIds.map((w) => w.map((id) => getSpecialist(id)!).filter(Boolean)).filter((w) => w.length);
  const team = waves.flat();
  if (!team.length) {
    return { type: "error", error: "no-specialists", message: "No valid specialists", status: 400 };
  }

  emit({
    type: "plan",
    kind,
    team: team.map((s) => ({ id: s.id, name: s.name, role: s.role, emoji: s.emoji, color: s.color })),
    redacted: cleaned.redacted ? cleaned.kinds : null,
  });

  // ─── 2. RESEARCH + URL READING ───
  // URL wala kaam team ki marzi par nahi chhoRa ja sakta: agar user ne link
  // diya hai to wo padhna HI hai, chahe koi specialist "research" na maange.
  // Pehle ye team.some(...) ke peeche tha, is liye agent kehta tha "main
  // web search nahi kar sakta" jabke link samne para hota tha.
  let researchData = "";

  const urlPromise = hasUrl(task) ? readUrlsIn(task).catch(() => "") : null;
  const searchPromise =
    team.some((s) => s.needsResearch) && needsResearch(task)
      ? research(task).catch(() => "")
      : null;

  if (urlPromise || searchPromise) {
    const [pages, search] = await Promise.all([
      urlPromise ?? Promise.resolve(""),
      searchPromise ?? Promise.resolve(""),
    ]);
    // Diye hue URL ka mazmoon UPAR — wo search results se zyada mutalliq hai.
    researchData = [pages, search].filter(Boolean).join("\n\n---\n\n");
    if (researchData) emit({ type: "research", chars: researchData.length });
  }

  // ─── 3. AGENTS — SEQUENTIAL, taake har agla pichhle ka kaam dekhe ───
  // Master route parallel chalta hai (speed ke liye, ek hi sawal ke kai
  // jawab). Yahan sequential hai kyunki reviewer ko engineer ka code
  // chahiye, aur tester ko dono ka. Ye pipeline hai, race nahi.
  const stages: StageResult[] = [];
  const usedModels: Entry[] = [];
  let context = "";

  for (const wave of waves) {
    // Waqt bacha hai? Warna poori wave skip.
    const left = BUDGET_MS - (Date.now() - t0) - SYNTH_RESERVE_MS;
    if (left < 6_000) {
      for (const spec of wave) {
        const stage: StageResult = {
          id: spec.id, name: spec.name, role: spec.role, emoji: spec.emoji, color: spec.color,
          model: "none", provider: "none", output: "", ok: false,
          error: "Skipped — time budget khatam ho gaya", ms: 0,
        };
        stages.push(stage);
        emit({ type: "agent:done", stage });
      }
      continue;
    }
    const agentTimeout = Math.min(AGENT_MAX_MS, left);

    const userMsg = context
      ? `TASK: ${task}\n\n──── WORK ALREADY DONE BY THE TEAM ────\n${context}\n\n──── YOUR TURN ────\nDo your part. Build on the work above — do not repeat it.`
      : `TASK: ${task}\n\nDo your part.`;

    // Wave ke andar har agent ko alag model do (taake ek provider ka rate
    // limit poori wave ko na maar de), phir sab ko saath chalao.
    // Wave ke andar har agent ko alag model AUR alag provider do. `reserved`
    // me sirf pehla (primary) daalna kaafi nahi tha — dono agents ka
    // fallback bhi wohi model ban jata tha, to dono aik hi waqt Laguna par
    // gir kar dono khaali laut aate the. Ab sab candidates reserve hote hain.
    const reserved: Entry[] = [];
    const plans = wave.map((spec) => {
      // 5 candidates. Free tier ka 429 ~100-300ms me wapas aata hai, to nakaam
      // koshish ka kharcha na ke barabar hai — asal kharcha to kamyab call ka
      // hai. Loop waqt khatam hone par rukta hai, ginti par nahi (neeche).
      const cands = pickModels(spec.tags, pool, [...usedModels, ...reserved], 5);
      reserved.push(...cands);
      return { spec, cands };
    });

    const results = await Promise.all(
      plans.map(async ({ spec, cands }): Promise<StageResult> => {
        if (!cands.length) {
          return {
            id: spec.id, name: spec.name, role: spec.role, emoji: spec.emoji, color: spec.color,
            model: "none", provider: "none", output: "", ok: false,
            error: "No model available", ms: 0,
          };
        }

        let last: StageResult | null = null;
        for (const model of cands) {
          emit({ type: "agent:start", id: spec.id, name: spec.name, model: model.name });

          const system =
            buildSystem({
              research: spec.needsResearch ? researchData : "",
              stale: isStale(model),
              cutoff: model.cutoff,
            }) +
            `\n\n════════ YOUR ROLE: ${spec.role.toUpperCase()} ════════\n${spec.system}`;

          const r = await callModel(model, system, [{ role: "user", content: userMsg }] as Msg[], {
            timeoutMs: agentTimeout,
            temperature: spec.id === "writer" ? 0.8 : 0.4,
            useGrounding: !!spec.needsResearch,
          });

          last = {
            id: spec.id, name: spec.name, role: spec.role, emoji: spec.emoji, color: spec.color,
            model: r.model, provider: r.provider, output: r.text,
            ok: r.ok && !!r.text.trim(), error: r.error, ms: r.ms,
          };

          if (last.ok) {
            usedModels.push(model);
            break;
          }
          // Retry ki had WAQT hai, ginti nahi.
          //
          // Pehle 3 candidates ki fixed limit thi. Live par ye hua: teenon
          // (Gemini, Gemini, OpenRouter) aik saath 429 de kar 1 SECOND me
          // khatam ho gaye — jab ke 20 second budget bacha tha aur registry
          // me OpenCodeZen ke tandurust keyless models mojood the. Agent
          // khaali haath laut aaya jabke chalne wala model maujood tha.
          if (BUDGET_MS - (Date.now() - t0) - SYNTH_RESERVE_MS < 6_000) break;
        }
        return last!;
      })
    );

    for (const stage of results) {
      stages.push(stage);
      emit({ type: "agent:done", stage });
      if (stage.ok) {
        // Context ko bandha rakho — warna prompt bohot bara ho jata hai aur
        // free tiers ka TPM limit hit ho jata hai.
        const txt = stage.output;
        const trimmed = txt.length > 2500 ? txt.slice(0, 2500) + "\n…(truncated)" : txt;
        context += `\n\n### ${stage.name} (${stage.role}):\n${trimmed}`;
      }
    }
  }

  const okStages = stages.filter((s) => s.ok && s.output.trim());
  if (!okStages.length) {
    return {
      type: "error",
      error: "all-agents-failed",
      message: stages.map((s) => `${s.name}: ${s.error ?? "empty response"}`).join(" | "),
      status: 502,
    };
  }

  // ─── 4. SYNTHESIZE ───
  // Ek agent ho to synthesis ka koi faida nahi — extra call, extra intezaar.
  // Fallback: agar synthesis na ho sake to har agent ka kaam heading ke sath
  // dikhao — warna baaki specialists ka output chup-chaap gum ho jata hai.
  // Stitched fallback ab aksar chalta hai (synthesis validator kaafi sakht
  // hai), is liye ye khud bhi ek acha deliverable hona chahiye. Agent ke
  // naam ke bajaye ROLE ka heading — user ko andar ki team ka nahi pata hona
  // chahiye, sirf ye ke kaam kis nazariye se hua.
  const stitched = () =>
    okStages.length === 1
      ? okStages[0].output
      : okStages
          .map((s) => `## ${s.emoji} ${s.role}\n\n${s.output}`)
          .join("\n\n---\n\n");

  let final = stitched();
  let synthModel = okStages.length === 1 ? "none (single agent)" : "none (stitched fallback)";

  /**
   * Synthesis ko qubool karne se pehle jaanch.
   *
   * Prompt me saaf likha hai "no preamble, never mention the agents" — magar
   * reasoning models (Groq Qwen 3.6) us ki parwah nahi karte. Live par 3 me
   * se 3 runs me poora internal monologue aaya: "**Team Output:** Contains a
   * structured review from Vesta (Code Reviewer)…", "Self-Correction during
   * thought:…". Prompt engineering ki 2 koshishein naakaam rahin.
   *
   * Isi liye ab prompt par bharosa nahi — output ko JAANCHA jata hai. Leak ho
   * to synthesis rad, aur stitched per-agent output dikhaya jata hai (jo
   * saaf-suthra hai aur har agent ka kaam poora rakhta hai).
   */
  const AGENT_NAMES = SPECIALISTS.map((x) => x.name);
  const looksLikeThinking = (t: string): string | null => {
    const head = t.slice(0, 1200);
    if (/\b(?:thinking process|thought process|self-correction|let me think|i need to|i'll (?:start|structure|draft))\b/i.test(head))
      return "internal monologue";
    if (/\*\*Team Output:?\*\*|\bteam output\b/i.test(t)) return "team-output meta";
    const named = AGENT_NAMES.filter((n) => new RegExp(`\\b${n}\\b`).test(t));
    if (named.length) return `agent naam leak (${named.join(", ")})`;
    return null;
  };

  if (okStages.length > 1) {
    emit({ type: "synthesis:start" });
    // 3 candidates, teenon alag provider se — synthesis sab se ahem step hai,
    // yahan fail hona matlab user ko bikhra hua output milega.
    const synthCands = pickModels(["reasoning", "general"], pool.filter((e) => !isStale(e)), [], 3);
    for (const synth of synthCands) {
      if (Date.now() - t0 > BUDGET_MS - 8_000) break;
      const synthSystem =
        buildSystem({ research: researchData }) +
        `\n\n════════ SYNTHESIS ════════
A team of specialists worked on this task in sequence. Merge their work into
ONE polished deliverable for the user.

RULES:
- Output ONLY the finished deliverable. No preamble, no "Here's my thinking
  process", no numbered plan of what you are about to write, no meta-commentary.
  Start directly with the first heading of the answer.
- Never mention "the team", "agents", "specialists", or any of their names
  (Sage, Logos, Forge, Vesta, Aegis, Scribe, Quill, Nova). The user must not
  know the work was split up. Write as one single author.
- Keep every concrete artifact intact — code blocks, tables, test suites,
  and numbers must survive verbatim.
- Drop duplicated explanation; keep the clearest version of each point.
- If specialists disagree on a fact, prefer the one supported by the web
  research above; if there is none, note the uncertainty.
- Structure with markdown headings so it is easy to scan.

Your response must begin with the first character of the deliverable itself.
If you catch yourself writing a plan, stop and write the deliverable instead.`;

      const sr = await callModel(
        synth,
        synthSystem,
        [{ role: "user", content: `ORIGINAL TASK: ${task}\n\nTEAM OUTPUT:${context}\n\nProduce the final deliverable:` }],
        { timeoutMs: Math.max(8_000, BUDGET_MS - (Date.now() - t0)), temperature: 0.4 }
      );
      // QUALITY GUARD: aik run me synthesis ne 10,198ch (code + tests) ko
      // 1,339ch me nichoR diya — poora code block gayab. Aisi "summary"
      // stitched output se buri hai. Agar synthesis sab se bare stage se
      // bhi chhoti hai, to usay rad kar do.
      const biggest = Math.max(...okStages.map((x) => x.output.length));
      if (!sr.ok || !sr.text.trim()) continue;

      const leak = looksLikeThinking(sr.text);
      if (leak) {
        synthModel = `${sr.model} (rad — ${leak})`;
        continue; // agla model try karo
      }
      if (sr.text.trim().length < biggest * 0.6) {
        synthModel = `${sr.model} (rad — bohot chhoti thi)`;
        continue;
      }
      final = sr.text;
      synthModel = sr.model;
      break;
    }
  }

  if (full) full.value = {
    ok: true,
    task: rawTask,
    kind,
    redacted: cleaned.redacted ? cleaned.kinds : null,
    research: researchData ? { chars: researchData.length } : null,
    team: team.map((s) => ({ id: s.id, name: s.name, role: s.role, emoji: s.emoji })),
    stages,
    synthesizedBy: synthModel,
    final,
    ms: Date.now() - t0,
  };

  return { type: "done", final, synthesizedBy: synthModel, ms: Date.now() - t0 };
}

export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  const wantsStream =
    new URL(req.url).searchParams.get("stream") === "1" || b?.stream === true;

  // ─── STREAMING (NDJSON) ───
  // 3 agents = ~40s. Bina stream ke user 40 second khaali screen dekhta hai.
  if (wantsStream) {
    const enc = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (e: Ev) => {
          try {
            controller.enqueue(enc.encode(JSON.stringify(e) + "\n"));
          } catch {
            /* client chala gaya */
          }
        };
        try {
          send(await runPipeline(b, send));
        } catch (err) {
          send({
            type: "error",
            error: "pipeline-crashed",
            message: err instanceof Error ? err.message : String(err),
            status: 500,
          });
        }
        controller.close();
      },
    });
    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
      },
    });
  }

  // ─── EK HI JSON RESPONSE ───
  const full: { value: Record<string, unknown> | null } = { value: null };
  const res = await runPipeline(b, () => {}, full);
  if (res.type === "error") {
    return Response.json(
      { error: res.error, message: res.message },
      { status: res.status, headers: corsHeaders }
    );
  }
  return Response.json(full.value ?? res, { headers: corsHeaders });
}
