// POST /api/auth/reset-password — reset password with token
import { NextResponse } from "next/server";
import { resetPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { token, password } = body;
    
    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Invalid reset link" }, { status: 400 });
    }
    
    if (!password || typeof password !== "string") {
      return NextResponse.json({ error: "Password is required" }, { status: 400 });
    }
    
    const result = await resetPassword(token, password);
    
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    
    return NextResponse.json({ 
      success: true, 
      message: "Password reset successfully. You can now log in with your new password." 
    });
  } catch (error) {
    console.error("[AUTH] Reset password error:", error);
    return NextResponse.json({ error: "Password reset failed" }, { status: 500 });
  }
}
