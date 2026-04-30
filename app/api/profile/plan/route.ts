import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/server";

export const runtime = "nodejs";

// Self-serve plan switch. Users can move themselves between any plan that's
// flagged isActive + isPublic. Switching resets the billing cycle to a fresh
// 30-day window (no proration — keep this lightweight until real billing
// lands).
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: { planSlug?: string };
  try { body = await request.json(); } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const slug = (body.planSlug ?? "").trim();
  if (!slug) return Response.json({ error: "planSlug is required" }, { status: 400 });

  const plan = await db.plan.findUnique({
    where: { slug },
    select: { slug: true, isActive: true, isPublic: true },
  });
  if (!plan || !plan.isActive || !plan.isPublic) {
    return Response.json({ error: "Plan unavailable" }, { status: 400 });
  }

  await db.user.update({
    where: { id: session.uid },
    data: {
      planSlug: plan.slug,
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      cancelAtPeriodEnd: false,
      subscriptionStatus: "active",
    },
  });

  return Response.json({ ok: true });
}
