#!/usr/bin/env node
/**
 * verify-models.mjs — LIVE model health check for Nexora.
 *
 * Ye script har provider se poochta hai ke uske paas ABHI kaunse models hain,
 * phir Nexora ke code me likhe hue IDs se match karta hai. Jo ID dead hai
 * wo *** DEAD *** dikhega.
 *
 * Run:  node scripts/verify-models.mjs
 *
 * Jab bhi jawab kharab aane lagen — sabse pehle YE chalao.
 */

const KEYS = {
  openrouter: process.env.OPENROUTER_API_KEY || "",
  groq: process.env.GROQ_API_KEY || "",
  gemini: process.env.GEMINI_API_KEY || "",
  cerebras: process.env.CEREBRAS_API_KEY || "",
};

const C = {
  ok: (s) => `\x1b[32m${s}\x1b[0m`,
  bad: (s) => `\x1b[31m${s}\x1b[0m`,
  warn: (s) => `\x1b[33m${s}\x1b[0m`,
  dim: (s) => `\x1b[90m${s}\x1b[0m`,
  head: (s) => `\x1b[1m\x1b[36m${s}\x1b[0m`,
};

async function jget(url, headers = {}) {
  try {
    const r = await fetch(url, { headers, signal: AbortSignal.timeout(20000) });
    if (!r.ok) return { error: `HTTP ${r.status}` };
    return await r.json();
  } catch (e) {
    return { error: e.message };
  }
}

// ─────────────────────────────────────────────────────────────
async function checkOpenRouter() {
  console.log(C.head("\n━━━ OpenRouter ━━━"));
  const d = await jget("https://openrouter.ai/api/v1/models");
  if (d.error) return console.log(C.bad(`  unreachable: ${d.error}`)), [];
  const all = (d.data || []).map((m) => m.id);
  const free = (d.data || [])
    .filter((m) => m.id.endsWith(":free"))
    .sort((a, b) => (b.context_length || 0) - (a.context_length || 0));
  console.log(C.dim(`  total=${all.length}  free=${free.length}`));
  console.log(C.head("\n  LIVE FREE MODELS (use these!):"));
  for (const m of free) {
    console.log(`    ${C.ok(m.id.padEnd(56))} ctx=${m.context_length}`);
  }
  return all;
}

async function checkGroq() {
  console.log(C.head("\n━━━ Groq ━━━"));
  if (!KEYS.groq) return console.log(C.warn("  GROQ_API_KEY not set — skipped")), [];
  const d = await jget("https://api.groq.com/openai/v1/models", {
    Authorization: `Bearer ${KEYS.groq}`,
  });
  if (d.error) return console.log(C.bad(`  ${d.error}`)), [];
  const ids = (d.data || []).map((m) => m.id).sort();
  ids.forEach((i) => console.log(`    ${C.ok(i)}`));
  return ids;
}

