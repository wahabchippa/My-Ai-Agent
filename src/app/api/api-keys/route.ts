// /api/api-keys — user API key management.
import { NextResponse } from "next/server";
import { db } from "@/db";
import { apiKeys } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getUser } from "@/lib/accessControl";
import { randomBytes, createHash } from "crypto";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getUser(req);
  if (!user || !db) return NextResponse.json({ keys: [] });
  const keys = await db.select({
    id: apiKeys.id, name: apiKeys.name, keyPrefix: apiKeys.keyPrefix,
    permissions: apiKeys.permissions, status: apiKeys.status,
    lastUsedAt: apiKeys.lastUsedAt, createdAt: apiKeys.createdAt,
  }).from(apiKeys).where(eq(apiKeys.userId, user.id)).orderBy(desc(apiKeys.createdAt));
  return NextResponse.json({ keys });
}

export async function POST(req: Request) {
  const user = await getUser(req);
  if (!user || !db) return NextResponse.json({ error: "Auth required" }, { status: 401 });
  const { name, permissions } = await req.json();

  // Generate secure API key
  const rawKey = `nexora_${randomBytes(24).toString("hex")}`;
  const keyHash = createHash("sha256").update(rawKey).digest("hex");
  const keyPrefix = rawKey.slice(0, 12) + "...";

  await db.insert(apiKeys).values({
    userId: user.id,
    name: name || "Default Key",
    keyHash, keyPrefix,
    permissions: permissions || "chat",
  });

  // Return raw key ONLY once
  return NextResponse.json({ key: rawKey, prefix: keyPrefix, name: name || "Default Key" });
}

export async function DELETE(req: Request) {
  const user = await getUser(req);
  if (!user || !db) return NextResponse.json({ error: "Auth required" }, { status: 401 });
  const { id } = await req.json();
  await db.update(apiKeys).set({ status: "revoked" }).where(eq(apiKeys.id, parseInt(id)));
  return NextResponse.json({ ok: true });
}
