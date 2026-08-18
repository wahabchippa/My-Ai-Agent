// /api/admin/users — list all users + stats.
//
// ── SECURITY FIX (2026-08-18) ──
// Pehle admin check sirf `?email=` QUERY PARAM se hota tha, aur emails
// source code me hardcoded thin. Matlab koi bhi (bina login ke) poora
// user directory nikal sakta tha:
//     GET /api/admin/users?email=wahab.chippa@joinfleek.com
// Ab baqi admin routes ki tarah proper session + requireAdmin().

import { NextResponse } from "next/server";
import { db } from "@/db";
import { users, userState } from "@/db/schema";
import { getUser, requireAdmin } from "@/lib/accessControl";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!db) return NextResponse.json({ error: "No DB" }, { status: 500 });

  // Admin check — session se, query param se nahi.
  const user = await getUser(req);
  if (!requireAdmin(user)) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const allUsers = await db
    .select({ id: users.id, email: users.email, name: users.name, createdAt: users.createdAt })
    .from(users);

  const states = await db.select({ userId: userState.userId, data: userState.data }).from(userState);
  const chatCounts = new Map<number, number>();
  for (const s of states) {
    try {
      const parsed = JSON.parse(s.data);
      chatCounts.set(s.userId, parsed.conversations?.length || 0);
    } catch {
      chatCounts.set(s.userId, 0);
    }
  }

  return NextResponse.json({
    totalUsers: allUsers.length,
    totalChats: allUsers.reduce((sum, u) => sum + (chatCounts.get(u.id) || 0), 0),
    users: allUsers.map((u) => ({ ...u, chatCount: chatCounts.get(u.id) || 0 })),
  });
}
