// ═══════════════════════════════════════════════════════════════════
// NEXORA OAUTH — Google & GitHub OAuth implementation
// ═══════════════════════════════════════════════════════════════════

import { randomBytes, createHash } from "crypto";

// ═══════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════
export interface OAuthProfile {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
}

export type OAuthProvider = "google" | "github";

// ═══════════════════════════════════════════
// STATE MANAGEMENT — CSRF protection
// ═══════════════════════════════════════════
// 🔒 FIX (2026-08-18): Pehle state sirf in-memory Map me rehti thi.
// Serverless (Vercel) par har invocation alag instance ho sakta hai —
// callback us instance par aaye jahan state maujood na ho → login
// intermittently 500 deta tha. Ab jab `OAUTH_STATE_SECRET` set ho,
// state HMAC-se signed hoti hai (stateless — kisi bhi instance par
// validate ho jati hai). Secret na ho to purana in-memory fallback.
const stateStore = new Map<string, { provider: OAuthProvider; createdAt: number }>();
const STATE_TTL = 10 * 60 * 1000; // 10 minutes
const STATE_SECRET = process.env.OAUTH_STATE_SECRET || "";

function signState(payload: string): string {
  return createHash("sha256").update(payload + STATE_SECRET).digest("base64url");
}

export function generateOAuthState(provider: OAuthProvider): string {
  // Clean expired states (sirf fallback store ke liye)
  const now = Date.now();
  for (const [key, val] of stateStore) {
    if (now - val.createdAt > STATE_TTL) stateStore.delete(key);
  }

  if (STATE_SECRET) {
    const payload = Buffer.from(
      JSON.stringify({ p: provider, exp: now + STATE_TTL })
    ).toString("base64url");
    return `${payload}.${signState(payload)}`;
  }

  const state = randomBytes(32).toString("hex");
  stateStore.set(state, { provider, createdAt: now });
  return state;
}

export function validateOAuthState(state: string): OAuthProvider | null {
  if (STATE_SECRET) {
    const dot = state.lastIndexOf(".");
    if (dot <= 0) return null;
    const payload = state.slice(0, dot);
    const sig = state.slice(dot + 1);
    if (sig !== signState(payload)) return null; // forged/changed state
    try {
      const data = JSON.parse(Buffer.from(payload, "base64url").toString());
      if (Date.now() > data.exp) return null;
      return data.p as OAuthProvider;
    } catch {
      return null;
    }
  }

  const entry = stateStore.get(state);
  if (!entry) return null;

  stateStore.delete(state); // one-time use

  if (Date.now() - entry.createdAt > STATE_TTL) return null;

  return entry.provider;
}

// ═══════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════
function getBaseUrl(): string {
  // NEXTAUTH_URL / VERCEL_URL / fallback
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return process.env.APP_URL || "http://localhost:3000";
}

function getGoogleConfig() {
  return {
    clientId: process.env.GOOGLE_CLIENT_ID || "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    redirectUri: process.env.GOOGLE_REDIRECT_URI || `${getBaseUrl()}/api/auth/oauth/google/callback`,
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    userInfoUrl: "https://www.googleapis.com/oauth2/v2/userinfo",
    scopes: ["openid", "email", "profile"],
  };
}

function getGitHubConfig() {
  return {
    clientId: process.env.GITHUB_CLIENT_ID || "",
    clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
    redirectUri: process.env.GITHUB_REDIRECT_URI || `${getBaseUrl()}/api/auth/oauth/github/callback`,
    authUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    userUrl: "https://api.github.com/user",
    emailsUrl: "https://api.github.com/user/emails",
    scopes: ["user:email", "read:user"],
  };
}

// ═══════════════════════════════════════════
// CHECK IF PROVIDER IS CONFIGURED
// ═══════════════════════════════════════════
export function isProviderConfigured(provider: OAuthProvider): boolean {
  if (provider === "google") {
    const cfg = getGoogleConfig();
    return !!(cfg.clientId && cfg.clientSecret);
  }
  if (provider === "github") {
    const cfg = getGitHubConfig();
    return !!(cfg.clientId && cfg.clientSecret);
  }
  return false;
}

