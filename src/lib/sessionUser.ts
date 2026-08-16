// Session cookie se userId nikalne ka ek hi jagah wala tareeqa.
//
// ⚠ YAHAN EK KHAMOSH BUG THA:
// sessions.token column me token ka SHA-256 HASH mehfooz hota hai
// (dekho auth.ts -> hashToken()). Purana code cookie ka RAW token seedha
// column se compare karta tha:
//     .where(eq(sessions.token, token))     // <- kabhi match nahi hota
// Nateeja: /api/state HAR request par 401 "Not logged in" deta tha, chahe
// user bilkul theek login ho. Isi liye Neon ki user_state table me 0 rows
// thin — save kabhi hua hi nahi.
//
// /api/auth/me theek chal raha tha kyunke wo validateSession() use karta
// hai jo hash karta hai. Bas ye helper reh gaya tha.

import { db } from "@/db";
import { sessions } from "@/db/schema";
import { and, eq, gte } from "drizzle-orm";
import { hashToken, getSessionTokenFromRequest } from "@/lib/auth";

/**
 * Request ki session cookie se userId nikalo.
 * Logged-out user, DB na hone, expired session, ya ghalat token par `null`.
 */
export async function getSessionUserId(req: Request): Promise<number | null> {
  if (!db) return null;
  const token = getSessionTokenFromRequest(req);
  if (!token) return null;
  try {
    const sess = await db
      .select({ userId: sessions.userId })
      .from(sessions)
      .where(
        and(
          // hash kar ke compare karo — column me hash hi para hai
          eq(sessions.token, hashToken(token)),
          // expire shuda session ko qubool mat karo
          gte(sessions.expiresAt, new Date()),
        ),
      )
      .limit(1);
    return sess[0]?.userId ?? null;
  } catch {
    return null;
  }
}
