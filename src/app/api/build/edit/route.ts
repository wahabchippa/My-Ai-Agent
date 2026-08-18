// ═══════════════════════════════════════════════════════════════════════
// NEXORA — PROJECT EDIT (Workspace ka chat)
//
// User: "WAHAN PROPER CHAT BOT DO, HAM JO BANREY HAMEN USME KUCH OR
//        CHANGING KARNI KUCH OR EDIT KARNI KUCH BHI KARNA TO WOH SAB HOSAKEY"
//
// Bilkul theek. Project ek baar ban jaye to wo pathar par nahi likha
// hona chahiye. Ab Workspace me chat hai: "button ka rang neela karo",
// "dark mode add karo", "ye bug theek karo" — aur asal files badalti hain.
//
// TAREEQA:
// Poora project dobara banwana galat hai — 30 second lagte hain aur jo
// theek tha wo bhi badal jata hai. Is liye do marhale:
//   1. PLAN  — chhota model batata hai KAUNSI files chhoonI hain
//   2. PATCH — sirf wohi files dobara likhi jati hain, baqi jaisi ki taisi
// Ek rang badalne ke liye 5 files dobara likhwana bewaqoofi hai.
// ═══════════════════════════════════════════════════════════════════════

import { NextRequest } from "next/server";
import { available, type Entry } from "@/lib/modelRegistry";
import { callModel } from "@/lib/aiCall";
import { sanitize } from "@/lib/sanitize";
import { guardApi } from "@/lib/guard";

export const maxDuration = 60;

const BUDGET_MS = 50_000;

interface FileIn {
  path: string;
  content: string;
  lang: string;
}

const langOf = (p: string): string => {
  const e = p.split(".").pop()?.toLowerCase() ?? "";
  const m: Record<string, string> = {
    ts: "typescript", tsx: "tsx", js: "javascript", jsx: "jsx",
    py: "python", html: "html", css: "css", json: "json",
    md: "markdown", sh: "bash", sql: "sql", yml: "yaml", yaml: "yaml",
  };
  return m[e] ?? "text";
};

function stripFence(raw: string): string {
  const t = raw.trim();
  const m = t.match(/^```[a-z0-9+#.-]*\s*\n([\s\S]*?)\n?```$/i);
  return (m ? m[1] : t).trim();
}

function parseJson<T>(raw: string): T | null {
  let t = raw.trim();
  const f = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (f) t = f[1].trim();
  const a = t.indexOf("{");
  const b = t.lastIndexOf("}");
  if (a === -1 || b <= a) return null;
  try {
    return JSON.parse(t.slice(a, b + 1)) as T;
  } catch {
    return null;
  }
}

function pick(tags: string[], pool: Entry[], n: number): Entry[] {
  const prov = new Map<string, number>();
  const score = (e: Entry) => {
    let s = e.rank;
    if (e.tags.some((t) => tags.includes(t))) s -= 100;
    if (e.degraded) s += 800;
    if (!e.envKey) s += 15;
    s += 50 * (prov.get(e.provider) ?? 0);
    return s;
  };
  const c = [...pool];
  const out: Entry[] = [];
  for (let i = 0; i < n && c.length; i++) {
    const best = c.reduce((a, b) => (score(b) < score(a) ? b : a));
    out.push(best);
    c.splice(c.indexOf(best), 1);
    prov.set(best.provider, (prov.get(best.provider) ?? 0) + 1);
  }
  return out;
}

const PLAN_SYSTEM = `You decide which files need changing. Reply with ONLY JSON:

{"files":["app.js","style.css"],"reply":"one short sentence telling the user what you will change","newFile":null}

RULES:
- List ONLY files that genuinely must change. Changing a button colour is
  usually ONE file. Do not list files "just in case" — every extra file is
  a chance to break something that already works.
- If the request needs a brand new file, put its path in "newFile", else null.
- If the request is a question about the code (not a change), return an empty
  files array and put the full answer in "reply".
- "reply" is spoken to the user. Plain, short, no markdown.`;

const EDIT_SYSTEM = `You are editing ONE file of an existing project.

Output ONLY the complete new contents of that file. No markdown fence, no
explanation, no "Here is the updated file". First character = first character
of the file.

RULES:
- Apply the requested change and NOTHING else. Do not refactor, rename, or
  "improve" code the user did not ask about. Unrequested changes are bugs.
- Return the WHOLE file, not a diff and not a fragment.
- Keep every element ID, class name, function name and import that other
  files depend on — unless the change is explicitly about renaming them.`;