// ═══════════════════════════════════════════
// BUILD AUTHORIZATION URL
// ═══════════════════════════════════════════
export function buildAuthorizationUrl(provider: OAuthProvider, state: string): string {
  if (provider === "google") {
    const cfg = getGoogleConfig();
    const params = new URLSearchParams({
      client_id: cfg.clientId,
      redirect_uri: cfg.redirectUri,
      response_type: "code",
      scope: cfg.scopes.join(" "),
      state,
      access_type: "offline",
      prompt: "select_account",
    });
    return `${cfg.authUrl}?${params.toString()}`;
  }

  if (provider === "github") {
    const cfg = getGitHubConfig();
    const params = new URLSearchParams({
      client_id: cfg.clientId,
      redirect_uri: cfg.redirectUri,
      scope: cfg.scopes.join(" "),
      state,
      allow_signup: "true",
    });
    return `${cfg.authUrl}?${params.toString()}`;
  }

  throw new Error(`Unknown provider: ${provider}`);
}

// ═══════════════════════════════════════════
// EXCHANGE CODE FOR TOKEN
// ═══════════════════════════════════════════
async function exchangeGoogleCode(code: string): Promise<string> {
  const cfg = getGoogleConfig();

  const res = await fetch(cfg.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      redirect_uri: cfg.redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[OAUTH] Google token exchange failed:", res.status, text);
    throw new Error("Failed to exchange Google authorization code");
  }

  const data = await res.json();
  if (!data.access_token) {
    throw new Error("No access token in Google response");
  }

  return data.access_token;
}

async function exchangeGitHubCode(code: string): Promise<string> {
  const cfg = getGitHubConfig();

  const res = await fetch(cfg.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      code,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      redirect_uri: cfg.redirectUri,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[OAUTH] GitHub token exchange failed:", res.status, text);
    throw new Error("Failed to exchange GitHub authorization code");
  }

  const data = await res.json();
  if (data.error) {
    console.error("[OAUTH] GitHub token error:", data.error_description || data.error);
    throw new Error(data.error_description || "GitHub authentication failed");
  }
  if (!data.access_token) {
    throw new Error("No access token in GitHub response");
  }

  return data.access_token;
}

// ═══════════════════════════════════════════
// FETCH USER PROFILE
// ═══════════════════════════════════════════
async function fetchGoogleProfile(accessToken: string): Promise<OAuthProfile> {
  const cfg = getGoogleConfig();

  const res = await fetch(cfg.userInfoUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error("Failed to fetch Google profile");
  }

  const data = await res.json();

  if (!data.email) {
    throw new Error("No email address associated with this Google account");
  }

  return {
    id: String(data.id),
    email: data.email,
    name: data.name || data.email.split("@")[0],
    avatarUrl: data.picture || undefined,
  };
}

async function fetchGitHubProfile(accessToken: string): Promise<OAuthProfile> {
  const cfg = getGitHubConfig();

  // Fetch user profile
  const userRes = await fetch(cfg.userUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
    },
  });

  if (!userRes.ok) {
    throw new Error("Failed to fetch GitHub profile");
  }

  const userData = await userRes.json();

  // Fetch emails (the profile email may be null if set to private)
  let email = userData.email;

  if (!email) {
    const emailRes = await fetch(cfg.emailsUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
      },
    });

    if (emailRes.ok) {
      const emails: { email: string; primary: boolean; verified: boolean }[] = await emailRes.json();
      // 🔒 FIX (2026-08-18): Pehle unverified email bhi accept hoti thi.
      // Attacker apne GitHub me victim ka email add kar ke (unverified)
      // uski EXISTING account se link ho sakta tha → account takeover.
      // Ab SIRF verified emails use hoti hain.
      const primary = emails.find((e) => e.primary && e.verified);
      const verified = emails.find((e) => e.verified);
      email = primary?.email || verified?.email || null;
    }
  }

  if (!email) {
    throw new Error(
      "No verified email address associated with this GitHub account. Please add and verify an email on GitHub."
    );
  }

  return {
    id: String(userData.id),
    email,
    name: userData.name || userData.login || email.split("@")[0],
    avatarUrl: userData.avatar_url || undefined,
  };
}

// ═══════════════════════════════════════════
// MAIN OAUTH FLOW — exchange code & get profile
// ═══════════════════════════════════════════
export async function exchangeCodeForProfile(
  provider: OAuthProvider,
  code: string
): Promise<OAuthProfile> {
  if (provider === "google") {
    const token = await exchangeGoogleCode(code);
    return fetchGoogleProfile(token);
  }

  if (provider === "github") {
    const token = await exchangeGitHubCode(code);
    return fetchGitHubProfile(token);
  }

  throw new Error(`Unknown provider: ${provider}`);
}
