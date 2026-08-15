// ═══════════════════════════════════════════════════════════════════
// NEXORA API KEYS — central, safe access
//
// Keys are read from environment variables (server-side only). They are
// NEVER hardcoded in source, so they never end up in the git repository.
// In production (Vercel) set these in: Settings → Environment Variables.
//
//   GROQ_API_KEY, BAZAARLINK_API_KEY, AIRFORCE_API_KEY,
//   OPENROUTER_API_KEY, CEREBRAS_API_KEY, GEMINI_API_KEY
// ═══════════════════════════════════════════════════════════════════

export function getKeys() {
  return {
    groq: process.env.GROQ_API_KEY || "",
    bazaarlink: process.env.BAZAARLINK_API_KEY || "",
    airforce: process.env.AIRFORCE_API_KEY || "",
    openrouter: process.env.OPENROUTER_API_KEY || "",
    cerebras: process.env.CEREBRAS_API_KEY || "",
    gemini: process.env.GEMINI_API_KEY || "",
  };
}

export const GROQ_KEY = () => process.env.GROQ_API_KEY || "";
export const BAZAARLINK_KEY = () => process.env.BAZAARLINK_API_KEY || "";
export const AIRFORCE_KEY = () => process.env.AIRFORCE_API_KEY || "";
export const OPENROUTER_KEY = () => process.env.OPENROUTER_API_KEY || "";
