// GET/DELETE /api/auth/sessions — manage user sessions
import { NextResponse } from "next/server";
import { 
  validateSession, 
  getSessionTokenFromRequest, 
  getUserSessions, 
  revokeSession, 
  destroyAllSessions 
} from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET — list all sessions
export async function GET(req: Request) {
  try {
    const token = getSessionTokenFromRequest(req);
    if (!token) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    
    const user = await validateSession(token);
    if (!user) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }
    
    const sessions = await getUserSessions(user.id, token);
    
    return NextResponse.json({ sessions });
  } catch (error) {
    console.error("[AUTH] Get sessions error:", error);
    return NextResponse.json({ error: "Failed to get sessions" }, { status: 500 });
  }
}

// DELETE — revoke session(s)
export async function DELETE(req: Request) {
  try {
    const token = getSessionTokenFromRequest(req);
    if (!token) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    
    const user = await validateSession(token);
    if (!user) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }
    
    const url = new URL(req.url);
    const sessionId = url.searchParams.get("id");
    const all = url.searchParams.get("all") === "true";
    
    if (all) {
      // Logout from all devices except current
      await destroyAllSessions(user.id, token);
      return NextResponse.json({ 
        success: true, 
        message: "Logged out from all other devices." 
      });
    }
    
    if (sessionId) {
      await revokeSession(user.id, parseInt(sessionId));
      return NextResponse.json({ 
        success: true, 
        message: "Session revoked." 
      });
    }
    
    return NextResponse.json({ error: "Session ID or 'all' flag required" }, { status: 400 });
  } catch (error) {
    console.error("[AUTH] Delete session error:", error);
    return NextResponse.json({ error: "Failed to revoke session" }, { status: 500 });
  }
}
