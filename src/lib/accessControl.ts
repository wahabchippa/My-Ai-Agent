// Access Control — server-side plan enforcement, usage tracking, model access.
// This is the SINGLE source of truth for what a user can do.

import { db } from "@/db";
import { users, sessions, plans, usageLogs, auditLogs } from "@/db/schema";
import { eq, sql, and, gte } from "drizzle-orm";
import { createHash } from "crypto";

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: string;
  plan: string;
  status: string;
  credits: number;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Extract authenticated user from the request session cookie.
 *  Admin status is determined ONLY from database role, never from email or headers. */
export async function getUser(req: Request): Promise<AuthUser | null> {
  if (!db) return null;

  // Extract session token from cookie or Authorization header
  const token = req.headers.get("cookie")?.match(/nexora_session=([^;]+)/)?.[1]
    || req.headers.get("x-session-token")
    || req.headers.get("authorization")?.replace("Bearer ", "");

  if (!token) return null;

  // Hash the token — sessions store hashed tokens
  const hashed = hashToken(token);

  const rows = await db
    .select()
    .from(sessions)
    .where(and(
      eq(sessions.token, hashed),
      gte(sessions.expiresAt, new Date())
    ))
    .limit(1);

  if (!rows.length) return null;

  const userRows = await db
    .select()
    .from(users)
    .where(eq(users.id, rows[0].userId))
    .limit(1);

  if (!userRows.length) return null;

  const u = userRows[0];

  if (u.status !== "active") return null;

  // Role comes from the database — never from client headers
  const isAdmin = u.role === "admin" || u.role === "super_admin";

  return {
    id: u.id,
    email: u.email,
    name: u.name || "",
    role: u.role,
    plan: isAdmin ? "admin" : u.plan,
    status: u.status,
    credits: u.credits,
  };
}

/** Get the plan configuration for a user. */
export async function getPlanConfig(user: AuthUser) {
  if (!db) return getDefaultPlan();
  if (user.plan === "admin") return getAdminPlan();

  const planRows = await db.select().from(plans).where(eq(plans.slug, user.plan)).limit(1);
  if (planRows.length && planRows[0].isActive) return planRows[0];
  return getDefaultPlan();
}

function getDefaultPlan() {
  return {
    name: "Free",
    slug: "free",
    price: "0",
    messageLimit: 100,
    agentLimit: 2,
    researchLimit: 5,
    projectLimit: 1,
    allowedModels: "groq-llama,llm7-gemini,pollinations,bl-deepseek",
    features: "chat,basic_search,voice,memory",
    isActive: true,
  };
}

function getAdminPlan() {
  return {
    name: "Admin",
    slug: "admin",
    price: "0",
    messageLimit: 999999,
    agentLimit: 20,
    researchLimit: 999,
    projectLimit: 999,
    allowedModels: "*",
    features: "chat,deep_research,voice,memory,coding,terminal,preview,image_upload,premium_models",
    isActive: true,
  };
}

/** Check if a model is allowed for the user's plan. */
export function isModelAllowed(modelId: string, planConfig: any): boolean {
  if (planConfig.allowedModels === "*") return true;
  const allowed = planConfig.allowedModels.split(",");
  // 🔒 FIX: Pehle `includes()` tha — "gpt-oss-120b" ki list "gpt-oss-1"
  // wale entry ko bhi match kara deti thi (substring collisions).
  // Ab exact / prefix-with-separator match hota hai.
  return allowed.some((m: string) => {
    const mm = m.trim();
    if (!mm) return false;
    return (
      modelId === mm ||
      modelId.startsWith(mm + ":") ||
      modelId.startsWith(mm + "-") ||
      modelId.startsWith(mm + "/")
    );
  });
}

/** Check usage limits for the current month. */
export async function checkUsageLimit(user: AuthUser, planConfig: any): Promise<{ allowed: boolean; used: number; limit: number }> {
  if (!db || user.plan === "admin") return { allowed: true, used: 0, limit: 999999 };

  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(usageLogs)
    .where(and(
      eq(usageLogs.userId, user.id),
      sql`${usageLogs.createdAt} >= date_trunc('month', now())`,
      eq(usageLogs.success, true),
    ));

  const used = result[0]?.count || 0;
  const limit = planConfig.messageLimit || 100;
  return { allowed: used < limit, used, limit };
}

/** Log an AI request for usage tracking. */
export async function logUsage(opts: {
  userId: number;
  type: string;
  model?: string;
  agentsUsed?: string;
  tokensIn?: number;
  tokensOut?: number;
  estimatedCost?: string;
  mode?: string;
  success?: boolean;
}) {
  if (!db) return;
  try {
    await db.insert(usageLogs).values({
      userId: opts.userId,
      type: opts.type,
      model: opts.model || null,
      agentsUsed: opts.agentsUsed || null,
      tokensIn: opts.tokensIn || 0,
      tokensOut: opts.tokensOut || 0,
      estimatedCost: opts.estimatedCost || "0",
      mode: opts.mode || "balanced",
      success: opts.success ?? true,
    });

    if (opts.userId > 0) {
      await db.update(users)
        .set({ credits: sql`GREATEST(credits - 1, 0)`, lastActive: new Date() })
        .where(eq(users.id, opts.userId));
    }
  } catch {}
}

/** Log an admin action for audit trail. */
export async function logAudit(adminId: number, action: string, targetId?: number, targetEmail?: string, details?: string) {
  if (!db) return;
  try {
    await db.insert(auditLogs).values({ adminId, action, targetId, targetEmail, details });
  } catch {}
}

/** Require admin access. */
export function requireAdmin(user: AuthUser | null): boolean {
  return user?.role === "admin" || user?.role === "super_admin";
}
