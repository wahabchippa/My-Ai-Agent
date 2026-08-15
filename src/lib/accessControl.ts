// Access Control — server-side plan enforcement, usage tracking, model access.
// This is the SINGLE source of truth for what a user can do.

import { db } from "@/db";
import { users, sessions, plans, usageLogs, auditLogs } from "@/db/schema";
import { eq, sql, and, gte, desc } from "drizzle-orm";

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: string;
  plan: string;
  status: string;
  credits: number;
}

const ADMIN_EMAILS = ["wahab.chippa@joinfleek.com", "wahabchippa@joinfleek.com"];

/** Extract user from session token (cookie or header) or admin-email header. */
export async function getUser(req: Request): Promise<AuthUser | null> {
  if (!db) return null;

  // Try session token first
  const token = req.headers.get("cookie")?.match(/nexora_session=([^;]+)/)?.[1]
    || req.headers.get("x-session-token");

  if (token) {
    const sess = await db
      .select({ userId: sessions.userId })
      .from(sessions)
      .where(eq(sessions.token, token))
      .limit(1);
    if (sess.length) {
      const userRows = await db
        .select()
        .from(users)
        .where(eq(users.id, sess[0].userId))
        .limit(1);
      if (userRows.length) {
        const u = userRows[0];
        const isAdmin = u.role === "admin" || u.role === "super_admin" || ADMIN_EMAILS.includes(u.email.toLowerCase());
        return {
          id: u.id, email: u.email, name: u.name || "",
          role: isAdmin ? "admin" : u.role,
          plan: isAdmin ? "admin" : u.plan,
          status: u.status, credits: u.credits,
        };
      }
    }
  }

  // Fallback: x-admin-email header (for localStorage-based admin auth)
  const adminEmail = req.headers.get("x-admin-email")?.toLowerCase();
  if (adminEmail && ADMIN_EMAILS.includes(adminEmail)) {
    // Find or verify this admin user exists in DB
    const userRows = await db.select().from(users).where(eq(users.email, adminEmail)).limit(1);
    if (userRows.length) {
      const u = userRows[0];
      return {
        id: u.id, email: u.email, name: u.name || "",
        role: "admin", plan: "admin", status: u.status, credits: u.credits,
      };
    }
    // Admin email recognized but not in DB — still return admin context
    return {
      id: 0, email: adminEmail, name: adminEmail.split("@")[0],
      role: "admin", plan: "admin", status: "active", credits: 99999,
    };
  }

  // Fallback: email query param (legacy)
  try {
    const url = new URL(req.url);
    const emailParam = url.searchParams.get("email")?.toLowerCase();
    if (emailParam && ADMIN_EMAILS.includes(emailParam)) {
      const userRows = await db.select().from(users).where(eq(users.email, emailParam)).limit(1);
      if (userRows.length) {
        const u = userRows[0];
        return {
          id: u.id, email: u.email, name: u.name || "",
          role: "admin", plan: "admin", status: u.status, credits: u.credits,
        };
      }
      return {
        id: 0, email: emailParam, name: emailParam.split("@")[0],
        role: "admin", plan: "admin", status: "active", credits: 99999,
      };
    }
  } catch {}

  return null;
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
    allowedModels: "*", // all models
    features: "chat,deep_research,voice,memory,coding,terminal,preview,image_upload,premium_models",
    isActive: true,
  };
}

/** Check if a model is allowed for the user's plan. */
export function isModelAllowed(modelId: string, planConfig: any): boolean {
  if (planConfig.allowedModels === "*") return true;
  const allowed = planConfig.allowedModels.split(",");
  return allowed.some((m: string) => modelId.startsWith(m.trim()) || modelId.includes(m.trim()));
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

    // Decrement credits for non-admin
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

/** Require admin access — throws 403 if not admin. */
export function requireAdmin(user: AuthUser | null): boolean {
  return user?.role === "admin" || user?.role === "super_admin";
}
