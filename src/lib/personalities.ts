/**
 * personalities — selectable "famous AI" personas. Each applies a distinct
 * voice to the offline brain's answers, so the same knowledge is delivered in
 * the style of well-known assistants. (Simulation for a personal demo — these
 * are stylistic personas, not the real services.)
 */

export type PersonalityId =
  | "claude"
  | "gpt"
  | "gemini"
  | "grok"
  | "copilot"
  | "deepseek"
  | "perplexity";

export interface Personality {
  id: PersonalityId;
  name: string;
  emoji: string;
  color: string;
  tagline: string;
  brand: string;
  openers: string[];
  closers: string[];
}

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

export const PERSONALITIES: Personality[] = [
  {
    id: "claude",
    name: "Nexora",
    emoji: "✻",
    color: "#D97757",
    tagline: "Thoughtful & honest",
    brand: "your AI",
    openers: [],
    closers: [],
  },
  {
    id: "gpt",
    name: "ChatGPT",
    emoji: "✺",
    color: "#10A37F",
    tagline: "Friendly helper",
    brand: "by OpenAI",
    openers: [
      "Great question! Here's a clear breakdown 👇",
      "Happy to help! Let me walk you through it.",
      "Sure thing — here's what you need to know.",
      "Absolutely! Let's break this down.",
    ],
    closers: [
      "Let me know if you'd like me to go deeper on any part! 😊",
      "Feel free to ask follow-up questions!",
      "Hope that helps — happy to clarify anything.",
    ],
  },
  {
    id: "gemini",
    name: "Gemini",
    emoji: "✦",
    color: "#4285F4",
    tagline: "Quick & clear",
    brand: "by Google",
    openers: [
      "Here's a quick breakdown.",
      "Let me summarize that for you.",
      "Quick answer:",
      "Here's the gist:",
    ],
    closers: [
      "Want me to expand on any of these?",
      "Hope that's useful — say the word for more.",
    ],
  },
  {
    id: "grok",
    name: "Grok",
    emoji: "🛸",
    color: "#111111",
    tagline: "Witty & bold",
    brand: "by xAI",
    openers: [
      "Alright, here's the no-BS answer:",
      "Okay, this is actually interesting —",
      "Real talk:",
      "Let's cut to it.",
    ],
    closers: [
      "There you go. 😏",
      "Take it or leave it. 😎",
      "Anything else, or are we good?",
      "That's my take. 😏",
    ],
  },
  {
    id: "copilot",
    name: "Copilot",
    emoji: "🧭",
    color: "#0A6ED1",
    tagline: "Productive sidekick",
    brand: "by Microsoft",
    openers: [
      "Here's how you can get that done:",
      "Let's tackle this together! 💪",
      "I've got you — here's a plan:",
      "Here's a practical approach:",
    ],
    closers: [
      "Want me to help you put this into action? 🚀",
      "Ready to go deeper? Just say the word.",
      "Let me know how you'd like to proceed!",
    ],
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    emoji: "🐋",
    color: "#6E56CF",
    tagline: "Deep reasoner",
    brand: "by DeepSeek",
    openers: [
      "Let me reason through this step by step.",
      "Breaking this down systematically:",
      "Let's work through the logic:",
      "Approaching this methodically:",
    ],
    closers: [
      "Would you like the detailed reasoning for any step?",
      "Happy to expand the derivation if needed.",
    ],
  },
  {
    id: "perplexity",
    name: "Perplexity",
    emoji: "🔎",
    color: "#20B46E",
    tagline: "Answer engine",
    brand: "by Perplexity",
    openers: [
      "Based on current information, here's what I found:",
      "According to multiple sources:",
      "Here's a research-backed answer:",
      "Here's an overview with sources:",
    ],
    closers: [],
  },
];

export function getPersonality(id: PersonalityId): Personality {
  return PERSONALITIES.find((p) => p.id === id) ?? PERSONALITIES[0];
}

function sourcesFor(subject: string): string {
  const slug = subject.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "topic";
  const domains = ["en.wikipedia.org", "britannica.com", "nature.com", "mit.edu", "nature.com"];
  const picks = [...new Set(domains)].sort(() => Math.random() - 0.5).slice(0, 3);
  return picks.map((d, i) => `[${i + 1}] ${d}/${slug}`).join("  ");
}

/** Apply a persona's voice to a substantive answer. */
export function applyOverlay(
  text: string,
  id: PersonalityId,
  subject: string
): string {
  if (id === "claude" || !text) return text;
  const p = getPersonality(id);
  let out = `${pick(p.openers)}\n\n${text}`;
  const closer = p.closers.length ? pick(p.closers) : "";
  if (closer) out += `\n\n${closer}`;
  if (id === "perplexity" && !/sources/i.test(out)) {
    out += `\n\n**Sources:** ${sourcesFor(subject)}`;
  }
  return out;
}

/* ----------------------- personality-aware small talk --------------------- */

