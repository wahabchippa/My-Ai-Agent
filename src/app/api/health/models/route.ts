// /api/health/models — LIVE DIAGNOSTIC
//
// Browser me kholein: http://localhost:3000/api/health/models
//
// Ye batata hai:
//   • kaunse providers configured hain
//   • har model ZINDA hai ya DEAD (404 = retired ID)
//   • kya jawab purane (stale) model se aa raha hai
//
// Jab bhi jawab kharab lagen — sabse pehle YAHI kholen.

import { REGISTRY, available, hasRealProvider, configuredProviders, isStale, keyFor } from "@/lib/modelRegistry";
import { callModel } from "@/lib/aiCall";
import { research } from "@/lib/research";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const deep = url.searchParams.get("deep") === "1";

  const providers = configuredProviders();
  const av = available();

  const base = {
    ok: hasRealProvider(),
    date: new Date().toISOString(),
    configuredProviders: providers,
    missingKeys: [...new Set(REGISTRY.filter((e) => e.envKey && !process.env[e.envKey]).map((e) => e.envKey))],
    availableModels: av.length,
    freshModels: av.filter((e) => !isStale(e) && e.envKey).length,
    keylessOnly: av.every((e) => !e.envKey),
  };

  if (!hasRealProvider()) {
    return Response.json(
      {
        ...base,
        verdict: "❌ KOI PROVIDER CONFIGURED NAHI",
        why:
          "App keyless public endpoints use kar rahi hai. Ye asal me purane models " +
          "(GPT-4o cutoff Oct 2023, GPT-4 cutoff Sep 2021) serve karte hain — " +
          "chahe unka naam 'gemini-3.1' ya 'claude-sonnet-5' likha ho. " +
          "YEH aapke ghalat/purane jawabon ki asal wajah hai.",
        fix: [
          "1. Gemini key lein (free, 1500 req/day): https://aistudio.google.com/apikey",
          "2. Groq key lein (free, 14400 req/day): https://console.groq.com/keys",
          "3. Cerebras key lein (free, 1M tokens/day): https://cloud.cerebras.ai",
          "4. .env me daalein: GEMINI_API_KEY=... GROQ_API_KEY=... CEREBRAS_API_KEY=...",
          "5. Server restart karein.",
        ],
        guide: "SETUP-FREE-AI.md",
      },
      { status: 503 }
    );
  }

  if (!deep) {
    return Response.json({
      ...base,
      verdict: base.freshModels > 0 ? "✅ HEALTHY" : "⚠️ SIRF PURANE MODELS AVAILABLE",
      models: av.map((e) => ({
        id: e.id,
        name: e.name,
        provider: e.provider,
        cutoff: e.cutoff,
        stale: isStale(e),
        keySet: e.envKey ? !!keyFor(e) : "keyless",
      })),
      hint: "Live test ke liye: /api/health/models?deep=1",
    });
  }

  // ─── DEEP: har model ko asli call ───
  const probe = [{ role: "user", content: "Reply with ONLY your knowledge cutoff month and year." }];
  const tested = await Promise.all(
    av.map(async (e) => {
      const r = await callModel(e, "Answer in under 10 words.", probe, { timeoutMs: 20000 });
      const reportedStale = r.ok && /201\d|202[0-3]/.test(r.text);
      return {
        id: e.id,
        name: e.name,
        provider: e.provider,
        declaredCutoff: e.cutoff,
        alive: r.ok,
        ms: r.ms,
        reply: r.ok ? r.text.trim().slice(0, 80) : null,
        error: r.error || null,
        // ⚠ model jo cutoff BATATA hai wo registry se mail khata hai?
        cutoffMismatch: reportedStale && !isStale(e),
      };
    })
  );

  // Research pipeline bhi test karein — freshness isi pe depend karti hai.
  const rTest = await research("who is the current president of the united states").catch(() => "");

  return Response.json({
    ...base,
    verdict: tested.some((t) => t.alive && !t.cutoffMismatch) ? "✅ HEALTHY" : "⚠️ PROBLEMS FOUND",
    dead: tested.filter((t) => !t.alive).map((t) => `${t.name}: ${t.error}`),
    lying: tested
      .filter((t) => t.cutoffMismatch)
      .map((t) => `${t.name} — registry kehta hai ${t.declaredCutoff}, model khud kehta hai "${t.reply}"`),
    models: tested,
    research: {
      working: rTest.length > 100,
      chars: rTest.length,
      preview: rTest.slice(0, 300),
      note: "Agar working=false hai to 'current' sawalon ke jawab purane aayenge.",
    },
  });
}
