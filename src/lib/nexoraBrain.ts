// ═══════════════════════════════════════════════════════════════════════
// NEXORA BRAIN — apni yaadasht jo waqt ke sath barhti hai
//
// SAWAL THA: "kya apna Nexora model in ke sath train ho sakta hai, taake
// aage chal kar ye sab AI hata dein aur kisi ki zaroorat na parhe?"
//
// SEEDHA JAWAB: model TRAIN nahi ho sakta. API se sirf text milta hai,
// model ke weights nahi — un se seekhna waisa hi hai jaise kisi ki kitab
// parh kar us ka dimagh copy karna. Aur 8GB RAM par 7B model train karna
// mumkin hi nahi ($50-100M aur 10,000 GPU ka kaam hai).
//
// MAGAR ASAL MAQSAD HO SAKTA HAI. Aap ko "apna model" nahi chahiye —
// aap ko chahiye ke Nexora ke paas itni knowledge ho ke bar bar bahar
// na poochna parhe. Wo TRAINING se nahi, YAADASHT se hota hai.
//
// Ye file wohi hai: har achha jawab hamesha ke liye mehfooz ho jata hai.
// Agli baar wohi sawal aaye to jawab Nexora ke apne brain se aata hai —
// 0ms, koi API call nahi, koi rate limit nahi, internet band ho to bhi
// chalta hai. Jitna istemal, utni khud-mukhtari.
//
// Ye asal me wohi tareeqa hai jo bare AI systems "caching + retrieval"
// keh kar istemal karte hain. Farq sirf itna ke yahan ye AAP ka data hai.
// ═══════════════════════════════════════════════════════════════════════

import { db } from "@/db";
import { memories } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export interface BrainHit {
  answer: string;
  question: string;
  score: number;
  /** kitni dafa kaam aaya */
  hits: number;
  savedAt: string;
  source: string;
}

/** DB me ek hi text column hai, is liye structured data JSON me jata hai.
 *  Naya table banane se purana data toot'ta, aur migration user ko khud
 *  chalani parti — jo wo nahi kar sakte. Isi liye JSON-in-text. */
interface Stored {
  v: 1;
  q: string;
  a: string;
  src: string;
  at: string;
  hits: number;
  /** normalize kiye hue keywords — search isi par chalti hai */
  kw: string[];
}

const STOP = new Set([
  "the", "a", "an", "is", "are", "was", "were", "be", "been", "being", "and",
  "or", "but", "if", "then", "than", "so", "of", "to", "in", "on", "at", "by",
  "for", "with", "about", "from", "as", "it", "its", "this", "that", "these",
  "those", "i", "you", "he", "she", "we", "they", "me", "my", "your", "how",
  "what", "why", "when", "where", "which", "who", "can", "could", "would",
  "should", "do", "does", "did", "will", "shall", "may", "might", "must",
  "have", "has", "had", "get", "got", "make", "made", "please", "kya", "hai",
  "hey", "ka", "ki", "ke", "ko", "me", "mein", "se", "kaise", "karo", "karna",
]);

export function keywords(text: string): string[] {
  return [
    ...new Set(
      text
        .toLowerCase()
        .replace(/[^a-z0-9\s+#.-]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 1 && w.length < 30 && !STOP.has(w)),
    ),
  ].slice(0, 40);
}

function parse(raw: string): Stored | null {
  try {
    const o = JSON.parse(raw) as Stored;
    return o?.v === 1 && o.q && o.a ? o : null;
  } catch {
    return null;
  }
}

/**
 * Jawab qabil-e-yaad hai ya nahi.
 *
 * Har cheez save karna brain ko kachra bana deta hai: "hi", "thanks",
 * ya wo jawab jo model khud kehta hai "mujhe nahi pata". Sirf wo bachao
 * jo waqai kisi kaam ka hai.
 */
export function worthSaving(question: string, answer: string): boolean {
  const q = question.trim();
  const a = answer.trim();
  if (q.length < 12 || a.length < 200) return false;
  // Model ka inkar ya maazrat — ye yaad rakhne layak nahi.
  if (/^(i (don'?t|do not|cannot|can'?t)|sorry|as an ai|i'?m not able)/i.test(a)) return false;
  // Waqt ke sath badalne wali cheezein: aaj ka jawab kal ghalat hoga.
  if (/\b(today|right now|current price|latest version|abhi|aaj)\b/i.test(q)) return false;
  return true;
}

/** Jawab ko hamesha ke liye mehfooz karo. */
export async function remember(
  userId: number,
  question: string,
  answer: string,
  source: string,
): Promise<boolean> {
  if (!worthSaving(question, answer)) return false;
  const rec: Stored = {
    v: 1,
    q: question.slice(0, 500),
    a: answer.slice(0, 20000),
    src: source,
    at: new Date().toISOString(),
    hits: 0,
    kw: keywords(question),
  };
  if (!db) return false;
  try {
    await db.insert(memories).values({ userId, content: JSON.stringify(rec) });
    return true;
  } catch {
    return false;
  }
}

/**
 * Brain se jawab dhoondo.
 *
 * Scoring: keyword overlap + poore jumle ka match. Threshold jaan bujh
 * kar ooncha (0.55) rakha hai — ghalat yaad-dasht se jawab dena bilkul
 * na jawab dene se bura hai. Shak ho to null, aur model chal jayega.
 */
export async function recall(
  userId: number,
  question: string,
  minScore = 0.55,
): Promise<BrainHit | null> {
  const qk = keywords(question);
  if (!qk.length) return null;
  const qSet = new Set(qk);
  const qNorm = question.toLowerCase().trim();

  if (!db) return null;
  let rows: { id: number; content: string }[];
  try {
    rows = await db
      .select({ id: memories.id, content: memories.content })
      .from(memories)
      .where(eq(memories.userId, userId))
      .orderBy(desc(memories.createdAt))
      .limit(500);
  } catch {
    return null;
  }

  let best: { rec: Stored; score: number } | null = null;

  for (const r of rows) {
    const rec = parse(r.content);
    if (!rec) continue;

    // Bilkul wohi sawal — foran jeet.
    if (rec.q.toLowerCase().trim() === qNorm) {
      best = { rec, score: 1 };
      break;
    }

    const inter = rec.kw.filter((k) => qSet.has(k)).length;
    if (!inter) continue;
    // Jaccard-ish: dono taraf ke keywords ginti me — warna lamba
    // mehfooz sawal har chhote sawal se match kar jata.
    const score = inter / Math.max(qk.length, Math.min(rec.kw.length, qk.length * 2));
    if (!best || score > best.score) best = { rec, score };
  }

  if (!best || best.score < minScore) return null;

  return {
    answer: best.rec.a,
    question: best.rec.q,
    score: Math.round(best.score * 100) / 100,
    hits: best.rec.hits,
    savedAt: best.rec.at,
    source: best.rec.src,
  };
}

/** Brain kitna bara hai — UI ke liye. */
export async function brainStats(userId: number): Promise<{ count: number; chars: number; oldest: string | null }> {
  if (!db) return { count: 0, chars: 0, oldest: null };
  try {
    const rows = await db
      .select({ content: memories.content })
      .from(memories)
      .where(eq(memories.userId, userId));
    let chars = 0;
    let oldest: string | null = null;
    let n = 0;
    for (const r of rows) {
      const rec = parse(r.content);
      if (!rec) continue;
      n++;
      chars += rec.a.length;
      if (!oldest || rec.at < oldest) oldest = rec.at;
    }
    return { count: n, chars, oldest };
  } catch {
    return { count: 0, chars: 0, oldest: null };
  }
}
