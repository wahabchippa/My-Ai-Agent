// ═══════════════════════════════════════════════════════════════════════
// NEXORA — PROJECT BUILDER
//
// KYUN BANAYA:
// Purana Workspace `src/lib/builder.ts` par chalta tha, jis me EK BHI AI
// call nahi thi. Wo mehez keyword matching thi:
//     prompt me "calculator" hai  -> canned calculator HTML
//     prompt me "todo" hai        -> canned todo HTML
//     warna                       -> generic "website about <topic>"
// Yani "expense tracker with charts" maango to bhi wohi generic landing
// page milta tha. Isi liye Workspace bekaar lagta tha — wo AI tha hi nahi.
//
// Ab: asal model, aur ek code block nahi balke POORA PROJECT — kai files,
// folder structure, package.json — jo download ho sakta hai.
// ═══════════════════════════════════════════════════════════════════════

import { NextRequest } from "next/server";
import { available, type Entry } from "@/lib/modelRegistry";
import { callModel } from "@/lib/aiCall";
import { sanitize } from "@/lib/sanitize";
import { hasUrl, readUrlsIn } from "@/lib/webFetch";

export const maxDuration = 60;

// Vercel 60s par kaat deta hai. 52s ka apna budget, taake jawab wapas
// bhejne ka waqt bache.
const BUDGET_MS = 52_000;
const PLAN_MS = 14_000;
const FILE_MS = 26_000;

export interface ProjectFile {
  path: string;
  content: string;
  lang: string;
}

interface Plan {
  name: string;
  summary: string;
  stack: string;
  files: { path: string; purpose: string }[];
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

/** Model ka jawab JSON hona chahiye, magar aksar ```json me lipta aata
 *  hai ya aage-peeche baatein hoti hain. Sab soorton se nikaalo. */
function parseJson<T>(raw: string): T | null {
  let t = raw.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) t = fence[1].trim();
  const a = t.indexOf("{");
  const b = t.lastIndexOf("}");
  if (a === -1 || b <= a) return null;
  try {
    return JSON.parse(t.slice(a, b + 1)) as T;
  } catch {
    return null;
  }
}

/** Model kabhi kabhi file ko ```lang ... ``` me lapet deta hai chahe mana
 *  kiya ho. Fence utaar do, warna file ke andar backticks reh jate hain. */
function stripFence(raw: string): string {
  const t = raw.trim();
  const m = t.match(/^```[a-z0-9+#.-]*\s*\n([\s\S]*?)\n?```$/i);
  return (m ? m[1] : t).trim();
}

