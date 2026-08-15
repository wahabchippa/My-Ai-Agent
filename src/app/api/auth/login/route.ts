// /api/auth/login — simple email login (no OTP). Finds or creates user, sets session cookie.

import { NextResponse } from "next/server";
import { db } from "@/db";
import { users, sessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { email } = await req.json().catch(() => ({}));
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  if (!db) return NextResponse.json({ error: "Database not configured" }, { status: 500 });

  // Find or create user
  let userRows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!userRows.length) {
    await db.insert(users).values({ email, name: email.split("@")[0] });
    userRows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  }
  const user = userRows[0];

  // Create session
  const token = randomBytes(32).toString("hex");
  await db.insert(sessions).values({ token, userId: user.id });

  const ADMIN_EMAILS = ["wahab.chippa@joinfleek.com", "wahabchippa@joinfleek.com"];
  const isAdmin = ADMIN_EMAILS.includes(email.toLowerCase());
  const res = NextResponse.json({ user: { id: user.id, email: user.email, name: user.name, isAdmin } });
  res.cookies.set("nexora_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return res;
}
