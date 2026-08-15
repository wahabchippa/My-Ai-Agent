// /api/admin/users — list all users + stats. Admin email passed in body/query.

import { NextResponse } from "next/server";
import { db } from "@/db";
import { users, userState } from "@/db/schema";

export const dynamic = "force-dynamic";

const ADMIN_EMAILS = ["wahab.chippa@joinfleek.com", "wahabchippa@joinfleek.com"];

export async function GET(req: Request) {
  if (!db) return NextResponse.json({ error: "No DB" }, { status: 500 });

  // Check admin via query param (localStorage auth has no server cookie)
  const url = new URL(req.url);
  const email = (url.searchParams.get("email") || "").toLowerCase();
  if (!ADMIN_EMAILS.includes(email))
    return NextResponse.json({ error: "Admin only" }, { status: 403 });

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
    totalChats: result_reduce(allUsers, chatCounts),
    users: allUsers.map((u) => ({ ...u, chatCount: chatCounts.get(u.id) || 0 })),
  });
}

function result_reduce(usersList: any[], counts: Map<number, number>): number {
  return usersList.reduce((sum, u) => sum + (counts.get(u.id) || 0), 0);
}
