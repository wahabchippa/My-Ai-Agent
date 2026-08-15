// GET /api/auth/me — get current authenticated user
import { NextResponse } from "next/server";
import { validateSession, getSessionTokenFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const token = getSessionTokenFromRequest(req);
    
    if (!token) {
      return NextResponse.json({ user: null }, { status: 401 });
    }
    
    const user = await validateSession(token);
    
    if (!user) {
      const res = NextResponse.json({ user: null }, { status: 401 });
      // Clear invalid cookie
      res.cookies.set("nexora_session", "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 0,
        path: "/",
      });
      return res;
    }
    
    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        plan: user.plan,
        status: user.status,
        credits: user.credits,
        emailVerified: user.emailVerified,
        twoFactorEnabled: user.twoFactorEnabled,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (error) {
    console.error("[AUTH] Me error:", error);
    return NextResponse.json({ user: null }, { status: 500 });
  }
}
