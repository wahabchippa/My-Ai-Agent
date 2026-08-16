// ═══════════════════════════════════════════════════════════════════════
// /api/brain — Nexora ki yaadasht dekho aur qaabu karo
//
// Brain khamoshi se seekhta rehta hai, magar user ko dikhna chahiye ke
// us me kya hai. Warna wo ek "jadoo ka dabba" hai jis par bharosa nahi
// kiya ja sakta — aur agar koi ghalat jawab yaad ho jaye to usay mitane
// ka koi raasta bhi hona chahiye.
// ═══════════════════════════════════════════════════════════════════════

import { NextRequest } from "next/server";
import { db } from "@/db";
import { memories } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getSessionUserId } from "@/lib/sessionUser";
import { brainStats } from "@/lib/nexoraBrain";

interface Stored {
  v: 1;
  q: string;
  a: string;
  src: string;
  at: string;
  hits: number;
}

export async function GET(req: NextRequest) {
  const userId = await getSessionUserId(req);
  if (!userId) return Response.json({ ok: false, error: "not-logged-in" }, { status: 401 });
  if (!db) return Response.json({ ok: true, stats: { count: 0, chars: 0, oldest: null }, items: [] });

  const stats = await brainStats(userId);

  const rows = await db
    .select({ id: memories.id, content: memories.content, createdAt: memories.createdAt })
    .from(memories)
    .where(eq(memories.userId, userId))
    .orderBy(desc(memories.createdAt))
    .limit(100);

  const items = rows
    .map((r) => {
      try {
        const p = JSON.parse(r.content) as Stored;
        if (p?.v !== 1) return null;
        return {
          id: r.id,
          question: p.q,
          // Poora jawab bhejna bekaar hai — list me sirf jhalak chahiye.
          preview: p.a.slice(0, 200),
          chars: p.a.length,
          source: p.src,
          at: p.at,
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  return Response.json({ ok: true, stats, items });
}

/** Ek yaad mitao (ghalat jawab), ya poora brain saaf karo. */
export async function DELETE(req: NextRequest) {
  const userId = await getSessionUserId(req);
  if (!userId) return Response.json({ ok: false, error: "not-logged-in" }, { status: 401 });
  if (!db) return Response.json({ ok: false, error: "no-db" }, { status: 503 });

  const id = new URL(req.url).searchParams.get("id");

  if (id === "all") {
    await db.delete(memories).where(eq(memories.userId, userId));
    return Response.json({ ok: true, cleared: "all" });
  }

  const n = Number(id);
  if (!Number.isFinite(n)) return Response.json({ ok: false, error: "bad-id" }, { status: 400 });

  // userId ki shart lazmi — warna koi bhi kisi ki bhi yaad mita sakta hai.
  await db.delete(memories).where(and(eq(memories.id, n), eq(memories.userId, userId)));
  return Response.json({ ok: true, deleted: n });
}
