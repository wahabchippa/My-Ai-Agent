// /api/admin/settings — system settings + feature flags management.
import { NextResponse } from "next/server";
import { db } from "@/db";
import { systemSettings, featureFlags, plans } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getUser, requireAdmin, logAudit } from "@/lib/accessControl";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getUser(req);
  if (!db) return NextResponse.json({ error: "No DB" }, { status: 500 });
  if (!requireAdmin(user)) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const settings = await db.select().from(systemSettings);
  const flags = await db.select().from(featureFlags);
  const allPlans = await db.select().from(plans);

  return NextResponse.json({ settings, featureFlags: flags, plans: allPlans });
}

export async function POST(req: Request) {
  const user = await getUser(req);
  if (!db) return NextResponse.json({ error: "No DB" }, { status: 500 });
  if (!requireAdmin(user)) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const { type, key, value, id } = await req.json();

  if (type === "setting") {
    const existing = await db.select().from(systemSettings).where(eq(systemSettings.key, key)).limit(1);
    if (existing.length) {
      await db.update(systemSettings).set({ value, updatedAt: new Date() }).where(eq(systemSettings.key, key));
    } else {
      await db.insert(systemSettings).values({ key, value });
    }
    await logAudit(user!.id, "setting_update", undefined, undefined, `${key} = ${value}`);
  }

  if (type === "flag" && id) {
    await db.update(featureFlags).set({ enabled: value === true || value === "true" }).where(eq(featureFlags.id, parseInt(id)));
    await logAudit(user!.id, "flag_update", undefined, undefined, `Flag ${id} = ${value}`);
  }

  if (type === "plan" && id) {
    // Update plan pricing/limits
    const { price, messageLimit, agentLimit, features, allowedModels, isActive } = value;
    await db.update(plans).set({
      ...(price !== undefined && { price: String(price) }),
      ...(messageLimit !== undefined && { messageLimit }),
      ...(agentLimit !== undefined && { agentLimit }),
      ...(features !== undefined && { features }),
      ...(allowedModels !== undefined && { allowedModels }),
      ...(isActive !== undefined && { isActive }),
    }).where(eq(plans.id, parseInt(id)));
    await logAudit(user!.id, "plan_update", undefined, undefined, `Plan ${id} updated`);
  }

  return NextResponse.json({ ok: true });
}
