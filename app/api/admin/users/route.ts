import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/server";
import { hashPassword } from "@/lib/auth/password";
import { isValidEmail, checkPassword } from "@/lib/auth/validation";

export const runtime = "nodejs";

async function adminGuard() {
  const session = await getSession();
  if (!session) return { error: "Unauthorized", status: 401 as const };
  const me = await db.user.findUnique({ where: { id: session.uid }, select: { role: true } });
  if (!me || me.role !== "admin") return { error: "Forbidden", status: 403 as const };
  return null;
}

// POST /api/admin/users — create a new user from the admin panel.
export async function POST(request: NextRequest) {
  const guard = await adminGuard();
  if (guard) return Response.json({ error: guard.error }, { status: guard.status });

  let body: {
    email?: string;
    password?: string;
    name?: string;
    role?: string;
    planSlug?: string;
  };
  try { body = await request.json(); } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  const name = body.name?.trim() || null;
  const role = body.role === "admin" ? "admin" : "user";
  const planSlug = (body.planSlug ?? "starter").trim();

  if (!email || !isValidEmail(email)) {
    return Response.json({ error: "Please enter a valid email address." }, { status: 400 });
  }
  const passwordCheck = checkPassword(password);
  if (!passwordCheck.ok) {
    return Response.json({ error: passwordCheck.message }, { status: 400 });
  }

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return Response.json({ error: "An account with that email already exists." }, { status: 409 });
  }

  // Validate plan exists and is active.
  const plan = await db.plan.findUnique({
    where: { slug: planSlug },
    select: { slug: true, isActive: true },
  });
  if (!plan || !plan.isActive) {
    return Response.json({ error: "Selected plan is not available." }, { status: 400 });
  }

  const passwordHash = await hashPassword(password);
  const user = await db.user.create({
    data: {
      email,
      passwordHash,
      name,
      role,
      planSlug: plan.slug,
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
    select: { id: true, email: true },
  });

  return Response.json({ id: user.id, email: user.email });
}
