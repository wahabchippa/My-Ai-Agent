// /api/admin/dashboard — comprehensive admin stats for the dashboard.

import { NextResponse } from "next/server";
import { db } from "@/db";
import { users, usageLogs, subscriptions, plans, auditLogs } from "@/db/schema";
import { eq, sql, and, gte, desc } from "drizzle-orm";
import { getUser, requireAdmin, logAudit } from "@/lib/accessControl";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!db) return NextResponse.json({ error: "No DB" }, { status: 500 });

  const user = await getUser(req);
  if (!requireAdmin(user))
    return NextResponse.json({ error: "Admin only" }, { status: 403 });

  // ─── USER STATS ───
  const totalUsers = await db.select({ count: sql<number>`count(*)::int` }).from(users);
  const activeUsers = await db.select({ count: sql<number>`count(*)::int` }).from(users).where(eq(users.status, "active"));
  const newToday = await db.select({ count: sql<number>`count(*)::int` }).from(users)
    .where(sql`${users.createdAt} >= CURRENT_DATE`);
  const newThisMonth = await db.select({ count: sql<number>`count(*)::int` }).from(users)
    .where(sql`${users.createdAt} >= date_trunc('month', now())`);

  const freeUsers = await db.select({ count: sql<number>`count(*)::int` }).from(users).where(eq(users.plan, "free"));
  const proUsers = await db.select({ count: sql<number>`count(*)::int` }).from(users).where(eq(users.plan, "pro"));
  const premiumUsers = await db.select({ count: sql<number>`count(*)::int` }).from(users).where(eq(users.plan, "premium"));

  // ─── USAGE STATS ───
  const requestsToday = await db.select({ count: sql<number>`count(*)::int` }).from(usageLogs)
    .where(sql`${usageLogs.createdAt} >= CURRENT_DATE`);
  const requestsThisMonth = await db.select({ count: sql<number>`count(*)::int` }).from(usageLogs)
    .where(sql`${usageLogs.createdAt} >= date_trunc('month', now())`);
  const failedRequests = await db.select({ count: sql<number>`count(*)::int` }).from(usageLogs)
    .where(eq(usageLogs.success, false));
  const searchRequests = await db.select({ count: sql<number>`count(*)::int` }).from(usageLogs)
    .where(eq(usageLogs.type, "current_events"));

  // ─── MODEL USAGE ───
  const modelUsage = await db
    .select({
      model: usageLogs.model,
      count: sql<number>`count(*)::int`,
    })
    .from(usageLogs)
    .where(sql`${usageLogs.createdAt} >= date_trunc('month', now())`)
    .groupBy(usageLogs.model)
    .orderBy(desc(sql`count(*)`))
    .limit(10);

  // ─── COST ───
  const monthlyCost = await db.select({
    total: sql<string>`COALESCE(SUM(${usageLogs.estimatedCost}), 0)`,
  }).from(usageLogs).where(sql`${usageLogs.createdAt} >= date_trunc('month', now())`);

  // ─── SUBSCRIPTIONS ───
  const activeSubs = await db.select({ count: sql<number>`count(*)::int` })
    .from(subscriptions).where(eq(subscriptions.status, "active"));
  const cancelledSubs = await db.select({ count: sql<number>`count(*)::int` })
    .from(subscriptions).where(eq(subscriptions.status, "cancelled"));

  // ─── USAGE OVER LAST 7 DAYS ───
  const dailyUsage = await db
    .select({
      date: sql<string>`DATE(${usageLogs.createdAt})`,
      count: sql<number>`count(*)::int`,
    })
    .from(usageLogs)
    .where(sql`${usageLogs.createdAt} >= now() - interval '7 days'`)
    .groupBy(sql`DATE(${usageLogs.createdAt})`)
    .orderBy(sql`DATE(${usageLogs.createdAt})`);

  // ─── TOP USERS BY USAGE ───
  const topUsers = await db
    .select({
      userId: usageLogs.userId,
      email: users.email,
      name: users.name,
      plan: users.plan,
      count: sql<number>`count(*)::int`,
    })
    .from(usageLogs)
    .innerJoin(users, eq(usageLogs.userId, users.id))
    .where(sql`${usageLogs.createdAt} >= date_trunc('month', now())`)
    .groupBy(usageLogs.userId, users.email, users.name, users.plan)
    .orderBy(desc(sql`count(*)`))
    .limit(10);

  return NextResponse.json({
    users: {
      total: totalUsers[0]?.count || 0,
      active: activeUsers[0]?.count || 0,
      newToday: newToday[0]?.count || 0,
      newThisMonth: newThisMonth[0]?.count || 0,
      free: freeUsers[0]?.count || 0,
      pro: proUsers[0]?.count || 0,
      premium: premiumUsers[0]?.count || 0,
    },
    usage: {
      requestsToday: requestsToday[0]?.count || 0,
      requestsThisMonth: requestsThisMonth[0]?.count || 0,
      failedRequests: failedRequests[0]?.count || 0,
      searchRequests: searchRequests[0]?.count || 0,
    },
    costs: {
      monthlyCost: monthlyCost[0]?.total || "0",
    },
    subscriptions: {
      active: activeSubs[0]?.count || 0,
      cancelled: cancelledSubs[0]?.count || 0,
    },
    modelUsage: modelUsage.map((m: any) => ({ model: m.model || "unknown", count: m.count })),
    dailyUsage: dailyUsage.map((d: any) => ({ date: d.date, count: d.count })),
    topUsers: topUsers.map((u: any) => ({ id: u.userId, email: u.email, name: u.name, plan: u.plan, requests: u.count })),
  });
}
