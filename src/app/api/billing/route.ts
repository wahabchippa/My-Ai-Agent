// /api/billing — subscription management + credits.
import { NextResponse } from "next/server";
import { db } from "@/db";
import { users, subscriptions, plans, creditTransactions, invoices } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getUser, requireAdmin, logAudit } from "@/lib/accessControl";

export const dynamic = "force-dynamic";

// GET — user's billing info (plan, credits, invoices)
export async function GET(req: Request) {
  const user = await getUser(req);
  if (!user || !db) return NextResponse.json({ error: "Auth required" }, { status: 401 });

  const userPlan = await db.select().from(plans).where(eq(plans.slug, user.plan)).limit(1);
  const sub = await db.select().from(subscriptions)
    .where(eq(subscriptions.userId, user.id)).limit(1);
  const creditHistory = await db.select().from(creditTransactions)
    .where(eq(creditTransactions.userId, user.id)).limit(20);
  const userInvoices = await db.select().from(invoices)
    .where(eq(invoices.userId, user.id)).limit(10);

  return NextResponse.json({
    currentPlan: userPlan[0] || { name: "Free", slug: "free", price: "0" },
    subscription: sub[0] || null,
    credits: user.credits,
    creditHistory,
    invoices: userInvoices,
  });
}

// POST — change plan (simplified — in production this would go through Stripe)
export async function POST(req: Request) {
  const user = await getUser(req);
  if (!user || !db) return NextResponse.json({ error: "Auth required" }, { status: 401 });

  const { action, planSlug } = await req.json();

  if (action === "change_plan" && planSlug) {
    // ── 🔒 PAYMENT GATE ──
    // Pehle koi bhi logged-in user bina payment ke `premium` bana leta
    // tha (credits + paid invoice ke sath). Payment system (Stripe) abhi
    // implement nahi hua — is liye paid plans sirf ADMIN badal sakta hai.
    // Free plan par downgrade sab ke liye allowed hai.
    if (planSlug !== "free" && !requireAdmin(user)) {
      return NextResponse.json(
        { error: "Plan changes are disabled until payments are configured. Contact support." },
        { status: 403 }
      );
    }

    const newPlan = await db.select().from(plans).where(eq(plans.slug, planSlug)).limit(1);
    if (!newPlan.length) return NextResponse.json({ error: "Plan not found" }, { status: 404 });

    // Update user's plan
    await db.update(users).set({ plan: planSlug }).where(eq(users.id, user.id));

    // Create/update subscription record
    const existing = await db.select().from(subscriptions)
      .where(eq(subscriptions.userId, user.id)).limit(1);

    const renewsAt = new Date();
    renewsAt.setMonth(renewsAt.getMonth() + 1);

    if (existing.length) {
      await db.update(subscriptions).set({
        planSlug, status: "active", renewsAt,
      }).where(eq(subscriptions.userId, user.id));
    } else {
      await db.insert(subscriptions).values({
        userId: user.id, planSlug, status: "active", renewsAt,
      });
    }

    // Grant credits based on plan
    const credits = planSlug === "free" ? 50 : planSlug === "pro" ? 500 : 2000;
    await db.update(users).set({ credits }).where(eq(users.id, user.id));

    // Log credit transaction
    await db.insert(creditTransactions).values({
      userId: user.id, amount: credits, type: "plan_grant",
      description: `${newPlan[0].name} plan credits`, balanceAfter: credits,
    });

    // Create invoice
    const invoiceNum = `INV-${Date.now()}`;
    if (newPlan[0].price !== "0") {
      await db.insert(invoices).values({
        userId: user.id, invoiceNumber: invoiceNum,
        amount: newPlan[0].price, tax: "0", total: newPlan[0].price,
        planSlug, status: "paid",
      });
    }

    return NextResponse.json({ ok: true, plan: newPlan[0], credits });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
