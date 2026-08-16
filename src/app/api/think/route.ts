// ═══════════════════════════════════════════════════════════════════════
// NEXORA — /api/think  (ReAct agent)
//
// /api/agents se farq:
//   /api/agents  = kai specialists, fixed pipeline, har ek EK baar bolta hai
//   /api/think   = EK model, magar tools ke sath, jitni baar zaroorat ho
//
// Dono ki jagah hai. agents team-work ke liye achha hai (code likho +
// review karo + test karo). think un sawalon ke liye hai jahan pehle se
// pata nahi ke kitna kaam lagega — "kya X, Y ke sath chalta hai?" ka
// jawab dene se pehle shayad search, phir docs, phir code chalana parhe.
//
// Streaming NDJSON, taake user har qadam live dekhe — yehi cheez agent ko
// "zinda" mehsoos karati hai, warna 40 second khaali screen.
// ═══════════════════════════════════════════════════════════════════════

import { NextRequest } from "next/server";
import { available, type Entry } from "@/lib/modelRegistry";
import { buildSystem } from "@/lib/aiCall";
import { sanitizeMessages } from "@/lib/sanitize";
import { runReactLoop, type Step } from "@/lib/reactLoop";
import { recall, remember } from "@/lib/nexoraBrain";
import { getSessionUserId } from "@/lib/sessionUser";

export const maxDuration = 60;

const BUDGET_MS = 46_000;

/**
 * Behtareen se shuru kar ke n models ki qatar.
 *
 * Pehla version sirf EK model chunta tha. Live par pehli hi koshish
 * Gemini 3.7 par gayi jo 429 de raha tha, aur poora loop 557ms me
 * khaali laut aaya — koi fallback hi nahi tha. Ab qatar banti hai aur
 * har provider alag hai (ek ka rate limit sab ko na maare).
 */
function pickChain(pool: Entry[], n = 3): Entry[] {
  const tags = ["reasoning", "coding", "general"];
  const prov = new Map<string, number>();
  const score = (e: Entry) => {
    let s = e.rank;
    if (e.tags.some((t) => tags.includes(t))) s -= 100;
    if (e.degraded) s += 800;
    if (!e.envKey) s += 15;
    s += 60 * (prov.get(e.provider) ?? 0);
    return s;
  };
  const cands = [...pool];
  const out: Entry[] = [];
  for (let i = 0; i < n && cands.length; i++) {
    const best = cands.reduce((a, b) => (score(b) < score(a) ? b : a));
    out.push(best);
    cands.splice(cands.indexOf(best), 1);
    prov.set(best.provider, (prov.get(best.provider) ?? 0) + 1);
  }
  return out;
}

