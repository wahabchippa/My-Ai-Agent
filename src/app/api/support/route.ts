// /api/support — support ticket system.
import { NextResponse } from "next/server";
import { db } from "@/db";
import { supportTickets, ticketReplies } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getUser, requireAdmin } from "@/lib/accessControl";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getUser(req);
  if (!user || !db) return NextResponse.json({ tickets: [] });

  const isAdmin = requireAdmin(user);

  if (isAdmin) {
    // Admin sees all tickets
    const tickets = await db.select().from(supportTickets).orderBy(desc(supportTickets.createdAt)).limit(50);
    return NextResponse.json({ tickets });
  }
  // User sees only their tickets
  const tickets = await db.select().from(supportTickets)
    .where(eq(supportTickets.userId, user.id))
    .orderBy(desc(supportTickets.createdAt));
  return NextResponse.json({ tickets });
}

export async function POST(req: Request) {
  const user = await getUser(req);
  if (!user || !db) return NextResponse.json({ error: "Auth required" }, { status: 401 });

  const { action, subject, message, ticketId, priority, status } = await req.json();

  if (action === "create") {
    const [ticket] = await db.insert(supportTickets).values({
      userId: user.id,
      subject: subject || "Support Request",
      message: message || "",
      priority: priority || "normal",
    }).returning();
    return NextResponse.json({ ticket });
  }

  if (action === "reply" && ticketId) {
    const isAdmin = requireAdmin(user);
    await db.insert(ticketReplies).values({
      ticketId: parseInt(ticketId),
      userId: user.id,
      message: message || "",
      isStaff: isAdmin,
    });
    if (isAdmin && status) {
      await db.update(supportTickets).set({ status, updatedAt: new Date() })
        .where(eq(supportTickets.id, parseInt(ticketId)));
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
