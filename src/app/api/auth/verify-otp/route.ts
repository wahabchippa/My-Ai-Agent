// POST /api/auth/verify-otp — verify OTP code (legacy, kept for compatibility)
import { NextResponse } from "next/server";
import { db } from "@/db";
import { users, otpCodes, loginAttempts } from "@/db/schema";
import { eq, and, gte, sql } from "drizzle-orm";
import { createSession, getClientInfo } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { email, code } = await req.json().catch(() => ({}));
    
    if (!email || !code) {
      return NextResponse.json({ error: "Email and code required" }, { status: 400 });
    }
    
    if (!db) {
      return NextResponse.json({ error: "Database not available" }, { status: 500 });
    }

    const { ip, userAgent } = getClientInfo(req);
    const normEmail = email.toLowerCase();

    // ── 🔒 BRUTE-FORCE PROTECTION ──
    // Pehle verify-otp par koi attempt limit nahi thi — 6-digit code ko
    // script se brute-force kiya ja sakta tha. Ab 15 min me 5 se zyada
    // failed attempts par request block hoti hai.
    const recent = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(loginAttempts)
      .where(
        and(
          eq(loginAttempts.email, normEmail),
          eq(loginAttempts.success, false),
          gte(loginAttempts.createdAt, new Date(Date.now() - 15 * 60 * 1000))
        )
      );
    if ((recent[0]?.count || 0) >= 5) {
      return NextResponse.json(
        { error: "Too many failed attempts. Try again later." },
        { status: 429 }
      );
    }

    // Find valid OTP
    const otps = await db
      .select()
      .from(otpCodes)
      .where(
        and(
          eq(otpCodes.email, normEmail),
          eq(otpCodes.code, code),
          eq(otpCodes.used, false),
          gte(otpCodes.expiresAt, new Date())
        )
      )
      .limit(1);
    
    if (!otps.length) {
      // Failed attempt log karo (rate-limit window ke liye)
      await db.insert(loginAttempts).values({
        email: normEmail,
        ipAddress: ip,
        userAgent,
        success: false,
      }).catch(() => {});
      return NextResponse.json({ error: "Invalid or expired code" }, { status: 401 });
    }
    
    // Mark OTP as used
    await db.update(otpCodes).set({ used: true }).where(eq(otpCodes.id, otps[0].id));
    
    // Find or create user
    let userRows = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
    
    if (!userRows.length) {
      await db.insert(users).values({
        email: email.toLowerCase(),
        name: email.split("@")[0],
        emailVerified: true,
        status: "active",
      });
      userRows = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
    }
    
    const user = userRows[0];

    // Successful verification — failed-attempt counter clear karo
    await db.delete(loginAttempts).where(eq(loginAttempts.email, normEmail)).catch(() => {});

    // Create session
    const token = await createSession(user.id, {
      deviceInfo: userAgent,
      ipAddress: ip,
    });
    
    const res = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        plan: user.plan,
      },
    });
    
    res.cookies.set("nexora_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60,
      path: "/",
    });
    
    return res;
  } catch (error) {
    console.error("[AUTH] Verify OTP error:", error);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
