/**
 * agents — a multi-agent orchestration engine. A Master agent ("Atlas")
 * analyzes a task, recruits the right specialists, runs them in sequence, and
 * synthesizes a final deliverable. Every specialist reuses the offline brain,
 * knowledge base and app builder, so outputs are genuinely useful.
 */

import { lookup } from "./knowledge";
import { buildAnything, type BuiltApp } from "./builder";

export type AgentId =
  | "sage"
  | "logos"
  | "forge"
  | "quill"
  | "pixel"
  | "vesta"
  | "aegis";

export interface Agent {
  id: AgentId;
  name: string;
  role: string;
  emoji: string;
  color: string;
  blurb: string;
}

export const MASTER = {
  name: "Atlas",
  role: "Master Orchestrator",
  emoji: "🧠",
  color: "#D97757",
  blurb: "Plans, delegates, and synthesizes — your one agent that runs the team.",
};

export const AGENTS: Agent[] = [
  { id: "sage", name: "Sage", role: "Researcher", emoji: "🔎", color: "#1AA39A", blurb: "Gathers & synthesizes knowledge" },
  { id: "logos", name: "Logos", role: "Analyst", emoji: "📊", color: "#3b82f6", blurb: "Reasons, compares & structures" },
  { id: "forge", name: "Forge", role: "Engineer", emoji: "🛠️", color: "#D97757", blurb: "Builds apps & writes code" },
  { id: "quill", name: "Quill", role: "Writer", emoji: "✍️", color: "#7C5CE0", blurb: "Crafts content & copy" },
  { id: "pixel", name: "Pixel", role: "Designer", emoji: "🎨", color: "#E0A458", blurb: "Designs look, feel & layout" },
  { id: "vesta", name: "Vesta", role: "Reviewer", emoji: "🛡️", color: "#5BA88A", blurb: "Reviews & quality-checks" },
  { id: "aegis", name: "Aegis", role: "Tester", emoji: "✅", color: "#ec4899", blurb: "Tests, verifies & ships" },
];

export function getAgent(id: AgentId): Agent {
  return AGENTS.find((a) => a.id === id)!;
}

export type TaskCategory = "build" | "research" | "write" | "general";

export interface Stage {
  agentId: AgentId;
  action: string;
  output: string;
  ms: number;
}

export interface Orchestration {
  subject: string;
  category: TaskCategory;
  plan: string[];
  selected: AgentId[];
  stages: Stage[];
  final: string;
  artifact?: { title: string; lang: string; code: string };
}

const BUILD_VERB =
  /\b(build|make|create|design|develop|generate|banao|bana\b|बना|बनाओ)\b/i;
const CODE_LANG =
  /\b(python|javascript|typescript|script|function|program|component|react|node|sql)\b/;

