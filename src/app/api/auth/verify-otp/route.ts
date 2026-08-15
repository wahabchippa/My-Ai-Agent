// /api/auth/verify-otp — verify OTP, create/find user, set session cookie.

import { NextResponse } from "next/server";
import { db } from "@/db";
import { otpCodes, users, sessions } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { email, code } = await req.json().catch(() => ({}));
  if (!email || !code)
    return NextResponse.json({ error: "Email and code required" }, { status: 400 });
  if (!db) return NextResponse.json({ error: "Database not configured" }, { status: 500 });

  // Check OTP: valid, not used, not expired
  const rows = await db
    .select()
    .from(otpCodes)
    .where(sql`${otpCodes.email} = ${email} AND ${otpCodes.code} = ${code} AND ${otpCodes.used} = false AND ${otpCodes.expiresAt} > now()`)
    .limit(1);

  if (!rows.length)
    return NextResponse.json({ error: "Invalid or expired code" }, { status: 401 });

  // Mark OTP as used
  await db.update(otpCodes).set({ used: true }).where(eq(otpCodes.id, rows[0].id));

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

  const res = NextResponse.json({ user: { id: user.id, email: user.email, name: user.name } });
  res.cookies.set("nexora_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
  });
  return res;
}
