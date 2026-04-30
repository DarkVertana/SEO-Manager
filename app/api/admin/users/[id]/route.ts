import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/server";
import { hashPassword } from "@/lib/auth/password";
import { isValidEmail, checkPassword } from "@/lib/auth/validation";

export const runtime = "nodejs";

async function adminSession() {
  const session = await getSession();
  if (!session) return { session: null, error: "Unauthorized", status: 401 as const };
  const me = await db.user.findUnique({ where: { id: session.uid }, select: { role: true } });
  if (!me || me.role !== "admin") {
    return { session: null, error: "Forbidden", status: 403 as const };
  }
  return { session, error: null, status: 200 as const };
}

// PATCH — edit name / email / password. Any field is optional; only the
// supplied keys are written.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await adminSession();
  if (!guard.session) return Response.json({ error: guard.error }, { status: guard.status });

  const { id } = await params;
  const target = await db.user.findUnique({ where: { id }, select: { id: true } });
  if (!target) return Response.json({ error: "Not found" }, { status: 404 });

  let body: { name?: string | null; email?: string; password?: string };
  try { body = await request.json(); } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};

  if ("name" in body) {
    const name = typeof body.name === "string" ? body.name.trim() : null;
    if (name && name.length > 80) {
      return Response.json({ error: "Name must be 80 characters or less" }, { status: 400 });
    }
    data.name = name && name.length > 0 ? name : null;
  }

  if (typeof body.email === "string" && body.email.trim()) {
    const email = body.email.trim().toLowerCase();
    if (!isValidEmail(email)) {
      return Response.json({ error: "Please enter a valid email address." }, { status: 400 });
    }
    const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
    if (existing && existing.id !== id) {
      return Response.json({ error: "An account with that email already exists." }, { status: 409 });
    }
    data.email = email;
  }

  if (typeof body.password === "string" && body.password.length > 0) {
    const passwordCheck = checkPassword(body.password);
    if (!passwordCheck.ok) {
      return Response.json({ error: passwordCheck.message }, { status: 400 });
    }
    data.passwordHash = await hashPassword(body.password);
  }

  if (Object.keys(data).length === 0) {
    return Response.json({ error: "Nothing to update" }, { status: 400 });
  }

  await db.user.update({ where: { id }, data });
  return Response.json({ ok: true });
}

// DELETE — destroy a user. Self-delete is forbidden so an admin can't lock
// themselves out. Cascades remove the user's audits + rewrites via the
// existing onDelete: Cascade relations.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await adminSession();
  if (!guard.session) return Response.json({ error: guard.error }, { status: guard.status });

  const { id } = await params;
  if (id === guard.session.uid) {
    return Response.json({ error: "You cannot delete your own account." }, { status: 400 });
  }

  const target = await db.user.findUnique({ where: { id }, select: { id: true, role: true } });
  if (!target) return Response.json({ error: "Not found" }, { status: 404 });

  // Don't allow deleting the last remaining admin.
  if (target.role === "admin") {
    const adminCount = await db.user.count({ where: { role: "admin" } });
    if (adminCount <= 1) {
      return Response.json(
        { error: "At least one admin must remain. Demote first, then delete." },
        { status: 400 },
      );
    }
  }

  await db.user.delete({ where: { id } });
  return Response.json({ ok: true });
}
