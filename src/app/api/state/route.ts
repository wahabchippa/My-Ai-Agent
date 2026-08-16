// /api/state — per-user private state (conversations + settings).
// Each user only sees their own data. Session cookie identifies the user.

import { NextResponse } from "next/server";
import { db } from "@/db";
import { userState } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSessionUserId as getUserId } from "@/lib/sessionUser";

export const dynamic = "force-dynamic";

// GET — load the user's saved state
export async function GET(req: Request) {
  const userId = await getUserId(req);
  if (!userId)
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  if (!db) return NextResponse.json({ error: "No DB" }, { status: 500 });

  const rows = await db
    .select({ data: userState.data })
    .from(userState)
    .where(eq(userState.userId, userId))
    .limit(1);

  if (!rows.length) return NextResponse.json({ state: null });
  try {
    return NextResponse.json({ state: JSON.parse(rows[0].data) });
  } catch {
    return NextResponse.json({ state: null });
  }
}

// PUT — save the user's state
export async function PUT(req: Request) {
  const userId = await getUserId(req);
  if (!userId)
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  if (!db) return NextResponse.json({ error: "No DB" }, { status: 500 });

  const { state } = await req.json().catch(() => ({}));
  if (!state) return NextResponse.json({ error: "No state" }, { status: 400 });

  const data = JSON.stringify(state);

  // Upsert: update if exists, insert if not
  const existing = await db
    .select({ id: userState.id })
    .from(userState)
    .where(eq(userState.userId, userId))
    .limit(1);

  if (existing.length) {
    await db
      .update(userState)
      .set({ data, updatedAt: new Date() })
      .where(eq(userState.userId, userId));
  } else {
    await db.insert(userState).values({ userId, data });
  }

  return NextResponse.json({ ok: true });
}
