// /api/api-keys — user API key management.
import { NextResponse } from "next/server";
import { db } from "@/db";
import { apiKeys } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
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

  // ── IDOR FIX ──
  // Pehle sirf `apiKeys.id` par delete hota tha — koi bhi user kisi bhi
  // user ki key revoke kar sakta tha (sequential ids). Ab userId filter
  // lazmi hai, aur NaN ids reject hoti hain.
  const keyId = parseInt(String(id), 10);
  if (!Number.isFinite(keyId)) {
    return NextResponse.json({ error: "Invalid key id" }, { status: 400 });
  }

  const result = await db
    .update(apiKeys)
    .set({ status: "revoked" })
    .where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, user.id)));

  if ((result.rowCount ?? 0) === 0) {
    return NextResponse.json({ error: "Key not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
