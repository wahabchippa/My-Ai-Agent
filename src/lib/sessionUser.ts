// Session cookie se userId nikalne ka ek hi jagah wala tareeqa.
//
// Ye logic pehle /api/state/route.ts ke andar copy-paste tha. Jab memories
// table me userId add hui to yehi cheez /api/chat me bhi chahiye thi —
// dobara copy karne ke bajaye yahan nikal di, taake session cookie ka naam
// ya table ki shakl badle to sirf EK jagah badalni pare.

import { db } from "@/db";
import { sessions } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Request ki session cookie se userId nikalo.
 * Logged-out user, DB na hone, ya ghalat token par `null`.
 */
export async function getSessionUserId(req: Request): Promise<number | null> {
  if (!db) return null;
  const token = req.headers.get("cookie")?.match(/nexora_session=([^;]+)/)?.[1];
  if (!token) return null;
  try {
    const sess = await db
      .select({ userId: sessions.userId })
      .from(sessions)
      .where(eq(sessions.token, token))
      .limit(1);
    return sess[0]?.userId ?? null;
  } catch {
    return null;
  }
}
