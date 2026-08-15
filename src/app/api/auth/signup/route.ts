// POST /api/auth/signup — create account + auto-login
import { NextResponse } from "next/server";
import {
  createUser,
  createSession,
  checkRateLimit,
  logLoginAttempt,
  getClientInfo,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { ip, userAgent } = getClientInfo(req);

    // Rate limiting
    const rateCheck = await checkRateLimit("signup", ip);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": String(rateCheck.retryAfter) } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { email, password, name } = body;

    // Validation
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
    }

    if (!password || typeof password !== "string") {
      return NextResponse.json({ error: "Password is required" }, { status: 400 });
    }

    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return NextResponse.json({ error: "Name is required (minimum 2 characters)" }, { status: 400 });
    }

    // Create user
    const result = await createUser({ email, password, name: name.trim() });

    if (result.error) {
      await logLoginAttempt(email, ip, userAgent, false);
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const user = result.user!;

    // Auto-login: create session immediately
    const token = await createSession(user.id, {
      rememberMe: true,
      deviceInfo: userAgent,
      ipAddress: ip,
    });

    await logLoginAttempt(email, ip, userAgent, true);

    const isAdmin = user.role === "admin" || user.role === "super_admin";

    const res = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        plan: user.plan,
        isAdmin,
      },
    });

    res.cookies.set("nexora_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60,
      path: "/",
    });

    return res;
  } catch (error) {
    console.error("[AUTH] Signup error:", error);
    return NextResponse.json({ error: "An error occurred. Please try again." }, { status: 500 });
  }
}
