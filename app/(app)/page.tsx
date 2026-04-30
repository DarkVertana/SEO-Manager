import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/server";
import { bytesAsNumber } from "@/lib/auth/plan";
import NewAuditForm from "./NewAuditForm";
import type { PlanCard } from "./UpgradeDialog";

export default async function HomePage() {
  const session = await getSession();
  if (!session) return null;

  // Fetched so the form can open the upgrade dialog inline when an audit
  // request is rejected with 402 (quota exhausted).
  const [me, plansRaw] = await Promise.all([
    db.user.findUnique({
      where: { id: session.uid },
      select: { planSlug: true },
    }),
    db.plan.findMany({
      where: { isActive: true, isPublic: true },
      orderBy: { sortOrder: "asc" },
      select: {
        slug: true,
        name: true,
        description: true,
        monthlyPriceCents: true,
        currency: true,
        auditsPerMonth: true,
        rewritesPerMonth: true,
        storageBytes: true,
        sourcesPerProgrammatic: true,
        features: true,
        sortOrder: true,
      },
    }),
  ]);

  const plans: PlanCard[] = plansRaw.map((p) => ({
    slug: p.slug,
    name: p.name,
    description: p.description,
    monthlyPriceCents: p.monthlyPriceCents,
    currency: p.currency,
    auditsPerMonth: p.auditsPerMonth,
    rewritesPerMonth: p.rewritesPerMonth,
    storageBytes: bytesAsNumber(p.storageBytes),
    sourcesPerProgrammatic: p.sourcesPerProgrammatic,
    features: p.features,
    sortOrder: p.sortOrder,
  }));

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-130px)] w-full max-w-[1400px] flex-col items-center justify-center px-4 py-10 sm:px-6 sm:py-16 lg:px-12">
      <div className="flex w-full max-w-2xl flex-col items-center gap-6 text-center sm:gap-8">
        <span className="swiss-eyebrow text-muted">— SEO / MANAGER</span>
        <h1 className="text-balance text-4xl font-medium leading-[1.05] tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
          Audit any URL.
        </h1>
        <p className="max-w-md text-pretty text-sm leading-relaxed text-muted sm:text-base">
          AI-powered SEO workspace for audits, architecture, and content.
        </p>
        <div className="w-full max-w-xl text-left">
          <NewAuditForm currentPlanSlug={me?.planSlug ?? "starter"} plans={plans} />
        </div>
      </div>
    </div>
  );
}
