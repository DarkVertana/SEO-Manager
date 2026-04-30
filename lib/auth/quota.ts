// Per-user quota gates for audit + rewrite endpoints. The check looks at:
//   1. subscription status — canceled / past_due users can't run anything
//   2. month-to-date usage vs the plan's per-month limit (auditsPerMonth /
//      rewritesPerMonth on the joined Plan row)
// Returns 402 (Payment Required) on quota failures so clients can distinguish
// "you ran out" from "the request was malformed" (400) or "you're not signed
// in" (401).

import { db } from "@/lib/db";

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export type QuotaResult =
  | { ok: true }
  | { ok: false; reason: string; status: number; used?: number; limit?: number };

function statusBlock(
  status: "active" | "trialing" | "past_due" | "canceled",
): QuotaResult | null {
  if (status === "canceled") {
    return {
      ok: false,
      reason: "Your subscription is canceled. Reactivate it to keep running.",
      status: 402,
    };
  }
  if (status === "past_due") {
    return {
      ok: false,
      reason: "Your subscription is past due. Update billing to continue.",
      status: 402,
    };
  }
  return null;
}

export async function checkAuditQuota(userId: string): Promise<QuotaResult> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      subscriptionStatus: true,
      plan: { select: { auditsPerMonth: true, name: true } },
    },
  });
  if (!user) return { ok: false, reason: "Account not found", status: 404 };

  const blocked = statusBlock(user.subscriptionStatus);
  if (blocked) return blocked;

  const monthStart = startOfMonth(new Date());
  const used = await db.seoAnalysis.count({
    where: { userId, createdAt: { gte: monthStart } },
  });
  const limit = user.plan.auditsPerMonth;
  if (used >= limit) {
    return {
      ok: false,
      reason: `Monthly audit limit reached (${used}/${limit} on the ${user.plan.name} plan). Upgrade or wait for the next cycle.`,
      status: 402,
      used,
      limit,
    };
  }
  return { ok: true };
}

export async function checkRewriteQuota(userId: string): Promise<QuotaResult> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      subscriptionStatus: true,
      plan: { select: { rewritesPerMonth: true, name: true } },
    },
  });
  if (!user) return { ok: false, reason: "Account not found", status: 404 };

  const blocked = statusBlock(user.subscriptionStatus);
  if (blocked) return blocked;

  const monthStart = startOfMonth(new Date());
  const used = await db.rewritePage.count({
    where: { userId, createdAt: { gte: monthStart } },
  });
  const limit = user.plan.rewritesPerMonth;
  if (used >= limit) {
    return {
      ok: false,
      reason: `Monthly rewrite limit reached (${used}/${limit} on the ${user.plan.name} plan). Upgrade or wait for the next cycle.`,
      status: 402,
      used,
      limit,
    };
  }
  return { ok: true };
}
