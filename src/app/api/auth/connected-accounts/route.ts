// GET/POST /api/auth/connected-accounts — manage OAuth linked accounts
import { NextResponse } from "next/server";
import {
  validateSession,
  getSessionTokenFromRequest,
  getLinkedAccounts,
  unlinkOAuthAccount,
} from "@/lib/auth";
import { isProviderConfigured } from "@/lib/oauth";

export const dynamic = "force-dynamic";

// GET — list connected accounts
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

    const linked = await getLinkedAccounts(user.id);

    return NextResponse.json({
      accounts: [
        {
          provider: "google",
          connected: linked.some((a) => a.provider === "google"),
          linkedAt: linked.find((a) => a.provider === "google")?.linkedAt || null,
          available: isProviderConfigured("google"),
        },
        {
          provider: "github",
          connected: linked.some((a) => a.provider === "github"),
          linkedAt: linked.find((a) => a.provider === "github")?.linkedAt || null,
          available: isProviderConfigured("github"),
        },
      ],
    });
  } catch (error) {
    console.error("[AUTH] Connected accounts error:", error);
    return NextResponse.json({ error: "Failed to get connected accounts" }, { status: 500 });
  }
}

// POST — unlink an account
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
    const { action, provider } = body;

    if (action === "unlink" && provider) {
      const result = await unlinkOAuthAccount(user.id, provider);
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json({ success: true, message: `${provider} account unlinked.` });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("[AUTH] Connected accounts action error:", error);
    return NextResponse.json({ error: "Failed to perform action" }, { status: 500 });
  }
}
