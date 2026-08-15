// POST /api/auth/forgot-password — request password reset
import { NextResponse } from "next/server";
import { requestPasswordReset, checkRateLimit, getClientInfo } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { ip } = getClientInfo(req);
    
    // Rate limiting
    const rateCheck = await checkRateLimit("password-reset", ip);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }
    
    const body = await req.json().catch(() => ({}));
    const { email } = body;
    
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
    }
    
    // Always return success to prevent email enumeration
    await requestPasswordReset(email);
    
    return NextResponse.json({ 
      success: true, 
      message: "If an account exists with this email, a password reset link has been sent." 
    });
  } catch (error) {
    console.error("[AUTH] Forgot password error:", error);
    // Still return success for security
    return NextResponse.json({ 
      success: true, 
      message: "If an account exists with this email, a password reset link has been sent." 
    });
  }
}
