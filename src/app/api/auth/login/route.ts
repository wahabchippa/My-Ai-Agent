// POST /api/auth/login — email/password login
import { NextResponse } from "next/server";
import {
  findUserByEmail,
  verifyPassword,
  createSession,
  checkRateLimit,
  logLoginAttempt,
  checkAccountLocked,
  incrementFailedAttempts,
  resetFailedAttempts,
  getClientInfo,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { ip, userAgent } = getClientInfo(req);
    
    // Rate limiting
    const rateCheck = await checkRateLimit("login", ip);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: "Too many login attempts. Please try again later." },
        { status: 429, headers: { "Retry-After": String(rateCheck.retryAfter) } }
      );
    }
    
    const body = await req.json().catch(() => ({}));
    const { email, password, rememberMe } = body;
    
    // Validation
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }
    
    if (!password || typeof password !== "string") {
      return NextResponse.json({ error: "Password is required" }, { status: 400 });
    }
    
    // Find user
    const user = await findUserByEmail(email);
    
    // Generic error to prevent email enumeration
    const invalidCredentials = { error: "Invalid email or password" };
    
    if (!user) {
      await logLoginAttempt(email, ip, userAgent, false);
      return NextResponse.json(invalidCredentials, { status: 401 });
    }
    
    // Check if account is locked
    const lockCheck = await checkAccountLocked(user.id);
    if (lockCheck.locked) {
      await logLoginAttempt(email, ip, userAgent, false);
      return NextResponse.json(
        { error: `Account temporarily locked. Try again after ${lockCheck.until?.toLocaleTimeString()}` },
        { status: 403 }
      );
    }
    
    // Check if user has password (might be OAuth-only)
    if (!user.passwordHash) {
      await logLoginAttempt(email, ip, userAgent, false);
      return NextResponse.json(
        { error: "Please sign in with Google or GitHub" },
        { status: 400 }
      );
    }
    
    // Verify password
    const validPassword = await verifyPassword(password, user.passwordHash);
    if (!validPassword) {
      await logLoginAttempt(email, ip, userAgent, false);
      const locked = await incrementFailedAttempts(user.id);
      if (locked) {
        return NextResponse.json(
          { error: "Too many failed attempts. Account temporarily locked." },
          { status: 403 }
        );
      }
      return NextResponse.json(invalidCredentials, { status: 401 });
    }
    
    // Check account status
    if (user.status === "suspended") {
      return NextResponse.json({ error: "Account suspended. Contact support." }, { status: 403 });
    }
    
    if (user.status === "deleted") {
      return NextResponse.json(invalidCredentials, { status: 401 });
    }
    
    // Reset failed attempts
    await resetFailedAttempts(user.id);
    
    // Log successful login
    await logLoginAttempt(email, ip, userAgent, true);
    
    // Create session
    const token = await createSession(user.id, {
      rememberMe: !!rememberMe,
      deviceInfo: userAgent,
      ipAddress: ip,
    });
    
    // Set cookie
    const maxAge = rememberMe ? 30 * 24 * 60 * 60 : 24 * 60 * 60;
    const res = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        plan: user.plan,
        emailVerified: user.emailVerified,
        avatarUrl: user.avatarUrl,
      },
    });
    
    res.cookies.set("nexora_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge,
      path: "/",
    });
    
    return res;
  } catch (error) {
    console.error("[AUTH] Login error:", error);
    return NextResponse.json({ error: "An error occurred. Please try again." }, { status: 500 });
  }
}