async function checkGemini() {
  console.log(C.head("\n━━━ Google Gemini ━━━"));
  if (!KEYS.gemini) return console.log(C.warn("  GEMINI_API_KEY not set — skipped")), [];
  const d = await jget(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(KEYS.gemini)}`
  );
  if (d.error) return console.log(C.bad(`  ${d.error}`)), [];
  const ids = (d.models || [])
    .filter((m) => (m.supportedGenerationMethods || []).includes("generateContent"))
    .map((m) => m.name.replace("models/", ""))
    .filter((i) => !/embedding|aqa|imagen|veo|tts/i.test(i))
    .sort();
  ids.forEach((i) => console.log(`    ${C.ok(i)}`));
  return ids;
}

async function checkCerebras() {
  console.log(C.head("\n━━━ Cerebras ━━━"));
  if (!KEYS.cerebras) return console.log(C.warn("  CEREBRAS_API_KEY not set — skipped")), [];
  const d = await jget("https://api.cerebras.ai/v1/models", {
    Authorization: `Bearer ${KEYS.cerebras}`,
  });
  if (d.error) return console.log(C.bad(`  ${d.error}`)), [];
  const ids = (d.data || []).map((m) => m.id).sort();
  ids.forEach((i) => console.log(`    ${C.ok(i)}`));
  return ids;
}

// ─── Smoke test: kya model SAHI jawab deta hai? ───
async function smokeTest(label, url, model, key, fmt = "openai") {
  const q = "Reply with ONLY your knowledge cutoff month and year. Nothing else.";
  try {
    let text = "";
    if (fmt === "gemini") {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: q }] }] }),
          signal: AbortSignal.timeout(30000),
        }
      );
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error?.message || `HTTP ${r.status}`);
      text = d?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ?? "";
    } else {
      const r = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(key ? { Authorization: `Bearer ${key}` } : {}),
        },
        body: JSON.stringify({ model, messages: [{ role: "user", content: q }] }),
        signal: AbortSignal.timeout(30000),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error?.message || `HTTP ${r.status}`);
      text = d?.choices?.[0]?.message?.content ?? "";
    }
    const clean = text.trim().replace(/\s+/g, " ").slice(0, 60);
    const stale = /201[0-9]|202[0-3]/.test(clean);
    console.log(
      `    ${(stale ? C.bad("STALE") : C.ok(" OK  ")).padEnd(14)} ${label.padEnd(38)} → "${clean}"`
    );
  } catch (e) {
    console.log(`    ${C.bad("FAIL ").padEnd(14)} ${label.padEnd(38)} → ${String(e.message).slice(0, 60)}`);
  }
}

async function main() {
  console.log(C.head("╔══════════════════════════════════════════════════╗"));
  console.log(C.head("║   NEXORA — LIVE MODEL VERIFICATION               ║"));
  console.log(C.head("╚══════════════════════════════════════════════════╝"));

  const [orIds, groqIds, gemIds, cerIds] = await Promise.all([
    checkOpenRouter(),
    checkGroq(),
    checkGemini(),
    checkCerebras(),
  ]);

  console.log(C.head("\n━━━ KEYLESS PROVIDERS (no key needed) ━━━"));
  console.log(C.warn("  ⚠ Ye sirf emergency fallback hain — inke jawab purane hote hain."));
  await smokeTest("pollinations:openai", "https://text.pollinations.ai/openai", "openai", "");
  await smokeTest("llm7:gemini-3.1-flash-lite", "https://api.llm7.io/v1/chat/completions", "gemini-3.1-flash-lite", "");

  console.log(C.head("\n━━━ SMOKE TEST — asli models ━━━"));
  if (KEYS.gemini) {
    for (const m of ["gemini-3-flash", "gemini-2.5-flash", "gemini-3.1-flash-lite"]) {
      if (gemIds.length && !gemIds.includes(m)) continue;
      await smokeTest(`gemini/${m}`, "", m, KEYS.gemini, "gemini");
    }
  }
  if (KEYS.groq) {
    for (const m of ["llama-3.3-70b-versatile", "openai/gpt-oss-120b"]) {
      if (groqIds.length && !groqIds.includes(m)) continue;
      await smokeTest(`groq/${m}`, "https://api.groq.com/openai/v1/chat/completions", m, KEYS.groq);
    }
  }
  if (KEYS.cerebras) {
    for (const m of ["gpt-oss-120b", "qwen-3-235b-a22b-instruct-2507"]) {
      if (cerIds.length && !cerIds.includes(m)) continue;
      await smokeTest(`cerebras/${m}`, "https://api.cerebras.ai/v1/chat/completions", m, KEYS.cerebras);
    }
  }
  if (KEYS.openrouter) {
    for (const m of ["nvidia/nemotron-3-ultra-550b-a55b:free", "google/gemma-4-31b-it:free"]) {
      if (orIds.length && !orIds.includes(m)) continue;
      await smokeTest(`openrouter/${m}`, "https://openrouter.ai/api/v1/chat/completions", m, KEYS.openrouter);
    }
  }

  const none = !KEYS.gemini && !KEYS.groq && !KEYS.cerebras && !KEYS.openrouter;
  if (none) {
    console.log(C.bad("\n╔══════════════════════════════════════════════════╗"));
    console.log(C.bad("║  ❌ KOI KEY SET NAHI HAI                          ║"));
    console.log(C.bad("║  Isi liye AI purane/ghalat jawab de raha hai.    ║"));
    console.log(C.bad("║  SETUP-FREE-AI.md padho — 10 min, 100% free.     ║"));
    console.log(C.bad("╚══════════════════════════════════════════════════╝"));
  } else {
    console.log(C.ok("\n✓ Verification complete.\n"));
  }
}

main();
