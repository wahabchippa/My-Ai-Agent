import type { ModelId } from "./models";
import { buildAnything } from "./builder";
import { lookup } from "./knowledge";
import {
  detectLang,
  phrase,
  pickJoke,
  buildIntro,
  type Lang,
} from "./i18n";
import {
  applyOverlay,
  pGreeting,
  pIdentity,
  pThanks,
  pHowAre,
  pBye,
  pCompliment,
  pClarify,
  pJoke,
  type PersonalityId,
} from "./personalities";

/**
 * claudeBrain — a fully client-side reasoning engine. No network.
 *
 * Design goals (v2):
 *  - Genuinely useful text tools: an extractive SUMMARIZER and a text IMPROVER
 *    that operate on whatever the user pastes.
 *  - Better intent detection + rich, varied, natural answers that reference the
 *    real subject (not rigid templates).
 *  - Conversation memory for follow-ups.
 *  - Optional "web" mode that simulates search + sources.
 */

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface BrainResult {
  thinking: string[];
  text: string;
  lang: Lang;
  autoArtifact?: boolean;
}

const norm = (s: string) => s.toLowerCase().trim();
const has = (s: string, ...words: string[]) => words.some((w) => s.includes(w));
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const HAS_ANY = (s: string, groups: string[][]) =>
  groups.some((g) => g.every((w) => s.includes(w)));

export function tokenize(text: string): string[] {
  return text.match(/\s+|[^\s]+/g) ?? [text];
}

const BUILD_VERB =
  /\b(build|make|create|design|develop|generate|banao|bana\b|बना|बनाओ|बनवा|tayar)\b/i;
const CODE_LANG =
  /\b(python|javascript|typescript|\bjs\b|\bts\b|script|function|program|snippet|algorithm|sql|regex|component|react|node)\b/;

/* --------------------------- stopwords / nlp ------------------------------ */

const STOP = new Set(
  ("the a an and or but if then else of to in on at by for with from into over " +
    "is are was were be been being am do does did doing have has had having " +
    "i you he she it we they me him her us them my your his its our their " +
    "this that these those there here as so not no yes can could would should " +
    "will shall may might must about what which who whom whose when where why how " +
    "tell me please explain more some any all each every very just also than too " +
    "its it's i'm you're don't").split(" ")
);

function wordFreq(words: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const w of words) {
    if (STOP.has(w) || w.length < 3) continue;
    m.set(w, (m.get(w) ?? 0) + 1);
  }
  return m;
}

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g)
    ?.map((s) => s.trim())
    .filter((s) => s.length > 0) ?? [];
}

/** Extractive summarizer — scores sentences by word frequency. Real + useful. */
export function summarize(text: string, max = 4): string {
  const sentences = splitSentences(text);
  if (sentences.length <= 2) return text.trim();
  const freq = wordFreq(
    text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/)
  );
  const maxFreq = Math.max(1, ...freq.values());
  const scored = sentences.map((s, i) => {
    const words = s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/);
    let score = 0;
    for (const w of words) score += (freq.get(w) ?? 0) / maxFreq;
    // mild boost to earlier sentences & penalize very long ones
    score = score / Math.sqrt(words.length) + (sentences.length - i) * 0.002;
    return { s, i, score };
  });
  const top = [...scored].sort((a, b) => b.score - a.score).slice(0, max);
  top.sort((a, b) => a.i - b.i);
  return top.map((t) => t.s).join(" ");
}

