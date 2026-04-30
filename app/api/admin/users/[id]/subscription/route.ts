import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/server";
import type { SubscriptionStatus } from "@/lib/auth/plan";

export const runtime = "nodejs";

const VALID_STATUSES: Set<SubscriptionStatus> = new Set([
  "active",
  "trialing",
  "past_due",
  "canceled",
]);

async function requireAdminJSON() {
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
  const guard = await requireAdminJSON();
  if (!guard.session) return Response.json({ error: guard.error }, { status: guard.status });

  const { id } = await params;
  let body: {
    planSlug?: string;
    status?: string;
    extend?: boolean;
    cancelAtPeriodEnd?: boolean;
  };
  try { body = await request.json(); } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};

  if (typeof body.planSlug === "string") {
    const plan = await db.plan.findUnique({
      where: { slug: body.planSlug },
      select: { slug: true, isActive: true },
    });
    if (!plan) return Response.json({ error: "Unknown plan" }, { status: 400 });
    if (!plan.isActive) return Response.json({ error: "Plan is not active" }, { status: 400 });
    data.planSlug = plan.slug;
    // Reset the period when plan changes — keeps billing dates honest.
    data.currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  }
  if (typeof body.status === "string") {
    if (!VALID_STATUSES.has(body.status as SubscriptionStatus)) {
      return Response.json({ error: "Invalid status" }, { status: 400 });
    }
    data.subscriptionStatus = body.status;
  }
  if (body.extend) {
    data.currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  }
  if (typeof body.cancelAtPeriodEnd === "boolean") {
    data.cancelAtPeriodEnd = body.cancelAtPeriodEnd;
  }

  if (Object.keys(data).length === 0) {
    return Response.json({ error: "Nothing to update" }, { status: 400 });
  }

  await db.user.update({ where: { id }, data });
  return Response.json({ ok: true });
}
