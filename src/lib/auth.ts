// ═══════════════════════════════════════════════════════════════════
// NEXORA AUTH LIBRARY — Production-grade authentication
// ═══════════════════════════════════════════════════════════════════

import { db } from "@/db";
import { users, sessions, oauthAccounts, loginAttempts } from "@/db/schema";
import { eq, and, gte, sql, desc } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { randomBytes, createHash } from "crypto";

// ═══════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════
export interface AuthUser {
  id: number;
  email: string;
  name: string | null;
  role: string;
  plan: string;
  status: string;
  credits: number;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  avatarUrl: string | null;
}

export interface SessionInfo {
  id: number;
  deviceInfo: string | null;
  ipAddress: string | null;
  location: string | null;
  lastActiveAt: Date;
  createdAt: Date;
  current: boolean;
}

// ═══════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════
const SALT_ROUNDS = 12;
const SESSION_DURATION_DEFAULT = 24 * 60 * 60 * 1000; // 24 hours
const SESSION_DURATION_REMEMBER = 30 * 24 * 60 * 60 * 1000; // 30 days
const VERIFY_TOKEN_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours
const RESET_TOKEN_EXPIRY = 60 * 60 * 1000; // 1 hour
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_ATTEMPTS_PER_WINDOW = 10;

// Password requirements
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;

