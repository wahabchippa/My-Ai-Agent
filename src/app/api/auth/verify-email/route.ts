// POST /api/auth/verify-email — verify email with token
import { NextResponse } from "next/server";
import { verifyEmail, resendVerificationEmail } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { token, action, email } = body;
    
    // Resend verification email
    if (action === "resend" && email) {
      await resendVerificationEmail(email);
      return NextResponse.json({ 
        success: true, 
        message: "If an account exists, a verification email has been sent." 
      });
    }
    
    // Verify token
    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Invalid verification link" }, { status: 400 });
    }
    
    const result = await verifyEmail(token);
    
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    
    return NextResponse.json({ 
      success: true, 
      message: "Email verified successfully. You can now log in." 
    });
  } catch (error) {
    console.error("[AUTH] Verify email error:", error);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
