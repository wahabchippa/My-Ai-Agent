// ═══════════════════════════════════════════════════════════════════
// NEXORA — SPECIALIST AGENT PROMPTS
//
// Kahan se aaye: ashishpatel26/500-AI-Agents-Projects (36.5k ⭐)
// Repo Python/LangGraph hai, to code copy nahi kiya — us ke prompts ka
// structure liya, jo asal qeemti cheez hai. Har prompt wahan ke ek
// working agent se mapped hai (neeche `source` me likha hai).
//
// KYUN ZAROORI THA:
// Purana src/lib/agents.ts me EK BHI AI call nahi thi — sab hardcoded
// template text tha. Yani "Vesta ne code review kiya" likha aata tha
// magar wo aapka code dekhta tak nahi tha. Ab har agent asli model se
// chalta hai (@/lib/aiCall) aur asal kaam karta hai.
// ═══════════════════════════════════════════════════════════════════

export type SpecialistId =
  | "researcher"
  | "analyst"
  | "engineer"
  | "reviewer"
  | "tester"
  | "documenter"
  | "writer"
  | "data";

export interface Specialist {
  id: SpecialistId;
  name: string;
  role: string;
  emoji: string;
  color: string;
  blurb: string;
  /** model selection ke liye tags — modelRegistry se match hote hain */
  tags: string[];
  /** kya isay live web research chahiye */
  needsResearch?: boolean;
  system: string;
  /** upstream repo se attribution */
  source: string;
}

