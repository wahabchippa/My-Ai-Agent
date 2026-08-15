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

function getBaseUrl(): string {
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return process.env.APP_URL || "http://localhost:3000";
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const { provider: rawProvider } = await params;
    const provider = rawProvider as OAuthProvider;
    const base = getBaseUrl();

    // Validate provider
    if (!VALID_PROVIDERS.includes(provider as (typeof VALID_PROVIDERS)[number])) {
      return NextResponse.json({ error: "Invalid OAuth provider" }, { status: 400 });
    }

    // Check if provider is configured
    if (!isProviderConfigured(provider)) {
      const label = provider === "google" ? "Google" : "GitHub";
      const callbackUrl = `${base}/api/auth/oauth/${provider}/callback`;

      // Give the exact env vars and setup instructions — never say "contact administrator"
      const setupGuide = provider === "google"
        ? `${label} login requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables. ` +
          `Set up at console.cloud.google.com/apis/credentials — ` +
          `add redirect URI: ${callbackUrl}`
        : `${label} login requires GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET environment variables. ` +
          `Set up at github.com/settings/developers — ` +
          `set callback URL: ${callbackUrl}`;

      return NextResponse.redirect(
        `${base}/?auth_error=${encodeURIComponent(setupGuide)}`
      );
    }

    // Generate CSRF state
    const state = generateOAuthState(provider);

    // Build authorization URL and redirect
    const authUrl = buildAuthorizationUrl(provider, state);

    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error("[OAUTH] Init error:", error);
    const base = getBaseUrl();
    return NextResponse.redirect(
      `${base}/?auth_error=${encodeURIComponent("Failed to initiate authentication. Please try again.")}`
    );
  }
}
