// /api/notifications — user notification system.
import { NextResponse } from "next/server";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { getUser } from "@/lib/accessControl";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getUser(req);
  if (!user || !db) return NextResponse.json({ notifications: [] });
  const items = await db.select().from(notifications)
    .where(eq(notifications.userId, user.id))
    .orderBy(desc(notifications.createdAt)).limit(20);
  return NextResponse.json({ notifications: items, unread: items.filter(n => !n.read).length });
}

export async function POST(req: Request) {
  const user = await getUser(req);
  if (!user || !db) return NextResponse.json({ error: "Auth required" }, { status: 401 });
  const { action, id } = await req.json();
  if (action === "mark_read" && id) {
    await db.update(notifications).set({ read: true }).where(eq(notifications.id, parseInt(id)));
  } else if (action === "mark_all_read") {
    await db.update(notifications).set({ read: true }).where(eq(notifications.userId, user.id));
  }
  return NextResponse.json({ ok: true });
}
