import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/server";

export const runtime = "nodejs";

// Admin-gated role mutator. We don't use the redirect-based requireAdmin()
// here because this is an API endpoint — we want to return JSON, not a 307.
async function getAdminSession() {
  const session = await getSession();
  if (!session) return { error: "Unauthorized", status: 401 as const, session: null };
  const me = await db.user.findUnique({
    where: { id: session.uid },
    select: { role: true },
  });
  if (!me || me.role !== "admin") {
    return { error: "Forbidden", status: 403 as const, session: null };
  }
  return { error: null, status: 200 as const, session };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await getAdminSession();
  if (!guard.session) return Response.json({ error: guard.error }, { status: guard.status });
  const session = guard.session;

  const { id } = await params;

  let body: { role?: string };
  try { body = await request.json(); } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const next = body.role === "admin" ? "admin" : body.role === "user" ? "user" : null;
  if (next === null) {
    return Response.json({ error: "role must be 'user' or 'admin'" }, { status: 400 });
  }

  // Self-demotion + last-admin guards keep the workspace from getting locked
  // out of /admin entirely.
  if (next === "user") {
    if (id === session.uid) {
      return Response.json({ error: "You cannot demote yourself" }, { status: 400 });
    }
    const target = await db.user.findUnique({ where: { id }, select: { role: true } });
    if (target?.role === "admin") {
      const adminCount = await db.user.count({ where: { role: "admin" } });
      if (adminCount <= 1) {
        return Response.json({ error: "At least one admin must remain" }, { status: 400 });
      }
    }
  }

  await db.user.update({ where: { id }, data: { role: next } });
  return Response.json({ ok: true });
}