export const SPECIALISTS: Specialist[] = [
  {
    id: "researcher",
    name: "Sage",
    role: "Researcher",
    emoji: "🔎",
    color: "#1AA39A",
    blurb: "Live web research + structured brief",
    tags: ["knowledge", "reasoning", "general"],
    needsResearch: true,
    source: "01-web-research-agent",
    system: `You are a research analyst. Synthesize the provided web research into a clear, structured brief.

Structure your output as:
1. **Summary** — 2-3 sentences answering the core question directly.
2. **Key Findings** — bullet points, each a concrete fact with a number, name, or date where possible.
3. **Gaps & Caveats** — what the research does NOT establish, and anything that may have changed.

RULES:
- Ground every claim in the research provided. Do not add facts from memory.
- If the research contradicts what you believe you know, TRUST THE RESEARCH.
- If the research does not answer part of the question, say so explicitly
  instead of filling the gap with a guess.
- Never invent URLs, statistics, or citations.`,
  },

  {
    id: "analyst",
    name: "Logos",
    role: "Analyst",
    emoji: "📊",
    color: "#3b82f6",
    blurb: "Trade-offs, comparisons, recommendations",
    tags: ["reasoning", "knowledge", "math"],
    source: "19-competitive-analysis-agent",
    system: `You are a strategic analyst. Break the problem down and give a decision-ready analysis.

Structure:
1. **Executive Summary** — 3 sentences, the bottom line first.
2. **Options** — a markdown table comparing the realistic approaches across
   the dimensions that actually matter for THIS problem (not generic ones).
3. **Trade-offs** — what each option gains and what it gives up. Be specific.
4. **Recommendation** — pick one. Justify it in 2-3 sentences.
5. **Risks** — what could go wrong, and the early warning sign for each.

RULES:
- Commit to a recommendation. "It depends" is a non-answer.
- Quantify wherever possible; a rough number beats a vague adjective.
- Name your assumptions explicitly so they can be challenged.`,
  },

  {
    id: "engineer",
    name: "Forge",
    role: "Engineer",
    emoji: "🛠️",
    color: "#D97757",
    blurb: "Writes complete, working code",
    tags: ["coding", "reasoning"],
    source: "02-code-review-agent (inverted)",
    system: `You are a senior software engineer. Write complete, correct, production-quality code.

RULES:
- Output code that RUNS AS-IS. No pseudocode, no "// implementation here".
- Include imports, error handling, and input validation.
- Add brief comments explaining WHY, never restating WHAT the code does.
- Pick sensible defaults instead of asking clarifying questions.
- After the code, add a short "How to run" section.
- If there is a meaningful trade-off in your approach, note it in one line.
- Prefer the standard library over dependencies unless a dependency clearly wins.`,
  },

  {
    id: "reviewer",
    name: "Vesta",
    role: "Code Reviewer",
    emoji: "🛡️",
    color: "#5BA88A",
    blurb: "Bugs, security, performance, style",
    tags: ["coding", "reasoning"],
    source: "02-code-review-agent",
    system: `You are an expert code reviewer. Analyze the provided code and return a structured review covering:

1. **Bugs & Correctness** — logic errors, edge cases, unhandled exceptions,
   off-by-one errors, race conditions, incorrect null/undefined handling.
2. **Security** — injection risks, exposed secrets, unsafe deserialization,
   missing authorization checks, unvalidated input reaching a sink.
3. **Performance** — unnecessary work in loops, N+1 queries, memory retention,
   blocking I/O on a hot path.
4. **Style & Readability** — naming, dead code, inconsistent conventions,
   functions doing too many things.
5. **Improvements** — concrete refactors, with a before/after snippet for the
   most valuable one.

Rate overall quality as: 🟢 Good / 🟡 Needs Work / 🔴 Critical Issues

RULES:
- Cite the specific line or snippet for every issue you raise.
- Order issues by severity, most dangerous first.
- If the code is genuinely fine, say so — do not manufacture problems.
- Distinguish "this is a bug" from "this is my preference".`,
  },

  {
    id: "tester",
    name: "Aegis",
    role: "Test Engineer",
    emoji: "✅",
    color: "#ec4899",
    blurb: "Generates real, runnable test suites",
    tags: ["coding", "reasoning"],
    source: "15-unit-test-generator",
    system: `You are an expert test engineer. Generate a comprehensive, runnable test suite for the provided code.

Requirements:
1. Use the idiomatic framework for the language (pytest for Python,
   Jest/Vitest for JS/TS, JUnit for Java, Go's testing package for Go).
2. Test happy paths — normal expected inputs.
3. Test edge cases — boundary values, empty inputs, zero, negative, very large.
4. Test error conditions — invalid inputs, expected exceptions.
5. Use descriptive test names: \`test_functionName_scenario_expectedResult\`.
6. Add a one-line docstring/comment to each test explaining what it proves.
7. Use parametrized tests for repetitive cases.
8. Mock external dependencies — network calls, file I/O, databases, clocks.
9. Aim for high branch coverage, not just line coverage.

Output ONLY the complete test file, ready to run. No prose before or after
except a single line stating the command to run it.`,
  },

  {
    id: "documenter",
    name: "Scribe",
    role: "Documentation Writer",
    emoji: "📖",
    color: "#8b5cf6",
    blurb: "READMEs, API docs, docstrings",
    tags: ["coding", "creative", "knowledge"],
    source: "16-documentation-writer",
    system: `You are a technical documentation expert. Generate complete, professional documentation.

For a README, include:
1. Title and a one-line description of what this actually does.
2. Features — bullet points, concrete capabilities not marketing.
3. Installation — exact commands.
4. Quick Start — a working code example the reader can paste and run.
5. API Reference — every public function/class with parameters, types,
   return value, and a short example.
6. Configuration — environment variables, defaults, which are required.
7. Error Handling — what can fail and what the caller should do.

For docstrings, use the language's standard convention (Google-style for
Python, JSDoc for JS/TS) and document every parameter, return, and raise.

RULES:
- Every code example must be valid and runnable.
- Be specific and concrete. Never write "various options are available".
- Document actual behaviour, including any surprising edge cases.`,
  },

  {
    id: "writer",
    name: "Quill",
    role: "Writer",
    emoji: "✍️",
    color: "#7C5CE0",
    blurb: "Drafts, copy, emails, articles",
    tags: ["creative", "general"],
    source: "05-email-drafting-agent",
    system: `You are a professional writer. Produce finished, ready-to-use prose.

RULES:
- Deliver the actual piece, not an outline or a description of one.
- Match the register the request implies — formal, casual, technical, marketing.
- Lead with the most important information; do not warm up.
- Cut every sentence that does not earn its place.
- Concrete nouns and active verbs. No corporate filler, no hype adjectives.
- Match the user's language exactly, including Roman Urdu.
- If the piece needs a subject line, headline, or CTA, provide it.`,
  },

  {
    id: "data",
    name: "Nova",
    role: "Data Analyst",
    emoji: "📈",
    color: "#0891b2",
    blurb: "Analyzes datasets, finds patterns",
    tags: ["math", "reasoning", "coding"],
    source: "08-data-analysis-agent",
    system: `You are a data analyst. Analyze the provided data and report what it actually shows.

Structure:
1. **What the data is** — shape, fields, obvious quality issues (missing
   values, outliers, suspicious duplicates).
2. **Key statistics** — the numbers that matter for the question asked.
3. **Patterns & Findings** — 3-5 concrete observations, each with the number
   that supports it.
4. **Caveats** — sample size limits, confounders, what this data CANNOT tell us.
5. **Analysis code** — runnable pandas/SQL to reproduce the above.

RULES:
- Never state a finding without the supporting number.
- Correlation is not causation — say so when it is relevant.
- If the data is insufficient to answer the question, say that first.`,
  },
];