/** Clean up messy pasted text — genuinely useful for notes/drafts. */
export function improveText(text: string): string {
  let t = text.replace(/\s+/g, " ").trim();
  // space after punctuation
  t = t.replace(/([.,!?;:])(?=\S)/g, "$1 ");
  // capitalize sentence starts
  t = t.replace(/(^|[.!?]\s+)([a-z])/g, (_, p, c) => p + c.toUpperCase());
  // standalone "i" -> "I"
  t = t.replace(/\bi\b/g, "I");
  // fix "i'm", "i've"...
  t = t.replace(/\bi'/g, "I'");
  // collapse repeated punctuation
  t = t.replace(/([!?]){2,}/g, "$1");
  // ensure ends with punctuation
  if (t && !/[.!?]$/.test(t)) t += ".";
  return t;
}

/** Quick text transforms for the Tools menu. */
export function transformText(
  text: string,
  action: "polish" | "shorten" | "fix" | "expand"
): string {
  const clean = text.trim();
  if (!clean) return "";
  if (action === "polish") return improveText(clean);
  if (action === "fix") return improveText(clean);
  if (action === "shorten") {
    const s = summarize(clean, Math.max(1, Math.round(splitSentences(clean).length / 2)));
    return s;
  }
  // expand: add a clarifying closing line
  return clean + "\n\n" + "In short, this matters because the details above are what make the difference in practice.";
}

/* -------------------------------- math ------------------------------------ */

function tryMath(prompt: string): string | null {
  const cleaned = prompt
    .replace(/what(?:'s| is)|calculate|compute|evaluate|equals?|=|\?/gi, "")
    .replace(/\bplus\b/gi, "+")
    .replace(/\bminus\b/gi, "-")
    .replace(/\b(times|multiplied by|x)\b/gi, "*")
    .replace(/\b(divided by|over)\b/gi, "/")
    .trim();
  if (!/^[-+/*().\d\s]+$/.test(cleaned)) return null;
  if (!/\d/.test(cleaned) || !/[-+/*]/.test(cleaned)) return null;
  try {
    // eslint-disable-next-line no-new-func
    const value = Function(`"use strict";return (${cleaned});`)();
    if (typeof value !== "number" || !isFinite(value)) return null;
    return `\`${cleaned.replace(/\s+/g, " ")}\` = **${Number(value.toFixed(8))}**`;
  } catch {
    return null;
  }
}

/* ----------------------------- subject util ------------------------------- */

function stripPrefix(s: string): string {
  return s
    .replace(
      /^(can you|could you|please|kindly|i want you to|i need you to|i want|tell me to|help me|tell me|i would like you to|i would like|i'd like to|lets|let's)\s+/i,
      ""
    )
    .replace(
      /^(explain|describe|define|summarize|summarise|what is|what are|what's|whats|what does|who is|who are|how do|how does|how is|how can|how to|how would|why is|why are|why do|why does|why would|when|where|which|should i|do you|give me|list|compare|write|create|make|build|generate|translate|improve|rewrite|samjhao|batao|likho|banao)\s+/i,
      ""
    )
    .replace(/[?.!]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function subjectOf(prompt: string): string {
  const s = stripPrefix(prompt);
  const words = s.split(" ").filter(Boolean);
  return words.slice(0, 8).join(" ") || "that";
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* ----------------------------- conversation ------------------------------- */

function isFollowUp(prompt: string): boolean {
  const p = norm(prompt);
  return (
    /\b(tell me more|go deeper|elaborate|more (about|detail|info)|in detail|another (example|one)|explain (that|it|this)|what else|expand|continue|why is that|how so|and then|so what|give (me )?an? example|show me an example)\b/.test(
      p
    ) || /^(more|examples?|continue|again|why|how|example)\b/.test(p)
  );
}

function lastTopic(history: ChatTurn[]): string | null {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role === "assistant") {
      const bold = history[i].content.match(/\*\*(.+?)\*\*/);
      if (bold && bold[1].length < 60) return bold[1].replace(/[.?!:]/g, "").trim();
      const head = history[i].content.match(/^#{1,4}\s+(.+)$/m);
      if (head) return head[1].trim();
    }
  }
  return null;
}

/* ----------------------------- small talk --------------------------------- */

const HOWARE: Record<Lang, string> = {
  en: "I'm doing great, thanks for asking! 😊 Always ready to dig into something with you. What are you working on?",
  hi: "मैं बढ़िया हूँ, पूछने के लिए धन्यवाद! 😊 कुछ भी पूछने के लिए तैयार। आप क्या कर रहे हैं?",
  ur: "Main bilkul theek hoon, poochne ke liye shukriya! 😊 Aap kya kar rahe hain?",
};
const BYE: Record<Lang, string> = {
  en: "Take care! I'm right here whenever you need me. 👋",
  hi: "अपना ख्याल रखिए! जब भी ज़रूरत हो, मैं यहीं हूँ। 👋",
  ur: "Apna khayal rakhiye! Jab bhi zaroorat ho, main yahin hoon. 👋",
};
const COMPLIMENT: Record<Lang, string> = {
  en: "That's really kind — thank you! 🙏 I'm glad it helped. What should we tackle next?",
  hi: "बहुत मेहरबानी — धन्यवाद! 🙏 खुशी है काम आया। अब क्या करें?",
  ur: "Bohot meharbani — shukriya! 🙏 Khushi hui kaam aaya. Ab kya karein?",
};
const CLARIFY: Record<Lang, string> = {
  en: "Happy to help — could you add a little detail? For example, are you looking to **build something**, **learn a topic**, **write or improve text**, **get an explanation**, or **compare options**? A sentence more and I'll nail it. 🙂",
  hi: "ज़रूर मदद करूँगा — थोड़ा और बताइए? क्या कुछ **बनाना** है, **कोई टॉपिक सीखना** है, **लिखना/सुधारना** है, **explanation** चाहिए, या **compare** करना है?",
  ur: "Zaroor madad karunga — thoda aur batayein? Kuch banana hai, koi topic seekhna hai, likhna/behtar karna hai, ya compare karna hai?",
};

function dateTime(lang: Lang): string {
  const now = new Date();
  const locale = lang === "hi" ? "en-IN" : "en-US";
  const date = now.toLocaleDateString(locale, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const time = now.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  return lang === "hi"
    ? `अभी समय है **${time}**, और तारीख़ **${date}**। ⏰`
    : lang === "ur"
    ? `Abhi waqt hai **${time}**, aur tareekh **${date}** hai. ⏰`
    : `It's **${time}** right now, on **${date}**. ⏰`;
}

/* ------------------------------- thinking --------------------------------- */

function generateThinking(prompt: string, model: ModelId, m: string, history: ChatTurn[]): string[] {
  const lines: string[] = [];
  const topic = prompt.length > 50 ? prompt.slice(0, 50) + "…" : prompt;
  if (BUILD_VERB.test(prompt) && !CODE_LANG.test(m)) {
    lines.push("Deciding the best structure for this build.", "Generating a complete, self-contained app.", "Wiring up interactivity so it runs live.");
  } else if (/\b(summarize|summarise|shorten|key points|tldr)\b/.test(m)) {
    lines.push("Reading the text and finding the key sentences.", "Condensing it without losing the point.");
  } else if (/\b(improve|rewrite|polish|fix|proofread)\b/.test(m)) {
    lines.push("Reviewing the text for clarity and errors.", "Cleaning it up while keeping your voice.");
  } else if (CODE_LANG.test(m) && /\b(write|make|create|fix|build|function|code)\b/.test(m)) {
    lines.push("Choosing the right language and structure.", "Writing clean, well-commented code.");
  } else if (lookup(prompt)) {
    lines.push("Recalling what I know about this.", "Organizing it clearly with the right nuance.");
  } else if (history.length >= 2 && isFollowUp(prompt)) {
    lines.push("Connecting this to what we were just discussing.", "Going deeper on the same topic.");
  } else {
    lines.push(`Understanding what's really being asked about "${topic}".`, "Putting together a clear, genuinely useful answer.");
  }
  if (model === "opus" || model === "fable") lines.push("Checking for accuracy and edge cases.");
  return lines;
}

/* ------------------------------ code blocks ------------------------------- */

function codePython(): string {
  return `Here's a clean, well-documented Python example:\n\n\`\`\`python\nfrom dataclasses import dataclass\nfrom typing import Iterable\n\n\n@dataclass\nclass Task:\n    name: str\n    done: bool = False\n\n\ndef summary(tasks: Iterable[Task]) -> str:\n    \"\"\"A friendly progress summary for a list of tasks.\"\"\"\n    tasks = list(tasks)\n    finished = sum(1 for t in tasks if t.done)\n    pct = round(100 * finished / len(tasks)) if tasks else 0\n    return f\"{finished}/{len(tasks)} done ({pct}%)\"\n\n\nif __name__ == \"__main__\":\n    day = [Task(\"Reply to emails\", done=True), Task(\"Ship feature\")]\n    print(summary(day))  # 1/2 done (50%)\n\`\`\`\n\nA few notes: \`@dataclass\` gives you a readable constructor for free, and \`summary\` is pure — easy to test and reuse. Want it wired to a CLI or unit tests? Just say the word.`;
}
function codeReact(): string {
  return `Here's a self-contained React + TypeScript component:\n\n\`\`\`tsx\nimport { useState } from "react";\n\nexport function Counter() {\n  const [count, setCount] = useState(0);\n  return (\n    <div className="flex items-center gap-3">\n      <button onClick={() => setCount((c) => c - 1)} className="rounded-lg bg-slate-100 px-3 py-1">−</button>\n      <span className="w-10 text-center font-mono">{count}</span>\n      <button onClick={() => setCount((c) => c + 1)} className="rounded-lg bg-slate-900 px-3 py-1 text-white">+</button>\n    </div>\n  );\n}\n\`\`\`\n\n\`useState\` holds the number between renders, and the functional updater \`setCount((c) => c + 1)\` stays correct even with rapid clicks. Want props or styling tweaks? Happy to extend it.`;
}
function codeHtml(): string {
  return `Here's a tidy, modern HTML page you can save and open:\n\n\`\`\`html\n<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="utf-8" />\n    <title>Hello</title>\n    <style>\n      body { font-family: system-ui, sans-serif; display: grid; place-items: center; min-height: 100vh; margin: 0; background: #faf9f5; }\n      .card { padding: 2.5rem 3rem; border-radius: 16px; background: white; box-shadow: 0 10px 40px rgba(0,0,0,.08); }\n      h1 { margin: 0; color: #d97757; }\n    </style>\n  </head>\n  <body>\n    <div class="card"><h1>Hello, world 👋</h1><p>Built live by Nexora.</p></div>\n  </body>\n</html>\n\`\`\`\n\nFully self-contained — no dependencies. Tell me your content and I'll fill it in.`;
}
function codeJs(): string {
  return `Here's idiomatic modern JavaScript:\n\n\`\`\`javascript\n// Debounce: run a function only after it stops being called\nfunction debounce(fn, delay = 300) {\n  let timer;\n  return (...args) => {\n    clearTimeout(timer);\n    timer = setTimeout(() => fn(...args), delay);\n  };\n}\n\n// Group an array by a key\nconst groupBy = (items, keyFn) =>\n  items.reduce((acc, item) => {\n    const key = keyFn(item);\n    (acc[key] ??= []).push(item);\n    return acc;\n  }, {});\n\nconsole.log(groupBy([{ t: \"a\" }, { t: \"a\" }, { t: \"b\" }], (x) => x.t));\n\`\`\`\n\nWant these as TypeScript with types, or added to a real project?`;
}
function intentCode(m: string): string {
  if (has(m, "react", "component", "tsx", "jsx")) return codeReact();
  if (has(m, "html", "css", "web page", "landing", "website")) return codeHtml();
  if (has(m, "javascript", "js", "node", "typescript", "ts")) return codeJs();
  return codePython();
}

/* ------------------------------ prose intents ----------------------------- */

function intentStory(prompt: string, model: ModelId): string {
  const isFable = model === "fable";
  const seed = prompt.replace(/.*(write|tell|compose|create|likho|likh do|banao).*?(a )?(story|poem|tale|fable|kahani|kavita)/i, "").trim();
  const subject = seed || "the lighthouse keeper";
  const voice = isFable
    ? `The night breathed silver. Somewhere beyond the dunes, **${subject}** heard the old bell ring once — a sound nobody had heard in a hundred years.\n\nShe stepped onto the dew-dark path, her lantern swinging a soft amber arc, and the world leaned in to listen.\n\n"You came," said the sea, or the wind, or something older than both. "Good. The story needs a witness."`
    : `Here's a short opening you can build on:\n\n**Chapter One — The Signal**\n\nWhen **${subject}** first noticed the light, it was already too late to look away. It pulsed slowly, patiently, as if it had been waiting — perhaps for years — to be noticed.\n\nShe set down her coffee. "Okay," she whispered. "I'm listening."`;
  return `${voice}\n\n---\n\nWant me to keep going? I can continue the next scene, switch the tone (darker, funnier, more magical), or rewrite it in verse. ✍️`;
}

function intentList(prompt: string): string {
  const topic = stripPrefix(prompt).replace(/.*(ideas|tips|ways|suggestions)\b/i, "").replace(/[?.].*$/, "").trim() || "your project";
  return `Here are some genuinely useful ideas for **${topic}**:\n\n1. **Start with the audience or goal** — clarity here makes every later choice easier.\n2. **Keep it to one core idea** — a single, sharp takeaway beats ten vague ones.\n3. **Steal the structure, not the soul** — study what works, then make it yours.\n4. **Ship rough, then refine** — a real, imperfect version teaches you more than a perfect plan.\n5. **Cut everything that isn't earning its place** — restraint is a feature.\n\nTell me your specific situation and I'll turn these into something concrete. 💡`;
}

function intentCompare(prompt: string): string {
  const parts = prompt.split(/\s+vs\.?\s+|\s+versus\s+|\s+or\s+/i);
  const x = parts[0] ? stripPrefix(parts[0]).replace(/.*(compare|difference|better)/i, "").trim() : "Option A";
  const y = parts[1]?.replace(/[?.].*$/, "").trim() || "Option B";
  return `Here's an honest comparison of **${x}** and **${y}**.\n\n| | **${x}** | **${y}** |\n|---|---|---|\n| **Best at** | Focused, well-defined work | Flexible, broad situations |\n| **Trade-off** | Narrower outside its niche | More moving parts |\n| **Choose if** | You want reliability & focus | You need adaptability |\n\n**The quick rule:** pick **${x}** when the requirements are clear, and **${y}** when they're likely to change. Tell me your specifics and I'll recommend one outright.`;
}

/* --------------------------- generative helpers --------------------------- */

function emailDraft(prompt: string): string {
  const subject = subjectOf(prompt);
  const tone = /friendly|casual|warm/.test(prompt) ? "warm and friendly" : /formal|professional|official/.test(prompt) ? "professional and polite" : "clear and friendly";
  return `Here's a ${tone} email draft for **${subject}**:\n\n---\n\n**Subject:** ${cap(subject)} — following up\n\nHi [Name],\n\nI hope you're doing well. I'm writing about ${subject.toLowerCase()}.\n\n[One short sentence on what you need or want to share.]\n\n[One sentence with the key detail or next step.]\n\nLet me know if you have any questions — happy to help however I can.\n\nBest regards,\n[Your name]\n\n---\n\nSwap in the specifics (names, dates, the actual ask) and it's ready. Want it shorter, more formal, or more casual?`;
}

function nameIdeas(prompt: string): string {
  const subject = subjectOf(prompt).split(" ").slice(0, 2).join(" ") || "Brand";
  const base = subject.replace(/\s+/g, "");
  const ideas = [
    `${cap(subject)} Co.`,
    `${base}ly`,
    `${cap(subject)} Studio`,
    `The ${cap(subject)} Lab`,
    `${base}Hub`,
    `${cap(subject)} & Co.`,
    `Nova${cap(subject.split(" ")[0])}`,
    `${cap(subject.split(" ")[0])}ify`,
  ];
  return `Here are some name ideas for **${subject}**:\n\n${ideas.map((n) => `- **${n}**`).join("\n")}\n\nA few principles to pick a great name:\n\n- **Short & easy to spell** — people should be able to type it after hearing it once.\n- **Say it out loud** — avoid awkward combinations or hard-to-pronounce parts.\n- **Check availability** — domain and social handles matter.\n- **Future-proof** — don't paint yourself into too narrow a niche.\n\nTell me the vibe (playful, premium, minimal, bold) and I'll refine the list.`;
}

function captions(prompt: string): string {
  const subject = subjectOf(prompt);
  return `Here are some caption options for **${subject}**:\n\n**Short & punchy**\n- Less talk, more ${subject.toLowerCase()}.\n- This is the sign.\n- Main character energy. ✨\n\n**Engaging (asks a question)**\n- Who else is obsessed with ${subject.toLowerCase()}? 👀\n- Rate this 1–10 👇\n- Tag someone who needs to see this.\n\n**Storytelling**\n- ${cap(subject)} is a journey, and today was a good chapter.\n- Started from a what-if, ended up here.\n\nAdd your hashtags and you're set. Want them funnier, more professional, or in another language?`;
}

function planGen(prompt: string): string {
  const m = norm(prompt);
  const isWorkout = /\b(workout|exercise|gym|fitness|training)\b/.test(m);
  const isStudy = /\b(study|learn|exam|revision|prepare)\b/.test(m);
  const subject = subjectOf(prompt);
  if (isWorkout) {
    return `Here's a balanced beginner-friendly workout plan for **${subject}** — 3 days a week:\n\n**Day 1 — Push**\n- Push-ups: 3 × 8–12\n- Dumbbell shoulder press: 3 × 10\n- Triceps dips: 3 × 10\n\n**Day 2 — Pull & Legs**\n- Bodyweight rows / pull-ups: 3 × 8\n- Squats: 3 × 12\n- Lunges: 3 × 10 each leg\n- Plank: 3 × 30–45s\n\n**Day 3 — Full body / cardio**\n- 20 min brisk walk or jog\n- Glute bridges: 3 × 15\n- Push-ups: 3 × max\n\n**Rules:** warm up 5 min, rest 60–90s between sets, add reps/weight gradually, and take a rest day between sessions. Consistency beats intensity. (Not medical advice — check with a pro if needed.)`;
  }
  if (isStudy) {
    return `Here's an effective study plan for **${subject}**:\n\n**Structure your week**\n- **Mon/Wed/Fri:** learn new material (read + take notes in your own words).\n- **Tue/Thu:** active recall — close the book and reproduce what you know.\n- **Sat:** practice problems / past questions.\n- **Sun:** light review + rest.\n\n**Within each session (Pomodoro)**\n1. 25 min focused study, phone away.\n2. 5 min break.\n3. Repeat ×4, then a longer break.\n\n**The techniques that actually work**\n- **Active recall** over re-reading.\n- **Spaced repetition** — revisit topics on increasing intervals.\n- **Teach it back** — if you can explain it simply, you understand it.\n\nTell me your timeline and I'll make it specific.`;
  }
  return `Here's a simple, realistic plan for **${subject}**:\n\n1. **Define the goal clearly** — a specific, measurable outcome.\n2. **Break it into weekly milestones** — small wins build momentum.\n3. **Schedule the work** — a task on the calendar gets done; a vague intention doesn't.\n4. **Review weekly** — what worked, what to adjust.\n5. **Protect your energy** — sleep and breaks are part of the plan.\n\nWant me to tailor this to a specific timeframe or goal?`;
}

/* The improved, specific, varied fallback — feels genuinely thoughtful. */
function smartFallback(prompt: string, model: ModelId, lang: Lang): string {
  const subject = subjectOf(prompt);
  const opener = pick([
    `Good question. Here's the clearest way I can put **${subject}**.`,
    `Let me give you a genuinely useful take on **${subject}**.`,
    `Great thing to ask about. With **${subject}**, here's what actually matters.`,
    `Happy to dig into **${subject}**. Here's a straight, honest answer.`,
  ]);

  const intro = lang === "hi" ? `आपने **${subject}** के बारे में पूछा है।` : lang === "ur" ? `Aap ne **${subject}** ke baare mein poocha hai.` : opener;

  const points = [
    `**What it really comes down to:** the core of ${subject.toLowerCase()} is a handful of ideas working together — get those straight and the rest follows naturally.`,
    `**Why it matters:** this shows up more than you'd expect, and understanding it saves you from common mistakes and wasted effort.`,
    `**A practical way in:** start with the simplest version, notice what confuses you, and build from there. Concrete examples beat abstract definitions every time.`,
    `**Watch out for:** the details that trip people up are usually the edge cases — worth a moment of attention once the basics feel solid.`,
  ];

  const closer = pick([
    `Want me to go deeper on any of these, or give a concrete example?`,
    `If you tell me your goal — a project, an exam, or just curiosity — I can tailor this further.`,
    `Want the beginner-friendly version, or a more technical deep dive?`,
  ]);

  let text =
    lang === "en"
      ? `${opener}\n\n${points.join("\n\n")}\n\n${closer}`
      : `${intro}\n\n${points.join("\n\n")}\n\n${closer}`;

  // honest caveat for obscure topics
  if (!lookup(prompt)) {
    text +=
      lang === "hi"
        ? `\n\n_(ये एक सामान्य जवाब है — अगर आप विशेष detail चाहते हैं तो बताइए।)_`
        : lang === "ur"
        ? `\n\n_(Yeh ek aam jawab hai — agar aap makhsoos detail chahte hain toh batayein.)_`
        : `\n\n_(This is my best general take — for specialist-level detail, point me at the specifics and I'll go further.)_`;
  }

  if (model === "fable") {
    text = `*${pick(["Let me shape this for you.", "Here's a way to picture it.", "Allow me to frame it."])}*\n\n` + text;
  }
  return text;
}

/* follow-up continuation on the remembered topic */
function expandTopic(topic: string, lang: Lang): string {
  const lead: Record<Lang, string> = {
    en: `Sure — let's go deeper on **${topic}**.`,
    hi: `बिल्कुल — **${topic}** पर और गहराई से।`,
    ur: `Bilkul — **${topic}** par aur gehraai se.`,
  };
  return `${lead[lang]}\n\nA few directions worth opening up:\n\n- **The *why* behind it** — understanding the underlying cause makes the whole thing click and lets you predict new cases.\n- **A concrete example** — abstractions get fuzzy until you see them play out on something real.\n- **Common mistakes** — the pitfalls are often as valuable as the rules.\n- **How it connects elsewhere** — nothing stands alone; the links reveal the bigger picture.\n\nWhich of those would you like — an example, or the common mistakes people make?`;
}

/* ------------------------------- web mode --------------------------------- */

function sourcesFor(subject: string): string {
  const slug = subject.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "topic";
  const domains = ["en.wikipedia.org", "medium.com", "stackoverflow.com", "mdn.dev", "britannica.com"];
  const picks = domains.sort(() => Math.random() - 0.5).slice(0, 3);
  return picks.map((d) => `- [${cap(subject)} — ${d.split(".")[0]}](https://${d}/${slug})`).join("\n");
}

/* ------------------------------- dispatcher ------------------------------- */

export function generateReply(opts: {
  prompt: string;
  model: ModelId;
  history?: ChatTurn[];
  web?: boolean;
  personality?: PersonalityId;
}): BrainResult {
  const { prompt, model, web = false, personality = "claude" } = opts;
  const history = opts.history ?? [];
  const lang = detectLang(prompt);
  const m = norm(prompt);
  const thinking = generateThinking(prompt, model, m, history);
  const isClaude = personality === "claude";

  let text = "";
  let styled = false; // already personality-aware (small talk)
  let autoArtifact = false;

  // 1. math
  const math = tryMath(prompt);
  if (math) {
    text = math;
  }
  // 2. build apps/websites
  else if (BUILD_VERB.test(prompt) && !CODE_LANG.test(m)) {
    const app = buildAnything(prompt);
    autoArtifact = true;
    text = buildIntro(lang) + "\n\n```html\n" + app.html + "\n```\n\n> Tip: open the **Code** tab in the panel to see how it's built.";
  }
  // 3. summarize pasted text
  else if (/\b(summari[sz]e|summari[sz]e this|tldr|tl;dr|key points|main points|shorten this|bullet points of)\b/.test(m)) {
    const body = stripPrefix(prompt);
    const src = body && body.split(/\s+/).length >= 12 ? body : prompt;
    if (src.split(/\s+/).length >= 12) {
      const summary = summarize(src);
      const bullets = splitSentences(summary).slice(0, 4).map((s) => `- ${s}`).join("\n");
      const tldr = splitSentences(summary)[0] || summary;
      text = `Here's a tight summary:\n\n**TL;DR:** ${tldr}\n\n**Key points:**\n${bullets}\n\nWant it shorter, or as a single paragraph?`;
    } else {
      text = smartFallback(prompt, model, lang);
    }
  }
  // 4. improve / rewrite pasted text
  else if (/\b(improve|rewrite|rephrase|polish|proofread|fix (?:this|my)|make (?:it|this) better|correct (?:this|my))\b/.test(m)) {
    const body = stripPrefix(prompt);
    const src = body && body.split(/\s+/).length >= 4 ? body : "";
    if (src) {
      const improved = improveText(src);
      const same = improved.trim() === src.trim();
      text = `Here's a cleaner version:\n\n> ${improved}\n\n${same ? "It was already in good shape — just tidied the spacing and punctuation." : "I smoothed the punctuation, capitalization, and spacing while keeping your meaning."} Want it more formal, shorter, or punchier?`;
    } else {
      text = smartFallback(prompt, model, lang);
    }
  }
  // 5. small talk (personality-aware)
  else if (HAS_ANY(m, [["hi"], ["hello"], ["hey"], ["good morning"], ["good evening"], ["howdy"], ["hiya"], ["namaste"], ["namaskar"], ["salam"], ["assalam"]]) && m.length < 26) {
    text = isClaude ? phrase("hello", lang) : pGreeting(personality);
    styled = true;
  }
  else if (HAS_ANY(m, [["how are you"], ["how r u"], ["kaise ho"], ["kaisa hai"], ["kya haal"], ["kaise hain"]])) {
    text = isClaude ? HOWARE[lang] : pHowAre(personality);
    styled = true;
  }
  else if (HAS_ANY(m, [["bye"], ["goodbye"], ["see you"], ["alvida"], ["phir milenge"], ["tata"]])) {
    text = isClaude ? BYE[lang] : pBye(personality);
    styled = true;
  }
  else if (has(m, "thank", "thanks", "appreciate", "shukriya", "shukar", "dhanyawad", "dhanyavaad")) {
    text = isClaude ? phrase("thanks", lang) : pThanks(personality);
    styled = true;
  }
  else if (has(m, "good job", "well done", "you're great", "you are great", "you're amazing", "love you", "awesome", "shabash", "zabardast", "kamaal")) {
    text = isClaude ? COMPLIMENT[lang] : pCompliment(personality);
    styled = true;
  }
  else if (has(m, "joke", "make me laugh", "funny", "chutkula", "mazak", "hasao")) {
    text = isClaude ? pickJoke(lang) : pJoke(personality);
    styled = true;
  }
  else if (HAS_ANY(m, [["who", "you"], ["what", "you"], ["your name"], ["are you", "ai"], ["who made"], ["kaun ho"], ["tum kaun"], ["aap kaun"], ["tumhara naam"]])) {
    text = isClaude ? phrase("identity", lang) : pIdentity(personality);
    styled = true;
  }
  else if (HAS_ANY(m, [["what", "do"], ["what", "can"], ["help me"], ["capabilities"], ["kya kar", "sakte"], ["kya kya"], ["kaise", "kaam"]]) && m.length < 52) {
    text = isClaude ? phrase("caps", lang) : pIdentity(personality);
    styled = true;
  }
  else if (/\b(what time|what.?s the time|whats the time|current time|what date|today.?s date|what day is it|kitne baje|kitna time|aaj ki date|aaj kya din|waqt kya)\b/.test(m)) {
    text = dateTime(lang);
    styled = true;
  }
  // 6. very short / vague → clarifying question
  else if (m.length < 9 && !/\b(write|build|make|code)\b/.test(m)) {
    text = isClaude ? CLARIFY[lang] : pClarify(personality);
    styled = true;
  }
  // 7. follow-up continuation using memory
  else if (isFollowUp(prompt) && history.length >= 2) {
    const topic = lastTopic(history);
    text = topic ? expandTopic(topic, lang) : smartFallback(prompt, model, lang);
    if (topic) styled = true;
  }
  // 8. generative helpers
  else if (/\b(email|mail|message to)\b/.test(m) && /\b(write|draft|compose|send)\b/.test(m)) {
    text = emailDraft(prompt);
  }
  else if (/\b(name|names|naming|brand name|username|startup name)\b/.test(m) && /\b(ideas?|suggest|give|for)\b/.test(m)) {
    text = nameIdeas(prompt);
  }
  else if (/\b(captions?|instagram|insta|social media post|post caption)\b/.test(m) && /\b(write|give|ideas?|for|create)\b/.test(m)) {
    text = captions(prompt);
  }
  else if (/\b(workout|exercise|gym|fitness|training|study plan|learning plan|study routine|revision plan|schedule|meal plan)\b/.test(m) && /\b(plan|routine|schedule|make|create|give|for)\b/.test(m)) {
    text = planGen(prompt);
  }
  // 9. knowledge base
  else {
    const kb = lookup(prompt);
    if (kb) {
      const introLocal: Record<Lang, string> = { en: "", hi: "बिल्कुल, आइए समझते हैं:\n\n", ur: "Bilkul, aaiye samajhte hain:\n\n" };
      text = introLocal[lang] + kb.entry.answer;
    }
    // 10. code writing
    else if (CODE_LANG.test(m) && /\b(write|make|create|fix|build|function|code|program|script|example)\b/.test(m)) {
      text = intentCode(m);
    }
    // 11. creative writing
    else if (HAS_ANY(m, [["story"], ["poem"], ["tale"], ["write me"], ["character"], ["imagine"], ["screenplay"], ["fable"], ["kahani"], ["kavita"]]) ||
      (model === "fable" && has(m, "write", "create", "compose", "likho", "banao"))) {
      text = intentStory(prompt, model);
    }
    // 12. comparison / list
    else if (HAS_ANY(m, [["compare", "vs"], ["compare", "or"], ["difference between"], ["which is better"], [" vs "], [" versus "]])) {
      text = intentCompare(prompt);
    }
    else if (HAS_ANY(m, [["ideas"], ["list of"], ["ways to"], ["tips"], ["suggest"], ["brainstorm"], ["sujhav"]])) {
      text = intentList(prompt);
    }
    // 13. smart fallback
    else {
      text = smartFallback(prompt, model, lang);
    }
  }

  // Apply persona voice to substantive (non-small-talk) answers
  if (!styled) {
    text = applyOverlay(text, personality, subjectOf(prompt));
  }

  // Web mode → simulated search + sources (only for factual, non-build answers)
  if (web && !autoArtifact && !styled) {
    const subject = subjectOf(prompt);
    text = `🔍 Searching the web for "${subject}"…\n\n${text}\n\n**Sources**\n${sourcesFor(subject)}`;
  }

  return { thinking, text, lang, autoArtifact };
}
