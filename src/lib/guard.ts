// ═══════════════════════════════════════════════════════════════════
// NEXORA — API GUARD (auth gate + guest rate limit + origin-aware CORS)
//
// PICHLA MASLA: /api/chat, /api/think, /api/agents, /api/execute —
// kisi me bhi auth check nahi tha, aur sab `Access-Control-Allow-Origin:
// *` bhejte the. Matlab koi bhi website visitor ke browser se aapki
// server-side Gemini/Groq keys ka quota jala sakti thi, bina login ke.
//
// AB:
//   1. guardApi() — logged-in user hai to plan/usage limits wahi
//      enforcement (accessControl.ts). Guest (anonymous) requests ko
//      per-IP window limit milti hai.
//   2. corsHeaders() — CORS sirf app ke apne origins ko milta hai.
//      Same-origin requests par CORS ka koi asar nahi hota (wo hamesha
//      chalti hain), is liye ye sirf cross-origin browser abuse band
//      karta hai — app ki functionality nahi tooti.
// ═══════════════════════════════════════════════════════════════════

import { getUser } from "./accessControl";
import { getClientInfo } from "./auth";

// ── Guest (anonymous) rate limit ────────────────────────────────────
// Serverless par ye per-instance memory hai — perfect nahi, magar CORS
// band hone ke sath scripted abuse practically rok deti hai.
const ANON_LIMIT = 25;
const ANON_WINDOW_MS = 10 * 60 * 1000;
const anonHits = new Map<string, number[]>();

export type GuardResult =
  | { ok: true; user: Awaited<ReturnType<typeof getUser>>; anon: boolean }
  | { ok: false; status: number; error: string };

/**
 * Har AI endpoint ke shuru me bulao.
 *
 * @param opts.allowAnon  false = sirf logged-in users (e.g. /api/execute).
 */
export async function guardApi(
  req: Request,
  opts: { allowAnon?: boolean } = {}
): Promise<GuardResult> {
  const user = await getUser(req).catch(() => null);
  if (user) return { ok: true, user, anon: false };

  const allowAnon = opts.allowAnon ?? true;
  if (!allowAnon) return { ok: false, status: 401, error: "Login required" };

  const ip = getClientInfo(req).ip || "unknown";
  const now = Date.now();
  const hits = (anonHits.get(ip) || []).filter((t) => now - t < ANON_WINDOW_MS);
  if (hits.length >= ANON_LIMIT) {
    return { ok: false, status: 429, error: "Too many guest requests. Please login to continue." };
  }
  hits.push(now);
  anonHits.set(ip, hits);
  return { ok: true, user: null, anon: true };
}

// ── Origin-aware CORS ───────────────────────────────────────────────
function isAllowedOrigin(o: string): boolean {
  if (o === "http://localhost:3000" || o === "http://127.0.0.1:3000") return true;
  if (process.env.APP_URL && o === process.env.APP_URL) return true;
  if (process.env.VERCEL_URL && o === `https://${process.env.VERCEL_URL}`) return true;
  try {
    const host = new URL(o).hostname;
    // Vercel preview branches aur sandbox preview proxy
    if (host.endsWith(".vercel.app")) return true;
    if (host.endsWith(".e2b.app")) return true;
  } catch {}
  return false;
}

/** `*` ki jagah — sirf app ke origins ko CORS. */
export function corsHeaders(req?: Request): Record<string, string> {
  const origin = req?.headers.get("origin");
  if (origin && isAllowedOrigin(origin)) {
    return {
      "Access-Control-Allow-Origin": origin,
      Vary: "Origin",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-internal-secret",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    };
  }
  return {};
}
