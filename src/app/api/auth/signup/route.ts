// POST /api/auth/signup — create new account with email/password
import { NextResponse } from "next/server";
import { createUser, checkRateLimit, logLoginAttempt, getClientInfo } from "@/lib/auth";

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
    
    return NextResponse.json({
      success: true,
      message: "Account created. Please check your email to verify your account.",
      user: {
        id: result.user!.id,
        email: result.user!.email,
        name: result.user!.name,
        emailVerified: result.user!.emailVerified,
      },
    });
  } catch (error) {
    console.error("[AUTH] Signup error:", error);
    return NextResponse.json({ error: "An error occurred. Please try again." }, { status: 500 });
  }
}
