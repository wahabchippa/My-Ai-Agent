// /api/admin/manage-user — admin actions on individual users.

import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getUser, requireAdmin, logAudit } from "@/lib/accessControl";

export const dynamic = "force-dynamic";

// GET — list all users with pagination
export async function GET(req: Request) {
  if (!db) return NextResponse.json({ error: "No DB" }, { status: 500 });
  const admin = await getUser(req);
  if (!requireAdmin(admin)) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const url = new URL(req.url);
  const search = url.searchParams.get("search") || "";
  const planFilter = url.searchParams.get("plan") || "";

  // Simple filtering
  const allUsers = await db.select().from(users).orderBy(users.createdAt);
  
  let filtered = allUsers;
  if (search) {
    filtered = filtered.filter((u: any) =>
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.name || "").toLowerCase().includes(search.toLowerCase())
    );
  }
  if (planFilter && planFilter !== "all") {
    filtered = filtered.filter((u: any) => u.plan === planFilter);
  }

  return NextResponse.json({
    total: filtered.length,
    users: filtered.map((u: any) => ({
      id: u.id, email: u.email, name: u.name, role: u.role,
      plan: u.plan, status: u.status, credits: u.credits,
      createdAt: u.createdAt, lastActive: u.lastActive,
    })),
  });
}

// POST — perform admin action on a user
export async function POST(req: Request) {
  if (!db) return NextResponse.json({ error: "No DB" }, { status: 500 });
  const admin = await getUser(req);
  if (!requireAdmin(admin)) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const { action, userId, value } = await req.json();

  const targetUser = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!targetUser.length) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const target = targetUser[0];

  switch (action) {
    case "change_plan":
      await db.update(users).set({ plan: value }).where(eq(users.id, userId));
      await logAudit(admin!.id, "user_plan_change", userId, target.email, `Changed plan to ${value}`);
      break;

    case "change_role":
      await db.update(users).set({ role: value }).where(eq(users.id, userId));
      await logAudit(admin!.id, "user_role_change", userId, target.email, `Changed role to ${value}`);
      break;

    case "suspend":
      await db.update(users).set({ status: "suspended" }).where(eq(users.id, userId));
      await logAudit(admin!.id, "user_suspend", userId, target.email, "User suspended");
      break;

    case "unsuspend":
      await db.update(users).set({ status: "active" }).where(eq(users.id, userId));
      await logAudit(admin!.id, "user_unsuspend", userId, target.email, "User unsuspended");
      break;

    case "grant_premium":
      await db.update(users).set({ plan: "premium", credits: 9999 }).where(eq(users.id, userId));
      await logAudit(admin!.id, "grant_premium", userId, target.email, "Granted premium access");
      break;

    case "reset_usage":
      await db.update(users).set({ credits: 100 }).where(eq(users.id, userId));
      await logAudit(admin!.id, "reset_usage", userId, target.email, "Usage reset");
      break;

    case "set_credits":
      await db.update(users).set({ credits: parseInt(value) || 0 }).where(eq(users.id, userId));
      await logAudit(admin!.id, "set_credits", userId, target.email, `Credits set to ${value}`);
      break;

    case "delete":
      await db.update(users).set({ status: "deleted" }).where(eq(users.id, userId));
      await logAudit(admin!.id, "user_delete", userId, target.email, "User deleted");
      break;

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
