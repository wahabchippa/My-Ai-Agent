// /api/admin/audit-logs — paginated audit log viewer for admin.
import { NextResponse } from "next/server";
import { db } from "@/db";
import { auditLogs, users } from "@/db/schema";
import { eq, sql, desc } from "drizzle-orm";
import { getUser, requireAdmin } from "@/lib/accessControl";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!db) return NextResponse.json({ error: "No DB" }, { status: 500 });
  const user = await getUser(req);
  if (!requireAdmin(user))
    return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);
  const search = url.searchParams.get("search") || "";
  const offset = (page - 1) * limit;

  // Count total
  const totalResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(auditLogs);
  const total = totalResult[0]?.count || 0;

  // Get logs with admin email join
  const logs = await db
    .select({
      id: auditLogs.id,
      adminId: auditLogs.adminId,
      adminEmail: users.email,
      action: auditLogs.action,
      targetId: auditLogs.targetId,
      targetEmail: auditLogs.targetEmail,
      details: auditLogs.details,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.adminId, users.id))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit)
    .offset(offset);

  // Filter in JS if search is provided (simple approach)
  let filtered = logs;
  if (search) {
    const s = search.toLowerCase();
    filtered = logs.filter(
      (l) =>
        (l.action || "").toLowerCase().includes(s) ||
        (l.targetEmail || "").toLowerCase().includes(s) ||
        (l.details || "").toLowerCase().includes(s) ||
        (l.adminEmail || "").toLowerCase().includes(s)
    );
  }

  return NextResponse.json({
    total,
    page,
    limit,
    logs: filtered.map((l) => ({
      id: l.id,
      adminEmail: l.adminEmail || "system",
      action: l.action,
      targetId: l.targetId,
      targetEmail: l.targetEmail,
      details: l.details,
      createdAt: l.createdAt,
    })),
  });
}