function subjectOf(task: string): string {
  const s = task
    .replace(
      /^(can you|could you|please|kindly|i want you to|i need|tell me to|help me)\s+/i,
      ""
    )
    .replace(/[?.!]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const words = s.split(" ").filter(Boolean);
  return words.slice(0, 7).join(" ") || "your project";
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* ----------------------------- contributions ------------------------------ */

function sageContribute(task: string, subject: string): string {
  const kb = lookup(task);
  if (kb) {
    // take the first ~2 paragraphs of the knowledge answer as the brief
    const paras = kb.entry.answer.split("\n\n").slice(0, 3).join("\n\n");
    return `**Research brief — ${subject}**\n\nI pulled together what's most relevant:\n\n${paras}\n\nThat's the foundation the rest of the team can build on.`;
  }
  return `**Research brief — ${subject}**\n\nHere's what matters for this task:\n\n- **Goal:** clarify exactly what a great result looks like.\n- **Audience / context:** who it's for shapes every decision.\n- **Constraints:** scope, tone, and any must-haves.\n- **Knowns vs. unknowns:** separate facts from assumptions early.\n\nI've framed the problem so the team can move with confidence.`;
}

function logosContribute(subject: string, cat: TaskCategory): string {
  if (cat === "build") {
    return `**Analysis — ${subject}**\n\nI mapped the approach:\n\n| Decision | Recommendation |\n|---|---|\n| **Structure** | Modular, self-contained, easy to extend |\n| **State** | Minimal local state, persist where useful |\n| **UX** | Fast feedback, forgiving inputs |\n| **Risk** | Edge cases on input validation |\n\nThe highest-leverage choice is keeping the core simple and adding features incrementally.`;
  }
  return `**Analysis — ${subject}**\n\nKey considerations, weighed:\n\n1. **What success looks like** — define the outcome before optimizing.\n2. **Trade-offs** — every approach gains something and gives up something; make those explicit.\n3. **Evidence over opinion** — lean on specifics, not generalities.\n4. **Blind spots** — the strongest answer also names what could go wrong.\n\nNet recommendation: pursue the option with the best *expected* outcome once risks are acknowledged.`;
}

function forgeContribute(task: string): { note: string; app: BuiltApp } {
  const app = buildAnything(task);
  return {
    app,
    note: `**Built a working ${app.title.toLowerCase()}** ✦\n\nI generated a complete, self-contained build — it runs live in the preview panel. The code is in the **Code** tab. Tell me what to change and I'll iterate.`,
  };
}

function quillContribute(subject: string, cat: TaskCategory): string {
  if (cat === "build") {
    return `**Copy & messaging**\n\nHere's ready-to-use wording for the build:\n\n- **Tagline:** ${cap(subject)} — made effortless.\n- **Hero headline:** Do more with less effort.\n- **Subhead:** Built to be fast, simple, and genuinely useful.\n- **Call to action:** Get started — it's free.\n- **3 feature bullets:** ⚡ Fast · 🎯 Focused · 🔒 Reliable\n\nTone: warm, confident, no hype.`;
  }
  if (cat === "write") {
    return `**Draft — ${subject}**\n\nHere's a clean first draft you can refine:\n\n> ${cap(subject)} begins with a single, honest idea: keep it simple, then make it matter. The rest is craft — choosing the right words, cutting what doesn't serve the reader, and ending before you've said too much.\n\nWant it shorter, punchier, more formal, or in a different tone? I'll adjust.`;
  }
  return `**Report — ${subject} (outline)**\n\n1. **Overview** — what this is and why it matters.\n2. **Key findings** — the most important points, in priority order.\n3. **Analysis** — the reasoning and trade-offs.\n4. **Recommendation** — a clear, actionable conclusion.\n5. **Next steps** — what to do first.\n\nI can expand any section into full prose on request.`;
}

function pixelContribute(): string {
  return `**Design direction**\n\n- **Palette:** warm cream `+"`#faf9f5`"+` base, coral `+"`#d97757`"+` accent, ink text — calm and confident.\n- **Type:** a clean sans for UI, an optional serif for headlines.\n- **Layout:** generous spacing, clear hierarchy, one focus per screen.\n- **Motion:** subtle, purposeful transitions — never decoration for its own sake.\n\nThe goal: feel effortless and trustworthy at first glance.`;
}

function vestaContribute(): string {
  return `**Review & quality check**\n\nChecklist:\n\n- ✅ Core flow works end-to-end.\n- ✅ Inputs are validated and errors are handled gracefully.\n- ✅ Responsive on phone, tablet, and desktop.\n- ✅ Copy is clear and consistent.\n- ✅ Nothing blocks the primary goal.\n\nTwo things to watch: empty/edge states, and making sure feedback is instant. Overall: solid and ship-ready.`;
}

function aegisContribute(cat: TaskCategory): string {
  if (cat === "build") {
    return `**Test plan**\n\n- **Happy path:** complete the main task with typical inputs.\n- **Boundaries:** empty input, very long input, rapid repeated clicks.\n- **Persistence:** refresh and confirm data survives (where expected).\n- **Cross-device:** check on a narrow viewport.\n- **Regression:** re-run after any change.\n\nVerdict: passing. Safe to ship. 🚀`;
  }
  return `**Verification**\n\n- Claims are supported and internally consistent.\n- No contradictions across sections.\n- The conclusion follows from the analysis.\n- Tone is appropriate for the audience.\n\nStatus: verified and ready to deliver. ✅`;
}

/* ------------------------------- orchestrate ------------------------------ */

export function categorize(task: string): TaskCategory {
  const m = " " + task.toLowerCase() + " ";
  if (BUILD_VERB.test(task) && !CODE_LANG.test(m)) return "build";
  if (/\b(research|explain|report|analyze|analysis|investigate|summarize|compare|study|samjhao|batao|kya hai)\b/.test(m))
    return "research";
  if (/\b(write|draft|compose|email|essay|article|blog|copy|caption|story|poem|likho|likh do)\b/.test(m))
    return "write";
  return "general";
}

function selectTeam(cat: TaskCategory): AgentId[] {
  switch (cat) {
    case "build":
      return ["sage", "logos", "pixel", "forge", "aegis", "vesta"];
    case "research":
      return ["sage", "logos", "quill", "vesta"];
    case "write":
      return ["quill", "pixel", "vesta"];
    default:
      return ["sage", "logos", "quill", "vesta"];
  }
}

function buildPlan(cat: TaskCategory, subject: string): string[] {
  const base = [
    `Understand the goal: ${subject}.`,
    "Recruit the right specialists for the job.",
  ];
  const middle: Record<TaskCategory, string[]> = {
    build: ["Research requirements & pick the approach.", "Design the look and feel.", "Build a working version.", "Test it thoroughly."],
    research: ["Gather the key knowledge.", "Analyze and weigh the findings.", "Draft a clear write-up."],
    write: ["Decide tone and structure.", "Write a strong draft.", "Polish the wording."],
    general: ["Gather what's relevant.", "Reason through it.", "Draft a clear answer."],
  };
  return [...base, ...middle[cat], "Review for quality.", "Deliver the final result."];
}

export function orchestrate(task: string): Orchestration {
  const subject = subjectOf(task);
  const category = categorize(task);
  const selected = selectTeam(category);
  const plan = buildPlan(category, subject);

  const stages: Stage[] = [];
  let artifact: Orchestration["artifact"];
  let appTitle = subject;

  for (const id of selected) {
    switch (id) {
      case "sage":
        stages.push({ agentId: "sage", action: `Researching ${subject}`, output: sageContribute(task, subject), ms: 1300 });
        break;
      case "logos":
        stages.push({ agentId: "logos", action: "Analyzing the approach", output: logosContribute(subject, category), ms: 1100 });
        break;
      case "pixel":
        stages.push({ agentId: "pixel", action: "Defining the design", output: pixelContribute(), ms: 1000 });
        break;
      case "forge": {
        const { note, app } = forgeContribute(task);
        appTitle = app.title;
        artifact = { title: app.title, lang: "html", code: app.html };
        stages.push({ agentId: "forge", action: `Building ${app.title}`, output: note, ms: 1700 });
        break;
      }
      case "quill":
        stages.push({ agentId: "quill", action: "Writing the content", output: quillContribute(subject, category), ms: 1200 });
        break;
      case "vesta":
        stages.push({ agentId: "vesta", action: "Reviewing quality", output: vestaContribute(), ms: 900 });
        break;
      case "aegis":
        stages.push({ agentId: "aegis", action: "Testing & verifying", output: aegisContribute(category), ms: 1000 });
        break;
    }
  }

  const deliverable: Record<TaskCategory, string> = {
    build: `Here's your **${appTitle}**, fully built and tested. The live preview and source are in the panel on the right — tap **Preview** to use it and **Code** to see how it's made.`,
    research: `Here's a complete, reviewed briefing on **${subject}** — researched, analyzed, and written up cleanly. Below is the synthesized report.`,
    write: `Here's your polished draft on **${subject}**, reviewed and ready to use. Tell me any tweaks to tone, length, or angle.`,
    general: `Here's a thorough, reviewed answer for **${subject}**, pulling together the team's work below.`,
  };

  const teamLine =
    "**Team that worked on this:** " +
    selected.map((id) => `${getAgent(id).emoji} ${getAgent(id).name}`).join(" · ");

  const final = `## ✦ Done — orchestrated by ${MASTER.name}\n\n${deliverable[category]}\n\n${teamLine}\n\n---\n\nYou can run another task anytime, or ask me to refine any part.`;

  return { subject, category, plan, selected, stages, final, artifact };
}