// ═══════════════════════════════════════════
// PASSWORD UTILITIES
// ═══════════════════════════════════════════
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.push(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`);
  }
  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain a lowercase letter");
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain an uppercase letter");
  }
  if (!/\d/.test(password)) {
    errors.push("Password must contain a number");
  }
  if (!/[@$!%*?&#^()_+\-=\[\]{}|;:,.<>]/.test(password)) {
    errors.push("Password must contain a special character");
  }
  
  return { valid: errors.length === 0, errors };
}

// ═══════════════════════════════════════════
// TOKEN GENERATION
// ═══════════════════════════════════════════
export function generateToken(length = 32): string {
  return randomBytes(length).toString("hex");
}

export function generateSecureToken(): string {
  return randomBytes(48).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// ═══════════════════════════════════════════
// RATE LIMITING
// ═══════════════════════════════════════════
export async function checkRateLimit(email: string, ip: string): Promise<{ allowed: boolean; retryAfter?: number }> {
  if (!db) return { allowed: true };
  
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW);
  
  const attempts = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(loginAttempts)
    .where(and(
      eq(loginAttempts.ipAddress, ip),
      gte(loginAttempts.createdAt, windowStart)
    ));
  
  const count = attempts[0]?.count || 0;
  
  if (count >= MAX_ATTEMPTS_PER_WINDOW) {
    return { allowed: false, retryAfter: Math.ceil(RATE_LIMIT_WINDOW / 1000) };
  }
  
  return { allowed: true };
}

export async function logLoginAttempt(email: string, ip: string, userAgent: string, success: boolean) {
  if (!db) return;
  
  try {
    await db.insert(loginAttempts).values({
      email: email.toLowerCase(),
      ipAddress: ip,
      userAgent,
      success,
    });
  } catch {}
}

// ═══════════════════════════════════════════
// ACCOUNT LOCKOUT
// ═══════════════════════════════════════════
export async function checkAccountLocked(userId: number): Promise<{ locked: boolean; until?: Date }> {
  if (!db) return { locked: false };
  
  const user = await db.select({ lockedUntil: users.lockedUntil })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  
  if (!user.length || !user[0].lockedUntil) return { locked: false };
  
  if (user[0].lockedUntil > new Date()) {
    return { locked: true, until: user[0].lockedUntil };
  }
  
  // Lockout expired, reset
  await db.update(users)
    .set({ failedLoginAttempts: 0, lockedUntil: null })
    .where(eq(users.id, userId));
  
  return { locked: false };
}

export async function incrementFailedAttempts(userId: number): Promise<boolean> {
  if (!db) return false;
  
  const user = await db.select({ failedLoginAttempts: users.failedLoginAttempts })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  
  const attempts = (user[0]?.failedLoginAttempts || 0) + 1;
  
  if (attempts >= MAX_LOGIN_ATTEMPTS) {
    const lockedUntil = new Date(Date.now() + LOCKOUT_DURATION);
    await db.update(users)
      .set({ failedLoginAttempts: attempts, lockedUntil })
      .where(eq(users.id, userId));
    return true; // Account is now locked
  }
  
  await db.update(users)
    .set({ failedLoginAttempts: attempts })
    .where(eq(users.id, userId));
  
  return false;
}

export async function resetFailedAttempts(userId: number) {
  if (!db) return;
  await db.update(users)
    .set({ failedLoginAttempts: 0, lockedUntil: null })
    .where(eq(users.id, userId));
}

// ═══════════════════════════════════════════
// USER OPERATIONS
// ═══════════════════════════════════════════
export async function createUser(data: {
  email: string;
  password: string;
  name: string;
}): Promise<{ user?: AuthUser; error?: string }> {
  if (!db) return { error: "Database not available" };
  
  const email = data.email.toLowerCase().trim();
  
  // Check if user exists
  const existing = await db.select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  
  if (existing.length > 0) {
    // Don't reveal if account exists - security best practice
    return { error: "Unable to create account. Please try again or use a different email." };
  }
  
  // Validate password
  const validation = validatePassword(data.password);
  if (!validation.valid) {
    return { error: validation.errors[0] };
  }
  
  // Hash password
  const passwordHash = await hashPassword(data.password);
  
  // Generate verification token
  const verifyToken = generateSecureToken();
  const verifyExpires = new Date(Date.now() + VERIFY_TOKEN_EXPIRY);
  
  // Create user — auto-activated (email verification is optional/future)
  const [newUser] = await db.insert(users).values({
    email,
    name: data.name.trim(),
    passwordHash,
    status: "active",
    emailVerified: true,
  }).returning();
  
  return {
    user: {
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      role: newUser.role,
      plan: newUser.plan,
      status: newUser.status,
      credits: newUser.credits,
      emailVerified: newUser.emailVerified,
      twoFactorEnabled: newUser.twoFactorEnabled,
      avatarUrl: newUser.avatarUrl,
    },
  };
}

export async function findUserByEmail(email: string) {
  if (!db) return null;
  
  const rows = await db.select()
    .from(users)
    .where(eq(users.email, email.toLowerCase().trim()))
    .limit(1);
  
  return rows[0] || null;
}

export async function findUserById(id: number) {
  if (!db) return null;
  
  const rows = await db.select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  
  return rows[0] || null;
}

// ═══════════════════════════════════════════
// EMAIL VERIFICATION
// ═══════════════════════════════════════════
export async function verifyEmail(token: string): Promise<{ success: boolean; error?: string }> {
  if (!db) return { success: false, error: "Database not available" };
  
  const hashedToken = hashToken(token);
  
  const user = await db.select()
    .from(users)
    .where(and(
      eq(users.emailVerifyToken, hashedToken),
      gte(users.emailVerifyExpires, new Date())
    ))
    .limit(1);
  
  if (!user.length) {
    return { success: false, error: "Invalid or expired verification link" };
  }
  
  await db.update(users)
    .set({
      emailVerified: true,
      emailVerifyToken: null,
      emailVerifyExpires: null,
      status: "active",
    })
    .where(eq(users.id, user[0].id));
  
  return { success: true };
}

export async function resendVerificationEmail(email: string): Promise<{ success: boolean; error?: string }> {
  if (!db) return { success: false, error: "Database not available" };
  
  const user = await findUserByEmail(email);
  
  // Don't reveal if account exists
  if (!user || user.emailVerified) {
    return { success: true }; // Pretend success for security
  }
  
  const verifyToken = generateSecureToken();
  const verifyExpires = new Date(Date.now() + VERIFY_TOKEN_EXPIRY);
  
  await db.update(users)
    .set({
      emailVerifyToken: hashToken(verifyToken),
      emailVerifyExpires: verifyExpires,
    })
    .where(eq(users.id, user.id));
  
  // TODO: Send verification email
  console.log(`[AUTH] New verification token for ${email}: ${verifyToken}`);
  
  return { success: true };
}

// ═══════════════════════════════════════════
// PASSWORD RESET
// ═══════════════════════════════════════════
export async function requestPasswordReset(email: string): Promise<{ success: boolean }> {
  if (!db) return { success: true }; // Don't reveal DB issues
  
  const user = await findUserByEmail(email);
  
  // Always return success to prevent email enumeration
  if (!user) return { success: true };
  
  const resetToken = generateSecureToken();
  const resetExpires = new Date(Date.now() + RESET_TOKEN_EXPIRY);
  
  await db.update(users)
    .set({
      passwordResetToken: hashToken(resetToken),
      passwordResetExpires: resetExpires,
    })
    .where(eq(users.id, user.id));
  
  // TODO: Send password reset email
  console.log(`[AUTH] Password reset token for ${email}: ${resetToken}`);
  
  return { success: true };
}

export async function resetPassword(token: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
  if (!db) return { success: false, error: "Database not available" };
  
  const validation = validatePassword(newPassword);
  if (!validation.valid) {
    return { success: false, error: validation.errors[0] };
  }
  
  const hashedToken = hashToken(token);
  
  const user = await db.select()
    .from(users)
    .where(and(
      eq(users.passwordResetToken, hashedToken),
      gte(users.passwordResetExpires, new Date())
    ))
    .limit(1);
  
  if (!user.length) {
    return { success: false, error: "Invalid or expired reset link" };
  }
  
  const passwordHash = await hashPassword(newPassword);
  
  await db.update(users)
    .set({
      passwordHash,
      passwordResetToken: null,
      passwordResetExpires: null,
      failedLoginAttempts: 0,
      lockedUntil: null,
    })
    .where(eq(users.id, user[0].id));
  
  // Invalidate all sessions for security
  await db.delete(sessions).where(eq(sessions.userId, user[0].id));
  
  return { success: true };
}

export async function changePassword(userId: number, currentPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
  if (!db) return { success: false, error: "Database not available" };
  
  const user = await findUserById(userId);
  if (!user || !user.passwordHash) {
    return { success: false, error: "Unable to change password" };
  }
  
  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) {
    return { success: false, error: "Current password is incorrect" };
  }
  
  const validation = validatePassword(newPassword);
  if (!validation.valid) {
    return { success: false, error: validation.errors[0] };
  }
  
  const passwordHash = await hashPassword(newPassword);
  
  await db.update(users)
    .set({ passwordHash })
    .where(eq(users.id, userId));
  
  return { success: true };
}

// ═══════════════════════════════════════════
// SESSION MANAGEMENT
// ═══════════════════════════════════════════
export async function createSession(
  userId: number,
  options: {
    rememberMe?: boolean;
    deviceInfo?: string;
    ipAddress?: string;
  } = {}
): Promise<string> {
  if (!db) throw new Error("Database not available");
  
  const token = generateSecureToken();
  const hashedToken = hashToken(token);
  const duration = options.rememberMe ? SESSION_DURATION_REMEMBER : SESSION_DURATION_DEFAULT;
  const expiresAt = new Date(Date.now() + duration);
  
  await db.insert(sessions).values({
    token: hashedToken,
    userId,
    deviceInfo: options.deviceInfo || null,
    ipAddress: options.ipAddress || null,
    rememberMe: options.rememberMe || false,
    expiresAt,
  });
  
  // Update user's last active
  await db.update(users)
    .set({ lastActive: new Date() })
    .where(eq(users.id, userId));
  
  return token;
}

export async function validateSession(token: string): Promise<AuthUser | null> {
  if (!db || !token) return null;
  
  const hashedToken = hashToken(token);
  
  const result = await db
    .select({
      session: sessions,
      user: users,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(
      eq(sessions.token, hashedToken),
      gte(sessions.expiresAt, new Date())
    ))
    .limit(1);
  
  if (!result.length) return null;
  
  const { session, user } = result[0];
  
  // Check if user is active
  if (user.status !== "active" && user.status !== "pending_verification") {
    return null;
  }
  
  // Update last active
  await db.update(sessions)
    .set({ lastActiveAt: new Date() })
    .where(eq(sessions.id, session.id));
  
  await db.update(users)
    .set({ lastActive: new Date() })
    .where(eq(users.id, user.id));
  
  return {
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
  };
}

export async function destroySession(token: string): Promise<void> {
  if (!db || !token) return;
  
  const hashedToken = hashToken(token);
  await db.delete(sessions).where(eq(sessions.token, hashedToken));
}

export async function destroyAllSessions(userId: number, exceptToken?: string): Promise<void> {
  if (!db) return;
  
  if (exceptToken) {
    const hashedToken = hashToken(exceptToken);
    await db.delete(sessions).where(and(
      eq(sessions.userId, userId),
      sql`${sessions.token} != ${hashedToken}`
    ));
  } else {
    await db.delete(sessions).where(eq(sessions.userId, userId));
  }
}

export async function getUserSessions(userId: number, currentToken?: string): Promise<SessionInfo[]> {
  if (!db) return [];
  
  const currentHash = currentToken ? hashToken(currentToken) : null;
  
  const rows = await db.select()
    .from(sessions)
    .where(and(
      eq(sessions.userId, userId),
      gte(sessions.expiresAt, new Date())
    ))
    .orderBy(desc(sessions.lastActiveAt));
  
  return rows.map((s) => ({
    id: s.id,
    deviceInfo: s.deviceInfo,
    ipAddress: s.ipAddress,
    location: s.location,
    lastActiveAt: s.lastActiveAt,
    createdAt: s.createdAt,
    current: currentHash ? s.token === currentHash : false,
  }));
}

export async function revokeSession(userId: number, sessionId: number): Promise<boolean> {
  if (!db) return false;
  
  const result = await db.delete(sessions).where(and(
    eq(sessions.id, sessionId),
    eq(sessions.userId, userId)
  ));
  
  return true;
}

// ═══════════════════════════════════════════
// OAUTH
// ═══════════════════════════════════════════
export async function findOrCreateOAuthUser(
  provider: "google" | "github",
  profile: {
    id: string;
    email: string;
    name: string;
    avatarUrl?: string;
  }
): Promise<{ user: AuthUser; isNew: boolean }> {
  if (!db) throw new Error("Database not available");
  
  const email = profile.email.toLowerCase().trim();
  
  // Check if OAuth account already linked
  const existingOAuth = await db.select()
    .from(oauthAccounts)
    .where(and(
      eq(oauthAccounts.provider, provider),
      eq(oauthAccounts.providerAccountId, profile.id)
    ))
    .limit(1);
  
  if (existingOAuth.length > 0) {
    // Get the linked user
    const user = await findUserById(existingOAuth[0].userId);
    if (!user) throw new Error("User not found");
    
    return {
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
      isNew: false,
    };
  }
  
  // Check if user with this email exists
  const existingUser = await findUserByEmail(email);
  
  if (existingUser) {
    // Link OAuth to existing account
    await db.insert(oauthAccounts).values({
      userId: existingUser.id,
      provider,
      providerAccountId: profile.id,
    });
    
    // Mark email as verified (OAuth provider already verified it)
    if (!existingUser.emailVerified) {
      await db.update(users)
        .set({ emailVerified: true, status: "active" })
        .where(eq(users.id, existingUser.id));
    }
    
    return {
      user: {
        id: existingUser.id,
        email: existingUser.email,
        name: existingUser.name,
        role: existingUser.role,
        plan: existingUser.plan,
        status: "active",
        credits: existingUser.credits,
        emailVerified: true,
        twoFactorEnabled: existingUser.twoFactorEnabled,
        avatarUrl: existingUser.avatarUrl || profile.avatarUrl || null,
      },
      isNew: false,
    };
  }
  
  // Create new user
  const [newUser] = await db.insert(users).values({
    email,
    name: profile.name,
    emailVerified: true,
    status: "active",
    avatarUrl: profile.avatarUrl || null,
  }).returning();
  
  // Link OAuth account
  await db.insert(oauthAccounts).values({
    userId: newUser.id,
    provider,
    providerAccountId: profile.id,
  });
  
  return {
    user: {
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      role: newUser.role,
      plan: newUser.plan,
      status: newUser.status,
      credits: newUser.credits,
      emailVerified: newUser.emailVerified,
      twoFactorEnabled: newUser.twoFactorEnabled,
      avatarUrl: newUser.avatarUrl,
    },
    isNew: true,
  };
}

export async function getLinkedAccounts(userId: number): Promise<{ provider: string; linkedAt: Date }[]> {
  if (!db) return [];
  
  const accounts = await db.select({
    provider: oauthAccounts.provider,
    linkedAt: oauthAccounts.createdAt,
  })
  .from(oauthAccounts)
  .where(eq(oauthAccounts.userId, userId));
  
  return accounts.map((a) => ({
    provider: a.provider,
    linkedAt: a.linkedAt,
  }));
}

export async function unlinkOAuthAccount(userId: number, provider: string): Promise<{ success: boolean; error?: string }> {
  if (!db) return { success: false, error: "Database not available" };
  
  // Check if user has a password set
  const user = await findUserById(userId);
  if (!user) return { success: false, error: "User not found" };
  
  // Count linked accounts
  const accounts = await db.select()
    .from(oauthAccounts)
    .where(eq(oauthAccounts.userId, userId));
  
  // If no password and only one OAuth account, can't unlink
  if (!user.passwordHash && accounts.length <= 1) {
    return { success: false, error: "Cannot unlink the only login method. Set a password first." };
  }
  
  await db.delete(oauthAccounts).where(and(
    eq(oauthAccounts.userId, userId),
    eq(oauthAccounts.provider, provider)
  ));
  
  return { success: true };
}

// ═══════════════════════════════════════════
// AUTH HELPERS
// ═══════════════════════════════════════════
export function getSessionTokenFromRequest(req: Request): string | null {
  // Check cookie first
  const cookie = req.headers.get("cookie");
  const cookieToken = cookie?.match(/nexora_session=([^;]+)/)?.[1];
  if (cookieToken) return cookieToken;
  
  // Check Authorization header
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  
  return null;
}

export function getClientInfo(req: Request): { ip: string; userAgent: string } {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() 
    || req.headers.get("x-real-ip") 
    || "unknown";
  const userAgent = req.headers.get("user-agent") || "unknown";
  
  return { ip, userAgent };
}
