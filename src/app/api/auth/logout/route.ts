// POST /api/auth/logout — destroy current session
import { NextResponse } from "next/server";
import { destroySession, getSessionTokenFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const token = getSessionTokenFromRequest(req);
    
    if (token) {
      await destroySession(token);
    }
    
    const res = NextResponse.json({ success: true });
    
    // Clear the cookie
    res.cookies.set("nexora_session", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
      path: "/",
    });
    
    return res;
  } catch (error) {
    console.error("[AUTH] Logout error:", error);
    return NextResponse.json({ error: "Logout failed" }, { status: 500 });
  }
}