/** Path safety: `../` se bahar nikalna ya absolute path banana mana hai. */
function safePath(p: string): string | null {
  const clean = p.replace(/\\/g, "/").replace(/^\.?\//, "").trim();
  if (!clean || clean.includes("..") || clean.startsWith("/")) return null;
  if (clean.length > 120) return null;
  return clean;
}

function pick(tags: string[], pool: Entry[], exclude: Entry[], n: number): Entry[] {
  const used = new Set(exclude.map((e) => e.id));
  const prov = new Map<string, number>();
  for (const e of exclude) prov.set(e.provider, (prov.get(e.provider) ?? 0) + 1);
  const score = (e: Entry) => {
    let s = e.rank;
    if (e.tags.some((t) => tags.includes(t))) s -= 100;
    if (e.degraded) s += 800;
    if (!e.envKey) s += 15;
    s += 40 * (prov.get(e.provider) ?? 0);
    return s;
  };
  const cands = pool.filter((e) => !used.has(e.id));
  const out: Entry[] = [];
  for (let i = 0; i < n && cands.length; i++) {
    const best = cands.reduce((a, b) => (score(b) < score(a) ? b : a));
    out.push(best);
    cands.splice(cands.indexOf(best), 1);
    prov.set(best.provider, (prov.get(best.provider) ?? 0) + 1);
  }
  return out;
}

const PLAN_SYSTEM = `You are a senior software architect. Given a project request,
design the file structure. Reply with ONLY a JSON object, no prose, no markdown fence:

{
  "name": "kebab-case-project-name",
  "summary": "one sentence describing what it does",
  "stack": "the technologies used, comma separated",
  "files": [
    { "path": "index.html", "purpose": "what this file contains, specifically" }
  ]
}

RULES:
- 3 to 7 files. No more. Every file must be genuinely needed.
- Prefer zero-build stacks that run by just opening a file or one command.
- If it is a web app, plain HTML+CSS+JS that opens in a browser beats a
  framework that needs npm install.
- "purpose" must be concrete: name the actual functions, elements or routes
  that file will contain. A vague purpose produces a vague file.
- Include a README.md last.
- Do NOT include node_modules, lockfiles, .gitignore, or config boilerplate
  unless the stack genuinely cannot run without it.`;

const FILE_SYSTEM = `You are a senior engineer writing ONE file of a larger project.

Output ONLY the raw file contents. No markdown fence, no explanation before
or after, no "Here is the file". Your first character is the first character
of the file itself.

RULES:
- Write the COMPLETE file. Never write "// ... rest of the code" or "TODO"
  or leave a function unimplemented. Partial files break the project.
- Match the other files in the project exactly: same names, same imports,
  same element IDs, same API shapes. They are listed for you.
- Real, working logic. No placeholder data unless the project is a demo.
- Keep it focused: this file does its job and nothing else.`;

export async function POST(req: NextRequest) {
  const t0 = Date.now();
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "bad-json" }, { status: 400 });
  }

  const raw = String(body?.prompt ?? "").trim();
  if (!raw) return Response.json({ ok: false, error: "no-prompt" }, { status: 400 });
  if (raw.length > 4000) {
    return Response.json({ ok: false, error: "too-long" }, { status: 400 });
  }

  const cleaned = sanitize(raw);
  const prompt = cleaned.text;

  const pool = available();
  if (!pool.length) {
    return Response.json({ ok: false, error: "no-models" }, { status: 503 });
  }

  // Agar prompt me link hai to usay parh lo — "is API ke liye client banao"
  // tab hi kaam karta hai jab wo API ka doc samne ho.
  let context = "";
  if (hasUrl(prompt)) {
    context = await readUrlsIn(prompt).catch(() => "");
  }

  // ─── 1. PLAN ───
  const planCands = pick(["reasoning", "coding", "general"], pool, [], 3);
  let plan: Plan | null = null;
  let planModel = "";
  for (const m of planCands) {
    if (Date.now() - t0 > BUDGET_MS - FILE_MS) break;
    const r = await callModel(
      m,
      PLAN_SYSTEM,
      [{ role: "user", content: context ? `${prompt}\n\n──── REFERENCE ────\n${context.slice(0, 4000)}` : prompt }],
      { timeoutMs: PLAN_MS, temperature: 0.3 },
    );
    if (!r.ok || !r.text.trim()) continue;
    const p = parseJson<Plan>(r.text);
    if (!p?.files?.length) continue;
    // Path sanitize + 7 ki hadd. Model kabhi 15 files maang leta hai aur
    // phir budget me ek bhi theek se nahi likhi jati.
    p.files = p.files
      .map((f) => ({ ...f, path: safePath(String(f.path ?? "")) ?? "" }))
      .filter((f) => f.path)
      .slice(0, 7);
    if (!p.files.length) continue;
    plan = p;
    planModel = r.model;
    break;
  }

  if (!plan) {
    return Response.json(
      { ok: false, error: "plan-failed", message: "Plan nahi ban saka — dobara koshish karein" },
      { status: 502 },
    );
  }

  // ─── 2. FILES — sab PARALLEL ───
  // Sequential likhne par 5 files x ~8s = budget khatam. Parallel me har
  // file ko poora manifest diya jata hai (neeche `manifest`), is liye wo
  // ek doosre se mel khati hain bina ek doosre ka intezar kiye.
  const manifest = plan.files.map((f) => `- ${f.path} — ${f.purpose}`).join("\n");

  const fileCands = pick(["coding", "general", "reasoning"], pool, [], Math.max(3, plan.files.length));

  // ─── ANCHOR FILE PEHLE ───
  // Pehla version sab files ek saath parallel banata tha. Live test me
  // app.js ne getElementById("category-chart") dhoonda jabke index.html
  // me wo id thi hi nahi — 6/7 match hue, ek toota. Wajah saaf: JS ne
  // asal HTML kabhi dekha hi nahi, sirf uska ek-line "purpose" dekha.
  // Ab HTML (ya jo bhi structure define karti hai) PEHLE banti hai, aur
  // uska POORA content baqi sab ko diya jata hai. Wo ~4s leti hai, baqi
  // phir bhi parallel — total waqt tqreeban wohi rehta hai.
  const anchorIdx = plan.files.findIndex((f) => /\.html?$/i.test(f.path));
  let anchor: ProjectFile | null = null;

  const writeFile = async (spec: { path: string; purpose: string }, i: number, extra: string): Promise<ProjectFile> => {
    const order = [...fileCands.slice(i % fileCands.length), ...fileCands.slice(0, i % fileCands.length)];
    const user = `PROJECT: ${plan!.name} — ${plan!.summary}
STACK: ${plan!.stack}
ORIGINAL REQUEST: ${prompt}

ALL FILES IN THIS PROJECT:
${manifest}
${extra}
──── NOW WRITE THIS ONE FILE ────
PATH: ${spec.path}
PURPOSE: ${spec.purpose}

Output the complete contents of ${spec.path} and nothing else.`;

    for (const m of order.slice(0, 3)) {
      const left = BUDGET_MS - (Date.now() - t0) - 2_000;
      if (left < 4_000) break;
      const r = await callModel(m, FILE_SYSTEM, [{ role: "user", content: user }], {
        timeoutMs: Math.min(FILE_MS, Math.max(6_000, left)),
        temperature: 0.2,
      });
      if (r.ok && r.text.trim().length > 10) {
        return { path: spec.path, content: stripFence(r.text), lang: langOf(spec.path) };
      }
    }
    return {
      path: spec.path,
      content: `// ${spec.path} nahi ban saki — waqt ya model khatam.\n// Maqsad tha: ${spec.purpose}\n`,
      lang: langOf(spec.path),
    };
  };

  if (anchorIdx >= 0) {
    anchor = await writeFile(plan.files[anchorIdx], anchorIdx, "");
  }

  // Baqi files: anchor ka asal content saath jata hai, is liye IDs,
  // class names aur script tags bilkul mel khate hain.
  const anchorBlock = anchor
    ? `\n──── ${anchor.path} (ALREADY WRITTEN — match it EXACTLY: same element IDs, same class names, same script/link paths) ────\n${anchor.content.slice(0, 5000)}\n`
    : "";

  const rest: ProjectFile[] = await Promise.all(
    plan.files.map(async (spec, i): Promise<ProjectFile | null> => {
      if (i === anchorIdx) return null;
      return writeFile(spec, i, anchorBlock);
    }),
  ).then((a) => a.filter((x): x is ProjectFile => x !== null));

  // Asal tarteeb bahal karo (anchor apni jagah par).
  const byPath = new Map(rest.map((f) => [f.path, f]));
  if (anchor) byPath.set(anchor.path, anchor);
  const files: ProjectFile[] = plan.files
    .map((s) => byPath.get(s.path))
    .filter((x): x is ProjectFile => !!x);

  const built = files.filter((f) => !f.content.startsWith("// " + f.path + " nahi ban saki"));

  return Response.json({
    ok: built.length > 0,
    name: plan.name,
    summary: plan.summary,
    stack: plan.stack,
    files,
    built: built.length,
    total: files.length,
    planModel,
    redacted: cleaned.redacted ? cleaned.kinds : null,
    ms: Date.now() - t0,
  });
}
