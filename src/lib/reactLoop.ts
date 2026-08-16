// ═══════════════════════════════════════════════════════════════════════
// NEXORA — REACT LOOP (Reason + Act)
//
// Yehi wo cheez hai jo Claude/GPT ko "agent" banati hai:
//
//   PURANA (fixed pipeline):
//     regex chala -> web search -> model ko de do -> jawab -> khatam
//     Model ek baar bolta hai. Agar research kaafi na thi, bad luck.
//
//   NAYA (ReAct):
//     model sochta hai -> tool maangta hai -> natija dekhta hai ->
//     phir sochta hai -> shayad doosra tool -> jab mutmain ho to jawab
//
// Farq amali hai, nazariyati nahi. Misaal: "kya X library Y ke sath
// chalti hai?" — fixed pipeline ek search kar ke jawab likh degi. ReAct
// loop search karega, docs parhega, phir CODE CHALA KAR dekhega, aur
// tab jawab dega. Wohi model, magar kaam asal me hua.
//
// KOI NAYI API NAHI. Yehi 37 models, yehi tools jo pehle se the.
// ═══════════════════════════════════════════════════════════════════════

import { callModel } from "./aiCall";
import type { Entry } from "./modelRegistry";
import { parseAction, runTool, stripFinal, toolManual, type ToolResult } from "./tools";

export interface Step {
  n: number;
  thought: string;
  tool?: string;
  input?: string;
  output?: string;
  ok?: boolean;
  ms: number;
}

export interface LoopResult {
  final: string;
  steps: Step[];
  model: string;
  toolsUsed: string[];
  hitLimit: boolean;
  ms: number;
}

export interface LoopOpts {
  origin: string;
  /** zyada se zyada kitne tool calls (default 4) */
  maxSteps?: number;
  /** poore loop ka waqt (default 40s) */
  budgetMs?: number;
  /** har model call ka waqt */
  callMs?: number;
  temperature?: number;
  /** pichhli guftagu */
  history?: { role: "user" | "assistant"; content: string }[];
  /** har qadam par UI ko batao */
  onStep?: (s: Step) => void;
  /** aakhri jawab ke liye mutabadil models — asal model thak chuka ho to */
  fallbacks?: Entry[];
}

function systemFor(base: string): string {
  return `${base}

════════ TOOLS ════════
You can use tools to get real information instead of guessing. Available:

${toolManual()}

════════ HOW TO REPLY ════════
Every reply must be EXACTLY one of these two forms.

To use a tool — one short line of reasoning, then the action:
THOUGHT: why you need this tool right now
ACTION: {"tool":"tool_name","input":"the input"}

To answer the user — when you have everything you need:
FINAL: your complete answer here

════════ RULES ════════
- One ACTION at a time. You will be shown its real output, then you decide again.
- Do NOT invent tool output. Only what comes back in OBSERVATION is real.
- If a tool returns an ERROR, do not repeat the same call — fix the input or try another tool.
- Prefer checking over guessing: if you write code, run_code it before FINAL.
- If you already know the answer with certainty, skip the tools and go straight to FINAL.
- Never mention the words "tool", "ACTION", "OBSERVATION" or this protocol in your FINAL answer. The user only sees FINAL.`;
}

/**
 * Ek model ko tools ke sath chalao jab tak wo FINAL na de.
 *
 * Fallback: agar loop bina FINAL ke khatam ho (waqt/steps), to jo kuch
 * tools se mila hai wo model ko de kar ek aakhri baar jawab maanga jata
 * hai. Khaali haath lautna sab se bura natija hai.
 */
