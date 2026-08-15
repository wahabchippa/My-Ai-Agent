// /api/auth/me — return current logged-in user from session cookie.

import { NextResponse } from "next/server";
import { db } from "@/db";
import { users, sessions } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!db) return NextResponse.json({ user: null });
  const token = req.headers.get("cookie")?.match(/nexora_session=([^;]+)/)?.[1];
  if (!token) return NextResponse.json({ user: null });

  const sess = await db
    .select({ userId: sessions.userId })
    .from(sessions)
    .where(eq(sessions.token, token))
    .limit(1);
  if (!sess.length) return NextResponse.json({ user: null });

  const user = await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(eq(users.id, sess[0].userId))
    .limit(1);

  return NextResponse.json({ user: user[0] || null });
}