export async function POST(req: NextRequest) {
  // ── AUTH GATE (guest per-IP limit) — /api/build ke sath consistency ──
  const guard = await guardApi(req, { allowAnon: true });
  if (!guard.ok) {
    return Response.json({ ok: false, error: guard.error }, { status: guard.status });
  }

  const t0 = Date.now();
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "bad-json" }, { status: 400 });
  }

  const rawMsg = String(body?.message ?? "").trim();
  const files = (Array.isArray(body?.files) ? body.files : []) as FileIn[];
  if (!rawMsg) return Response.json({ ok: false, error: "no-message" }, { status: 400 });
  if (!files.length) return Response.json({ ok: false, error: "no-files" }, { status: 400 });

  const message = sanitize(rawMsg).text;
  const pool = available();
  if (!pool.length) return Response.json({ ok: false, error: "no-models" }, { status: 503 });

  const manifest = files.map((f) => `- ${f.path} (${f.content.length} chars)`).join("\n");
  // Chhoti files poori bhejo — model ko asal code dekhe baghair sahi
  // faisla nahi ho sakta ke kya badalna hai.
  const peek = files
    .map((f) => `──── ${f.path} ────\n${f.content.slice(0, 1800)}${f.content.length > 1800 ? "\n…" : ""}`)
    .join("\n\n")
    .slice(0, 9000);

  // ─── 1. PLAN ───
  interface Plan {
    files: string[];
    reply: string;
    newFile: string | null;
  }
  let plan: Plan | null = null;
  for (const m of pick(["reasoning", "coding", "general"], pool, 3)) {
    if (Date.now() - t0 > BUDGET_MS - 20_000) break;
    const r = await callModel(
      m,
      PLAN_SYSTEM,
      [{ role: "user", content: `PROJECT FILES:\n${manifest}\n\n${peek}\n\n──── USER REQUEST ────\n${message}` }],
      { timeoutMs: 12_000, temperature: 0.2 },
    );
    if (!r.ok || !r.text.trim()) continue;
    const p = parseJson<Plan>(r.text);
    if (!p) continue;
    plan = {
      files: (Array.isArray(p.files) ? p.files : []).filter((f) => files.some((x) => x.path === f)).slice(0, 4),
      reply: String(p.reply ?? "").slice(0, 500),
      newFile: p.newFile && typeof p.newFile === "string" && !p.newFile.includes("..") ? p.newFile : null,
    };
    break;
  }

  if (!plan) {
    return Response.json({ ok: false, error: "plan-failed", reply: "Samajh nahi aaya — dobara likhein?" }, { status: 502 });
  }

  // Sirf sawal tha, koi tabdeeli nahi.
  if (!plan.files.length && !plan.newFile) {
    return Response.json({
      ok: true,
      reply: plan.reply || "Is me koi tabdeeli ki zaroorat nahi.",
      changed: [],
      files,
      ms: Date.now() - t0,
    });
  }

  // ─── 2. PATCH — sirf mutasira files, parallel ───
  const editCands = pick(["coding", "general", "reasoning"], pool, 3);
  const targets = [
    ...plan.files.map((p) => ({ path: p, existing: files.find((f) => f.path === p)! })),
    ...(plan.newFile ? [{ path: plan.newFile, existing: null }] : []),
  ];

  const results = await Promise.all(
    targets.map(async (t, i): Promise<{ path: string; content: string | null }> => {
      const others = files
        .filter((f) => f.path !== t.path)
        .map((f) => `──── ${f.path} ────\n${f.content.slice(0, 1500)}`)
        .join("\n\n")
        .slice(0, 6000);

      const user = t.existing
        ? `USER REQUEST: ${message}

──── OTHER FILES (do not break these) ────
${others}

──── CURRENT ${t.path} ────
${t.existing.content}

Output the complete updated ${t.path}.`
        : `USER REQUEST: ${message}

──── EXISTING FILES ────
${others}

Create a NEW file: ${t.path}
Output its complete contents.`;

      const order = [...editCands.slice(i % editCands.length), ...editCands.slice(0, i % editCands.length)];
      for (const m of order.slice(0, 2)) {
        const left = BUDGET_MS - (Date.now() - t0) - 2_000;
        if (left < 6_000) break;
        const r = await callModel(m, EDIT_SYSTEM, [{ role: "user", content: user }], {
          timeoutMs: Math.min(26_000, left),
          temperature: 0.15,
        });
        if (r.ok && r.text.trim().length > 10) return { path: t.path, content: stripFence(r.text) };
      }
      return { path: t.path, content: null };
    }),
  );

  const changed = results.filter((r) => r.content !== null).map((r) => r.path);
  const failed = results.filter((r) => r.content === null).map((r) => r.path);

  // Nayi file list banao — sirf kamyab tabdeeliyan lagao.
  const byPath = new Map(files.map((f) => [f.path, { ...f }]));
  for (const r of results) {
    if (r.content === null) continue;
    byPath.set(r.path, { path: r.path, content: r.content, lang: langOf(r.path) });
  }

  return Response.json({
    ok: changed.length > 0,
    reply:
      plan.reply ||
      (changed.length ? `${changed.join(", ")} update kar di.` : "Tabdeeli nahi ho saki."),
    changed,
    failed,
    files: [...byPath.values()],
    ms: Date.now() - t0,
  });
}