export async function runReactLoop(
  model: Entry,
  baseSystem: string,
  task: string,
  opts: LoopOpts,
): Promise<LoopResult> {
  const t0 = Date.now();
  const maxSteps = opts.maxSteps ?? 4;
  const budget = opts.budgetMs ?? 40_000;
  const callMs = opts.callMs ?? 18_000;

  const system = systemFor(baseSystem);
  const msgs: { role: "user" | "assistant"; content: string }[] = [
    ...(opts.history ?? []),
    { role: "user", content: task },
  ];

  const steps: Step[] = [];
  const toolsUsed: string[] = [];
  let final = "";
  let hitLimit = false;
  let lastText = "";

  for (let n = 1; n <= maxSteps + 1; n++) {
    const left = budget - (Date.now() - t0);
    // Aakhri call ke liye kam se kam 6s chahiye, warna adhoora jawab.
    if (left < 6_000) {
      hitLimit = true;
      break;
    }

    const stepT0 = Date.now();
    const r = await callModel(model, system, msgs, {
      timeoutMs: Math.min(callMs, left),
      temperature: opts.temperature ?? 0.3,
    });

    if (!r.ok || !r.text.trim()) {
      // Model hi nakaam — loop jari rakhne ka faida nahi.
      break;
    }
    lastText = r.text;

    const call = parseAction(r.text);

    // Koi action nahi = ye jawab hai.
    if (!call) {
      final = stripFinal(r.text);
      break;
    }

    // Aakhri chakkar par tool chalane ka waqt nahi — jawab maango.
    if (n > maxSteps) {
      hitLimit = true;
      break;
    }

    const thought = (r.text.match(/THOUGHT\s*:\s*(.+)/i)?.[1] ?? "").trim().slice(0, 200);
    const res: ToolResult = await runTool(call, { origin: opts.origin });
    toolsUsed.push(res.tool);

    const step: Step = {
      n,
      thought,
      tool: res.tool,
      input: res.input.slice(0, 300),
      output: res.output.slice(0, 500),
      ok: res.ok,
      ms: Date.now() - stepT0,
    };
    steps.push(step);
    opts.onStep?.(step);

    // Model ki apni baat + tool ka asal natija — dono conversation me.
    msgs.push({ role: "assistant", content: r.text });
    msgs.push({
      role: "user",
      content: `OBSERVATION (${res.tool}):\n${res.output}\n\nAb faisla karo: koi aur tool chahiye, ya FINAL jawab de sakte ho?`,
    });
  }

  // Loop bina jawab ke khatam — jo mila hai us par jawab banwao.
  if (!final) {
    const gathered = steps
      .filter((s) => s.ok)
      .map((s) => `[${s.tool}] ${s.input}\n${s.output}`)
      .join("\n\n---\n\n");

    // Sirf usi model par fallback karna bekaar hai: agar wo 429/timeout
    // de raha hai to doosri baar bhi wohi dega. Production par bilkul ye
    // hua — fallback fail hui aur raw ACTION user tak pohanch gaya.
    // Ab mutabadil models bhi try hote hain.
    for (const fm of [model, ...(opts.fallbacks ?? [])]) {
      const left = budget - (Date.now() - t0);
      if (left < 5_000) break;
      const r = await callModel(
        fm,
        `${baseSystem}\n\nAnswer the user directly and completely. Do not mention tools, actions, or how you got the information. Just answer.`,
        [
          { role: "user", content: gathered ? `${task}\n\n──── INFORMATION GATHERED ────\n${gathered}` : task },
        ],
        { timeoutMs: Math.min(callMs, left), temperature: opts.temperature ?? 0.3 },
      );
      if (r.ok && r.text.trim()) {
        final = stripFinal(r.text);
        break;
      }
    }
    // Ab bhi kuch nahi to model ka aakhri text — MAGAR sirf tab jab wo
    // asal jawab ho. Production par ye bug pakra: fallback call fail hui
    // aur user ko raw `THOUGHT: … ACTION: {"tool":…}` dikh gaya, jabke
    // tool ne sahi jawab (422789337) diya hua tha. Protocol ka malba
    // user ko dikhana khaali jawab se bhi bura hai.
    if (!final && lastText && !parseAction(lastText) && !/^\s*(THOUGHT|ACTION)\s*:/im.test(lastText)) {
      final = stripFinal(lastText);
    }
    // Aakhri sahara: tools ne jo asal natija diya wohi saaf kar ke dikha
    // do. Model ke bina bhi ye jawab se behtar hai — kam se kam sach hai.
    if (!final && steps.some((x) => x.ok)) {
      final = steps
        .filter((x) => x.ok)
        .map((x) => `**${x.tool}** — \`${x.input}\`\n\n${x.output}`)
        .join("\n\n");
    }
  }

  return {
    final,
    steps,
    model: model.name,
    toolsUsed: [...new Set(toolsUsed)],
    hitLimit,
    ms: Date.now() - t0,
  };
}