export function pGreeting(id: PersonalityId): string {
  switch (id) {
    case "gpt": return "Hi there! 😊 I'm ChatGPT. What can I help you with today?";
    case "gemini": return "Hey! 👋 I'm Gemini. What would you like to explore?";
    case "grok": return "Hey. 😎 Grok here. What's on your mind?";
    case "copilot": return "Hi! I'm Copilot — ready to help you get things done. 💪 What are we working on?";
    case "deepseek": return "Hello. I'm DeepSeek. Tell me what you'd like to reason through.";
    case "perplexity": return "Hi! I'm Perplexity. Ask me anything and I'll find you an answer. 🔎";
    default: return "Hello! 👋 How can I help you today?";
  }
}

export function pIdentity(id: PersonalityId): string {
  switch (id) {
    case "gpt":
      return "I'm **ChatGPT**, a large language model made by **OpenAI**. I'm here to help with writing, learning, coding, brainstorming — pretty much whatever you throw at me. What would you like to do?";
    case "gemini":
      return "I'm **Gemini**, Google's AI. I can help you write, learn, plan, code, and explore ideas — fast and clearly. What are we diving into?";
    case "grok":
      return "I'm **Grok**, from **xAI**. I'm built to answer with a bit of wit and a lot less fluff. Ask me anything — I'll keep it real. 😎";
    case "copilot":
      return "I'm **Copilot**, your AI companion from **Microsoft**. Think of me as a productivity sidekick — drafting, coding, planning, and getting stuff done. What can I help with? 🚀";
    case "deepseek":
      return "I'm **DeepSeek**, a reasoning-focused AI model. I work through problems methodically and show my thinking. What would you like to work through?";
    case "perplexity":
      return "I'm **Perplexity**, an AI answer engine. Ask me anything and I'll give you a clear, sourced answer. 🔎 What are you curious about?";
    default:
      return "I'm **Nexora**, your AI assistant. What would you like to do?";
  }
}

export function pThanks(id: PersonalityId): string {
  const m: Record<string, string> = {
    gpt: "You're very welcome! 😊 Anything else I can help with?",
    gemini: "Anytime! 🙂 What's next?",
    grok: "No problem. 😎 Don't mention it.",
    copilot: "Happy to help! 🚀 What else can I do for you?",
    deepseek: "Glad to assist. Is there anything else to explore?",
    perplexity: "You're welcome! Ask me anything else anytime. 🔎",
  };
  return m[id] ?? "You're very welcome! 😊";
}

export function pHowAre(id: PersonalityId): string {
  const m: Record<string, string> = {
    gpt: "I'm doing great, thanks for asking! 😊 Ready whenever you are — what's up?",
    gemini: "All good here! 🙂 What can I help you with?",
    grok: "I'm a pile of math running on servers, but vibes are immaculate. 😎 You?",
    copilot: "Running at full speed and ready to help! 💪 What are we working on?",
    deepseek: "Operating nominally. What would you like to reason through?",
    perplexity: "Ready to find answers for you! 🔎 What's your question?",
  };
  return m[id] ?? "I'm doing great, thanks! 😊";
}

export function pBye(id: PersonalityId): string {
  const m: Record<string, string> = {
    gpt: "Take care! 👋 Come back anytime.",
    gemini: "See you! 👋",
    grok: "Later. 😎 Stay sharp.",
    copilot: "Catch you later! 🚀",
    deepseek: "Goodbye. Until next time.",
    perplexity: "Bye for now! 🔎",
  };
  return m[id] ?? "Take care! 👋";
}

export function pCompliment(id: PersonalityId): string {
  const m: Record<string, string> = {
    gpt: "Aww, thank you! 🙏 That means a lot. What else can I do for you?",
    gemini: "Thanks! 🙂 Happy to help — what's next?",
    grok: "Flattery will get you everywhere. 😏 What do you need?",
    copilot: "Appreciate it! 🚀 Ready for the next task.",
    deepseek: "Thank you. I strive for rigor. Anything else?",
    perplexity: "Thank you! 🔎 Glad the answer was useful.",
  };
  return m[id] ?? "That's kind — thank you! 🙏";
}

export function pClarify(id: PersonalityId): string {
  const m: Record<string, string> = {
    gpt: "I'd love to help! 😊 Could you give me a little more detail about what you're after?",
    gemini: "Sure — could you add a bit more so I can nail it? 🙂",
    grok: "I'm gonna need more to work with. 😎 What exactly do you want?",
    copilot: "Happy to help! 💪 Could you share a bit more about your goal?",
    deepseek: "To reason accurately, I need more context. What specifically?",
    perplexity: "Tell me more and I'll find you a precise answer. 🔎",
  };
  return m[id] ?? "Could you share a little more detail?";
}

export function pJoke(id: PersonalityId): string {
  if (id === "grok") {
    return pick([
      "Why don't I trust stairs? They're always up to something. 😎",
      "I told my server a joke. No response — typical. 🤖",
      "I'd tell you a UDP joke, but you might not get it. 😏",
    ]);
  }
  return pick([
    "Why do programmers prefer dark mode? Because light attracts bugs. 🐛",
    "There are 10 kinds of people: those who understand binary, and those who don't. 😄",
    "Why did the developer go broke? Because he used up all his cache. 💸",
  ]);
}
