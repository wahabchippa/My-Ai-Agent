// GET /api/auth/oauth/[provider]/callback — OAuth callback handler
import { NextResponse } from "next/server";
import {
  validateOAuthState,
  exchangeCodeForProfile,
  type OAuthProvider,
} from "@/lib/oauth";
import {
  findOrCreateOAuthUser,
  createSession,
  getClientInfo,
  logLoginAttempt,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

function getBaseUrl(): string {
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return process.env.APP_URL || "http://localhost:3000";
}

function redirectWithError(message: string): NextResponse {
  const base = getBaseUrl();
  return NextResponse.redirect(
    `${base}/?auth_error=${encodeURIComponent(message)}`
  );
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { ip, userAgent } = getClientInfo(req);
  const base = getBaseUrl();

  try {
    const { provider: rawProvider } = await params;
    const url = new URL(req.url);

    // ── Check for errors from provider ──
    const errorParam = url.searchParams.get("error");
    if (errorParam) {
      const desc = url.searchParams.get("error_description") || "Authentication was cancelled or failed.";
      console.error(`[OAUTH] Provider returned error: ${errorParam} - ${desc}`);

      if (errorParam === "access_denied") {
        return redirectWithError("Authentication was cancelled.");
      }
      return redirectWithError(desc);
    }

    // ── Validate state (CSRF protection) ──
    const state = url.searchParams.get("state");
    if (!state) {
      return redirectWithError("Invalid authentication request (missing state).");
    }

    const validatedProvider = validateOAuthState(state);
    if (!validatedProvider) {
      return redirectWithError("Authentication session expired. Please try again.");
    }

    // Ensure the URL provider matches the state provider
    if (rawProvider !== validatedProvider) {
      return redirectWithError("Invalid authentication request (provider mismatch).");
    }

    const provider = validatedProvider as OAuthProvider;

    // ── Exchange authorization code for profile ──
    const code = url.searchParams.get("code");
    if (!code) {
      return redirectWithError("Invalid authentication response (missing code).");
    }

    let profile;
    try {
      profile = await exchangeCodeForProfile(provider, code);
    } catch (err: any) {
      console.error(`[OAUTH] Profile fetch error for ${provider}:`, err.message);
      return redirectWithError(err.message || "Failed to verify your identity. Please try again.");
    }

    // ── Find or create user ──
    let result;
    try {
      result = await findOrCreateOAuthUser(provider, profile);
    } catch (err: any) {
      console.error(`[OAUTH] User creation error:`, err.message);
      return redirectWithError("Failed to create or find your account. Please try again.");
    }

    const { user, isNew } = result;

    // ── Check account status ──
    if (user.status === "suspended") {
      await logLoginAttempt(user.email, ip, userAgent, false);
      return redirectWithError("Your account has been suspended. Please contact support.");
    }

    if (user.status === "deleted") {
      await logLoginAttempt(user.email, ip, userAgent, false);
      return redirectWithError("This account is no longer active.");
    }

    // ── Create session ──
    const sessionToken = await createSession(user.id, {
      rememberMe: true, // OAuth logins persist by default
      deviceInfo: userAgent,
      ipAddress: ip,
    });

    // ── Log successful login ──
    await logLoginAttempt(user.email, ip, userAgent, true);

    // ── Set cookie & redirect to app ──
    const isAdmin = user.role === "admin" || user.role === "super_admin";
    const response = NextResponse.redirect(
      `${base}/?auth_success=1`
    );

    // Set secure session cookie
    response.cookies.set("nexora_session", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60, // 30 days for OAuth
      path: "/",
    });

    // Set a short-lived cookie with user info for the client to pick up
    // This avoids an extra /api/auth/me round-trip on first load
    response.cookies.set("nexora_user_bootstrap", JSON.stringify({
      email: user.email,
      name: user.name || user.email.split("@")[0],
      isAdmin,
      plan: user.plan,
      avatarUrl: user.avatarUrl,
    }), {
      httpOnly: false, // readable by JS
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60, // 1 minute — just for the initial load
      path: "/",
    });

    return response;
  } catch (error: any) {
    console.error("[OAUTH] Callback error:", error);
    return redirectWithError("An unexpected error occurred during authentication. Please try again.");
  }
}
