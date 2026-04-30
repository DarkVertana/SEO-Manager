import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/server";
import { PLAN_SLUG_REGEX } from "@/lib/auth/plan";

export const runtime = "nodejs";

async function adminGuard() {
  const session = await getSession();
  if (!session) return { error: "Unauthorized", status: 401 as const };
  const me = await db.user.findUnique({ where: { id: session.uid }, select: { role: true } });
  if (!me || me.role !== "admin") return { error: "Forbidden", status: 403 as const };
  return null;
}

// POST: create a new plan.
export async function POST(request: NextRequest) {
  const guard = await adminGuard();
  if (guard) return Response.json({ error: guard.error }, { status: guard.status });

  let body: {
    slug?: string;
    name?: string;
    description?: string;
    monthlyPriceCents?: number;
    currency?: string;
    auditsPerMonth?: number;
    rewritesPerMonth?: number;
    storageBytes?: number;
    sourcesPerProgrammatic?: number;
    features?: string[];
    sortOrder?: number;
    isActive?: boolean;
    isPublic?: boolean;
  };
  try { body = await request.json(); } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const slug = (body.slug ?? "").trim().toLowerCase();
  const name = (body.name ?? "").trim();
  if (!PLAN_SLUG_REGEX.test(slug)) {
    return Response.json({ error: "Slug must be lowercase letters / digits / hyphens (2-32 chars)" }, { status: 400 });
  }
  if (!name) return Response.json({ error: "Name is required" }, { status: 400 });

  const existing = await db.plan.findUnique({ where: { slug } });
  if (existing) return Response.json({ error: "A plan with that slug already exists" }, { status: 409 });

  const plan = await db.plan.create({
    data: {
      slug,
      name,
      description: body.description?.trim() || null,
      monthlyPriceCents: clampInt(body.monthlyPriceCents, 0, 1_000_000_00, 0),
      currency: (body.currency ?? "USD").toUpperCase().slice(0, 3),
      auditsPerMonth: clampInt(body.auditsPerMonth, 0, 1_000_000, 100),
      rewritesPerMonth: clampInt(body.rewritesPerMonth, 0, 1_000_000, 25),
      storageBytes: BigInt(clampInt(body.storageBytes, 0, Number.MAX_SAFE_INTEGER, 1_000_000_000)),
      sourcesPerProgrammatic: clampInt(body.sourcesPerProgrammatic, 0, 1000, 20),
      features: Array.isArray(body.features) ? body.features.filter((f) => typeof f === "string").slice(0, 30) : [],
      sortOrder: clampInt(body.sortOrder, -1000, 1000, 0),
      isActive: body.isActive !== false,
      isPublic: body.isPublic !== false,
    },
  });

  return Response.json({ slug: plan.slug });
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return Math.max(min, Math.min(max, Math.round(value)));
}
