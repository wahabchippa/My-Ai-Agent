// /api/admin/models — CRUD for model registry.
import { NextResponse } from "next/server";
import { db } from "@/db";
import { modelRegistry } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getUser, requireAdmin, logAudit } from "@/lib/accessControl";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!db) return NextResponse.json({ error: "No DB" }, { status: 500 });
  const user = await getUser(req);
  if (!requireAdmin(user))
    return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const models = await db.select().from(modelRegistry).orderBy(modelRegistry.priority);
  return NextResponse.json({ models });
}

export async function POST(req: Request) {
  if (!db) return NextResponse.json({ error: "No DB" }, { status: 500 });
  const user = await getUser(req);
  if (!requireAdmin(user))
    return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const { action, id, data } = await req.json();

  if (action === "create" && data) {
    await db.insert(modelRegistry).values({
      provider: data.provider || "unknown",
      modelId: data.modelId || "",
      displayName: data.displayName || "",
      accessLevel: data.accessLevel || "free",
      status: data.status || "active",
      priority: data.priority || 50,
      costPerMtok: data.costPerMtok || "0",
      capabilities: data.capabilities || "general",
    });
    await logAudit(user!.id, "model_create", undefined, undefined, `Created model ${data.displayName}`);
    return NextResponse.json({ ok: true });
  }

  if (action === "update" && id && data) {
    await db
      .update(modelRegistry)
      .set({
        ...(data.provider !== undefined && { provider: data.provider }),
        ...(data.modelId !== undefined && { modelId: data.modelId }),
        ...(data.displayName !== undefined && { displayName: data.displayName }),
        ...(data.accessLevel !== undefined && { accessLevel: data.accessLevel }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.priority !== undefined && { priority: data.priority }),
        ...(data.costPerMtok !== undefined && { costPerMtok: data.costPerMtok }),
        ...(data.capabilities !== undefined && { capabilities: data.capabilities }),
      })
      .where(eq(modelRegistry.id, id));
    await logAudit(user!.id, "model_update", undefined, undefined, `Updated model #${id}`);
    return NextResponse.json({ ok: true });
  }

  if (action === "delete" && id) {
    await db.delete(modelRegistry).where(eq(modelRegistry.id, id));
    await logAudit(user!.id, "model_delete", undefined, undefined, `Deleted model #${id}`);
    return NextResponse.json({ ok: true });
  }

  if (action === "toggle_status" && id) {
    const model = await db.select().from(modelRegistry).where(eq(modelRegistry.id, id)).limit(1);
    if (model.length) {
      const newStatus = model[0].status === "active" ? "disabled" : "active";
      await db.update(modelRegistry).set({ status: newStatus }).where(eq(modelRegistry.id, id));
      await logAudit(user!.id, "model_toggle", undefined, undefined, `Model #${id} → ${newStatus}`);
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