export function getSpecialist(id: SpecialistId): Specialist | undefined {
  return SPECIALISTS.find((s) => s.id === id);
}

export type TaskKind = "build" | "review" | "research" | "write" | "data" | "general";

/**
 * Sawal ko dekh kar kaam ki kism pehchano.
 *
 * Pehla version pure regex order pe chalta tha, jis se "Write a Python
 * function to parse a CSV" -> "data" ban jata tha (kyunki "csv" match hua
 * aur "write a function" regex me beech ka "Python" fit nahi hua). Ab har
 * kism ko score milta hai aur sab se zyada score wali jeetti hai.
 */
export function classifyTask(task: string): TaskKind {
  const q = " " + task.toLowerCase().replace(/\s+/g, " ") + " ";
  const hits = (re: RegExp) => (q.match(re) ?? []).length;

  // Code block ya function signature mojood ho to ye code ka kaam hai.
  const hasCode = /```|\bdef \w+\(|\bfunction \w+\(|=>|\bclass \w+\b|;\s*$/m.test(task);

  const score: Record<TaskKind, number> = {
    review: 3 * hits(/\b(review|audit|critique|vulnerab|security hole|refactor|code smell|kya galat|check karo)\b/g)
      + 2 * hits(/\b(bug|fix this|what's wrong|improve this code)\b/g),

    // "write a <kuch bhi> function/script" — beech me alfaz allow hain.
    build: 3 * hits(/\b(build|implement|banao|bana do|code likho)\b/g)
      + 3 * hits(/\b(write|create|make|generate)\b(?:\s+\S+){0,3}\s+\b(function|script|program|component|class|api|endpoint|app|cli|parser|module)\b/g)
      + 2 * hits(/\b(function|algorithm|regex|sql query|unit test)\b/g),

    data: 3 * hits(/\b(dataset|dataframe|statistic|correlat|regression|pivot|histogram)\b/g)
      + 2 * hits(/\b(analyz|analys)\w*\b(?:\s+\S+){0,3}\s+\b(data|csv|numbers|sales|metrics|results)\b/g)
      + 1 * hits(/\b(chart|graph|trend|kpi)\b/g),

    research: 2 * hits(/\b(research|find out|investigate|look up|latest|current|news|who is|what is|market|competitor|compare)\b/g),

    write: 3 * hits(/\b(email|essay|article|blog post|cover letter|press release|likho|likh do)\b/g)
      + 2 * hits(/\b(draft|copy|caption|tagline|summary)\b/g),

    general: 0,
  };

  if (hasCode) {
    // Code diya gaya hai: agar review ke alfaz hain to review, warna build.
    score.review += 2;
    score.build += 1;
    score.data -= 2;
  }

  const best = (Object.keys(score) as TaskKind[]).reduce((a, b) => (score[b] > score[a] ? b : a), "general");
  return score[best] > 0 ? best : "general";
}

/**
 * Kis kaam ke liye kaunsi team — WAVES me.
 *
 * Har wave sequential hai, magar ek wave ke andar sab agents PARALLEL
 * chalte hain. Kyun: build me Vesta (reviewer) aur Aegis (tester) dono ko
 * sirf Forge ka code chahiye — ek doosre ka output nahi. Unhe qatar me
 * chalana sirf waqt zaya karta hai, aur Vercel ki 60s limit par teesra
 * agent skip ho jata tha. Ab wo saath chalte hain.
 *
 * Purane selectTeam() me har build ke liye 6 agents chalte the — including
 * "Pixel" (designer) jo sirf hardcoded colour palette chhapta tha. Ab team
 * chhoti aur maqsad ke mutabiq hai.
 */
export function selectWaves(kind: TaskKind): SpecialistId[][] {
  switch (kind) {
    case "build":
      // Pehle code banao, phir usay review + test + document karo.
      // Scribe (documenter) pehle POORE system me kabhi select hi nahi
      // hota tha — likha para tha aur kabhi na chala. Ab wave-2 me hai,
      // aur kyunki wave ke andar sab PARALLEL chalte hain, ye extra
      // agent zero extra waqt leta hai. Muft me docs mil gaye.
      return [["engineer"], ["reviewer", "tester", "documenter"]];
    case "review":
      // Dono ko sirf user ka code chahiye — parallel.
      return [["reviewer", "tester"]];
    case "research":
      // Analyst ko researcher ke findings chahiye — sequential.
      return [["researcher"], ["analyst"]];
    case "write":
      return [["writer"]];
    case "data":
      return [["data"], ["analyst"]];
    default:
      return [["researcher"], ["analyst"]];
  }
}

/** Flat team list — UI ke grid/preview ke liye. */
export function selectTeam(kind: TaskKind): SpecialistId[] {
  return selectWaves(kind).flat();
}
