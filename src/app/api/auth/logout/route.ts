// /api/auth/logout — clear session cookie.

import { NextResponse } from "next/server";
import { db } from "@/db";
import { sessions } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const token = req.headers.get("cookie")?.match(/nexora_session=([^;]+)/)?.[1];
  if (token && db) {
    try {
      await db.delete(sessions).where(eq(sessions.token, token));
    } catch {
      /* ignore */
    }
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set("nexora_session", "", { httpOnly: true, maxAge: 0, path: "/" });
  return res;
}
