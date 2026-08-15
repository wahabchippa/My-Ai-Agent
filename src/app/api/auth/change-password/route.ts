// POST /api/auth/change-password — change password (authenticated)
import { NextResponse } from "next/server";
import { changePassword, validateSession, getSessionTokenFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const token = getSessionTokenFromRequest(req);
    if (!token) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    
    const user = await validateSession(token);
    if (!user) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }
    
    const body = await req.json().catch(() => ({}));
    const { currentPassword, newPassword } = body;
    
    if (!currentPassword || typeof currentPassword !== "string") {
      return NextResponse.json({ error: "Current password is required" }, { status: 400 });
    }
    
    if (!newPassword || typeof newPassword !== "string") {
      return NextResponse.json({ error: "New password is required" }, { status: 400 });
    }
    
    const result = await changePassword(user.id, currentPassword, newPassword);
    
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    
    return NextResponse.json({ 
      success: true, 
      message: "Password changed successfully." 
    });
  } catch (error) {
    console.error("[AUTH] Change password error:", error);
    return NextResponse.json({ error: "Failed to change password" }, { status: 500 });
  }
}
