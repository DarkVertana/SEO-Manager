import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/server";

export const runtime = "nodejs";

async function adminGuard() {
  const session = await getSession();
  if (!session) return { error: "Unauthorized", status: 401 as const };
  const me = await db.user.findUnique({ where: { id: session.uid }, select: { role: true } });
  if (!me || me.role !== "admin") return { error: "Forbidden", status: 403 as const };
  return null;
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return Math.max(min, Math.min(max, Math.round(value)));
}

// PATCH: update an existing plan. Body fields are optional; only the
// supplied keys are written.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const guard = await adminGuard();
  if (guard) return Response.json({ error: guard.error }, { status: guard.status });

  const { slug } = await params;

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (typeof body.description === "string") data.description = body.description.trim() || null;
  if (typeof body.monthlyPriceCents === "number")
    data.monthlyPriceCents = clampInt(body.monthlyPriceCents, 0, 1_000_000_00, 0);
  if (typeof body.currency === "string") data.currency = body.currency.toUpperCase().slice(0, 3);
  if (typeof body.auditsPerMonth === "number")
    data.auditsPerMonth = clampInt(body.auditsPerMonth, 0, 1_000_000, 100);
  if (typeof body.rewritesPerMonth === "number")
    data.rewritesPerMonth = clampInt(body.rewritesPerMonth, 0, 1_000_000, 25);
  if (typeof body.storageBytes === "number")
    data.storageBytes = BigInt(clampInt(body.storageBytes, 0, Number.MAX_SAFE_INTEGER, 1_000_000_000));
  if (typeof body.sourcesPerProgrammatic === "number")
    data.sourcesPerProgrammatic = clampInt(body.sourcesPerProgrammatic, 0, 1000, 20);
  if (Array.isArray(body.features))
    data.features = (body.features as unknown[]).filter((f) => typeof f === "string").slice(0, 30);
  if (typeof body.sortOrder === "number") data.sortOrder = clampInt(body.sortOrder, -1000, 1000, 0);
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;
  if (typeof body.isPublic === "boolean") data.isPublic = body.isPublic;

  if (Object.keys(data).length === 0) {
    return Response.json({ error: "Nothing to update" }, { status: 400 });
  }

  const plan = await db.plan.findUnique({ where: { slug }, select: { slug: true } });
  if (!plan) return Response.json({ error: "Not found" }, { status: 404 });

  await db.plan.update({ where: { slug }, data });
  return Response.json({ ok: true });
}

// DELETE: remove a plan. Refuses if any user is currently subscribed to it.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const guard = await adminGuard();
  if (guard) return Response.json({ error: guard.error }, { status: guard.status });

  const { slug } = await params;
  const plan = await db.plan.findUnique({
    where: { slug },
    select: { slug: true, _count: { select: { users: true } } },
  });
  if (!plan) return Response.json({ error: "Not found" }, { status: 404 });
  if (plan._count.users > 0) {
    return Response.json(
      { error: `Cannot delete: ${plan._count.users} user(s) are on this plan. Move them first.` },
      { status: 400 },
    );
  }
  await db.plan.delete({ where: { slug } });
  return Response.json({ ok: true });
}
