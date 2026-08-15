// GET /api/auth/oauth/[provider] — Initiate OAuth flow (redirect to provider)
import { NextResponse } from "next/server";
import {
  generateOAuthState,
  buildAuthorizationUrl,
  isProviderConfigured,
  type OAuthProvider,
} from "@/lib/oauth";

export const dynamic = "force-dynamic";

const VALID_PROVIDERS = ["google", "github"] as const;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const { provider: rawProvider } = await params;
    const provider = rawProvider as OAuthProvider;

    // Validate provider
    if (!VALID_PROVIDERS.includes(provider as (typeof VALID_PROVIDERS)[number])) {
      return NextResponse.json({ error: "Invalid OAuth provider" }, { status: 400 });
    }

    // Check if provider is configured
    if (!isProviderConfigured(provider)) {
      // Return a redirect to the login page with an error message
      const base = process.env.NEXTAUTH_URL || process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : process.env.APP_URL || "http://localhost:3000";

      return NextResponse.redirect(
        `${base}/?auth_error=${encodeURIComponent(
          `${provider.charAt(0).toUpperCase() + provider.slice(1)} login is not configured. Please contact the administrator.`
        )}`
      );
    }

    // Generate CSRF state
    const state = generateOAuthState(provider);

    // Build authorization URL and redirect
    const authUrl = buildAuthorizationUrl(provider, state);

    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error("[OAUTH] Init error:", error);
    const base = process.env.NEXTAUTH_URL || process.env.APP_URL || "http://localhost:3000";
    return NextResponse.redirect(
      `${base}/?auth_error=${encodeURIComponent("Failed to initiate authentication. Please try again.")}`
    );
  }
}
