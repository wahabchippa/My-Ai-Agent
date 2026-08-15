// GET /api/auth/oauth-status — tells the frontend which OAuth providers are configured
import { NextResponse } from "next/server";
import { isProviderConfigured } from "@/lib/oauth";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    google: isProviderConfigured("google"),
    github: isProviderConfigured("github"),
  });
}
