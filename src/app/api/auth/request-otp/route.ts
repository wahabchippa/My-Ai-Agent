// /api/auth/request-otp — generate a 6-digit OTP and store it.
// In dev (no RESEND_API_KEY), returns the OTP directly so the client can
// display it. In production, sends it via Resend email.

import { NextResponse } from "next/server";
import { db } from "@/db";
import { otpCodes } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { email } = await req.json().catch(() => ({}));
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });

  if (!db) return NextResponse.json({ error: "Database not configured" }, { status: 500 });

  // Rate limit: max 3 OTPs per email per 10 min
  const recent = await db
    .select({ count: sql<number>`count(*)` })
    .from(otpCodes)
    .where(sql`${otpCodes.email} = ${email} AND ${otpCodes.createdAt} > now() - interval '10 minutes'`);
  if ((recent[0]?.count || 0) >= 3)
    return NextResponse.json({ error: "Too many requests. Wait 10 minutes." }, { status: 429 });

  const code = String(Math.floor(100000 + Math.random() * 900000));
  await db.insert(otpCodes).values({
    email,
    code,
    expiresAt: sql`now() + interval '5 minutes'`,
  });

  // Try to send real email if RESEND_API_KEY is set
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Nexora <noreply@resend.dev>",
          to: email,
          subject: "Your Nexora login code",
          text: `Your login code is: ${code}\n\nIt expires in 5 minutes.`,
        }),
      });
      return NextResponse.json({ sent: true });
    } catch {
      /* fall through to dev mode */
    }
  }

  // Dev mode: return the code directly (no email service configured)
  return NextResponse.json({ sent: false, code });
}
