// Long-term memory for Nexora — stores facts the user shares and retrieves
// them so the AI "remembers" across conversations. Uses PostgreSQL (Drizzle).
// If no DB is configured, all functions no-op gracefully.

import { db } from "@/db";
import { memories } from "@/db/schema";
import { and, desc, eq, like } from "drizzle-orm";

/**
 * Ek user ki memories laao (aur jo query se milti hon).
 *
 * ⚠ userId ab LAZMI hai. Pehle ye argument tha hi nahi aur query bina filter
 * ke chalti thi — har user ko sab ki memories milti thin.
 */
export async function recallMemories(userId: number, query?: string): Promise<string[]> {
  if (!db || !userId) return [];
  try {
    const rows = await db
      .select({ content: memories.content })
      .from(memories)
      .where(eq(memories.userId, userId))
      .orderBy(desc(memories.createdAt))
      .limit(15);
    let items = rows.map((r) => r.content);
    // keyword match — ye bhi usi user tak mehdood
    if (query && db) {
      const matched = await db
        .select({ content: memories.content })
        .from(memories)
        .where(and(eq(memories.userId, userId), like(memories.content, `%${query.slice(0, 40)}%`)))
        .limit(5);
      items = [...matched.map((r) => r.content), ...items];
    }
    return [...new Set(items)];
  } catch {
    return [];
  }
}

/** Ek fact us user ki long-term memory me daalo. */
export async function rememberFact(userId: number, fact: string): Promise<boolean> {
  if (!db || !userId || !fact.trim()) return false;
  try {
    await db.insert(memories).values({ userId, content: fact.trim() });
    return true;
  } catch {
    return false;
  }
}

/**
 * Sirf IS user ki memory mitao.
 *
 * ⚠ Pehle ye `db.delete(memories)` tha — bina WHERE ke. Yani koi bhi user
 * "forget everything" likhta to POORE system ki, har user ki memory ud jati.
 */
export async function clearAllMemory(userId: number): Promise<boolean> {
  if (!db || !userId) return false;
  try {
    await db.delete(memories).where(eq(memories.userId, userId));
    return true;
  } catch {
    return false;
  }
}

/**
 * Heuristic: should the user's message be remembered, and what fact?
 * Detects phrases like "remember that...", "my name is...", "mera naam...", etc.
 * Returns the fact to store, or null.
 */
export function extractFact(message: string): string | null {
  const m = message.trim();
  // clear/forget
  if (/\b(forget|clear|delete)\b.*(memory|everything|all|sab|yaad)/i.test(m))
    return "__CLEAR__";
  // explicit "remember that X" / "yaad rakh X"
  const explicit = m.match(/(?:remember(?:\s+that)?|yaad\s+rakh[a-z]*|memorize)\s*:?\s*(.+)/i);
  if (explicit) return explicit[1].trim();
  // "my name is X" / "mera naam X hai"
  const name = m.match(/(?:my name is|i am called|i'm called|mera naam|mera naam|mera naam)\s+([a-z\u0600-\u06FF][\w\s]{1,30})/i);
  if (name) return `User's name is ${name[1].trim()}`;
  // "I like/prefer X"
  const pref = m.match(/(?:i (?:like|love|prefer|work as|live in)|mujhe .+ pasand hai|main .+ rehta|main .+ karta)\s+(.+)/i);
  if (pref) return `User: ${pref[0].trim()}`;
  return null;
}