export async function POST(req: NextRequest) {
  const t0 = Date.now();
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "bad-json" }, { status: 400 });
  }

  // messages[] ya seedha task — dono qubool.
  const rawMsgs = Array.isArray(body?.messages)
    ? (body.messages as { role: "user" | "assistant"; content: string }[])
    : [];
  const rawTask = String(body?.task ?? "").trim();

  const cleaned = sanitizeMessages(
    rawMsgs.length ? rawMsgs : rawTask ? [{ role: "user" as const, content: rawTask }] : [],
  );
  const msgs = cleaned.messages.filter((m) => m.content.trim());
  if (!msgs.length) return Response.json({ ok: false, error: "no-task" }, { status: 400 });

  const task = msgs[msgs.length - 1].content;
  const history = msgs.slice(0, -1).slice(-6) as { role: "user" | "assistant"; content: string }[];

  const stream = new URL(req.url).searchParams.get("stream") === "1";

  // ─── NEXORA BRAIN ───
  // Model chalane se PEHLE apni yaadasht dekho. Agar ye sawal (ya is
  // jaisa) pehle hal ho chuka hai to jawab 0ms me apne paas se aata
  // hai — koi API call nahi, koi rate limit nahi. Jitna istemal hoga,
  // utni Nexora khud-mukhtar hoti jayegi.
  const userId = await getSessionUserId(req);
  const useBrain = body?.brain !== false;
  if (userId && useBrain) {
    const hit = await recall(userId, task);
    if (hit) {
      const payload = {
        ok: true,
        final: hit.answer,
        steps: [],
        model: "Nexora Brain",
        toolsUsed: ["memory"],
        hitLimit: false,
        fromBrain: true,
        brain: { score: hit.score, savedAt: hit.savedAt, originalQuestion: hit.question, source: hit.source },
        ms: Date.now() - t0,
      };
      if (!stream) return Response.json(payload);
      // Stream me bhi wohi shakl bhejo taake UI ko farq na parhe.
      const enc0 = new TextEncoder();
      return new Response(
        new ReadableStream({
          start(c) {
            c.enqueue(enc0.encode(JSON.stringify({ type: "start", model: "Nexora Brain", provider: "local", maxSteps: 0 }) + "\n"));
            c.enqueue(enc0.encode(JSON.stringify({ type: "done", ...payload, type2: undefined }) + "\n"));
            c.close();
          },
        }),
        { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } },
      );
    }
  }

  const pool = available();
  const chain = pickChain(pool, 3);
  if (!chain.length) return Response.json({ ok: false, error: "no-models" }, { status: 503 });

  const origin = new URL(req.url).origin;
  const baseSystem = buildSystem({});

  const maxSteps = Math.min(6, Math.max(1, Number(body?.maxSteps ?? 4)));

  if (!stream) {
    let r = null as Awaited<ReturnType<typeof runReactLoop>> | null;
    for (const m of chain) {
      if (Date.now() - t0 > BUDGET_MS - 8_000) break;
      r = await runReactLoop(m, baseSystem, task, {
        origin,
        maxSteps,
        budgetMs: BUDGET_MS - (Date.now() - t0),
        history,
        fallbacks: chain.filter((x) => x.id !== m.id),
      });
      if (r.final.trim()) break; // kaam ho gaya
    }
    if (!r) return Response.json({ ok: false, error: "all-models-failed" }, { status: 502 });
    // Achha jawab hamesha ke liye mehfooz — agli baar 0ms me milega.
    let saved = false;
    if (userId && r.final) saved = await remember(userId, task, r.final, r.model);
    return Response.json({
      saved,
      ok: !!r.final,
      final: r.final,
      steps: r.steps,
      model: r.model,
      toolsUsed: r.toolsUsed,
      hitLimit: r.hitLimit,
      redacted: cleaned.redacted ? cleaned.kinds : null,
      ms: Date.now() - t0,
    });
  }

  // ─── STREAM ───
  const enc = new TextEncoder();
  const rs = new ReadableStream({
    async start(controller) {
      const emit = (o: unknown) => {
        try {
          controller.enqueue(enc.encode(JSON.stringify(o) + "\n"));
        } catch {
          /* client chala gaya */
        }
      };

      emit({ type: "start", model: chain[0].name, provider: chain[0].provider, maxSteps });

      try {
        let r = null as Awaited<ReturnType<typeof runReactLoop>> | null;
        for (const m of chain) {
          if (Date.now() - t0 > BUDGET_MS - 8_000) break;
          if (r) emit({ type: "retry", model: m.name }); // pehla nakaam hua
          r = await runReactLoop(m, baseSystem, task, {
            origin,
            maxSteps,
            budgetMs: BUDGET_MS - (Date.now() - t0),
            history,
            fallbacks: chain.filter((x) => x.id !== m.id),
            onStep: (s: Step) => emit({ type: "step", step: s }),
          });
          if (r.final.trim()) break;
        }
        if (!r) {
          emit({ type: "error", message: "koi model kaam nahi kar saka" });
          controller.close();
          return;
        }
        let saved = false;
        if (userId && r.final) saved = await remember(userId, task, r.final, r.model);
        emit({
          type: "done",
          saved,
          final: r.final,
          model: r.model,
          toolsUsed: r.toolsUsed,
          hitLimit: r.hitLimit,
          steps: r.steps.length,
          ms: Date.now() - t0,
        });
      } catch (e) {
        emit({ type: "error", message: (e as Error).message });
      }
      controller.close();
    },
  });

  return new Response(rs, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
